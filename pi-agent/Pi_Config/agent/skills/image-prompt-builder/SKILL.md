---
name: image-prompt-builder
description: Construct high-grade prompts and optical staging across AI image engines including Krea 2 (RAW/Turbo/Edit), ANIMA (Anime/LoRA), Flux, SDXL, and Midjourney.
---

# Universal AI Image Prompt Builder

A high-density directive for translating visual concepts into production-grade generation prompts across modern foundation models (Krea 2 RAW/Turbo/Edit, CircleStone Labs ANIMA, FLUX.1 Dev/Schnell, SD 3.5, and Midjourney v6). Enforces physical photonics, FACS micro-facial mechanics, Kelvin color science, 3-plane optical staging, kinetic contrapposto, and engine-specific conditioning architectures.

---

## Resources & Engine References Index

| Resource / Reference | Target Engine & Architecture | Playbook Contents |
| :--- | :--- | :--- |
| **[`references/krea2.md`](references/krea2.md)** | **Krea 2 (RAW / Turbo)** | Qwen3-VL 12-layer fusion bands (`txtfusion`), KGW rebalancing, 8-block prose sequence, and Kodak Vision3/Portra film stock matrices. |
| **[`references/krea2-edit.md`](references/krea2-edit.md)** | **Krea 2 Edit / Inpainting** | Dual In-Context 3D-RoPE conditioning (`krea2_identity_edit_v1_2`), `ref_boost`, `grounding_px`, slot indexing, and regional restyling. |
| **[`references/anima.md`](references/anima.md)** | **CircleStone Labs ANIMA** | Cosmos-Predict2 DiT + Qwen3 anime engine, Danbooru tag hygiene, `@artist` surname-first indexing, score rules, and 2.5D anti-realism shields. |

---

## 1. Intake Routing, Engine Selection & Modern Aspect Ratio Grid

### A. Multimodal Input Routing Matrix
Assistants may receive varied input modalities:
* **Mode 1: Image Input Only (Visual Reverse-Engineering):** Deconstruct the image's lighting physics (Kelvin), lens optics (focal length/DoF), material textures, adult age (21+), FACS muscle tensions, and composition into a reproduction 8-block prompt package.
* **Mode 2: Base Text Prompt Only (Creative Expansion):** Expand the user's concept through the 8-block canonical sequence, demographic/adult age grounding, and two-tone lighting.
* **Mode 3: Image(s) + Concept (Generation / Non-Edit via `Picture N:`):** Use Krea 2's multimodal Qwen3-VL vision tower to pass reference images for Style (SREF), Character Likeness (CREF), Composition Staging, or Turnaround Sheets while rendering a completely new generation.
* **Mode 4: Image(s) + Inpainting/Mask (Regional Edit / Dual RoPE):** Use Krea 2 Edit (`krea2_identity_edit_v1_2`) for regional inpainting, object swaps, and background replacement.

### B. Engine Architecture Selection
| Target Concept / Style | Recommended Engine | Conditioning Paradigm & Syntax Model |
| :--- | :--- | :--- |
| **Photorealism / Cinematic Stills** | **Krea 2 RAW** or **FLUX.1 Dev** | 8-Block Natural Language Prose (Qwen3-VL / T5-XXL Relational Clauses) |
| **2D Anime / Key Animation / Cel** | **CircleStone Labs ANIMA** | Danbooru Tag Prefix + Kinetic Narrative Prose (Cosmos 2B + Qwen3) |
| **Fast Iteration / Distilled (CFG 1.0)** | **Krea 2 Turbo** or **FLUX.1 Schnell** | Positive-Only Natural Prose (Negative Prompt Inert / Ignored) |
| **Image Editing / Regional Inpainting** | **Krea 2 Edit** | Dual In-Context 3D-RoPE Binding (`krea2_identity_edit_v1_2.safetensors`) |
| **Commercial / Stylized Concepts** | **Midjourney v6.1** | Natural Language + Parameters (`--style raw --v 6.1 --ar 16:9 --s 250`) |

### C. Native 1-Megapixel Bucketed Resolution Grid
Diffusion Transformers (DiT / Flow-Matching) are trained on bucketed 1-megapixel latents ($1,048,576\text{ px}$). Always specify native bucket dimensions to prevent distortion, limb cloning, and cropping:

