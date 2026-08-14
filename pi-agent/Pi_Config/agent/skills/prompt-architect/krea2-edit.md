[← Back to Universal Prompt Architect Hub](SKILL.md) | [Go to Krea 2 Generation Playbook →](krea2.md)

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
`Krea2EditModelPatch` intercepts Krea 2's `SingleStreamDiT` forward pass, concatenating the clean source latents directly into the sequence:

$$\text{Sequence} = [\text{context (text)} \mid \text{source\_imgs (clean refs)} \mid \text{tgt\_img (noisy target)}]$$

* **3D Rotary Position Embeddings (3D-RoPE):**
  * **Text tokens:** Assigned frame index $(0, 0, 0)$.
  * **Source reference 1 (Scene / Primary):** Assigned RoPE **Frame 1** $(1, y, x)$.
  * **Source reference 2 (Subject / Person):** Assigned RoPE **Frame 2** $(2, y, x)$.
  * **Target latent:** Assigned RoPE **Frame 0** $(0, y, x)$.
* **`fit` Mode Geometry (v1.2+ Fractional Centering):**
  Resamples the source image onto the exact $/16$ latent patch grid at scale $sc = \min(px\_h/ih, px\_w/iw)$, eliminating coordinate skip and seam artifacts when source and target aspect ratios differ.
* **Reference Attention Fidelity Dial (`ref_boost`):**
  Applies an additive logit bias to the self-attention mechanism:
  $$\text{bias}[:, :, \text{rows0}:, \text{cols}] = \ln(\max(\text{ref\_boost}, 10^{-4}))$$
  * Recommended: **`ref_boost: 4.0`** (for the subject reference in v1.2) to strongly lock facial identity.
  * `ref_boost_mask`: Downsamples a pixel-space mask via area interpolation to restrict the attention logit boost specifically to the face or garment.

### B. Semantic Grounding Path: Qwen3-VL Vision-Language Encoding
`Krea2EditGroundedEncode` feeds the instruction prompt and the downscaled source image(s) into **Qwen3-VL (4B)** via an image-grounded ChatML template:
```text
<|im_start|>system
Describe the image by detailing the color, shape, size, texture, quantity, text, spatial relationships of the objects and background:<|im_end|>
<|im_start|>user
<|vision_start|><|image_pad|><|vision_end|>{prompt}<|im_end|>
<|im_start|>assistant
```
* **`grounding_px` Quality Dial (default `768`):**
  * **`1024`**: Maximizes facial identity and fine likeness retention (optimal for portraits).
  * **`512`**: Loosens grounding for stubborn, heavy environment/background replacements.

### C. Pixel Path & VRAM Pre-Encoding (`target_latent`)
* When using `vae` + `source_image`, wire `target_latent` (the same empty latent feeding `KSampler.latent_image`).
* This primes the resolution cache during node execution, preventing mid-sampling VAE encode calls that force ComfyUI to offload model weights to CPU.

---

## 2. Model Selection, CFG & Sampling Matrix

```
┌───────────────────────────┬─────────────┬───────────┬──────────────┬──────────────┬────────────────────────────────────────────────────────┐
│ Edit Operation            │ Engine Base │ Steps     │ CFG Scale    │ Sampler      │ Mechanical Rules & Wiring                              │
├───────────────────────────┼─────────────┼───────────┼──────────────┼──────────────┼────────────────────────────────────────────────────────┤
│ 1. Attribute / Garment /  │ K2 Turbo    │ 8–12      │ **CFG 1.0**  │ `euler`      │ Fast path (~1 min at 2MP). Empty prompt negative.      │
│    Recolor / Restyle      │             │           │              │ (simple)     │ Negative prompt is inert at CFG 1.0.                   │
├───────────────────────────┼─────────────┼───────────┼──────────────┼──────────────┼────────────────────────────────────────────────────────┤
│ 2. Salient Object /       │ **K2 RAW**  │ **20–25** │ **CFG 3.0**  │ `euler`      │ **CRITICAL:** Turbo at CFG 1 will re-render subject!   │
│    Subject Deletion       │             │           │              │ (simple)     │ Must use RAW at CFG 3.0 with grounded empty negative.  │
├───────────────────────────┼─────────────┼───────────┼──────────────┼──────────────┼────────────────────────────────────────────────────────┤
│ 3. Two-Input Composition  │ K2 RAW or   │ 12–25     │ CFG 1.0–3.0  │ `euler`      │ Place both references simultaneously in one pass       │
│    (Person into Scene)    │ Turbo       │           │              │ (simple)     │ (Scene $\rightarrow$ main inputs, Person $\rightarrow$ `_b` inputs).   │
└───────────────────────────┴─────────────┴───────────┴──────────────┴──────────────┴────────────────────────────────────────────────────────┘
```

