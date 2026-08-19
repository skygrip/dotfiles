[← Back to Universal Prompt Builder Hub](SKILL.md) | [Go to Krea 2 Generation Playbook →](krea2.md)

# ComfyUI-Krea2Edit & Identity-Preserving Image Editing Playbook

This playbook provides a complete technical guide to instruction-based image editing, identity-preserving character restaging, attribute modification, object removal, and two-reference scene composition using **`comfyui-krea2edit`** (by `lbouaraba` / `conradlocke`) and the **Krea 2 Identity Edit LoRA** (`krea2_identity_edit_v1_2.safetensors`).

---

## 1. Technical Architecture & Dual Conditioning Pipeline

`comfyui-krea2edit` turns Krea 2 (RAW or Turbo) into an instruction-based editor using **Dual In-Context Conditioning**, matching the exact training geometry of the `krea2edit-trainer`:

```
                                  ┌──────────────────────────────┐
  Source Image ──────────────────►│ Krea2EditGroundedEncode      ├──► KSampler.positive
         │                        │ (Qwen3-VL Vision-Language)   │    (Instruction + Visual Semantics)
         │                        └──────────────────────────────┘
         │                                       ▲
         │                                [Edit Instruction]
         ▼
  ┌──────────────┐                ┌──────────────────────────────┐
  │ VAEEncode    ├───────────────►│ Krea2EditModelPatch          ├──► KSampler.model
  │ (Pixel/Latent)                │ (3D-RoPE In-Context Tokens)  │    (In-Context Visual Anchor)
  └──────────────┘                └──────────────────────────────┘
```

### A. Appearance Path: In-Context DiT Patching & 3D RoPE Positioning
`Krea2EditModelPatch` intercepts Krea 2's `SingleStreamDiT` forward pass, concatenating clean source latents into the sequence via 3D Rotary Position Embeddings (3D-RoPE):
* **Frame Index Allocations:**
  * **Text tokens:** Frame $(0, 0, 0)$.
  * **Source Reference 1 (Scene / Primary):** Frame **1** $(1, y, x)$.
  * **Source Reference 2 (Subject / Person):** Frame **2** $(2, y, x)$.
  * **Target Latent:** Frame **0** $(0, y, x)$.
* **`fit` Mode Geometry (v1.2+ Fractional Centering):** Resamples source images onto the exact $/16$ latent patch grid, eliminating coordinate skip and seam artifacts when source and target aspect ratios differ.
* **Reference Attention Fidelity Dial (`ref_boost`):**
  * **`ref_boost: 4.0`** (recommended for subject reference) strongly locks facial identity and fine features.
  * **`ref_boost: 0.9`** loosens self-attention anchor to allow seamless object removal.
  * `ref_boost_mask`: Restricts the attention boost specifically to a masked face or garment.

### B. Semantic Grounding Path: Qwen3-VL Vision-Language Encoding
`Krea2EditGroundedEncode` feeds the instruction prompt and the downscaled source image(s) into **Qwen3-VL (4B)**:
* **`grounding_px` Quality Dial (default `768`):**
  * **`1024`**: Maximizes facial identity and fine likeness retention (optimal for portraits).
  * **`512`**: Loosens grounding for stubborn, heavy environment/background replacements.

### C. Pixel Path & VRAM Pre-Encoding (`target_latent`)
* When using `vae` + `source_image`, wire `target_latent` (the empty latent feeding `KSampler.latent_image`) to prime the resolution cache and prevent offloading model weights to CPU during sampling.

---

## 2. Model Selection, CFG & Sampling Matrix

| Edit Operation | Engine Base | Steps | CFG Scale | Sampler | Mechanical Rules & Wiring |
|---|---|---|---|---|---|
| **1. Attribute / Garment / Recolor / Restyle** | K2 Turbo | 8–12 | **CFG 1.0** | `euler` (simple) | Fast path (~1 min at 2MP). Empty prompt negative (inert at CFG 1.0). |
| **2. Salient Object / Subject Deletion** | **K2 RAW** | **20–25** | **CFG 3.0** | `euler` (simple) | **CRITICAL:** Turbo at CFG 1 re-renders subject! Must use RAW at CFG 3.0 with grounded empty negative (`""`). |
| **3. Two-Input Composition (Person into Scene)** | K2 RAW or Turbo | 12–25 | CFG 1.0–3.0 | `euler` (simple) | Place both references simultaneously (Scene $\rightarrow$ main inputs, Person $\rightarrow$ `_b` inputs). |
| **4. Environment / Lighting Restage & Relight** | **K2 RAW** | **22–28** | **CFG 2.5** | `euler` (simple) | Replaces entire backdrop and restyles ambient light while preserving character posture and identity. |