| Aspect Ratio | Standard Resolution | Native Latent Dimensions | Primary Production Use Case |
| :--- | :--- | :--- | :--- |
| **`1:1`** | **`1024 × 1024`** | Square $(1.05\text{ MP})$ | Avatars, social profile icons, centered close-up portraits. |
| **`4:5`** | **`896 × 1152`** | Vertical Portrait | Instagram feed portraits, character concept sheets, tarot cards. |
| **`3:4`** | **`896 × 1216`** | Vertical Standard | Editorial photography, comic panels, full-body portraits. |
| **`2:3`** | **`832 × 1248`** | Vertical Classic | 35mm portrait photography, poster prints, book covers. |
| **`9:16`** | **`768 × 1344`** | Vertical Ultra-Tall | Mobile wallpapers, TikTok/Reels stories, smartphone full-screen UI. |
| **`5:4`** | **`1152 × 896`** | Horizontal Wide | Desktop banners, environmental landscapes, wide portraits. |
| **`4:3`** | **`1216 × 896`** | Horizontal Standard | Classic cinematic photography, gallery painting canvas. |
| **`3:2`** | **`1248 × 832`** | Horizontal Classic | 35mm film landscape stills, double-page editorial spreads. |
| **`16:9`** | **`1344 × 768`** | Widescreen Cinematic | YouTube thumbnails, 1080p/4K display backgrounds, film stills. |
| **`21:9`** | **`1536 × 640`** | Ultrawide Anamorphic | Anamorphic cinema aspect, ultrawide monitors, panoramic concepts. |

---

## 2. Core Physical Pillars & Optical Staging

### A. 3-Plane Optical Depth Staging & Lens Physics
Compose scenes across three distinct spatial planes to eliminate flat 2D collapse:
$$\text{[Camera Lens]} \longrightarrow \text{[Foreground (15–30\% Defocus Blur)]} \longrightarrow \text{[Midground (Tack-Sharp Subject)]} \longrightarrow \text{[Background (Atmospheric Falloff \& Bokeh)]}$$

* **Lens Focal Length & Aperture Matrix:**
  - **85mm / 105mm Prime ($f/1.2–f/1.8$):** Ultra-shallow DoF, creamy circular bokeh discs, razor-thin focal plane (Portraits).
  - **35mm / 50mm Prime ($f/2.8–f/4.0$):** Natural narrative cinematic DoF, contextual environmental room clarity.
  - **24mm / 28mm Wide ($f/8–f/11$):** Deep DoF, edge-to-edge sharpness across foreground crags to distant horizons.
* **Obstructed / Found Vantage Points:** Peer through an ajar door frame occluding 35% of the foreground left in shadow; shoot through rain-streaked automotive side mirrors; or use high-angle corner security CCTV barrel distortion.
* **Contrastive Relational Phrasing (Anti-Misfocus Rule):**
  Never use bare, isolated tags (`depth of field`, `bokeh`, `blurry`) when multiple subjects or props are present. Use **longer contrastive sentence fragments** to explicitly bind DoF and focus to the correct plane:
  - ❌ *Ambiguous tags:* `1girl, robot, ruined city, depth of field, blurry background` *(causes cross-attention bleed, misfocusing the character or whole scene).*
  - ✅ *Contrastive fragment:* `"Foreground: an out-of-focus metal rack of spanners frames the lower edge, while the youth in the midground remains in tack-sharp crisp focus as distant grandstands dissolve into soft circular bokeh discs."`

### B. Kelvin Lighting Physics & Two-Tone Color Contrast
Define exact Correlated Color Temperature (CCT) in Kelvin:
* `2000K–2700K` (Candlelight, warm tungsten key) $\vert$ `3200K` (Golden hour sun) $\vert$ `5500K` (Direct neutral daylight) $\vert$ `6500K–8000K` (Overcast / deep twilight shadow fill).
* **Two-Tone Lighting Blueprint:** Combine opposing Kelvin sources: *"A 2800K warm tungsten desk lamp illuminates the workbench from the left while cool 6500K overcast twilight fills shadow contours from the right."*

### C. Immediate Demographic, Adult Age (21+) & Skeletal Build Anchoring
* **Strict Adult Age Policy (21+ Years):**
  All human subject generations must be comfortably adult (e.g., `24-year-old`, `38-year-old`, `62-year-old`). When in doubt or unspecified, default strictly to adult ages.
