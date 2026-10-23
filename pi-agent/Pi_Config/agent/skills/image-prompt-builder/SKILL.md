---
name: image-prompt-builder
description: Construct high-grade prompts and optical staging across AI image engines including Krea 2 (RAW/Turbo/Edit), ANIMA (Anime/LoRA), Flux, SDXL, and Midjourney.
---

# Universal AI Image Prompt Builder

A high-density directive for translating visual concepts into production-grade generation prompts across modern foundation models (Krea 2 RAW/Turbo/Edit, CircleStone Labs ANIMA, FLUX.1 Dev/Schnell, SD 3.5, and Midjourney v6). Enforces physical photonics, FACS micro-facial mechanics, Kelvin color science, 3-plane optical staging, kinetic contrapposto, and engine-specific conditioning architectures.

---

## 1. Quality Guardrails & Engine Modifiers

| Engine / Modality | Target Concept & Styling | Conditioning Paradigm & Architecture |
| :--- | :--- | :--- |
| **Krea 2 RAW / FLUX.1 Dev** | Photorealism, Cinematic Stills | 8-Block Natural Language Prose (Qwen3-VL / T5-XXL Relational Clauses). |
| **CircleStone Labs ANIMA** | 2D Anime, Key Animation, Cel | Danbooru Tag Prefix followed by Kinetic Narrative Prose. |
| **Krea 2 Turbo / FLUX Schnell** | Fast Iteration (CFG 1.0) | Positive-Only Natural Prose (Negative prompt ignored by distilled models). |
| **Krea 2 Edit** | Regional Inpainting, Image Edits | Dual In-Context 3D-RoPE Binding (`krea2_identity_edit_v1_2.safetensors`). |
| **Midjourney v6.1** | Commercial, Stylized Imagery | Natural Language with parameters (`--style raw --v 6.1 --ar 16:9`). |

### Universal Quality Guardrails & Vocabulary Rules

* **Banned Quality Buzzwords:** Never use empty quality qualifiers such as photorealistic, hyperrealistic, 8k, 4k, UHD, masterpiece (except anime tag prefixes), trending on artstation, smooth skin, airbrushed, or award-winning. Direct token budget toward physical dermal features and Kelvin lighting.
* **Adult Age & Demographic Anchoring:** All human subjects must be explicitly grounded as adults aged 21 or older (e.g., 24-year-old, 38-year-old). State age and ethnicity immediately in the subject description to anchor facial latent tensors before secondary attributes are parsed.
* **Semantic Economy:** Do not describe attributes inherent to the concept by definition (e.g., a wooden pier already implies planks and water; a business suit already implies lapels). Spend word budget on high-entropy deltas: lighting angles, optical depth, and fabric wear.
* **Anti-Split-Screen Protocol:** Avoid terms like split screen, two panels, or diptych when depicting multiple characters. Place all actors in a shared continuous environment, describing Actor A's attributes fully before introducing Actor B.

### Aspect Ratio & Latent Dimension Matrix

Always specify native bucket dimensions for Diffusion Transformers to prevent limb cloning or distortion:

| Aspect Ratio | Standard Resolution | Native Latent Dimensions | Primary Production Use Case |
| :--- | :--- | :--- | :--- |
| **`1:1`** | **`1024 × 1024`** | Square (1.05 MP) | Centered close-up portraits, square icons. |
| **`4:5`** | **`896 × 1152`** | Vertical Portrait | Editorial photography, character sheets. |
| **`3:4`** | **`896 × 1216`** | Vertical Standard | Full-body portraits, comic panels. |
| **`2:3`** | **`832 × 1248`** | Vertical Classic | 35mm portrait stills, poster prints. |
| **`16:9`** | **`1344 × 768`** | Widescreen Cinematic | Film stills, 1080p/4K display backgrounds. |
| **`21:9`** | **`1536 × 640`** | Ultrawide Anamorphic | Anamorphic cinema aspect, panoramic concepts. |

Consult [`references/krea2.md`](references/krea2.md), [`references/krea2-edit.md`](references/krea2-edit.md), and [`references/anima.md`](references/anima.md) for deep engine-specific fusion bands and LoRA weights.

---

## 2. Optical Staging & Photonics Matrix

Compose scenes across three distinct spatial planes: **Foreground** (15-30% defocus blur) $\rightarrow$ **Midground** (tack-sharp subject) $\rightarrow$ **Background** (atmospheric falloff and bokeh).

| Optical Dimension | Lens / Lighting Rig | Visual Behavior & Execution Rule |
| :--- | :--- | :--- |
| **Portrait Prime** | 85mm or 105mm ($f/1.2 - f/1.8$) | Ultra-shallow depth of field, razor-thin focal plane, creamy circular bokeh discs. |
| **Cinematic Normal** | 35mm or 50mm ($f/2.8 - f/4.0$) | Natural narrative depth of field with environmental room context. |
| **Wide Angle** | 24mm or 28mm ($f/8 - f/11$) | Deep depth of field, edge-to-edge sharpness from foreground props to horizon. |
| **Two-Tone Lighting**| Dual CCT Contrast | Contrast opposing Kelvin sources (e.g. 2800K tungsten key with 6500K overcast shadow fill). |
| **Lo-Fi Sensor Noise**| High-ISO CMOS Grit | Direct on-axis smartphone flash, hard drop-shadows, and slight edge chromatic aberration. |
| **Vantage Geometry** | Worm's-Eye / Canting | Low floor-level worm's-eye view, 15-degree Dutch tilt, or over-the-shoulder framing. |