> ⚠️ **Sampler Warning:** Always use **`euler` (ODE)** with the `simple` scheduler at **denoise `1.0`**. Avoid SDE samplers like `er_sde`, which degrade reference coherence in edit pipelines.

---

## 3. Strict Prompting & Formatting Syntax for Krea2Edit & Ostris Edit

### 1. ComfyUI Node Architecture Comparison: Krea2Edit vs. Ostris Edit

| Feature / Dial | `comfyui-krea2edit` (`lbouaraba`) | `ComfyUI-Krea2-Ostris-Edit` (`ostris`) |
|---|---|---|
| **Core Nodes** | `Krea2EditModelPatch` + `Krea2EditGroundedEncode` | `Krea 2 Ostris Edit Model Patch` + `Text Encode Krea 2 Ostris Edit` |
| **LoRA Architecture** | `krea2_identity_edit_v1_2.safetensors` (trained with `krea2edit-trainer`) | AI-Toolkit Krea 2 Edit LoRAs (`edit: true`) |
| **Reference Image Slots** | Up to 2 inputs: `image` (Scene/Frame 1) & `image_b` (Person/Frame 2) | Up to 3 inputs: `image1`, `image2`, `image3` |
| **Grounding Resolution** | `grounding_px`: 384–1024 (Quality dial; 1024 for faces) | Fixed 384x384 downsampling for text encoder |
| **Fidelity Dial** | `ref_boost` (e.g. `4.0` for subject face lock) | Governed by LoRA weight (@1.0) and CFG scale |
| **Prompt Reference Syntax** | `"the subject"`, `"image A"` / `"image B"` or `"Image 1"` / `"Image 2"` | `image1`, `image2`, `image3` (e.g., `"Replace the shirt in image1 with the jacket in image2"`) |

---

### 2. Instruction-Based Natural Language Syntax
Both node packs are trained on direct, active transformation orders rather than static text-to-image descriptions. Always specify **what to change, what to preserve, and the optical result**:

$$\text{Edit Prompt} = [\text{Target Action Verb}] + [\text{Specific Subject/Region Anchor}] + [\text{New Tactile/Physical Property}] + [\text{Lighting \& Optics Consistency}]$$

* ❌ **WRONG (Generative Prompt):** `"a photo of a man in a red jacket standing in a modern kitchen"`
* ✅ **RIGHT (Instruction Prompt):** `"Change the man's charcoal wool overcoat into a dark crimson corduroy jacket with visible ribbing and horn buttons. Preserve his facial expression, hair, and the 2700K tungsten workshop lighting."`

---

### 3. Image Reference Syntax Rules (`Image1` vs. `Image2`)
* **1-Based Indexing Only:** Always use `Image 1`, `Image 2`, `Image 3` or `Image A`, `Image B`. Never use `Image0` (which is unrecognized by VLM token parsers).
* **Slot-to-Concept Binding:** When using multiple references, explicitly assign the visual roles:
  * *Two-Image Composition (Person + Scene):* `"Place the subject from image2 into the library scene from image1..."`
  * *Texture/Outfit Transfer:* `"Replace the jacket on the person in image1 with the leather jacket from image2. Preserve the facial identity and lighting from image1."`
* **Negative Reference Disambiguation:** When pulling a subject from a reference image, explicitly instruct the model to ignore that image's background:
  * `"Extract only the character from image2; do not retain the background or lighting from image2."`

---

### 4. Resolution & Spatial Rules
* **Generate at $\le 2\text{MP}$:** Recommended resolutions: $1024 \times 1024$ (1:1), $832 \times 1216$ (4:5 vertical), $1216 \times 832$ (16:9 widescreen). Keep multi-person compositions $\le 1.5\text{MP}$.
* **Spatial Disambiguation:** Use clear positional anchors (`"the coffee cup in his right hand"`, `"the background wall behind the left shoulder"`).

---

## 4. Production-Ready Examples

### Example 1: Precision Wardrobe & Tactile Fabric Swap (K2 Turbo Fast Path)