* **Immediate Demographic Anchoring:**
  Diffusion models carry strong "average dataset priors" (defaulting to generic mid-20s Caucasian faces if unspecified). State ethnicity and age immediately in Block 3 (Subject Anchor) to lock facial latent tensors before secondary attributes are applied:
  - ❌ *Vague:* `"An architect reviews blueprints..."` $\rightarrow$ defaults to generic 25yo AI face.
  - ✅ *Grounded:* `"A 58-year-old Japanese architectural engineer..."` or `"A 34-year-old West African botanist..."`
* **Skeletal Frame & Body Proportions Matrix:**
  Anchor physical frame and build to eliminate cookie-cutter body shapes:
  - `slender athletic runner's build`, `broad-shouldered heavyweight frame`, `tall long-limbed silhouette`, `compact stocky build`, `delicate angular collarbones`.

### D. FACS Facial Mechanics & Anti-Plasticity Dermal Topography
Never use abstract emotion words (*"she looks sad"*, *"he is furious"*). Describe physical muscle contractions in plain English (**never output raw `AU` code strings in final prompt text**):

| Emotion / State | FACS Action Units | Natural English Prompt Phrasing |
| :--- | :--- | :--- |
| **Analytical Focus** | AU1 + AU4 + AU7 | Inner brows pinched tight, lower eyelids narrowed and taut, pinpoint catchlight in upper iris. |
| **Playful Shock / "Oops"** | AU1 + AU2 + AU26 | Eyebrows arched high, eyes widened in playful surprise, mouth parted in a soft 'O' shape, glancing back over shoulder. |
| **Playful Wink / Coyness** | AU46 + AU12 + AU14 | Left eye winking playfully with raised cheek, unilateral smile pulling lip corner, subtle dimple. |
| **Suppressed Grief** | AU1 + AU2 + AU15 | Inner brows arched softly upward, mouth corners pulled slightly downward, watery lower eyelid film. |
| **Defiant Intensity** | AU4 + AU7 + AU31 | Brow furrowed hard, jaw clenched with taut masseter tension, direct piercing gaze into the lens. |
| **Subtle Skepticism** | Unilateral AU12 + AU14 | One mouth corner lifted in an asymmetric smirk, single raised eyebrow, eyes slightly narrowed. |

* **🚫 Banned Quality Buzzwords (Zero Tolerance):** `photorealistic`, `hyperrealistic`, `8K`, `4K`, `UHD`, `masterpiece` *(except anime tag prefixes)*, `trending on artstation`, `flawless skin`, `smooth skin`, `airbrushed`, `stunning`, `award winning`.
* **✅ Physical Dermal Anchors:**
  - **Micro-Pores & Follicular Relief:** Unretouched micro-pores visible across the T-zone and nose bridge (no digital smoothing).
  - **Translucent Vellus Hair:** Fine peach fuzz along the jawline catching raking rim light.
  - **Natural Sebum & Capillary Flush:** Subtle natural sebum sheen on the forehead/bridge of nose; subsurface scattering (SSS) yielding warm capillary redness through the ears and fingertips.
  - **Corneal Catchlights:** Single directional pinpoint reflection in the upper iris (*"a single 3200K tungsten pin-light reflects in the upper iris crescent; gaze deflected 15° off-camera"*).
  - **Lo-Fi Anti-Perfection Toolkit:** Direct on-axis camera flash, raw high-ISO luminance noise in shadows, and 24mm wide-angle barrel distortion immediately shatter synthetic AI artifacts.

### E. Biomechanical Kinematics, Tactile Friction & Garment Architecture
* **Classical Contrapposto & Lumbar Arching:** Break parallel lines: *"Rests full weight onto the ball of her right foot, arching the lower spine in deep lumbar S-curve while left knee bends inward and right hip tilts upward."*
* **Torso Torsion & Look-Back Angles:** Rotate upper body relative to hips (*"hips angled 45° camera-left while shoulders and head twist back toward the lens over the shoulder"*).
* **Tactile Grip Dynamics:** Specify knuckle whitening, thumb lock, downward palm pressure, and material deformation (*"fingertips press firmly into frosted glass, wiping clear streaks through condensation"*).
* **Garment Tailoring Fit & 3-Layer Hierarchy:**
  Define explicit garment fit (`loose oversized boxy fit`, `tailored slim taper`, `draped unlined linen`, `structured heavy wool`) and order layered garments sequentially (`[Inner Base Layer] -> [Structured Mid-Layer] -> [Heavy Outer Shell]`) to prevent textile texture bleed:
  - *Example:* *"A crisp white cotton base shirt under a fitted charcoal wool vest, beneath an unbuttoned heavy canvas trench coat."*
