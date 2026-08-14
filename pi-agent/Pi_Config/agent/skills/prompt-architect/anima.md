[← Back to Universal Prompt Architect Hub](SKILL.md)

# CircleStone Labs ANIMA Prompt Engineering & Architecture Playbook

**ANIMA** is a 2-billion parameter anime and illustration text-to-image foundation model developed by **CircleStone Labs** and **Comfy Org** (a derivative of the **NVIDIA Cosmos-Predict2-2B-Text2Image** architecture). It is purpose-built for anime concepts, stylization, and non-photorealistic illustrations.

---

## 1. Technical Architecture & Text Encoder Mechanics

### Dual Text Conditioning Pipeline
* **Diffusion Backbone:** 2-Billion parameter DiT text-to-image model derived from `nvidia/Cosmos-Predict2-2B-Text2Image`.
* **Text Encoder:** **Qwen3-0.6B** (`split_files/text_encoders/qwen_3_06b_base.safetensors`).
* **VAE:** **Qwen-Image VAE** (`split_files/vae/qwen_image_vae.safetensors`).
* **LLM Adapter Layer:** A dedicated projection adapter connects Qwen3 text embeddings to the Cosmos diffusion backbone.
* **Hybrid Prompt Parsing:** Anima is trained on a mixture of **Danbooru/Gelbooru tags**, **natural language captions**, and **hybrid combinations of both**.
  - **Danbooru/Gelbooru Tags:** Handle precise character identity, hair, eye geometry, wardrobe, and primary posture.
  - **Natural Language Prose:** Directs multi-character spatial placement (`"Left side of the image is..., right side is..."`), cinematic lighting, atmospheric storytelling, and emotional subtext.

---

## 2. Model Variants & Parameter Matrix

```
┌─────────────────────────┬───────────────────┬──────────────┬────────────────────────┬──────────────────────────────────────────┐
│ Variant                 │ File Name         │ Step Range   │ CFG Scale              │ Primary Use Case & Characteristics       │
├─────────────────────────┼───────────────────┼──────────────┼────────────────────────┼──────────────────────────────────────────┤
│ 1. Anima-Base v1.0      │ `anima-base-v1.0` │ 30–50 steps  │ **CFG 4.0–5.0**        │ Pretrained, unrefined base. Maximum      │
│                         │                   │              │                        │ flexibility, diversity, LoRA training.   │
├─────────────────────────┼───────────────────┼──────────────┼────────────────────────┼──────────────────────────────────────────┤
│ 2. Anima-Aesthetic v1.0 │ `anima-aesthetic` │ 30–50 steps  │ **CFG 4.0–5.0**        │ Fine-tuned on high-aesthetic images.     │
│    / v1.1 / v1.0b       │                   │              │ (or 3.5–4.5)           │ High default consistency. No score tags. │
├─────────────────────────┼───────────────────┼──────────────┼────────────────────────┼──────────────────────────────────────────┤
│ 3. Anima-Turbo v1.0     │ `anima-turbo-v1.0`│ **8–12 steps**│ **CFG 1.0**           │ Distilled for ultra-fast generation.     │
│                         │                   │              │                        │ Strong default style, lower diversity.   │
└─────────────────────────┴───────────────────┴──────────────┴────────────────────────┴──────────────────────────────────────────┘
```

### Optimal Samplers & Schedulers (Official CircleStone Recommendations)
* **`er_sde` (Default):** Neutral style, flat colors, sharp lines. Official recommended baseline.
* **`euler_a`:** Softer, thinner lines with a gentle 2.5D aesthetic. Can push CFG slightly higher without color burn.
* **`dpmpp_2m_sde_gpu`:** Higher creative variety; produces more dynamic variations on complex prompts.
* **`euler`:** Fast and stable; excellent for Anima-Turbo and Anima-Aesthetic.
* **`beta57` Scheduler (RES4LYF Node Pack):** Emphasizes low-noise timesteps for painterly textures and refined linework.
* **Resolution Range:** Supports native resolutions between **$512 \times 512$** and **$1536 \times 1536$** pixels ($1024 \times 1024$ recommended).

---

## 3. Strict Prompting & Formatting Syntax Rules

### 1. The Comma-Space Tokenizer Rule (Crucial for Qwen BPE)
* **Always follow commas with a space (`", "`):** In Qwen's BPE vocabulary, a comma immediately preceding an alphanumeric character without a space (e.g. `,1girl` or `,artist`) merges into an unintended composite token. Always format tags as: `masterpiece, best quality, 1girl, solo, black hair`.