**📝 Edit Instruction Prompt (Copy-Paste Ready)**
```text
Change the subject's casual grey cotton hoodie into a heavy olive-drab waxed-canvas artisan apron with distressed brass rivets, cross-back chestnut bridle leather straps, and double-needle pocket stitching over a cream waffle-knit thermal shirt. Preserve his facial bone structure, trimmed beard, dark curly hair, and the warm 3200K tungsten workshop lighting streaming from the left. Seamlessly integrate tactile canvas creasing, natural fabric drape, and realistic contact shadows across the chest and waist.
```

**🚫 Negative Prompt**
```text
(Leave blank — negative conditioning is bypassed at CFG 1.0 on K2 Turbo)
```

**🎛 Model & Node Parameters**
| Parameter | Selection | Rationale |
|---|---|---|
| **Target Engine** | Krea 2 Turbo + `krea2_identity_edit_v1_2` LoRA (@1.0) | Rapid single-pass garment replacement with strict identity retention |
| **Sampler / Steps / CFG** | `euler` (simple), 10 steps, **CFG 1.0** | Distilled fast-path configuration avoiding over-sharpening |
| **Node Dials** | `fit_mode: fit`, `grounding_px: 1024`, `ref_boost: 4.0` | Maximum VLM grounding and RoPE attention bias to lock facial and hair likeness |
| **Resolution** | 4:5 Vertical ($832 \times 1216$, matching source) | Maintains native aspect ratio and latent patch grid alignment without scaling distortion |

**🔄 Iteration Pathway**
```text
1. Garment Restyle: Change the waxed-canvas apron into a chunky charcoal cable-knit merino wool cardigan with polished dark horn toggles.
2. Hardware Modification: Replace the distressed brass rivets with matte black forged iron grommets and heavy industrial snap closures.
3. Lighting Shift: Shift the workshop illumination from 3200K warm tungsten to crisp 5400K overcast daylight entering through a side window.
```

---

### Example 2: Salient Object Removal & Seamless Inpainting (K2 RAW Guided Path)

**📝 Edit Instruction Prompt (Copy-Paste Ready)**
```text
Completely remove the modern clear plastic water bottle and black smartphone resting on the antique oak study desk beside the open atlas. In their place, seamlessly inpaint continuous polished dark oak wood grain with natural amber varnish highlights, authentic surface patina, and the unoccluded deckled parchment edges of the open atlas. Maintain consistent warm 2800K brass desk lamp illumination, casting natural soft-edged contact shadows across the restored desktop and paper margins.
```

**🚫 Negative Prompt**
```text
(Empty prompt via second Krea2EditGroundedEncode node)
```

**🎛 Model & Node Parameters**
| Parameter | Selection | Rationale |
|---|---|---|
| **Target Engine** | Krea 2 RAW + `krea2_identity_edit_v1_2` LoRA (@1.0) | RAW engine base at CFG 3.0 provides genuine classifier-free guidance required to cleanly erase salient objects |
| **Sampler / Steps / CFG** | `euler` (simple), 22 steps, **CFG 3.0** | Sufficient step density to resolve new wood grain and paper fibers without ghosting artifacts |
| **Node Dials** | `fit_mode: fit`, `grounding_px: 768`, `ref_boost: 0.9` | Lowering ref_boost to 0.9 loosens self-attention anchor enough to heal substrate without re-drawing removed items |
| **Negative Conditioning** | Second `Krea2EditGroundedEncode` with **empty prompt (`""`)** and same image | Provides necessary unconditional reference distribution for CFG trajectory |

**🔄 Iteration Pathway**
```text
1. Period Prop Addition: Place an antique brass magnifying glass with a turned ebony handle onto the restored oak desk beside the atlas.
2. Lighting Shift: Shift the 2800K brass lamp beam to cast longer, dramatic amber shadows stretching diagonally across the map pages.
3. Surface Texture Shift: Add subtle historical wear, such as faint archival ink droplets and fine micro-scratches, across the reclaimed oak varnish.
```

---

### Example 3: Multi-Reference Character-into-Scene Composition (Dual-Image / Ostris & Krea2Edit)