> ⚠️ **Sampler Warning:** Always use **`euler` (ODE)** with the `simple` scheduler at **denoise `1.0`**. Avoid SDE samplers like `er_sde`, which degrade reference coherence in edit pipelines.

---

## 3. Strict Prompting & Formatting Syntax for Krea2Edit

### 1. Instruction-Based Natural Language Syntax
`comfyui-krea2edit` is trained on direct, active transformation instructions. Never use generic image generation descriptions. Tell the model **what to change, what to preserve, and the optical result**:

$$\text{Edit Prompt} = [\text{Target Action Verb}] + [\text{Specific Subject/Region Anchor}] + [\text{New Tactile/Physical Property}] + [\text{Lighting & Optics Consistency}]$$

* ❌ **WRONG (Generative Prompt):** `"a photo of a man in a red jacket standing in a modern kitchen"`
* ✅ **RIGHT (Instruction Prompt):** `"Change the man's charcoal wool overcoat into a dark crimson corduroy jacket with visible ribbing and horn buttons. Preserve his facial expression, hair, and the 2700K tungsten workshop lighting."`

### 2. Resolution & Spatial Rules
* **Generate at $\le 2\text{MP}$:** Recommended resolutions: $1024 \times 1024$ (1:1), $832 \times 1216$ (4:5 vertical), $1216 \times 832$ (16:9 widescreen). Keep two-person compositions $\le 1.5\text{MP}$.
* **Spatial Disambiguation:** Use clear positional anchors (`"the coffee cup in his right hand"`, `"the background wall behind the left shoulder"`).

---

## 4. Production-Ready Worked Editing Packages

### Package 1: Precision Garment & Wardrobe Swap (K2 Turbo Fast Path)

**🎛 Model & Node Parameters**
| Parameter | Selection | Rationale |
|---|---|---|
| **Target Engine** | Krea 2 Turbo + `krea2_identity_edit_v1_2` LoRA (@1.0) | High-speed attribute transformation with strong face lock |
| **Sampler / Steps / CFG** | `euler` (simple), 10 steps, **CFG 1.0** | Optimal single-pass distillation range |
| **Node Dials** | `fit_mode: fit`, `grounding_px: 1024`, `ref_boost: 4.0` | 1024px grounding + ref_boost 4.0 ensures maximum face likeness |
| **Resolution** | 4:5 Vertical ($832 \times 1216$, matching source) | Prevents out-of-distribution geometry artifacts |

**🚫 Negative Prompt**
```text
(Leave blank — negative conditioning is bypassed at CFG 1.0 on K2 Turbo)
```

**📝 Edit Instruction Prompt (Copy-Paste Ready)**
```text
Change the subject's beige cardigan into a tailored charcoal herringbone tweed blazer with structured lapels and visible woven texture. Tightly crease the fabric along the elbow joints. Preserve her facial identity, half-updo dark hairstyle, delicate crescent eye expression, and the 2800K golden-hour sunlight streaming through the conservatory window.
```