---

## 3. FACS, Anatomy & Multi-Actor Staging Matrix

Describe facial muscle tensions using physical English descriptions rather than abstract emotion labels:

| State / Expression | FACS Action Units | Physical Action & Natural Phrasing |
| :--- | :--- | :--- |
| **Analytical Focus** | AU1 + AU4 + AU7 | Inner brows pinched tight, lower eyelids narrowed and taut, pinpoint catchlight in upper iris. |
| **Playful Surprise** | AU1 + AU2 + AU26 | Eyebrows arched high, eyes widened in playful surprise, mouth parted in a soft O-shape. |
| **Defiant Intensity** | AU4 + AU7 + AU31 | Brow furrowed hard, jaw clenched with taut masseter tension, direct piercing gaze into the lens. |
| **Subtle Skepticism**| Unilateral AU12 + AU14 | One mouth corner lifted in an asymmetric smirk, single raised eyebrow, eyes slightly narrowed. |

### Dermal Micro-Realism & Kinematics

* **Dermal Micro-Realism:** Specify unretouched micro-pores along the nose bridge and T-zone, fine peach fuzz catching raking rim light, natural sebum sheen on the forehead, and corneal catchlights.
* **Biomechanical Kinematics:** Break parallel posture with classical contrapposto (weight shifted onto one foot, spine curved in lumbar S-curve, shoulders tilted counter to hips).
* **Layered Wardrobe Hierarchy:** Order layered garments sequentially: Inner Base Layer $\rightarrow$ Structured Mid-Layer $\rightarrow$ Heavy Outer Shell (e.g., crisp white cotton base shirt under a fitted charcoal wool vest, beneath an unbuttoned heavy canvas trench coat).

---

## 4. Exemplar Composite Prompt Stacks

### Exemplar 1: Photorealistic Editorial Portrait (Krea 2 RAW / FLUX.1 Dev)
* **Configuration:** Aspect Ratio `4:5` ($896 \times 1152$) | 30 steps | CFG 3.5 | `euler`

```text
85mm f/1.4 portrait prime lens, shallow depth of field. A 2800K tungsten desk lamp illuminates an antique mahogany workbench against cool 6500K overcast window shadow fill. A 62-year-old master watchmaker in a charcoal tweed vest leans forward with pinched brows, taut lower eyelids, and an iris catchlight. His thumb and forefinger press micro-tweezers against a ruby tourbillon bearing before a softly defocused foreground glass loupe. Kodak Portra 400 35mm film still.
```

### Exemplar 2: Illustrative Cel Sci-Fi Action (CircleStone ANIMA-Aesthetic / Turbo)
* **Configuration:** Aspect Ratio `16:9` ($1344 \times 768$) | 38 steps | CFG 4.0 | `dpmpp_2m_sde_gpu`

```text
1boy, solo, @sadamoto yoshiyuki, @yamashita ikuto, 1990s anime, retro anime, cel animation, flight mechanic, short brown hair, denim overalls, work gloves, tsurime, cliffside hangar, sunset, cel shading, anime screencap, 2d, clean lineart, vibrant anime aesthetic, Foreground: an out-of-focus spanner rack. In the midground, the 24-year-old flight mechanic drops his weight onto his left boot, cranking a socket wrench against hydraulic actuator resistance. Focused resolve sharpens his gaze with a pin-light spark. A 9000K cyan telemetry display rim-lights his jaw against 2400K golden twilight. Distant cumulus cloud banks dissolve into soft bokeh.
```
*(Negative: `worst quality, low quality, semi-realistic, 2.5d, 3d render, cgi, digital painting, photorealistic, realistic face, airbrush, oily skin, artist name, blurry, bad anatomy, deformed hands`)*

### Exemplar 3: Dual-Image Inpainting & Regional Composition (Krea 2 Edit)
* **Configuration:** Grounding 1024px | `fit_mode: fit` | `ref_boost: 4.0` | 22 steps | CFG 2.5

```text
Place the subject from reference image2 into the ancient sunlit greenhouse in reference image1. Extract only the subject from image2, strictly preserving their 28-year-old facial bone structure and khaki field shirt. The subject stands in the midground, left palm pressing downward onto the wrought-iron planter table. Relight with warm 5500K sunbeams and match f/2.8 optical depth of field with soft bokeh across background ferns.
```

### Exemplar 4: Candid Lo-Fi Smartphone Snapshot (FLUX.1 Dev / Krea 2 RAW)
* **Configuration:** Aspect Ratio `4:5` ($896 \times 1152$) | 28 steps | CFG 3.5 | `euler`

```text
26mm f/1.8 smartphone wide-angle lens with subtle edge chromatic aberration. Harsh on-axis direct smartphone LED flash casting a sharp dark drop-shadow against vinyl diner wall tiles. A 24-year-old Korean woman with an unposed mid-laughter smile, crinkled eye corners, and natural goosebumps on bare shoulders leans forward across a laminate table. Subtle high-ISO sensor noise in underexposed shadow corners, unretouched micro-pores, and melting milkshake condensation in foreground. Candid handheld snapshot.
```