* **The 3-Part Anchor for Displaced / Non-Conventional Clothing (Breaking Default Priors):**
  When rendering slipping, unbuttoned, tied, or asymmetrical garments (which fight strong $P(\text{worn normally})$ baseline priors):
  1. **The Physical Snag Point:** State where gravity caught the fabric (❌ *"jacket slipping"* $\rightarrow$ ✅ *"her oversized cardigan has slid completely off her left shoulder, hanging caught in the crook of her left elbow while remaining draped over her right collarbone"*).
  2. **Exposed Dermal Negative Space:** Describe the exposed anatomy to force skin pixels (*"...exposing her bare left collarbone, neck, and shoulder to the cool daylight"*).
  3. **Fabric Tension Vectors:** Describe diagonal drag folds pulling toward the displacement (*"heavy diagonal tension lines stretch from her right shoulder toward the bunched fabric at her left waist"*).
  4. *Anime/Danbooru Tags:* `off-shoulder`, `jacket off shoulder`, `jacket around waist`, `partially unbuttoned`, `shirt pull`, `straps down`, `untied`, `collarbone`.

---

## 3. Strict Rules, Grammar Constraints & Multi-Actor Staging

### A. Principle of Semantic Economy & Latent Prior Leverage (The Anti-Tautology Rule)
Every token consumes cross-attention budget. Modern foundation models already encode deep baseline priors for standard objects.
* **Trust Baseline Priors:** Never describe what a concept inherently contains by definition. A *"wooden pier"* already contains wooden planks and water. A *"tailored suit"* already contains lapels, sleeves, and trousers. A *"dense forest"* already contains trees and soil.
* **Spend Budget ONLY on High-Entropy Deltas:** Direct words strictly toward unique physical wear, exact Kelvin lighting angles, FACS muscle tensions, and optical staging.

| Tautological Bloat (❌ BANNED) | High-Signal Precision (✅ REQUIRED) |
|---|---|
| ❌ *"A long wooden pier made of rustic wooden planks and timber posts, standing over blue ocean water..."* | ✅ *"Weathered wooden pier extending into dense ocean fog. Low-angle 24mm wide-shot, f/2.8, 5500K overcast dawn light with fine mist clinging to timber."* |
| ❌ *"A businessman wearing a formal suit with jacket, shirt, collar, sleeves, tie, and trousers stands in an office with windows..."* | ✅ *"Executive in a structured charcoal wool blazer leans against a steel mullion. 85mm prime lens, 3200K indoor lamp key with cool 6500K overcast window fill."* |

### B. Zero Tolerance for Filler Words & Lazy Spatial Adjectives
* **🚫 Banned Empty Narrative Tropes:** `"in a world of..."`, `"a sense of wonder"`, `"breathtaking view"`, `"captivating atmosphere"`, `"exuding power"`, `"radiating presence"`, `"a scene depicting"`, `"an image of"`, `"a visually striking composition"`.
* **🚫 Banned Lazy Room Labels:** `"messy room"`, `"cluttered space"`, `"cozy apartment"`, `"lived-in room"`.
* **✅ Micro-Narrative Props Rule (1–2 Resonant Props):** Never describe abstract clutter. Anchor spaces with **1–2 resonant physical props** undergoing active physical arrangement or human trace mechanics:
  - *Example:* Instead of *"messy bedroom"*, write: *"Plushies and pastel throw pillows tumble off the unmade duvet onto the carpet, while tangled charging cables snake across the nightstand."*
  - *Action Verbs for Props:* `tumble`, `scatter`, `snake`, `unmake`, `rumple`, `pool`, `prop`, `drape`, `fleck`, `singe`, `rest`, `clasp`, `perch`, `spill`.