### 2. The Lowercase & Spacing Rule
* **Use lowercase and spaces** for all Danbooru/Gelbooru tags: `black hair`, `pleated skirt`, `looking at viewer`.
* **Never use underscores for tags** (e.g. ❌ `black_hair`, ❌ `looking_at_viewer`).
* **Score tags are the ONLY tags that use underscores:**
  - ✅ `score_7`, `score_8`, `score_9`, `score_1`, `score_2`, `score_3`

### 3. Artist Tag Syntax (`@` Prefix)
* **Always prefix artist names with `@`** (e.g. `@nnn yryr`, `@krenz cushart`). CircleStone Labs explicitly notes: *"You must put @ in front of the artist. The effect will be very weak if you don't."*

### 4. Gelbooru Tag Preference
* When a tag differs between Danbooru and Gelbooru, Anima was trained with a preference for the **Gelbooru version**.

### 5. Multi-Character Spatial Layout Steering
Due to the Qwen3 text encoder's spatial syntax comprehension, multi-character identity bleeding is resolved by explicit left/right prose framing:
```text
masterpiece, best quality, score_7, safe, 
the image is segmented into left and right, depicting two girls.
Left side of the image: 1girl, long black hair, blue eyes, white blouse, quiet smile.
Right side of the image: 1girl, short blonde hair, amber eyes, red cardigan, energetic laugh.
They lean towards each other sharing a pair of earphones, soft park background, bokeh
```

### 6. Tag Order Hierarchy (CircleStone Labs Standard)
```text
[quality/score tags], [subject count: 1girl/1boy], [character name], [series title], [artist: @name], [general/appearance/clothing tags], [action/scene/lighting tags]
```

---

## 4. Facial Emotion & Micro-Geometry Taxonomy