**🔄 Iteration Pathway**
```text
1. Fabric Shift: Change the blazer to a dark navy denim work jacket with brass rivets and contrast copper stitching.
2. Color Temperature Shift: Adjust the lighting instruction to shift sunlight from 2800K golden hour to 5600K cool overcast daylight.
3. Accessory Addition: Add a delicate silver pendant necklace resting against her collarbone.
```

---

### Package 2: Salient Object Removal (K2 RAW Guided Path)

**🎛 Model & Node Parameters**
| Parameter | Selection | Rationale |
|---|---|---|
| **Target Engine** | Krea 2 Large / RAW + `krea2_identity_edit_v1_2` LoRA (@1.0) | RAW model at CFG 3.0 is mandatory for clean object deletion |
| **Sampler / Steps / CFG** | `euler` (simple), 22 steps, **CFG 3.0** | Real classifier-free guidance allows the model to erase salient objects |
| **Node Dials** | `fit_mode: fit`, `grounding_px: 768`, `ref_boost: 0.9` | Lowering ref_boost slightly allows the removed area to heal seamlessly |
| **Negative Conditioning**| Second `Krea2EditGroundedEncode` with **empty prompt (`""`)** and same image | Trained unconditional reference |

**🚫 Negative Prompt**
```text
(Empty prompt via second Krea2EditGroundedEncode node)
```

**📝 Edit Instruction Prompt (Copy-Paste Ready)**
```text
Remove the modern smartwatch from the subject's left wrist completely. In its place, render bare skin with natural wrist tendon lines, subtle radial artery relief, and fine vellus hair. Seamlessly extend the frayed linen shirt cuff and match the warm 2700K tungsten illumination across the arm.
```

**🔄 Iteration Pathway**
```text
1. Replacement Shift: Instead of bare skin, replace the smartwatch with an antique Swiss mechanical watch on a worn brown leather strap.
2. Shadow Shift: Deepen the contact shadow beneath the wrist against the dark oak workbench.
3. Sleeve Shift: Roll the linen sleeve upward by 5 centimeters to expose the mid-forearm.
```

---

### Package 3: Two-Reference Person-Into-Scene Composition

**🎛 Model & Node Parameters**
| Parameter | Selection | Rationale |
|---|---|---|
| **Target Engine** | Krea 2 Large / RAW + `krea2_identity_edit_v1_2` LoRA (@1.0) | Blends character identity with complex architectural scene lighting |
| **Inputs Wiring** | Scene Image $\rightarrow$ `source_latent` / `image`<br>Person Image $\rightarrow$ `source_latent_b` / `image_b` | Simultaneous two-frame in-context placement |
| **Sampler / Steps / CFG** | `euler` (simple), 20 steps, **CFG 2.5** | Balanced guidance for mutual lighting integration |
| **Node Dials** | `ref_boost: 4.0` (Subject Person), `ref_boost_a: 1.0` (Scene), `grounding_px: 1024` | Prioritizes character facial fidelity inside new scene |

**🚫 Negative Prompt**
```text
(Empty prompt via second Krea2EditGroundedEncode node with both images connected)
```

**📝 Edit Instruction Prompt (Copy-Paste Ready)**
```text
Place the person from reference image B into the vintage library scene from reference image A. The person stands in seated contrapposto beside the dark mahogany reading table, resting one hand upon an open leather-bound volume. Harmonize their skin tone and clothing with the library's warm 2700K brass lamp chiaroscuro and 6000K window backlight. Match the shallow 85mm f/1.4 depth of field so the background bookshelves dissolve into soft circular bokeh.
```

**🔄 Iteration Pathway**
```text
1. Pose Shift: Change the person's pose to standing upright while reaching for a book on the upper mahogany shelf.
2. Interaction Shift: The person holds an antique brass magnifying glass over the open book page.
3. Atmospheric Shift: Introduce volumetric dust motes drifting through the 6000K window light beam around the person.
```
