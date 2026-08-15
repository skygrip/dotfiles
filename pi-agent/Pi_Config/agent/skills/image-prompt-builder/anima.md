[← Back to Universal Prompt Builder Hub](SKILL.md)

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
  - **Natural Language Prose:** Directs multi-character environmental placement (*"On the sofa on the left..., across the room at the table on the right..."*), cinematic lighting, atmospheric storytelling, and emotional subtext without using meta-panel words.

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

### 3. Artist & Key Designer Tag Syntax (`@` Prefix)
* **Default Policy (LoRA-Ready):** Do **NOT** add artist or studio tags to primary baseline prompts by default unless explicitly requested by the user. Keeping prompts style-neutral allows the base model to render cleanly and makes prompts 100% compatible with LoRA style overwrites.
* **Suggesting Artist Styles (Exploration & Iteration):** While keeping the primary prompt style-neutral, proactively recommend 1–2 compatible `@` artist tags in the **Iteration Pathway** or as optional stylistic upgrades (e.g. suggesting `@soejima shigenori` for sharp graphic game-art chiaroscuro, `@fuzichoco` for delicate fantasy layers, or `@redjuice` for sci-fi precision).
* **When Instructed:** Always prefix artist names with `@` (e.g. `@soejima shigenori`, `@yamashita ikuto`). CircleStone Labs explicitly notes: *"You must put @ in front of the artist. The effect will be very weak if you don't."*