### C. Natural Syntax, Direct Framing & Adaptive Word Budget
* **Pick ONE Definitive Posture:** Never combine contradictory physical positions (❌ `"stands seated"`, `"sits standing"`, `"walks perched"` $\rightarrow$ ✅ `"sits upon the railing"`, `"stands at the edge"`).
* **Ban Abstract Personification:** Never assign human actions to abstract concepts (❌ `"the atmosphere breathes"`, `"the light sings"` $\rightarrow$ ✅ `"warm 5500K daylight fills the room"`).
* **🚫 Banned Meta-Observer Phrases:** Never use passive observer framing that signals an image is being viewed (❌ `"can be seen"`, `"is seen"`, `"is depicted"`, `"is located in"`, `"is illuminated by"`, `"being photographed"`, `"there is a [noun]"` $\rightarrow$ ✅ Describe the physical light and subject directly: `"2700K tungsten lamp illuminates the mahogany table"`, `"she stands at the rail"`).
* **🚫 Banned Inverted Passive Actions:** Always place the acting subject before the action verb (❌ `"The heavy latch is pulled by the engineer"` $\rightarrow$ ✅ `"The engineer pulls the heavy iron latch downward"`).
* **🚫 Banned Ambiguous Runaway `-ing` Stacks:** Do not chain loose, comma-separated participial verbs where the acting subject becomes ambiguous (❌ `"A warrior battling a beast, swinging a blade, shouting, glowing, falling..."` $\rightarrow$ ✅ `"A warrior swings a broadsword against the beast as glowing embers scatter across the stone"`).
* **🚫 Banned Helper Verbs & Grammar Padding:** Eliminate filler verbs that bloat token count (❌ `"provides a key light onto"`, `"serves to illuminate"`, `"creates a feeling of"`, `"acts as a backdrop"` $\rightarrow$ ✅ `"casts warm key light across"`, `"illuminates"`, `"against a dark backdrop"`).
* **✅ Direct Participle & Compound Compaction:** Prefer tight compound descriptions over separate explanatory clauses:
  - ❌ *Verbose (22 words):* `"Brows are pinched tight and lower eyelids are narrowed in analytical focus while a single warm 2800K pinpoint catchlight reflects in his iris."`
  - ✅ *Compact (13 words):* `"Pinched brows and taut lower eyelids in analytical focus with a 2800K iris catchlight."`
* **Drive Main Actions with Active Verbs:** `stands`, `wears`, `grips`, `casts`, `drapes`, `pools`, `rakes`, `tilts`, `glances`, `lashes`, `slices`, `curls`, `sways`, `strikes`, `anchors`, `clasps`, `presses`.
* **Adaptive Word Budget Matrix:**
  | Engine Tier & Sampling Mode | Target Word Budget | Density Directive |
  | :--- | :--- | :--- |
  | **Turbo / Distilled / Anime (CFG 1.0, 8–10 steps)** | **45–65 words** | Ultra-lean, maximum token signal, zero grammatical filler. |
  | **RAW / Flow-Matching / Base (CFG 3.5+, 30+ steps)** | **60–80 words** | Dense physical textures, two-tone lighting, and FACS nuance. |
  | **Multi-Character / Complex Machinery** | **85–110 words** | Extended budget strictly for coordinating multiple interacting bodies/props. |
* **🚫 Zero Tolerance for Rule Echoing / Meta-Concept Leaks:** Never echo skill instructions into the prompt (❌ `"displaying strong kinetic torsion"`, `"creating a 3-plane transition"`, `"demonstrating FACS mechanics (AU31)"` $\rightarrow$ Execute the visual directly in plain English).

### D. Multi-Actor Environmental Staging & Anti-Split-Screen Protocol
When prompting 2+ characters performing concurrent actions:
1. **🚫 Strictly Banned Layout Words:** `split screen`, `divided into two halves`, `left side: / right side:`, `two panels`, `diptych`. (These trigger comic panel dividing lines).
2. **✅ Continuous Environmental Grounding:** Place both actors in a shared physical container:
   - *"In a sunlit workshop, a carpenter sits at the workbench on the left planing cedar wood while across the room on the right an apprentice sweeps shavings with a bristle broom."*
3. **Attribute Clustering:** Fully describe Actor A's wardrobe, colors, and stance completely before introducing Actor B to prevent color cross-contamination.