**📝 Edit Instruction Prompt (Copy-Paste Ready)**
```text
Place the subject from reference image2 into the ancient sunlit Victorian greenhouse from reference image1. Extract only the subject from image2, preserving their facial bone structure, hairstyle, and khaki canvas botanist field wardrobe; do not retain the background or original lighting from image2. Inherit the vaulted ironwork glass architecture, terracotta planters, and lush tropical ferns directly from image1. The subject stands in a natural three-quarter posture along the central aisle, resting their left hand upon the ornate wrought-iron planter table. Relight the subject seamlessly with the warm 5500K sunlight streaming through the conservatory glass panes, casting realistic contact shadows onto the flagstone floor and matching the f/2.8 optical depth of field with soft bokeh across the background foliage.
```

**🚫 Negative Prompt**
```text
(Empty prompt via second Krea2EditGroundedEncode node with both image1 and image2 connected)
```

**🎛 Model & Node Parameters**
| Parameter | Selection | Rationale |
|---|---|---|
| **Target Engine** | Krea 2 RAW + `krea2_identity_edit_v1_2` LoRA (@1.0) | RAW base enables clean subject-to-environment integration without hallucinating artifacts |
| **Inputs Wiring** | Scene Image (`image1`) → `source_latent` / `image`<br>Person Image (`image2`) → `source_latent_b` / `image_b` | Dual in-context conditioning via 3D-RoPE Frame 1 (Scene) and Frame 2 (Subject) |
| **Sampler / Steps / CFG** | `euler` (simple), 20 steps, **CFG 2.5** | Provides sufficient classifier-free guidance to blend cross-image illumination |
| **Node Dials** | `fit_mode: fit`, `grounding_px: 1024`, `ref_boost: 4.0` (Subject / `image2`), `ref_boost_a: 1.0` (Scene / `image1`) | High-resolution grounding (1024px) and 4.0 logit boost preserve subject facial likeness |
| **Negative Conditioning** | Second `Krea2EditGroundedEncode` with **empty prompt (`""`)** and both source images | Serves as the unguided visual baseline for classifier-free subtraction |

**🔄 Iteration Pathway**
```text
1. Interaction Shift: Pose the botanist holding a brass pocket magnifying loupe up to inspect an exotic blooming orchid on the planter table.
2. Atmosphere Shift: Introduce fine morning mist particles catching the sunbeams drifting near the high glass cupola.
3. Wardrobe Shift: Add a weathered leather field satchel with brass buckles slung across the botanist's right shoulder.
```

---

### Example 4: Environmental Restyling & Complex Relighting (Overcast Park to Sunset Cabin Veranda)

**📝 Edit Instruction Prompt (Copy-Paste Ready)**
```text
Restyle the background and environmental lighting around the seated subject from the overcast city park into a rustic cedar cabin veranda overlooking autumn mountains at sunset. Replace the flat daylight with low-angle golden hour sunlight and a warm 2600K brass lantern glow, casting directional amber specular rim highlights across the subject's hair, cheekbones, and jacket contours. Scatter softly drifting golden maple leaves across the cedar plank floor and render gentle background bokeh. Strictly preserve the subject's facial likeness, seated posture, eye gaze, and clothing silhouette.
```

**🚫 Negative Prompt**
```text
(Empty prompt via second Krea2EditGroundedEncode node)
```

**🎛 Model & Node Parameters**
| Parameter | Selection | Rationale |
|---|---|---|
| **Target Engine** | Krea 2 RAW + `krea2_identity_edit_v1_2` LoRA (@1.0) | RAW base at CFG 2.5 enables total background replacement while maintaining facial likeness |
| **Sampler / Steps / CFG** | `euler` (simple), 24 steps, **CFG 2.5** | Balanced guidance for structural scene restyling and light ray integration without latent artifacts |
| **Node Dials** | `fit_mode: fit`, `grounding_px: 768`, `ref_boost: 3.5` | Grounding at 768px allows background overhaul while ref_boost 3.5 firmly preserves facial features |
| **Negative Conditioning** | Second `Krea2EditGroundedEncode` with **empty prompt (`""`)** and source portrait | Anchors unconditional generation to source reference |

**🔄 Iteration Pathway**
```text
1. Foliage Shift: Increase the density of falling amber maple leaves swirling in a gentle mountain breeze around the porch railings.
2. Atmosphere Shift: Add soft evening valley fog rolling between the background pine trees with cool 5000K twilight contrast.
3. Lantern Accent Shift: Intensify the 2600K lantern glow to cast deeper contact shadows beneath the veranda chair and along the cedar floorboards.
```

