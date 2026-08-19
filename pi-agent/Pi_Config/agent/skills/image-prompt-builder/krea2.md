[← Back to Universal Prompt Builder Hub](SKILL.md) | [Go to Krea 2 Edit & Inpainting Playbook →](krea2-edit.md)

# Krea 2 (K2) Advanced Prompting & Optical Steering Playbook

Krea 2 is a **Single-Stream MMDiT (Diffusion Transformer) with Rectified Flow-Matching (RF-DiT)** conditioned on a **Qwen3-VL** multimodal text encoder. It utilizes cross-layer feature aggregation (`txtfusion`) to blend 12 discrete hidden layers `[L2, L5, L8, L11, L14, L17, L20, L23, L26, L29, L32, L35]` coarse-to-fine.

---

## 1. Technical Architecture & Text Encoder Mechanics

### 4 Functional Layer Bands in Krea 2
Ground-truth layer analysis reveals that the 12 tapped hidden layers form **4 functional bands of 3 layers each ($3 \times 4$)**:

| Band | Layers / Taps | Functional Role |
|---|---|---|
| **Band 1: Shallow Scaffolding** | `L2, L5, L8` (`w0–w2`) | Lexical anchoring & token noise (unusable alone; renders as noise). |
| **Band 2: Structure & Layout** | `L11, L14, L17` (`w3–w5`) | Structural geometry, vanishing points, scene layout, and glyphs (`L14`). |
| **Band 3: Global Attention Hub** | `L20, L23, L26` (`w6–w8`) | Volumetric lighting, color transitions; `L20` is universal attention hub. |
| **Band 4: Deep Content & FACS** | `L29, L32, L35` (`w9–w11`) | Carries semantic detail: FACS micro-expressions, irises, and skin pores. |

> **Why Rebalancing Works:** Krea 2's learned `txtfusion.projector` is contrastive ("mid-minus-deep"), which naturally suppresses deep layers `L23–L32` to balance encoder norm growth ($48\times$). Rebalancing with RMS normalization re-inflates the deep Band 4 layers, restoring facial expression nuance and skin micro-pores without image degradation.

---

## 2. Model Variants & Parameter Matrix

| Variant | Step Range | CFG Scale | Primary Characteristics |
|---|---|---|---|
| **1. Krea 2 RAW** | 25–40 steps | CFG 3.0–5.0 | Maximum fidelity, rich micro-textures, full dynamic range and lighting nuance. |
| **2. Krea 2 Turbo** | 8–12 steps | CFG 1.0 | Distilled ultra-fast flow-matching. Negative prompts are inert. |

### 🚫 Negative Prompt Policy & Natural Language Steering
- **Never use traditional negative prompt fields on Krea 2.**
- **Natural Language Steering (Qwen3-VL):** Because Krea 2 uses a multimodal VLM text encoder, it parses instructions as full natural language sentences rather than SD1.5-style bag-of-words token weights.
- **Negative Weights (NegPiP):** Syntax like `(word:-2.0)` is only active if an attention-inversion custom node (like `ComfyUI-krea2-negpip`) is installed. In standard native Krea 2, **use direct natural language phrasing** to suppress concepts (e.g. *"bare face without glasses"*, *"wide environmental framing showing the full body"*).
- **Positive Emphasis Band:** In standard nodes, keep emphasis weights moderate (between `1.1` and `1.5`, e.g. `(cinematic lighting:1.2)`). Excessive weights cause color burn and pixel degradation.

---

## 3. Strict Prompting & Formatting Syntax Rules

### The 8-Block Canonical Prompt Sequence
To maximize Qwen3-VL token-attention efficiency, structure all natural language prompts in this exact 8-block sequence:

```
[1. LENS & SHOT GEOMETRY] ──► [2. LIGHTING & ATMOSPHERE] ──► [3. SUBJECT ANCHOR] ──► [4. ENVIRONMENT & SURFACES]
                                                                                             │
[8. COLOR & FILM GRAIN]   ◄── [7. BIOMECHANICAL POSE]    ◄── [6. SECONDARY MOTION] ◄── [5. FACS MICRO-EXPRESSION]
```