To achieve deep emotion in Anima, avoid flat labels like `sad` or `happy`. Use Anima's rich Danbooru ocular and mouth vocabulary:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    ANIMA FACIAL MICRO-GEOMETRY TAXONOMY                      │
├──────────────────────┬────────────────────────────┬──────────────────────────┤
│ Emotional Subtext    │ Eye & Gaze Tags            │ Mouth & Facial Tension   │
├──────────────────────┼────────────────────────────┼──────────────────────────┤
│ Suppressed Grief /   │ `half-closed eyes`,        │ `parted lips`,           │
│ Nostalgia            │ `watery eyes`,             │ `trembling mouth`,       │
│                      │ `tears in eyes`,           │ `subtle blush`           │
│                      │ `looking down`             │                          │
├──────────────────────┼────────────────────────────┼──────────────────────────┤
│ Intense Resolve /    │ `tsurime`,                 │ `clenched teeth`,        │
│ Defiance             │ `constricted pupils`,      │ `grimace`,               │
│                      │ `direct gaze`,             │ `slight smirk`           │
│                      │ `eye glint`                │                          │
├──────────────────────┼────────────────────────────┼──────────────────────────┤
│ Quiet Skepticism /   │ `jitome`,                  │ `firm neutral lips`,     │
│ Deadpan              │ `half-closed eyes`,        │ `slight frown`           │
│                      │ `looking away`             │                          │
├──────────────────────┼────────────────────────────┼──────────────────────────┤
│ Gentle Tenderness /  │ `tareme`,                  │ `light smile`,           │
│ Serenity             │ `crescent eyes`,           │ `relaxed lips`,          │
│                      │ `soft gaze`                │ `cheek blush`            │
├──────────────────────┼────────────────────────────┼──────────────────────────┤
│ Catastrophic Dread / │ `blank eyes`,              │ `mouth agape`,           │
│ Trauma               │ `dilated pupils`,          │ `shaded face`,           │
│                      │ `sanpaku`                  │ `dark aura`              │
└──────────────────────┴────────────────────────────┴──────────────────────────┘
```

---

## 5. Dynamic Posing, Tactile Actions & 3-Plane Anime Staging

### Dynamic Posing Anchors (Anti-Stiffness)
* **Perspective & Camera Angles:** `dynamic angle`, `dutch angle`, `from below`, `from above`, `dynamic foreshortening`.
* **Kinetic Weight:** `contrapposto`, `twisted torso`, `reaching towards viewer`, `combat stance`, `mid-stride`.
* **Secondary Wind Physics:** `hair flowing`, `wind blown clothing`, `floating ribbons`, `flying petals`, `sparks drifting`.

### Studio Cinematic Profiles in Anima
1. **Makoto Shinkai Atmosphere (CoMix Wave):**
   * *Tags:* `sunset gradient, cumulus clouds, volumetric lighting, crepuscular rays, lens flare, rain on glass, wet asphalt reflections, shallow depth of field`
2. **Ufotable Dramatic Chiaroscuro (Fate / Demon Slayer):**
   * *Tags:* `high contrast chiaroscuro, glowing particles, fiery embers, intense rim lighting, dynamic shadows, motion blur, bloom`
3. **Kyoto Animation Intimacy (Violet Evergarden):**
   * *Tags:* `soft diffused backlighting, delicate hair highlights, translucent bangs, dust motes in sunbeam, circular bokeh discs, f/1.4 lens`

---

## 6. Official Positive & Negative Formulas

### 1. Anima-Base Positive & Negative Formulations
* **Positive Prefix:**
  ```text
  masterpiece, best quality, score_7, safe, 
  ```
* **Negative Prompt (Official CircleStone Formula):**
  ```text
  worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration, 3d render, plastic skin, bad anatomy, deformed hands, extra limbs, stiff pose
  ```

### 2. Anima-Aesthetic Positive & Negative Formulations
* **Positive Prefix:** *(Score tags stripped)*
  ```text
  masterpiece, best quality, safe, 
  ```
* **Negative Prompt:** *(Score tags stripped to avoid slop artifacts)*
  ```text
  worst quality, low quality, artist name, blurry, jpeg artifacts, chromatic aberration, 3d render, plastic skin, bad anatomy, deformed hands, extra limbs, stiff pose
  ```

### 3. Anima-Turbo Formulations
* **Sampling:** 8–12 steps, **CFG 1.0** (Negative prompt is inert at CFG 1.0; leave blank).
* **Positive Prefix:** `masterpiece, best quality, safe, `

---

## 7. Production-Ready Worked Packages

### Package 1: Emotional Studio Anime (Kyoto Animation / Makoto Shinkai Aesthetic)

**🎛 Model & Engine Recommendation**
| Parameter | Value | Rationale |
|---|---|---|
| **Target Engine** | CircleStone Labs ANIMA-Base v1.0 | Maximizes latent prompt adherence for fine Danbooru facial micro-geometry and volumetric lighting without aesthetic pre-baking. |
| **Aspect Ratio** | 4:5 Vertical ($832 \times 1040$) | Optimizes vertical headroom for architectural glass arches, crepuscular light rays, and subject portrait grounding. |
| **Style Reference** | Kyoto Animation & CoMix Wave Films (*Violet Evergarden* & Makoto Shinkai aesthetic) | Provides delicate hair linework, translucent backlit bangs, optical lens bloom, and atmospheric golden-hour physics. |

**🎚️ Engine-Specific Parameters**
- **Base Architecture:** Cosmos-Predict2-2B + Qwen3-0.6B Text Encoder
- **Sampler & Scheduler:** `er_sde` with `beta57` scheduler (RES4LYF Node Pack)
- **Sampling Steps & CFG:** 35 steps, **CFG 4.5**
- **BPE Tokenizer Alignment:** Comma followed by space everywhere (`, `), all tags lowercase with spaces, underscores exclusively on `score_*`.

**🏷️ Positive Prefix & Danbooru Anchors**
```text
masterpiece, best quality, score_7, safe, 1girl, solo, dark hair, braided half-updo, beige cardigan, pleated skirt, tareme, crescent eyes, watery eyes, parted lips, subtle blush, holding letter, paper envelope, conservatory, greenhouse, crepuscular rays, dust motes, circular bokeh discs, contrapposto
```

**🚫 Negative Prompt**
```text
worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration, 3d render, plastic skin, bad anatomy, deformed hands, extra limbs, stiff pose
```

**📝 Primary Narrative Prompt (Copy-Paste Ready)**
```text
Low 2800K golden-hour sunlight streams through tall conservatory glass panes at a 30-degree angle. A student stands beside a brass planter in subtle contrapposto and holds an unfolded handwritten letter. Her thumb and forefinger pinch the textured cotton paper and press a faint crease into the deckled edge. Her other fingertips press against the window pane, where her body heat leaves a faint circle of condensation on the glass. Her tareme eyes curve into soft crescents beneath translucent bangs. A thin film of moisture coats her lower eyelid margin and catches the amber rim light. Her parted lips release a quiet breath. In the foreground, an out-of-focus monstera leaf blurs the left edge of the frame. Volumetric crepuscular rays cut through the air and illuminate suspended dust motes. In the background, distant brass arches and purple sunset clouds dissolve into creamy circular bokeh discs.
```

**🔄 Iteration Pathway**
```text
1. Atmospheric Shift: Switch the light source to 6500K overcast drizzle. Raindrops streak down the exterior glass. Diffuse gray illumination flattens the shadow contrast and removes the crepuscular rays.
2. Camera Angle Shift: Lower the camera 45 degrees into a low-angle shot. Frame the subject from below against the conservatory glass roof and the open twilight sky.
3. Expression Shift: Replace the crescent eyes with an averted downward gaze. Tighten her lower eyelids and compress her lips into a resolute neutral line.
```

---

### Package 2: Dynamic Action Anime (Ufotable Chiaroscuro / Studio Trigger Kinetic Energy)

**🎛 Model & Engine Recommendation**
| Parameter | Value | Rationale |
|---|---|---|
| **Target Engine** | CircleStone Labs ANIMA-Base v1.0 | Handles high-density particle dynamics, intense chiaroscuro contrast, and multi-concept interaction physics cleanly. |
| **Aspect Ratio** | 16:9 Cinematic Widescreen ($1216 \times 688$) | Grants full lateral canvas space for severe dynamic foreshortening, weapon arcs, and particle trajectory trails. |
| **Style Reference** | Ufotable Chiaroscuro & Studio Trigger Kinetic Dynamism (`@krenz cushart`, `@hiroyuki imaishi`) | Directs sharp ink linework, saturated specular highlights, volumetric edge glows, and exaggerated perspective foreshortening. |

**🎚️ Engine-Specific Parameters**
- **Base Architecture:** Cosmos-Predict2-2B + Qwen3-0.6B Text Encoder
- **Sampler & Scheduler:** `dpmpp_2m_sde_gpu` with `beta57` scheduler (RES4LYF Node Pack)
- **Sampling Steps & CFG:** 40 steps, **CFG 4.5**
- **Artist Syntax:** `@krenz cushart, @hiroyuki imaishi` (`@` prefix required by CircleStone Labs)
- **BPE Tokenizer Alignment:** Comma followed by space everywhere (`, `), all tags lowercase with spaces, underscores exclusively on `score_*`.

**🏷️ Positive Prefix & Danbooru Anchors**
```text
masterpiece, best quality, score_7, safe, 1boy, solo, @krenz cushart, @hiroyuki imaishi, silver hair, tactical haori, tsurime, constricted pupils, clenched teeth, eye glint, spellblade, plasma arc, mid-air, dynamic angle, from below, dynamic foreshortening, combat stance, sparks, glowing embers, high contrast chiaroscuro, intense rim lighting
```

**🚫 Negative Prompt**
```text
worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration, 3d render, plastic skin, bad anatomy, deformed hands, extra limbs, stiff pose
```

**📝 Primary Narrative Prompt (Copy-Paste Ready)**
```text
Low-angle upward perspective captures a spell-blade warrior mid-dash above a shattered stone courtyard. His torso twists 30 degrees toward the viewer while his right arm thrusts a crystal blade forward in severe dynamic foreshortening. Both hands clamp the braided leather hilt with white-knuckled force. His tsurime eyes narrow into sharp slits. His constricted pupils lock onto his target with a sharp specular eye glint, while his clenched teeth bare in fierce resolve. A 9000K electric-cyan plasma arc erupts along the blade edge and casts hard chiaroscuro shadows across his face. 2000K orange sparks carve sharp rim accents along his wind-whipped dark coat. In the immediate foreground, defocused crystalline shards and motion-blurred smoke streak across the bottom frame. In the background, ruined gothic arches plunge into deep obsidian darkness.
```

**🔄 Iteration Pathway**
```text
1. Elemental Shift: Replace the electric-cyan plasma arc with a 1800K molten-fire vortex. Crimson flames engulf the blade and cast deep red chiaroscuro across his armor.
2. Perspective Shift: Rotate the camera to an extreme Dutch angle telephoto profile shot. Isolate his tsurime eyes, furrowed brow, and the glowing blade guard.
3. Action Shift: Change the attack pose to a two-handed downward cleave. His boots strike the cracked stone floor and kick up radial shockwave dust rings.
```