* **Syntax Rules for Artist Tags (AI Agent Directives):**
  - **Danbooru Surname-First Order:** Japanese creators are indexed surname-first: `@sadamoto yoshiyuki`, `@yamashita ikuto`, `@toriyama akira`, `@imaishi hiroyuki`, `@kubo tite`, `@murata range`, `@soejima shigenori`, `@yoshida akihiko`, `@amano yoshitaka`, `@miura kentaro`.
  - **Prefix & Spaces:** Always prefix with `@` and use spaces instead of underscores: `@soejima shigenori` (never `@soejima_shigenori` or `soejima shigenori`).
  - **Weighting & Blending:** Support artist blending via colon weighting when requested: `(@artist name:1.2)`.
  - **External Reference Catalog:** For additional styles, consult the [Anima 2B Style Explorer](https://anima.mooshieblob.com/) (40,000+ benchmarked Danbooru artist tags).

#### Curated High-Quality SFW Artist `@` Tags (Linked to Major Franchises)

##### 1. Cinematic Skies, Atmosphere & World-Building
1. **`@shinkai makoto`** — *Your Name* (*Kimi no Na wa*), *Weathering With You*, *Suzume*, *5 Centimeters per Second*
   - *Aesthetic:* Theatrical golden-hour sunsets, towering cumulus clouds, crepuscular light rays, and polished lens reflections.
2. **`@demizu posuka`** — *The Promised Neverland* (*Yakusoku no Neverland*), *Beyblade X*, *Splatoon*
   - *Aesthetic:* Dense multi-layered environmental perspective, whimsical architectural detail, atmospheric lighting, and dynamic wide-angle lenses.

##### 2. Graphic Styling, Chiaroscuro & Cyberpunk
3. **`@soejima shigenori`** — *Persona 3*, *Persona 4*, *Persona 5*, *Metaphor: ReFantazio*, *Catherine*
   - *Aesthetic:* High-contrast graphic UI styling, bold silhouette cutouts, vivid pop color blocking, and sharp character linework.
4. **`@redjuice`** — *Guilty Crown*, *Beatless*, *Project Itoh: The Empire of Corpses*, Supercell (*EGOIST*)
   - *Aesthetic:* High-precision sci-fi cyberpunk aesthetics, intricate mechanical elements, polished linework, and vibrant translucent hair shaders.
5. **`@shimadoriru`** — *Danganronpa V3*, *Fate/Grand Order* (Servant Character Designs), *Chaos Dragon*
   - *Aesthetic:* High-contrast black ink shadows, aggressive angular eye geometry, and dramatic high-tension game art.

##### 3. Painterly Fine Art, High Fantasy & Watercolor
6. **`@yoshida akihiko`** — *NieR:Automata*, *Bravely Default*, *Final Fantasy Tactics*, *Granblue Fantasy*, *Tactics Ogre*
   - *Aesthetic:* Muted earthy fantasy palettes, delicate cross-hatching, refined character anatomy, and painterly textile textures.
7. **`@amano yoshitaka`** — *Final Fantasy* (I through X character & logo designs), *Vampire Hunter D*, *Casshan*, *Gatchaman*
   - *Aesthetic:* Ethereal flowing wispy ink lines, surreal watercolor washes, ornate ornamental fantasy, and elongated dreamlike figures.
8. **`@wlop`** — *Ghostblade*, *Cloudfall*
   - *Aesthetic:* Painterly semi-realistic digital fantasy, cinematic atmospheric backlighting, soft brushwork, and ethereal rim lighting on jewelry and hair.
9. **`@fuzichoco`** — *Ascendance of a Bookworm* (*Honzuki no Gekokujou*), *The 8th Son? Are You Kidding Me?*, *Magic: The Gathering*
   - *Aesthetic:* Intricate Japanese fantasy illustration, dense multi-layered environmental detail, kaleidoscopic vibrant colors, and floating decorative elements.

##### 4. Kinetic Action, Dark Fantasy & Shonen Energy
10. **`@imaishi hiroyuki`** — *Tengen Toppa Gurren Lagann*, *Kill la Kill*, *Cyberpunk: Edgerunners*, *Promare* (Studio Trigger)
    - *Aesthetic:* Hyper-kinetic dynamism, extreme perspective foreshortening, bold angular ink lines, and explosive action staging.
11. **`@kubo tite`** — *Bleach*, *Burn the Witch*, *Sakura Wars*
    - *Aesthetic:* High-contrast fashion-forward shonen aesthetic, stark black-and-white ink balance, sharp aggressive eye geometry (`tsurime`), and sharp angular streetwear.
12. **`@toriyama akira`** — *Dragon Ball*, *Dragon Ball Z*, *Chrono Trigger*, *Dr. Slump*, *Dragon Quest*
    - *Aesthetic:* Legendary classic manga aesthetic, rounded muscular anatomy, defined planar cel shading, expressive kinetic stances, and whimsical mechanical designs.
13. **`@miura kentaro`** — *Berserk*
    - *Aesthetic:* Dense microscopic cross-hatching, dark gothic fantasy grit, monumental armor weight, and intense visceral tension.

##### 5. Gentle Drama, Modern Moe & Pop Art
14. **`@mika pikazo`** — *Fire Emblem Engage*, VTuber designs (*Hakos Baelz*, *Kaguya Luna*)
    - *Aesthetic:* Electrifying pop-art anime aesthetic, ultra-vibrant hyper-saturated neon color palettes, and dazzling multi-color geometric eye highlights.
15. **`@tiv`** — *Masamune-kun's Revenge*, *Idolmaster Cinderella Girls*
    - *Aesthetic:* Ultra-clean modern commercial anime character art, bright pristine lighting, delicate facial expressions, and vibrant hair highlights.

##### 6. Classic & Retro Cel Animation
17. **`@sadamoto yoshiyuki`** — *Neon Genesis Evangelion*, *FLCL*, *The Girl Who Leapt Through Time*, *Summer Wars*, *Nadia*
    - *Aesthetic:* Classic 1990s Gainax character design, expressive eyes, clean analog-era cel shading, and iconic silhouette definition.
18. **`@yamashita ikuto`** — *Neon Genesis Evangelion* (Lead Mecha Designer), *Evangelion ANIMA*, *Yukikaze*, *Blue Submarine No. 6*
    - *Aesthetic:* Iconic mechanical and biomechanical engineering, slender robotic silhouettes, complex hydraulics, and high-contrast armor panels.
19. **`@murata range`** — *Last Exile*, *Blue Submarine No. 6*, *Shangri-La*, *Cop Craft*
    - *Aesthetic:* Retro-futuristic dieselpunk/steampunk design, tactile leather/brass textures, rounded mechanical apparatus, and muted pastel palettes.

### 4. Gelbooru Tag Preference
* When a tag differs between Danbooru and Gelbooru, Anima was trained with a preference for the **Gelbooru version**.

### 5. Multi-Character Staging & Anti-Split-Screen Protocol (Turbo & Base Models)

When staging two or more characters in Anima, models (especially **Anima-Turbo at CFG 1.0 where negative prompts are inert**) will generate **literal vertical dividing lines, split screens, diptychs, or comic panel frames** if the prompt uses meta-layout words. Follow these strict positive-prompt rules:

#### 🚫 1. Banned Meta-Panel Phrasing (Zero Tolerance in Positive Prompts)
Never use phrases that describe partitioning the canvas:
* ❌ `"the image is segmented into..."`
* ❌ `"split into left and right..."`
* ❌ `"divided into sections..."`
* ❌ `"left side of the image: ... right side of the image: ..."`
* ❌ `"two halves"`, `"split screen"`, `"comic panel"`, `"multi-panel"`, `"diptych"`, `"triptych"`, `"sections"`

#### ✅ 2. Mandatory Positive Environmental Anchoring
Anchor subjects directly to physical room/environment objects within a single unified space:
* ✅ *"In an after-school literature clubroom, a girl with short dark blue hair sits on the vintage sofa on the left reading an open book. Across the room on the right, a girl with long blonde twin tails sits at a wooden table lifting a porcelain teacup to her lips."*
* ✅ *"A wide two-shot in a stone colosseum. On the left, a swordswoman drops into a low stance on the sandy arena floor with drawn blade. Across the arena on the right, a mage raises a glowing crystal staff as azure magic spirals into the air."*
* ✅ *"An adventuring party gathers in a rustic stone tavern. At the center table, [Knight]... Near the hearth, [Elf]... In a shadowed corner booth, [Catgirl]..."*

#### 🎥 3. Mandatory Single-Frame & Camera Framing Anchors
Always prepend wide continuous framing cues in both Danbooru tags and prose to ensure secondary characters are not crowded out:
* **Danbooru Tags:** Always include `wide shot` or `scenery` alongside the character count tag (e.g. `2girls, wide shot, scenery, `).
* **Prose:** Anchor with `"A wide-angle continuous shot...", "A medium wide two-shot in..."`.

#### 🏷️ 4. Danbooru Count Tag Precision
Always align the collective character count tag with the exact cast:
* `2girls` (for 2 female characters)
* `1boy, 1girl` (for 1 male and 1 female character)
* `2girls, 1boy` (for 2 female and 1 male characters)
* `2boys, 1girl` (for 2 male and 1 female characters)
* `multiple girls` / `multiple boys` (for 4+ characters)

#### 🛡️ 5. Negative Prompt Shield (For CFG > 1.0 / Base & Aesthetic Models)
For models with active negative conditioning (CFG 3.5–5.0), always append the anti-panel shield to the negative prompt:
```text
split screen, multiple views, comic panel, manga panel, collage, border, diptych, triptych, grid, frame
```

### 6. Tag Order Hierarchy (CircleStone Labs Standard)
```text
[quality/score tags], [subject count: 1girl/1boy], [character name], [series title], [artist: @name], [general/appearance/clothing tags], [action/scene/lighting tags]
```

### 7. Zero-Redundancy Division of Labor (Danbooru Anchors vs. Narrative Prose)
To maximize cross-attention density and prevent token dilution in Anima's Cosmos+Qwen architecture, aim for an **80–120 word budget** with a strict division of labor:

> 🚫 **The Danbooru Tag Blacklist Rule:** Any noun, costume, creature, object, or environment tag placed in the Danbooru tag prefix (`flight suit`, `jellyfish`, `sketchbook`, `shrine`, `mecha`, `rain`) is **STRICTLY BANNED from being repeated in the narrative prose block.**
> 
> * **Danbooru Anchors (Prefix):** Handle character identity, core wardrobe, art medium, creatures, and eye geometry (`masterpiece, best quality, score_7, safe, 1girl, flight suit, giant robot hand, desert, tareme, `).
> * **Narrative Prose (Prose Block):** Focuses EXCLUSIVELY on kinetic contrapposto, tactile grip pressure, Kelvin lighting, and 3-plane optical staging.
> 
> **Examples of Division of Labor:**
> - ❌ **Bad (Duplicate Waste):** `...1girl, flight suit, giant robot hand, desert, A pilot in a flight suit leans against a giant robot hand in the desert...`
> - ✅ **Good (Zero-Redundancy):** `...1girl, flight suit, giant robot hand, desert, She rests her weight in heavy contrapposto against the rusted iron palm, her fingers gripping a hydraulic joint with white-knuckled pressure as 5000K sunlight cuts through dust motes.`

### 8. Mitigating "Domain Leakage" (Real-World Gear & 2.5D Style Bleed)

When prompting technical equipment, tactical gear, or specialized suits that predominantly exist in photographic datasets (e.g. `scuba gear`, `diving regulator`, `spacesuit`, `firefighter gear`, `tactical armor`, `gas mask`):
* **The Failure Mode:** Photographic training priors from the real-world equipment leak into the character's face, hair shaders, and skin rendering, creating an unintended **2.5D semi-realistic / CG digital painting look** that breaks the 2D anime aesthetic.
* **The Double-Shield Mitigation Strategy:**
  1. **Positive 2D Medium Anchors (Prefix):** Prepend explicit 2D cel medium anchors directly alongside the gear tags:
     ```text
     cel shading, anime screencap, 2d, clean lineart, vibrant anime aesthetic, scuba gear, diving regulator
     ```
  2. **Negative Anti-Realism Shield:** Always append the anti-realism negative token block to suppress photographic and 3D rendering priors:
     ```text
     semi-realistic, 2.5d, 3d render, cgi, digital painting, photorealistic, realistic nose, realistic face, airbrush, oily skin
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
* **Action Pose Asymmetry:** Always specify single-arm dominance (*"single-arm spike, left arm dropped to waist for counterbalance"*) and pair with negative terms (*"two hands on ball, symmetrical pose"*) to prevent models from defaulting to symmetrical two-handed poses.
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

### 4. The 2.5D Style-Leakage Shield (Real-World Equipment & Technical Gear)
When prompting complex technical gear that predominantly exists in photographic training data (e.g. `scuba gear`, `diving mask`, `astronaut suit`, `tactical combat armor`, `firefighter gear`):
* **The Failure Mode:** Photographic dataset priors pull the face into a semi-realistic 2.5D digital painting / CG plastic look.
* **Positive Anchors:** Always prepend `cel shading, anime screencap, 2d, clean lineart, vibrant anime aesthetic, @kyoani, `.
* **Targeted Negative Shield:** Always append to the negative prompt:
  ```text
  semi-realistic, 2.5d, 3d render, cgi, digital painting, photorealistic, realistic nose, realistic face, airbrush, oily skin
  ```

---

## 7. Production-Ready Examples

### Example 1: Theatrical Slice of Life / Atmospheric Anime (Makoto Shinkai Observatory Twilight Aesthetic)

**📝 Unified Primary Positive Prompt (Copy-Paste Ready)**
```text
masterpiece, best quality, score_7, safe, 1girl, solo, @shinkai makoto, school uniform, pleated skirt, ponytail, tareme, observatory, telescope, twilight, distant city, depth of field, Foreground: a curved copper dome shutter frames the left edge in soft defocus. A student shifts her full weight onto her right heel and tilts her hips toward the heavy optic barrel. Her thumb and index finger grip the knurled brass wheel with firm contact pressure to turn the fine focus gear. Inner brows lift in quiet wonder (AU1+AU2) while dark irises catch pinpoint 6000K starlight. Background: a 2600K amber horizon gradient melts into indigo night, where valley streetlamps dissolve into creamy circular bokeh discs.
```

**🚫 Negative Prompt**
```text
worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration, 3d render, plastic skin, bad anatomy, deformed hands, extra limbs, stiff pose
```

**🎛 Model & Engine Recommendation**
| Parameter | Value | Rationale |
|---|---|---|
| **Target Engine** | ANIMA-Base v1.0 | Maximizes latent prompt adherence for fine Danbooru facial micro-geometry, volumetric light rays, and emotional atmosphere without pre-baking |
| **Aspect Ratio** | 16:9 Cinematic Widescreen ($1216 \times 688$) | Enhances horizontal horizon lines, panoramic observatory dome aperture, and sweeping sunset cloudscapes |
| **Style Reference** | Makoto Shinkai Theatrical Cinematography (*Your Name*, *Weathering With You*) | Provides delicate hair linework, translucent backlit bangs, optical lens bloom, and atmospheric golden-hour physics |

**🎚️ Engine-Specific Parameters**
- **Base Architecture:** Cosmos-Predict2-2B + Qwen3-0.6B Text Encoder
- **Sampler & Scheduler:** `er_sde` with `beta57` scheduler (RES4LYF Node Pack)
- **Sampling Steps & CFG:** 36 steps, **CFG 4.5**
- **Artist Syntax:** `@shinkai makoto` (`@` prefix required by CircleStone Labs)
- **BPE Tokenizer Alignment:** Comma followed by space everywhere (`, `), all tags lowercase with spaces, underscores exclusively on `score_*`.

**🔄 Iteration Pathway**
```text
1. Atmospheric Shift: Change the sky to 6500K overcast drizzle. Rain streaks across the copper dome aperture.
2. Perspective Shift: Lower the camera to floor level beside the tripod base and tilt the lens 45 degrees upward toward the open roof slit.
3. Interaction Shift: Shift her grip to the primary focuser barrel and turn her gaze 20 degrees toward the viewer with a subtle smile.
4. Artist Style Shift: Swap to `@demizu posuka` for dense whimsical architectural perspective (*The Promised Neverland*), or `@tiv` for pristine commercial character linework (*Masamune-kun's Revenge*).
```

---

### Example 2: Dynamic Kinetic Action / Shonen Energy (Studio Trigger & Persona 5 Graphic Chiaroscuro)

**📝 Unified Primary Positive Prompt (Copy-Paste Ready)**
```text
masterpiece, best quality, score_7, safe, 1boy, solo, @imaishi hiroyuki, @soejima shigenori, martial artist, sleeveless dogi, sash, wrist wraps, tsurime, clenched teeth, jump kick, midair, from below, dynamic angle, dynamic foreshortening, cyclone, maple foliage, dusk, depth of field, In the foreground, a glowing autumn leaf vortex whips across the lower lens. The young warrior leaps into a flying spin and twists his torso 35 degrees. He extends a single-arm strike and clamps his lead fist in a white-knuckled grip. His jaw tightens (AU31) beneath an intense, upward-angled gaze. Hard 3000K sunset rim light carves his athletic silhouette against an 8000K cyan wind glow. In the distant background, a rugged mountain ridge fades into purple twilight.
```

**🚫 Negative Prompt**
```text
worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration, 3d render, plastic skin, bad anatomy, deformed hands, extra limbs, stiff pose
```

**🎛 Model & Engine Recommendation**
| Parameter | Value | Rationale |
|---|---|---|
| **Target Engine** | ANIMA-Base v1.0 | Handles high-density particle dynamics, intense chiaroscuro contrast, and multi-concept interaction physics cleanly |
| **Aspect Ratio** | 16:9 Cinematic Widescreen ($1216 \times 688$) | Grants full lateral canvas space for severe dynamic foreshortening, rotational kinetic trajectory, and particle vortex trails |
| **Style Reference** | Studio Trigger Hyper-Dynamism & Persona 5 Graphic Chiaroscuro (`@imaishi hiroyuki`, `@soejima shigenori`) | Directs bold angular ink line weights, extreme perspective foreshortening, pop-contrast shadows, and explosive shonen action staging (*Gurren Lagann*, *Kill la Kill*, *Persona 5*) |

**🎚️ Engine-Specific Parameters**
- **Base Architecture:** Cosmos-Predict2-2B + Qwen3-0.6B Text Encoder
- **Sampler & Scheduler:** `dpmpp_2m_sde_gpu` with `beta57` scheduler (RES4LYF Node Pack)
- **Sampling Steps & CFG:** 40 steps, **CFG 4.5**
- **Artist Syntax:** `@imaishi hiroyuki, @soejima shigenori` (`@` prefix required by CircleStone Labs)
- **BPE Tokenizer Alignment:** Comma followed by space everywhere (`, `), all tags lowercase with spaces, underscores exclusively on `score_*`.

**🔄 Iteration Pathway**
```text
1. Lighting Shift: Switch to 6500K moonlit midnight. An electric violet lightning aura replaces the cyan wind glow.
2. Perspective Shift: Lower the camera to ground level. Point the lens 80 degrees upward through the leaf vortex.
3. Action Shift: Change the strike into a two-handed downward palm thrust that shatters cracked basalt stone.
4. Artist Style Shift: Swap to `@kubo tite` for stark high-contrast black-and-white ink tension (*Bleach*), or `@toriyama akira` for classic rounded muscular planar shading and kinetic manga stances (*Dragon Ball*).
```

---

### Example 3: Painterly Fine Art / Botanical Fantasy (Yoshida Akihiko & Fuzichoco Aesthetic)

**📝 Unified Primary Positive Prompt (Copy-Paste Ready)**
```text
masterpiece, best quality, score_7, safe, 1girl, solo, @yoshida akihiko, @fuzichoco, tareme, apprentice, linen tunic, leather satchel, woven basket, ancient forest, floating particles, depth of field, A young herbalist steps along a mossy trail in a graceful contrapposto stride. Delicate fingertips support the wicker handle of gathered botanicals. A serene smile lifts her cheeks (AU12). Dappled 4800K canopy sunbeams strike her shoulders while soft spore luminescence glows in the misty air. In the foreground, out-of-focus ferns frame the lower path. Behind her, towering tree roots dissolve into creamy circular bokeh discs.
```

**🚫 Negative Prompt**
```text
worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration, 3d render, plastic skin, bad anatomy, deformed hands, extra limbs, stiff pose
```

**🎛 Model & Engine Recommendation**
| Parameter | Value | Rationale |
|---|---|---|
| **Target Engine** | ANIMA-Base v1.0 | Renders delicate painterly cross-hatching, botanical watercolor textures, and luminous particle layers without 3D CGI plastic sheen |
| **Aspect Ratio** | 4:5 Vertical ($832 \times 1040$) | Accentuates vertical forest depth, descending canopy sunbeams, and the herbalist's contrapposto posture |
| **Style Reference** | Yoshida Akihiko & Fuzichoco Fantasy Aesthetic (`@yoshida akihiko`, `@fuzichoco`) | Fuses muted earthy fantasy palettes and refined character linework (*Bravely Default*, *NieR*) with vibrant kaleidoscopic botanical layers (*Ascendance of a Bookworm*) |

**🎚️ Engine-Specific Parameters**
- **Base Architecture:** Cosmos-Predict2-2B + Qwen3-0.6B Text Encoder
- **Sampler & Scheduler:** `er_sde` with `beta57` scheduler (RES4LYF Node Pack)
- **Sampling Steps & CFG:** 38 steps, **CFG 4.5**
- **Artist Syntax:** `@yoshida akihiko, @fuzichoco` (`@` prefix required by CircleStone Labs)
- **BPE Tokenizer Alignment:** Comma followed by space everywhere (`, `), all tags lowercase with spaces, underscores exclusively on `score_*`.

**🔄 Iteration Pathway**
```text
1. Atmospheric Shift: Switch lighting to 2800K dawn mist. Golden morning rays pierce heavy fog across the trail.
2. Perspective Shift: Lower camera to ground level among the ferns. Angle the lens 45 degrees up toward the canopy.
3. Interaction Shift: The herbalist pauses her stride and extends one hand outward to catch a drifting luminous spore.
4. Artist Style Shift: Swap to `@amano yoshitaka` for ethereal flowing watercolor washes (*Final Fantasy*), or `@demizu posuka` for dense whimsical botanical architecture (*The Promised Neverland*).
```

---

### Example 4: 1990s Retro Cel Sci-Fi / Mecha & Robotics (Young Flight Mechanic in Cliffside Hangar)

**📝 Unified Primary Positive Prompt (Copy-Paste Ready)**
```text
masterpiece, best quality, score_7, safe, 1boy, solo, @sadamoto yoshiyuki, @yamashita ikuto, 1990s anime, retro anime, cel animation, gouache background, slender glider, flight mechanic, short brown hair, denim overalls, work gloves, tsurime, cliffside hangar, sunset, depth of field, Foreground: an out-of-focus metal rack of spanners and calipers frames the lower edge. In the midground, the youth drops his weight onto his left boot in tense contrapposto beside the open chassis. His gloved hands crank a steel socket wrench against mechanical resistance at the hydraulic actuator. Focused resolve sharpens his gaze as a bright pin-light spark flashes across his irises. A 9000K cyan telemetry display casts a cool rim light along his jaw and cuts across warm 2400K golden twilight. Beyond the open bay, massive cumulus cloud banks drift over distant coastal crags.
```

**🚫 Negative Prompt**
```text
worst quality, low quality, score_1, score_2, score_3, semi-realistic, 2.5d, 3d render, cgi, digital painting, photorealistic, realistic face, realistic nose, airbrush, oily skin, smooth digital art, 3d model, artist name, blurry, jpeg artifacts, chromatic aberration, bad anatomy, deformed hands, extra limbs, stiff pose
```

**🎛 Model & Engine Recommendation**
| Parameter | Value | Rationale |
|---|---|---|
| **Target Engine** | ANIMA-Base v1.0 | Renders authentic 1990s hand-painted cel animation line weights, opaque gouache matte backdrops, and slender mechanical joint detailing without 2.5D CG plastic bleed |
| **Aspect Ratio** | 16:9 Cinematic Widescreen ($1216 \times 688$) | Accentuates horizontal cliffside perspective, expansive sunset cloudscapes, and the outstretched aerodynamic wing structure |
| **Style Reference** | 1990s Gainax retro cel sci-fi & mechanical engineering aesthetic (`@sadamoto yoshiyuki`, `@yamashita ikuto`) | Anchors iconic character facial geometry (*Neon Genesis Evangelion*, *FLCL*), slender biomechanical contours, high-contrast cel shadows, and analog film warmth |

**🎚️ Engine-Specific Parameters**
- **Base Architecture:** Cosmos-Predict2-2B + Qwen3-0.6B Text Encoder
- **Sampler & Scheduler:** `dpmpp_2m_sde_gpu` with `beta57` scheduler (RES4LYF Node Pack)
- **Sampling Steps & CFG:** 38 steps, **CFG 4.5**
- **Artist Syntax:** `@sadamoto yoshiyuki, @yamashita ikuto` (`@` prefix required by CircleStone Labs)
- **2.5D Style Shield:** Uses explicit 2D cel anchors and anti-realism negative tokens to suppress 3D CGI and photorealistic texture bleed on mechanical surfaces and character features
- **BPE Tokenizer Alignment:** Comma followed by space everywhere (`, `), all tags lowercase with spaces, underscores exclusively on `score_*`.

**🔄 Iteration Pathway**
```text
1. Lighting Shift: Shift ambient light to 1800K dusk. Electric cobalt sparks arc from the exposed battery terminal across the chassis.
2. Perspective Shift: Lower camera to a ground-level Dutch tilt beneath the wing spar. Frame upward past the mechanic toward the cliff edge.
3. Interaction Shift: The apprentice wipes grease from his cheek with a gloved wrist and inspects a handheld diagnostic display.
4. Artist Style Shift: Swap to `@murata range` for tactile retro-dieselpunk brass fittings and muted leather textures (*Last Exile*), or `@redjuice` for ultra-precise high-tech panel linework (*Beatless*).
```