1. **Lens & Shot Geometry:** Focal length, aperture, angle, framing (*"85mm f/1.4 portrait prime lens, eye-level framing"*).
2. **Lighting Physics in Kelvin:** Key light, fill, shadow falloff (*"2700K warm tungsten reading lamp casting high-contrast chiaroscuro"*).
3. **Subject Anchor & Wardrobe:** Tangible textures (*"weary intelligence officer in a structured charcoal woolen coat"*).
4. **Environment & Surface Textures:** Physical boundaries (*"dimly lit vintage train carriage interior with mahogany paneling"*).
5. **FACS Micro-Expressions:** Muscle and ocular mechanics (*"head tilted 10° down, lower eyelids tightened in suspicion (AU7)"*).
6. **Secondary Physics:** Hair and cloth aerodynamics (*"loose strands of copper hair resting across her temple"*).
7. **Biomechanical Pose & Tactile Grip:** Asymmetry and weight (*"seated contrapposto, resting chin upon curled knuckles"*). Knuckles belong to hands/fingers; soles, heels, and arches belong to feet.
8. **Color Grading & Film Stock:** Grain and palette (*"35mm film still with unretouched skin micro-pores"*).

> 💡 **Signage vs. Kelvin Disambiguation:** When prompting neon signs or storefronts, describe the light temperature separately from the sign (e.g. write *"warm amber neon signage casting 3000K illumination across the scene"* rather than *"a 3000K neon sign"*) to prevent diffusion text encoders from rendering numeric numbers like `"3000K"` as literal text on the sign.

---

## 4. Emotional Context & FACS Micro-Facial Guidance in Krea 2