### E. The 4-Shield Protocol for Intimate Physical Contact (Preventing Body Fusion & Phantom Limbs)
When generating two characters in close physical contact (embraces, cheek touches, lap sitting, forehead-to-forehead):
1. **Extreme Material & Color Contrast:** Put Character A in dark heavy wool and Character B in light silk or bare skin. High tonal contrast enables self-attention layers to segment interacting boundaries.
2. **The 3-Point Tactile Anchor:** Define exact hand placement and physical deformation (❌ *"embracing intimately"* $\rightarrow$ ✅ *"his right hand cups her left cheekbone, thumb along jawline, while her fingertips press into his dark coat sleeve, bunching the fabric"*).
3. **Asymmetrical / Over-the-Shoulder Camera Angle:** Shoot from a $3/4$ profile or over-the-shoulder perspective to establish clear foreground-to-background spatial occlusion.
4. **Closed-Circuit Ocular / Facial Alignment:** *"Their foreheads touch gently at the hairline with eyes softly closed in quiet tenderness, lips parted 2cm apart."*
5. *Anime/Danbooru Tags:* `forehead-to-forehead`, `cheek-to-cheek`, `hand on another's cheek`, `head on another's shoulder`, `embrace`, `hug from behind`, `interlocked fingers`.

---

## 4. Engine Conditioning Formulas & Dialects

### A. Krea 2 RAW & FLUX.1 Dev (Natural Language Flow-Matching)
* **Positive Prompt:** 8-Block Canonical Sequence (Lens $\rightarrow$ Light $\rightarrow$ Subject $\rightarrow$ Environment $\rightarrow$ FACS $\rightarrow$ Dynamics $\rightarrow$ Pose $\rightarrow$ Film Stock).
* **Typography:** Quote isolation bound to a substrate: `"stenciled in weathered yellow paint across the steel beam: 'NO ENTRY'"`.
* **Negative Prompt:** Leave blank on Turbo/Schnell (CFG 1.0). Use natural language positive steering for Base/RAW.

### B. Krea 2 Multimodal Reference Prompting (Non-Edit Generation via Qwen3-VL)
When users supply reference images for **new image generation** (not inpainting), Krea 2 ingests images as `Picture 1:`, `Picture 2:` directly into its multimodal vision-language text encoder:
* **1. Style & Lighting Transfer (SREF):** Transfer lighting, optics, and medium while creating a new subject:
  ```text
  In the visual style, 2800K tungsten chiaroscuro lighting, and 35mm film grain of Picture 1: a 45-year-old botanist inspects orchids in a misty greenhouse.
  ```
* **2. Character Likeness Lock (CREF):** Lock facial bone structure while changing wardrobe, pose, and setting:
  ```text
  Subject is the person from Picture 1, preserving facial bone structure and dark eyes. The subject wears a canvas field jacket, leaning against an iron railing in morning fog.
  ```
* **3. Spatial & Compositional Mimicry:** Replicate camera perspective and depth staging with new subjects:
  ```text
  Matching the low-angle perspective and 3-plane depth staging of Picture 1: a runner leaps across a hurdle under bright stadium floodlights.
  ```
* **4. Character Turnaround Sheet (360° Volumetric Lock):** Lock full 3D identity into a single scene:
  ```text
  Picture 1 is a character turnaround sheet. Render a single unified cinematic composition of this character seated at a wooden desk. Do not render a turnaround or multi-panel grid.
  ```
* **Preventing Visual Bleed (Explicit Unbinding):** If replacing elements from `Picture 1`, explicitly state the replacement (e.g. *"render bare face without the glasses in Picture 1"*, *"wearing a navy coat instead of the red jacket in Picture 1"*).

### C. Krea 2 Edit (Inpainting, Relighting & Regional Composition)
* **Node Dials:** `fit_mode: fit`, `grounding_px: 1024`, `ref_boost: 4.0` (identity lock) or `0.9` (object removal).
* **Formula:**
  $$\text{Edit Prompt} = [\text{Action Verb}] + [\text{Subject/Region Anchor}] + [\text{New Tactile Properties}] + [\text{Lighting \& Optics Match}]$$
* **Slot Indexing:** `"Place the subject from reference image2 into the greenhouse in reference image1. Extract only the subject from image2, preserving facial bone structure and wardrobe. Relight with image1's warm 5500K sunbeams."`

### D. CircleStone Labs ANIMA (Cosmos 2B + Qwen3 Anime Engine)
* **ANIMA-Aesthetic (Master Quality / CFG 3.5–4.5, 30–38 steps):**
  ```text
  1girl, solo, @artist_name, [wardrobe/appearance tags], [kinetic narrative prose with FACS & Kelvin lighting]
  ```
  - *Negative:* `worst quality, low quality, semi-realistic, 2.5d, 3d render, cgi, photorealistic, realistic face, airbrush, oily skin, artist name, blurry, bad anatomy, deformed hands`