Because Krea 2 uses a multimodal **Qwen3-VL** encoder, it responds directly to natural language descriptions of **FACS Action Units** (e.g. `AU1+AU4 inner brow pinch`, `AU7 lower eyelid tension`, `AU31 jaw clench`) without needing booru tags.
- For the full universal micro-expression taxonomy and natural language body vocabulary, see [**`SKILL.md` §1: Emotional Context & FACS Micro-Facial Mechanics**](SKILL.md#1-emotional-context--facs-micro-facial-mechanics).

### Krea 2 Specific Facial & Optical Rules:
1. **Ocular Mechanics & Catchlights:** Always define the light source reflection within the cornea (*"a single 3200K tungsten pin-light reflects in the upper crescent of her dark iris"*).
2. **Natural Asymmetry:** State subtle facial asymmetry (*"left eyebrow lifts slightly higher than right"*, *"unilateral smirk pulls the right corner of her mouth"*).
3. **Skin Micro-Textures:** Emphasize unretouched physical texture (*"matte unglazed skin texture with visible micro-pores, fine vellus hair along jawline, no smoothing"*). To maximize pore and expression fidelity, use the **Portrait & Micro-Emotion KGW preset** (boosting Band 4: `w9–w11`).

---

## 5. Kinetic Posing, Tactile Actions & Optical Staging in Krea 2

Krea 2 excels at continuous physical prose describing spatial relationships, weight transfer, and tactile grip mechanics without stiff mannequin artifacts.
- For the universal 3-plane optical depth staging framework, DoF matrix, contrapposto rules, and tactile interaction blueprints, see [**`SKILL.md` §2–§4**](SKILL.md#2-kinetic-posing-mechanics--anti-stiffness).

### Krea 2 Specific Staging Schema:
* **The "Core Four" Biomechanical Flow:** When constructing prose for Block 7 of the 8-block sequence, weave together:
  1. `silhouette` (*broad asymmetric triangular silhouette*)
  2. `weight_distribution` (*80% bodyweight planted on right heel in deep contrapposto*)
  3. `torso_orientation` (*hips angled 45° camera-left with shoulders twisted back toward lens*)
  4. `movement_quality` (*secondary coat and hair billowing*)
* **Layer Boost for Complex Anatomy:** When generating extreme acrobatic poses or complex hand grips, use the **Kinetic Pose & Anatomy Lock KGW preset** (boosting Bands 1 & 2: `w0–w5`).

---

## 6. Native Multimodal Image Prompting (Qwen3-VL Vision Tower)

Unlike legacy diffusion architectures where the text encoder only processes strings of text tokens, **Krea 2 natively supports image prompting directly inside the CLIP/Text conditioning pipeline** via its integrated **Qwen3-VL-4B** vision-language encoder (`type: krea2`).

```
                                      ┌─────────────────────────────────────┐
  Reference Image ───────────────────►│ Qwen3-VL Vision Tower (ViT)         │
                                      │ Encodes <|vision_start|> image tokens│
                                      └──────────────────┬──────────────────┘
                                                         ▼
  Text Prompt ───────────────────────► [Joint Multimodal ChatML Embedding] ──► KSampler.positive
                                       (12 Layer Taps: L2 to L35)
```

### The Native Multi-Image Template & `Picture N:` Syntax
In Krea 2's native conditioning template, reference images are ingested as structured vision blocks:
```text
<|im_start|>system
Describe the image by detailing the color, shape, size, texture, quantity, text, spatial relationships of the objects and background:<|im_end|>
<|im_start|>user
Picture 1: <|vision_start|><|image_pad|><|vision_end|>
Picture 2: <|vision_start|><|image_pad|><|vision_end|>
{prompt}<|im_end|>
<|im_start|>assistant
```
When prompting with multiple images, **explicitly refer to `Picture 1` and `Picture 2` in your prompt** for exact 1:1 cross-modal token binding (e.g. *"The person in Picture 1 wears the armor from Picture 2 inside a rain-soaked forest"*).

---

### The 4 Core Modes of Native Image Prompting

#### Mode A: Style, Lighting & Medium Reference (SREF)
Transfers color palette, Kelvin lighting ratios, lens optics, and rendering medium from the reference image without cloning the original subject:
```text
In the exact visual style, 2700K tungsten chiaroscuro lighting, and 35mm film grain of Picture 1: a vintage automobile mechanic in a canvas jumpsuit leans over an open engine bay, holding a steel wrench.
```

#### Mode B: Character & Facial Likeness Lock (CREF)
Preserves facial bone structure, eye shape, and identity from the reference image while restaging the subject into completely new poses, wardrobe, and environments:
```text
Subject is the exact person from Picture 1, preserving facial bone structure, dark eyes, and jawline. The subject wears an orange alpine storm suit and climbing harness, leaning into a dynamic sprint across snow.
```

#### Mode C: Compositional & Spatial Staging Mimicry
Adopts the exact framing geometry, Dutch tilt angle, and 3-plane depth separation of the reference image while populating new subjects:
```text
Matching the low-angle upward camera angle, high-speed shutter freeze, and 3-plane optical depth staging of Picture 1: an eagle takes flight from a mountain ledge.
```

#### Mode D: Multi-Angle Character Sheet Reference (360° Volumetric Lock)
Passes a **character turnaround / model sheet** (displaying front, 3/4, profile, back views, and expression close-ups on a neutral background) as `Picture 1`. This primes Qwen3-VL with 360-degree volumetric understanding of the character's bone structure, hairstyle volume, and costume details from any angle:
* **The Anti-Collage Prompting Rule:** Because the reference image is a multi-panel grid, naive prompts risk generating another multi-panel turnaround. You **must explicitly command a single unified scene** via natural language:
```text
Picture 1 is a character turnaround reference sheet. Render a single unified cinematic composition depicting this exact character in a dynamic seated contrapposto pose inside a dimly lit vintage library. The character holds an open leather-bound book with right hand, gazing 15 degrees off-camera in quiet contemplation (AU1+AU2). 2700K warm brass lamp key light with 7500K window shadow fill. 85mm f/1.4 lens with shallow depth of field. Style: 35mm film still with visible skin micro-pores. Do not render a turnaround, model sheet, split panel, or multiple views.
```

---

### Core Operational Rules for Image Prompting

1. **Resolution Sizing (`grounding_px`):**
   * **`1024px`** for facial likeness & character sheets (CREF / Mode B & D).
   * **`512px`** for broad style & color palette transfer (SREF / Mode A).
2. **Preventing Visual Bleed (Explicit Unbinding):**
   * If a reference image contains something you want changed (e.g. glasses or clothing color), explicitly state the replacement (e.g. *"render bare face without glasses"*).
3. **The Anti-Collage Rule (for Character Sheets):**
   * When passing multi-panel turnaround sheets, explicitly state:  
     *"Render a single unified composition. Do not render a turnaround, model sheet, split panel, or multiple views."*
4. **Canvas Limit with Image Prompts:**
   * Keep generations $\le 2\text{MP}$ ($1024 \times 1024$, $832 \times 1216$) to prevent subject duplication.

---

## 7. KGW Rebalance Presets (ComfyUI / Diffusion Nodes)

### The 5 Core Presets (Code-Verified)

#### 1. ⚖️ Balanced (Universal Production Default)
* **Best For:** General all-purpose production across photo, illustration, and diverse concepts without likeness drift.
* **Multiplier:** `1.0` (with RMS Renormalize: `True`)
* **Layer Vector:** `1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 2.5, 5.0, 1.1, 4.0, 1.0`

#### 2. 👤 Portrait & Micro-Emotion
* **Best For:** Close-up character portraits, facial FACS Action Units, corneal catchlights, iris texture, and skin micro-pores (boosts Band 4: `w9–w11`).
* **Multiplier:** `1.0` (with RMS Renormalize: `True`)
* **Layer Vector:** `1.8, 1.8, 1.8, 1.8, 2.0, 2.0, 2.5, 4.5, 1.2, 3.5, 1.0, 1.0`

#### 3. 🏋️ Kinetic Pose & Anatomy Lock
* **Best For:** Complex multi-limb poses, acrobatic actions, hand interactions, and perspective geometry (boosts Bands 1 & 2: `w0–w5`).
* **Multiplier:** `1.0` (with RMS Renormalize: `True`)
* **Layer Vector:** `2.5, 2.5, 2.5, 2.5, 1.5, 1.5, 1.5, 1.5, 1.0, 1.0, 1.0, 1.0`

#### 4. 🎬 Cinematic Lighting & Atmosphere
* **Best For:** Volumetric light shafts, dramatic chiaroscuro, neon night scenes, anamorphic flares, and color grading (boosts Band 3: `w6–w8`).
* **Multiplier:** `1.0` (with RMS Renormalize: `True`)
* **Layer Vector:** `1.0, 1.0, 1.0, 1.0, 2.5, 3.5, 4.0, 4.0, 3.5, 4.5, 5.0, 4.0`

#### 5. ⚡ Dual-Anchor Hybrid (Action + Emotion)
* **Best For:** High-intensity scenes demanding simultaneous complex kinetic action/poses AND deep micro-facial emotion (combines Bands 1/2 with Band 4).
* **Multiplier:** `1.0` (with RMS Renormalize: `True`)
* **Layer Vector:** `2.4, 2.4, 2.2, 2.0, 1.6, 1.8, 2.2, 3.8, 1.4, 3.8, 1.2, 1.0`

---

## 8. Production-Ready Examples

### Example 1: Master Watchmaker (Tactile Craft & Micro-Assembly)
* **Configuration:** Krea 2 RAW | **Aspect Ratio:** `4:5` (Vertical Portrait) | **Preset:** 👤 Portrait & Micro-Emotion
* **per_layer_weights:** `1.8, 1.8, 1.8, 1.8, 2.0, 2.0, 2.5, 4.5, 1.2, 3.5, 1.0, 1.0` (Multiplier: `1.0`, RMS Renormalize: `True`)

**📝 Primary Positive Prompt:**
```text
85mm f/1.8 macro lens with shallow depth of field. A 2700K tungsten lamp casts warm raking light over a wooden workbench. An elderly watchmaker wears a canvas apron and a monocle loupe. Tiny brass escapement gears and ruby bearings rest across the oak table. His inner brow pinches tight (AU1+AU4) as his lower eyelids narrow (AU7). Loose gray hair brushes his temple. He leans forward in seated contrapposto. His fingertips squeeze precision tweezers and seat a gear against spring resistance. Foreground: blurred steel screwdrivers. Background: soft circular bokeh discs. 35mm film still with natural skin texture.
```

**🔄 Iteration Pathway:**
1. Lighting Shift: Switch to 5500K daylight. Cool morning light filters through a workshop window and casts soft diffuse shadows across the workbench.
2. Perspective Shift: Lower the camera to tabletop macro level. Align the lens flush with the tweezers as the escapement tooth locks into the ruby pallet jewel.
3. Interaction Shift: The watchmaker rotates the loupe away from his eye. He exhales softly and inspects the spinning balance wheel.

---

### Example 2: High-Torque Kinetic Action (Equestrian Showjumper)
* **Configuration:** Krea 2 RAW | **Aspect Ratio:** `16:9` (Cinematic Widescreen) | **Preset:** ⚡ Dual-Anchor Hybrid (Action + Emotion)
* **per_layer_weights:** `2.4, 2.4, 2.2, 2.0, 1.6, 1.8, 2.2, 3.8, 1.4, 3.8, 1.2, 1.0` (Multiplier: `1.0`, RMS Renormalize: `True`)

**📝 Primary Positive Prompt:**
```text
70-200mm f/2.8 telephoto lens with a 1/2000s shutter. Direct 5500K midday sunlight rakes the turf and casts sharp contact shadows. An equestrian rider in a navy jacket guides a bay warmblood over a timber water hurdle. She furrows her brow (AU4) and clenches her jaw (AU31) with a direct forward gaze. Water droplets and turf clumps freeze in mid-air. She folds into a bent-knee contrapposto; gloved hands grip taut leather reins as the horse tucks its forelegs over the rail. Foreground: out-of-focus water spray. Background: arena grandstands dissolve into creamy circular bokeh. Unretouched 35mm sports film still.
```

**🔄 Iteration Pathway:**
1. Lighting Shift: Shift lighting to 3200K low-angle golden hour sunlight. Warm directional light casts long amber shadows across the water obstacle.
2. Perspective Shift: Drop the camera to a low ground-level angle beneath the timber rail. Frame the horse's tucked hooves directly against the sky.
3. Interaction Shift: The rider turns her head 15 degrees toward the next course turn. Her left hand eases rein tension while her heels press the horse's flank.

---

### Example 3: Atmospheric Environmental Adventure (Alpine Summit Botanist)
* **Configuration:** Krea 2 RAW | **Aspect Ratio:** `16:9` (Cinematic Widescreen) | **Preset:** 🎬 Cinematic Lighting & Atmosphere
* **per_layer_weights:** `1.0, 1.0, 1.0, 1.0, 2.5, 3.5, 4.0, 4.0, 3.5, 4.5, 5.0, 4.0` (Multiplier: `1.0`, RMS Renormalize: `True`)

**📝 Primary Positive Prompt:**
```text
35mm f/2.8 lens with cinematic depth. Warm 5200K dawn light rays cut through cool mountain mist. A botanist in a weathered canvas jacket kneels on a high mountain summit ridge. Deep contact shadows anchor her boots to damp rock. Her inner eyebrows arch in gentle wonder (AU1+AU2) as a soft smile curves her cheeks (AU12). Morning breeze ruffles her dark hair. Her left fingertips steady a brass magnifying lens over rare flora while her right hand presses an open field journal. Foreground: dew-covered alpine petals. Background: jagged granite peaks dissolve into soft haze. 35mm film still.
```

**🔄 Iteration Pathway:**
1. Lighting Shift: Shift the sun angle to 6000K overcast morning. Diffuse light flattens harsh rock highlights and deepens mist opacity across the valley.
2. Perspective Shift: Drop the camera to ground level. Frame the alpine blossoms in sharp foreground focus while the botanist kneels softly in the midground.
3. Interaction Shift: Subject sketches a botanical specimen into the journal with a graphite pencil. Her gaze focuses downward onto the page.

---

### Example 4: Architectural Modern Portrait (Structural Blueprint Review)
* **Configuration:** Krea 2 RAW | **Aspect Ratio:** `4:5` (Vertical Portrait) | **Preset:** 👤 Portrait & Micro-Emotion
* **per_layer_weights:** `1.8, 1.8, 1.8, 1.8, 2.0, 2.0, 2.5, 4.5, 1.2, 3.5, 1.0, 1.0` (Multiplier: `1.0`, RMS Renormalize: `True`)

**📝 Primary Positive Prompt:**
```text
85mm f/1.4 portrait lens with shallow depth of field. Diffuse 5000K overcast daylight filters through paned glass as a 2800K warm brass desk lamp illuminates the workspace. An architect in a charcoal turtleneck reviews structural blueprints across an oak drafting table. Her inner brows pinch in analytical focus (AU1+AU4) and lower eyelids tighten (AU7). Foreground: out-of-focus rain streaks on the window frame the edge. Her left palm presses flat against the heavy paper while curled right fingers grip a matte black technical pen. Background: geometric pavilion beams dissolve into soft circular bokeh discs. 35mm film still with natural skin texture.
```

**🔄 Iteration Pathway:**
1. Lighting Shift: Switch to 3000K late afternoon golden hour. Warm sunlight rakes across the drafting table and casts long diagonal shadows over the blueprints.
2. Perspective Shift: Lower the camera to tabletop level. Frame the technical pen and curled fingers in sharp close-up while the architect's focused eyes soften in the background.
3. Interaction Shift: The architect lifts the brass ruler with her left hand and aligns the metal edge against a blueprint grid line.