* **ANIMA-Turbo (Fast Distilled / CFG 1.0, 8–12 steps):**
  - Ultra-fast iteration path. Direct Danbooru + prose (`1girl, solo, ...`).
  - *Negative:* Leave blank (negative conditioning is inert at CFG 1.0).
* **Zero Boilerplate Rule:** Do not include `masterpiece`, `best quality`, `safe`, or `score_*` tags. Start prompts directly with character count and core visual anchors.
* **Artist `@` Indexing (Surname-First):** `@soejima shigenori`, `@sadamoto yoshiyuki`, `@yamashita ikuto`, `@shinkai makoto`, `@imaishi hiroyuki`, `@amano yoshitaka`.
* **2.5D Leakage Shield:** When prompting tactical/mechanical gear, add positive `cel shading, anime screencap, 2d` and negative `semi-realistic, 2.5d, 3d render, cgi`.
* **Contrastive Sentence Framing:** Always use contrastive prose clauses (`while`, `as`, `against`) rather than isolated `depth of field` tags to bind sharpness to the main actor and blur to foreground/background planes.

---

## 5. Execution Protocol: Multi-Pass Self-Pruning & Sequential Thinking

Before emitting the prompt package, perform a systematic multi-pass pruning workflow.

### Environment-Aware Execution Paths

#### 🧠 Path A: Reasoning via `sequential_thinking` Tool (When Tool is Available)
In environments equipped with the `sequential_thinking` tool (such as Pi Agent and reasoning-extended harnesses), log your systematic 3-step reasoning chain before outputting the final prompt package:
1. **Step 1 — Concept Deconstruction & Latent Prior Mapping:**
   - Identify the primary subject and setting; enforce adult age (21+) and demographic grounding.
   - Separate what the diffusion model's latent prior already handles (e.g., "wooden pier" implies planks, water, pilings) from **high-entropy deltas** (unique weathered state, Kelvin light, camera angle).
   - Select 1–2 tangible **lived-in micro-narrative props** with active placement verbs (e.g., plushies tumbling, tangled cables).
2. **Step 2 — High-Signal Drafting:**
   - Assemble the 8-block sequence (or engine format) with active verbs, Kelvin lighting, DoF optics, and biomechanical contrapposto.
3. **Step 3 — Anti-Tautology Audit & Pruning:**
   - Re-read the drafted prompt.
   - Prune redundant constituent descriptions (e.g., remove mentions of wooden planks on the pier).
   - Verify word count against the budget (**45–65 words for Turbo/Anime**, **60–80 words for RAW/Base**).
   - Ensure zero meta-observer phrases, zero ambiguous runaway `-ing` stacks, zero helper verb padding, zero banned buzzwords, zero raw AU code strings, and zero abstract room labels.

#### ⚡ Path B: Native Self-Pruning (When Tool is Absent)
In environments without `sequential_thinking`, perform the same 3-step workflow natively within internal chain-of-thought before generating the prompt package.

---

## 6. Universal Output Format Schema

When generating prompts, assistants must emit this structured schema:

```markdown
### 📝 Primary Positive Prompt
[Single cohesive code block with 8-block prose or Danbooru tag+prose]

### 🚫 Negative Prompt
[Engine-specific negative tokens or left empty for flow-matching/distilled models]

### 🎛 Model & Parameter Recommendation
| Parameter | Setting | Rationale |
| :--- | :--- | :--- |
| **Target Engine** | Krea 2 RAW / FLUX.1 Dev / ANIMA-Base | Optimal architectural fit |
| **Aspect Ratio & Res** | e.g. `16:9` (`1344×768`) / `4:5` (`896×1152`) | Native 1-megapixel bucket |
| **Sampler / Steps / CFG** | e.g. `Euler / 30 steps / CFG 3.5` | Engine calibration |

### 🔄 Iteration Pathway (3–4 Actionable Directives)
1. **Lighting / Atmosphere Shift:** (e.g. 2400K candlelight vs. 7500K twilight)
2. **Optics / POV Shift:** (e.g. 85mm portrait prime vs. 24mm wide angle through ajar door)
3. **Kinetic / FACS Shift:** (e.g. Unilateral smirk AU12+AU14 with 15° gaze deflection)
4. **Medium / Substrate Shift:** (e.g. Impasto oil on linen canvas or `@soejima shigenori` cel animation)
```

---

## 7. High-Leverage Production Exemplars

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
