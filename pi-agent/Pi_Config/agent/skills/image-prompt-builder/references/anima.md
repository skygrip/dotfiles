[← Back to Universal Prompt Builder Hub](../SKILL.md)

# CircleStone Labs ANIMA Prompt Engineering & Architecture Playbook

**ANIMA** is a 2-billion parameter anime and illustration text-to-image foundation model developed by **CircleStone Labs** and **Comfy Org** (a derivative of the **NVIDIA Cosmos-Predict2-2B-Text2Image** architecture). It is purpose-built for anime concepts, stylization, and non-photorealistic illustrations.

---

**Maximum Explicitness Rule:** In hardcore NSFW production, prioritize explicit description over poetic euphemism.

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

| Variant | File Name | Step Range | CFG Scale | Primary Use Case & Characteristics |
|---|---|---|---|---|
| **1. Anima-Aesthetic v1.0 / v1.1** | `anima-aesthetic` | 30–38 steps | **CFG 3.5–4.5** | High-aesthetic master render. Clean default style, rich color dynamic range. Zero `score_*` tags. |
| **2. Anima-Turbo v1.0 / v1.1 / v1.2** | `anima-turbo-v1.0` | **8–12 steps** | **CFG 1.0** | Distilled for ultra-fast generation (~1s). High consistency. Negative prompt is inert. |
| **3. Anima-Base v1.0** *(Legacy/Raw)* | `anima-base-v1.0` | 30–50 steps | **CFG 4.5–5.0** | Unrefined base model for low-level LoRA training. |

### Optimal Samplers & Schedulers (Official CircleStone Recommendations)
* **`er_sde` (Default):** Neutral style, flat colors, sharp lines. Official recommended baseline.
* **`euler_a`:** Softer, thinner lines with a gentle 2.5D aesthetic. Can push CFG slightly higher without color burn.
* **`dpmpp_2m_sde_gpu`:** Higher creative variety; produces more dynamic variations on complex prompts.
* **`euler`:** Fast and stable; excellent for Anima-Turbo and Anima-Aesthetic.
* **`beta57` Scheduler (RES4LYF Node Pack):** Emphasizes low-noise timesteps for painterly textures and refined linework.
* **Resolution Range:** Supports native resolutions between **$512 \times 512$** and **$1536 \times 1536$** pixels ($1024 \times 1024$ or $1344 \times 768$ recommended).

---

## 3. Strict Prompting & Formatting Syntax Rules

### 1. The Comma-Space Tokenizer Rule (Crucial for Qwen BPE)
* **Always follow commas with a space (`", "`):** In Qwen's BPE vocabulary, a comma immediately preceding an alphanumeric character without a space (e.g. `,1girl` or `,artist`) merges into an unintended composite token. Always format tags as: `1girl, solo, black hair`.

### 2. The Lowercase & Spacing Rule
* **Use lowercase and spaces** for all Danbooru/Gelbooru tags: `black hair`, `pleated skirt`, `looking at viewer`.
* **Never use underscores for tags** (e.g. ❌ `black_hair`, ❌ `looking_at_viewer`).
* **Zero Boilerplate Rule:** Do not include `masterpiece`, `best quality`, `safe`, or `score_*` tags. Start prompts directly with character count and visual anchors: `1girl, solo, ...`.

### 3. Artist & Key Designer Tag Syntax (`@` Prefix)
* **Default Policy (LoRA-Ready):** Do **NOT** add artist or studio tags to primary baseline prompts by default unless explicitly requested by the user. Keeping prompts style-neutral allows the base model to render cleanly and makes prompts 100% compatible with LoRA style overwrites.
* **Suggesting Artist Styles (Exploration & Iteration):** While keeping the primary prompt style-neutral, proactively recommend 1–2 compatible `@` artist tags in the **Iteration Pathway** or as optional stylistic upgrades (e.g. suggesting `@soejima shigenori` for sharp graphic game-art chiaroscuro, `@fuzichoco` for delicate fantasy layers, or `@redjuice` for sci-fi precision).
* **When Instructed:** Always prefix artist names with `@` (e.g. `@soejima shigenori`, `@yamashita ikuto`). CircleStone Labs explicitly notes: *"You must put @ in front of the artist. The effect will be very weak if you don't."*

* **Syntax Rules for Artist Tags (AI Agent Directives):**
  - **Danbooru Surname-First Order:** Japanese creators are indexed surname-first: `@sadamoto yoshiyuki`, `@yamashita ikuto`, `@toriyama akira`, `@imaishi hiroyuki`, `@kubo tite`, `@murata range`, `@soejima shigenori`, `@yoshida akihiko`, `@amano yoshitaka`, `@miura kentaro`.
  - **Prefix & Spaces:** Always prefix with `@` and use spaces instead of underscores: `@soejima shigenori` (never `@soejima_shigenori` or `soejima shigenori`).
  - **Weighting & Blending:** Support artist blending via colon weighting when requested: `(@artist name:1.2)`. *(Note: Anima responds best to higher attention weights, e.g. `(chibi:2)` or `(@artist name:1.5)`).*
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
16. **`@abec`** — *Sword Art Online*
    - *Aesthetic:* Clean fantasy adventurer designs, vivid eye highlights, delicate linework, and precise armor plating.

##### 6. Classic & Retro Cel Animation
17. **`@sadamoto yoshiyuki`** — *Neon Genesis Evangelion*, *FLCL*, *The Girl Who Leapt Through Time*, *Summer Wars*, *Nadia*
    - *Aesthetic:* Classic 1990s Gainax character design, expressive eyes, clean analog-era cel shading, and iconic silhouette definition.
18. **`@yamashita ikuto`** — *Neon Genesis Evangelion* (Lead Mecha Designer), *Evangelion ANIMA*, *Yukikaze*, *Blue Submarine No. 6*
    - *Aesthetic:* Iconic mechanical and biomechanical engineering, slender robotic silhouettes, complex hydraulics, and high-contrast armor panels.
19. **`@murata range`** — *Last Exile*, *Blue Submarine No. 6*, *Shangri-La*, *Cop Craft*
    - *Aesthetic:* Retro-futuristic dieselpunk/steampunk design, tactile leather/brass textures, rounded mechanical apparatus, and muted pastel palettes.

### 4. Gelbooru Tag Preference
* When a tag differs between Danbooru and Gelbooru, Anima was trained with a preference for the **Gelbooru version**.

### 5. Multi-Character Staging & Anti-Split-Screen Protocol

When generating multiple characters performing distinct actions in Anima (especially **Anima-Turbo at CFG 1.0** where negative prompts are inert), avoid meta-layout phrases (`split into`, `segmented into`, `two halves`) which cause literal panel borders. Anchor characters directly to continuous environmental props and enforce high-contrast attribute separation (see [**`SKILL.md` §3.D: Multi-Actor Environmental Staging**](../SKILL.md#d-multi-actor-environmental-staging--anti-split-screen-protocol)).

#### Anima-Specific Multi-Character Rules:
1. **Camera Framing & Continuous Scene Anchors:** Prepend `wide shot` or `scenery` alongside the count tag in the Danbooru prefix (`2girls, wide shot, scenery, `) and use continuous wide phrasing in the prose (*"In a wide continuous shot..."*).
2. **Danbooru Count Tag Precision:** Always align the count tag with the exact cast:
   - `2girls` (2 female characters)
   - `1boy, 1girl` (1 male, 1 female character)
   - `2girls, 1boy` (2 female, 1 male characters)
   - `multiple girls` / `multiple boys` (4+ characters)
3. **Danbooru Spatial & Relational Tag Vocabulary:**
   * **Spatial Placement:** `standing side by side`, `back-to-back`, `facing away`, `facing each other`, `walking together`, `seated together`, `over-the-shoulder`.
   * **Gaze & Interaction:** `looking at each other`, `looking away`, `gaze into distance`, `talking to each other`, `pointing`, `laughing together`.
   * **Physical Contact:** `hand on another's shoulder`, `arm around another's waist`, `holding hands`, `head on another's shoulder`, `interlocked fingers`.
4. **The Left-to-Right Single-Sentence Binding Formula:**
   To prevent cross-attention trait bleeding (e.g. hair color or clothing swapping between characters), bind each character's spatial slot, physical appearance, and action into a single unbroken clause:
   > *"In [shared environment], [Actor 1 on left + appearance + dedicated action] while across the room on the right, [Actor 2 on right + contrasting appearance + distinct action], under [two-tone Kelvin lighting]."*
5. **Enforce Extreme Contrast (Hair, Silhouette, & Wardrobe):**
   Always assign contrasting palettes and silhouettes to prevent self-attention latent bleeding (e.g., Actor 1: *short silver hair, dark navy robe, precision tweezers* vs. Actor 2: *braided amber hair, cream linen apron, pointing out window*).
6. **Negative Prompt Shield (CFG > 1.0 / Base & Aesthetic):**
   ```text
   split screen, multiple views, comic panel, manga panel, collage, border, diptych, triptych, grid, frame, partitioned, two shots, trait bleeding, color bleed
   ```

### 6. Tag Order Hierarchy (CircleStone Labs Standard)
```text
[1girl/1boy/1other count], [character name], [series title], [artist: @name], [medium/style: cel shading, anime screencap, 2d], [general/appearance/clothing tags], [action/scene/lighting tags]
```
*(Within each bracketed tag section, tags can be arranged in arbitrary order.)*

#### Complete Tag Taxonomy & Supported Vocabulary:
* **Character Count & Identity Anchors:**
   - `1girl`, `1boy`, `2girls`, `2boys`, `1boy 1girl`, `solo`, `multiple girls`, `multiple boys`
* **Time Period & Release Year Tags:**
   - *Specific years:* `year 2025`, `year 2024`, `year 2023`, `year 2020`, `year 2010`, `year 2000`, `year 1990`, etc.
   - *Period tags:* `newest`, `recent`, `mid`, `early`, `old`
* **Meta & Medium Tags:**
   - `anime screenshot`, `official art`, `key visual`, `cover`, `traditional media`, `watercolor`, `lineart`, `cel shading`, `anime screencap`, `2d`, `clean lineart`
* **Character & Series Naming + Appearance Co-Prompting:**
   - Follow standard English capitalization rules for character and franchise names (e.g. `Fern`, `Sousou no Frieren`, `Oomuro Sakurako`, `Yuru Yuri`).
   - *Co-Prompting Rule:* Name the character and immediately follow with their basic visual appearance (hair style/color, eyes, core outfit). When prompting multiple characters, this is essential to prevent trait bleeding.
* **Tag Dropout Resilience:**
   - Anima was trained with random tag dropout, so it is resilient if non-essential tags are omitted.

### 7. Zero-Redundancy Division of Labor (Danbooru Anchors vs. Narrative Prose)
To maximize cross-attention density and prevent token dilution in Anima's Cosmos+Qwen architecture, aim for the tiered word budget (**45–65 words** for Turbo/Anime, **85–110 words** for multi-actor scenes) with a strict division of labor:

> 🚫 **The Danbooru Tag Blacklist Rule:** Any noun, costume, creature, object, or environment tag placed in the Danbooru tag prefix (`flight suit`, `jellyfish`, `sketchbook`, `shrine`, `mecha`, `rain`) is **STRICTLY BANNED from being repeated in the narrative prose block.**
> 
> * **Danbooru Anchors (Prefix):** Handle character identity, core wardrobe, art medium, creatures, and eye geometry (`1girl, flight suit, giant robot hand, desert, tareme, `).
> * **Narrative Prose (Prose Block):** Focuses EXCLUSIVELY on kinetic contrapposto, tactile grip pressure, Kelvin lighting, and 3-plane optical staging.
> 
> **Examples of Division of Labor:**
> - ❌ **Bad (Duplicate Waste):** `...1girl, flight suit, giant robot hand, desert, A pilot in a flight suit leans against a giant robot hand in the desert...`
> - ✅ **Good (Zero-Redundancy):** `...1girl, flight suit, giant robot hand, desert, She rests her weight in heavy contrapposto against the rusted iron palm, her fingers gripping a hydraulic joint with white-knuckled pressure as 5000K sunlight cuts through dust motes.`

### 8. Mitigating "Domain Leakage" (Real-World Gear & 2.5D Style Bleed)

When prompting technical equipment, tactical gear, or suits that predominantly exist in photographic training data (e.g. `scuba gear`, `diving regulator`, `spacesuit`, `tactical armor`, `firefighter gear`, `gas mask`), photographic priors can leak into character faces and shaders (see [**`SKILL.md` §4.D: CircleStone Labs ANIMA**](../SKILL.md#d-circlestone-labs-anima-cosmos-2b--qwen3-anime-engine)).

#### Anima Double-Shield Mitigation:
1. **Positive 2D Medium Anchors (Prefix):** Prepend explicit 2D cel medium anchors alongside gear tags:
   ```text
   cel shading, anime screencap, 2d, clean lineart, vibrant anime aesthetic, scuba gear, diving regulator
   ```
2. **Negative Anti-Realism Shield (for CFG > 1.0):** Append the anti-realism token block:
   ```text
   semi-realistic, 2.5d, 3d render, cgi, digital painting, photorealistic, realistic nose, realistic face, airbrush, oily skin
   ```

### 9. Non-Anime Dataset Tags (`ye-pop` & `deviantart`)

To produce fine art, oil paintings, and fantasy concepts without anime stylization, Anima was trained on ~800k curated non-anime artistic images (LAION-POP `ye-pop` and DeviantArt). Place the dataset tag on the **first line** followed by a newline:

* **`ye-pop` format:**
  ```text
  ye-pop
  [Optional alt-text / work title]
  [Artistic natural language description / tags]
  ```
  *Example:*
  ```text
  ye-pop
  For Sale: Others by Arun Prem
  Abstract, oil painting of three faceless, blue-skinned figures. Left: white, draped figure; center: yellow-shirted, dark-haired figure; right: red-veiled, dark-haired figure carrying another. Bold, textured colors, minimalist style.
  ```

* **`deviantart` format:**
  ```text
  deviantart
  [Artwork title]
  [Detailed digital painting description]
  ```
  *Example:*
  ```text
  deviantart
  Flame
  Digital painting of a fiery dragon with glowing yellow eyes, black horns, and a long, sinuous tail, perched on a glowing, molten rock formation. The background is a gradient of dark purple to orange.
  ```

---

## 4. Facial Emotion & Micro-Geometry Taxonomy

To achieve deep emotion in Anima, avoid flat labels like `sad` or `happy`. Use Anima's rich Danbooru ocular and mouth vocabulary:

| Emotional Subtext | Eye & Gaze Tags | Mouth & Facial Tension Tags |
|---|---|---|
| **Suppressed Grief / Nostalgia** | `half-closed eyes`, `watery eyes`, `tears in eyes`, `looking down` | `parted lips`, `trembling mouth`, `subtle blush` |
| **Intense Resolve / Defiance** | `tsurime`, `constricted pupils`, `direct gaze`, `eye glint` | `clenched teeth`, `grimace`, `slight smirk` |
| **Quiet Skepticism / Deadpan** | `jitome`, `half-closed eyes`, `looking away` | `firm neutral lips`, `slight frown` |
| **Gentle Tenderness / Serenity** | `tareme`, `crescent eyes`, `soft gaze` | `light smile`, `relaxed lips`, `cheek blush` |
| **Catastrophic Dread / Trauma** | `blank eyes`, `dilated pupils`, `sanpaku` | `mouth agape`, `shaded face`, `dark aura` |

---

## 5. Dynamic Posing, Tactile Actions & 3-Plane Anime Staging

Anima combines Danbooru perspective tags with rich narrative prose. For universal contrapposto rules, tactile blueprints, Kelvin lighting, and 3-plane optical staging, see [**`SKILL.md` §2–§4**](../SKILL.md#2-core-physical-pillars--optical-staging).

### Danbooru Dynamic Posing Anchors (Anti-Stiffness)
* **Perspective & Camera Angles:** `dynamic angle`, `dutch angle`, `from below`, `from above`, `worm's-eye view`, `pov`, `first-person view`, `selfie`, `dynamic foreshortening`.
* **Kinetic Weight & Stance:** `contrapposto`, `twisted torso`, `reaching towards viewer`, `combat stance`, `mid-stride`, `unposed`, `candid`.
* **Action Pose Asymmetry:** Always specify single-arm dominance in prose (*"single-arm spike, left arm dropped to waist for counterbalance"*) and pair with negative terms (*"two hands on ball, symmetrical pose"*) to prevent models from defaulting to symmetrical two-handed poses.
* **Secondary Wind Physics:** `hair flowing`, `wind blown clothing`, `floating ribbons`, `flying petals`, `sparks drifting`.
* **Lo-Fi & Retro Aesthetics vs. Clean Cel:** While `chromatic aberration` is standard in negative prompts for pristine modern cel animation, when deliberately generating gritty 1980s/90s retro OVA, cyberpunk, or found-footage anime, move `chromatic aberration` to positive tags (`retro anime screencap, vhs effect, subtle chromatic aberration, 1990s anime aesthetic`) and prune it from the negative prompt.

### Contrastive Relational Phrasing for Depth of Field (DoF)
In multi-entity or prop-heavy anime compositions, isolated tags like `depth of field`, `blurry background`, or `out of focus` cause ambiguous cross-attention blur across characters and linework. Always bind focus using **contrastive sentence fragments** with coordinating relational clauses (`while`, `as`, `against`) as detailed in [**`SKILL.md` §2.A: Contrastive Relational Phrasing**](../SKILL.md#a-3-plane-optical-depth-staging--lens-physics).

---

## 6. Official Positive & Negative Formulas

### 1. Anima-Aesthetic Formulations (Master Quality)
* **Sampling:** 30–38 steps, **CFG 3.5–4.5** (`dpmpp_2m_sde_gpu` + `beta57` or `er_sde`).
* **Positive Formulation:**
  ```text
  [count], [optional @artist], [medium/lighting], [appearance/wardrobe], [kinetic narrative prose]
  ```
* **Negative Prompt (Anti-Realism & Artifact Shield):**
  ```text
  worst quality, low quality, semi-realistic, 2.5d, 3d render, cgi, digital painting, photorealistic, realistic face, airbrush, oily skin, artist name, blurry, bad anatomy, deformed hands, extra limbs, stiff pose
  ```

### 2. Anima-Turbo Formulations (Fast Distilled)
* **Sampling:** 8–12 steps, **CFG 1.0** (`euler` or `dpmpp_2m_sde_gpu`).
* **Positive Formulation:** Starts directly with character count and visual anchors (`1girl, solo, ...`).
* **Negative Prompt:** *(Leave empty / bypassed at CFG 1.0)*

### 3. The 2.5D Style-Leakage Shield (Real-World Equipment & Technical Gear)
When prompting complex technical gear that predominantly exists in photographic training data (e.g. `scuba gear`, `diving mask`, `astronaut suit`, `tactical combat armor`, `firefighter gear`):
* **Positive Anchors:** Prepend `cel shading, anime screencap, 2d, clean lineart, vibrant anime aesthetic, @kyoani, `.
* **Targeted Negative Shield:**
  ```text
  semi-realistic, 2.5d, 3d render, cgi, digital painting, photorealistic, realistic nose, realistic face, airbrush, oily skin
  ```

---

## 7. Production-Ready Examples

### Example 1: Theatrical Slice of Life / Atmospheric Anime (Makoto Shinkai Observatory Twilight)
* **Configuration:** ANIMA-Aesthetic v1.0 | **Aspect Ratio:** `16:9` ($1344 \times 768$) | **Sampler/CFG:** `dpmpp_2m_sde_gpu` + `beta57` (38 steps, **CFG 4.0**) | **Artist:** `@shinkai makoto`

**📝 Primary Positive Prompt:**
```text
1girl, solo, @shinkai makoto, astronomy researcher, observatory, brass telescope, twilight, starry sky, cel shading, anime screencap, 2d, clean lineart, vibrant anime aesthetic, Foreground: copper dome shutter edges dissolve in soft defocus. In the midground, the 24-year-old astronomy researcher shifts her weight onto her back heel, fingers turning the brass focus wheel with firm tactile resistance. Analytical focus tightens her inner brow with taut lower eyelids and a pinpoint star reflection. A 2600K amber horizon gradient melts into deep 8000K indigo night across distant cumulonimbus clouds.
```

**🚫 Negative Prompt:**
```text
worst quality, low quality, semi-realistic, 2.5d, 3d render, cgi, digital painting, photorealistic, realistic face, airbrush, oily skin, artist name, blurry, bad anatomy, deformed hands, extra fingers, missing fingers, floating limbs
```

**🔄 Iteration Pathway:**
1. **Lighting / Atmosphere Shift:** Transition from twilight dusk (2600K amber / 8000K indigo) to deep midnight astrophotography with 10000K celestial bioluminescence and Milky Way nebula glow.
2. **Optics / POV Shift:** Switch to an over-the-shoulder low-angle 24mm wide shot looking up past illuminated star charts on the desk toward the open dome ceiling.
3. **Kinetic / FACS Shift:** Evoke quiet wonder—eyebrows softly arched upward and lips slightly parted in awe as a meteor streak reflects across her corneas.
4. **Artist / Lineart Dialect Shift:** Swap `@shinkai makoto` for `@sadamoto yoshiyuki` or `@soejima shigenori` to bias toward crisp 90s key animation linework with flat cel paint fills and muted mechanical tones.

---

### Example 2: Dynamic Kinetic Action / Shonen Energy (Studio Trigger & Persona 5 Chiaroscuro)
* **Configuration:** ANIMA-Aesthetic v1.0 | **Aspect Ratio:** `16:9` ($1344 \times 768$) | **Sampler/CFG:** `dpmpp_2m_sde_gpu` + `beta57` (38–40 steps, **CFG 4.5**) | **Artists:** `@imaishi hiroyuki, @soejima shigenori`

**📝 Primary Positive Prompt:**
```text
1boy, solo, @imaishi hiroyuki, @soejima shigenori, martial artist, sleeveless dogi, sash, wrist wraps, tsurime, jump kick, midair, from below, dynamic angle, dynamic foreshortening, cel shading, anime screencap, 2d, In the foreground, an out-of-focus vortex of glowing crimson maple leaves whips across the lens. In the midground, a 22-year-old martial artist leaps into a flying spin kick with twisted torso, clamping his lead fist and tightening his jaw in focused defiance. Crisp 3000K sunset rim light carves his silhouette against 8000K cyan wind glow as distant crags dissolve into soft twilight bokeh.
```

**🚫 Negative Prompt:**
```text
worst quality, low quality, semi-realistic, 2.5d, 3d render, cgi, digital painting, photorealistic, realistic face, realistic nose, airbrush, oily skin, artist name, blurry, jpeg artifacts, chromatic aberration, bad anatomy, deformed hands, extra limbs, stiff pose
```

**🔄 Iteration Pathway:**
1. **Atmosphere & Lighting Shift:** Transition the scene to a 6500K moonlit midnight setting. Replace the 8000K cyan wind glow with an electric violet lightning aura, casting sharp raking specular highlights across the martial artist's dogi and wrist wraps.
2. **Optics & Perspective Shift:** Lower the camera to extreme ground level with an 80-degree upward Dutch angle (`from below`, `extreme low angle`), shooting directly through the leaf cyclone to push dynamic foreshortening on the striking heel.
3. **Kinetic & FACS Shift:** Swap the aerial spin kick for a grounded two-handed downward palm strike impact; modify facial tension to hard-furrowed brows and bared clenched teeth as shockwaves rupture the stone floor.
4. **Stylistic / Artist Shift:** Swap `@soejima shigenori` to `@kubo tite` for stark high-contrast black-and-white ink balances (*Bleach*), or to `@toriyama akira` for rounded muscular planar cel shading and classic shonen momentum (*Dragon Ball*).

---

### Example 3: Painterly Fine Art / Botanical Fantasy (Yoshida Akihiko & Fuzichoco Aesthetic)
* **Configuration:** ANIMA-Aesthetic v1.0 | **Aspect Ratio:** `4:5` ($896 \times 1152$) | **Sampler/CFG:** `er_sde` + `beta57` (38 steps, **CFG 4.0**) | **Artists:** `@yoshida akihiko, @fuzichoco`

**📝 Primary Positive Prompt:**
```text
1girl, solo, @yoshida akihiko, @fuzichoco, tareme, linen tunic, leather satchel, woven basket, ancient woodland, depth of field, Foreground: out-of-focus ferns frame the path. In the midground, the 26-year-old herbalist strides along the mossy trail in graceful contrapposto, delicate fingertips supporting the wicker handle, as a serene smile lifts her cheeks with relaxed lips. Dappled 4800K canopy sunbeams illuminate her shoulders against soft spore luminescence, while towering background tree roots dissolve into creamy circular bokeh discs.
```

**🚫 Negative Prompt:**
```text
worst quality, low quality, artist name, blurry, jpeg artifacts, chromatic aberration, semi-realistic, 2.5d, 3d render, cgi, photorealistic, realistic face, airbrush, oily skin, bad anatomy, deformed hands, extra limbs, stiff pose
```

**🔄 Iteration Pathway:**
1. **Atmosphere & Kelvin Shift:** Shift ambient lighting to `2800K dawn mist`, having directional golden amber crepuscular sunbeams slice through heavy canopy humidity to create high-contrast specular rim highlights across the tunic.
2. **Optics & Perspective Shift:** Lower the camera to ground level embedded within the foreground ferns, tilting the lens $45^\circ$ upward along the ascending root trail for dramatic vertical depth.
3. **Tactile Interaction & FACS Shift:** Have the herbalist pause mid-stride, extending an open palm to catch a drifting luminous spore while shifting the basket into the crook of her elbow, her expression transitioning into wide-eyed wonder with softly parted lips.
4. **Stylistic & Medium Shift:** Replace artist conditioning with `(@amano yoshitaka:1.1)` for ethereal flowing watercolor washes and filigree ornamentation, or `@demizu posuka` for dense, whimsical botanical perspective.

---

### Example 4: 1990s Retro Cel Sci-Fi / Mecha & Robotics (Young Flight Mechanic in Cliffside Hangar)
* **Configuration:** ANIMA-Aesthetic v1.0 | **Aspect Ratio:** `16:9` ($1344 \times 768$) | **Sampler/CFG:** `dpmpp_2m_sde_gpu` + `beta57` (38 steps, **CFG 4.0**) | **Artists:** `@sadamoto yoshiyuki, @yamashita ikuto`

**📝 Primary Positive Prompt:**
```text
1boy, solo, @sadamoto yoshiyuki, @yamashita ikuto, 1990s anime, retro anime, cel animation, cel shading, anime screencap, 2d, clean lineart, vibrant anime aesthetic, gouache background, cliffside hangar, glider chassis, denim overalls, work gloves, tsurime, sunset, Foreground: an out-of-focus spanner rack frames the lower edge. In the midground, the 24-year-old flight mechanic shifts his weight into taut contrapposto, cranking a socket wrench against hydraulic line resistance. Pinched brows and taut eyelids sharpen his focused gaze. A 9000K cyan telemetry display cuts across 2400K golden twilight as distant clouds dissolve into soft bokeh.
```

**🚫 Negative Prompt (with 2.5D Anti-Realism Shield):**
```text
worst quality, low quality, semi-realistic, 2.5d, 3d render, cgi, digital painting, photorealistic, realistic face, realistic nose, airbrush, oily skin, smooth digital art, 3d model, artist name, blurry, jpeg artifacts, chromatic aberration, bad anatomy, deformed hands, extra limbs, stiff pose
```

**🔄 Iteration Pathway:**
1. **Lighting / Atmosphere Shift:** Transition ambient light to 1800K deep twilight storm; replace the telemetry glow with high-voltage 12000K cobalt electric arcs discharging across the hydraulic manifold.
2. **Optics / POV Shift:** Drop camera to a low-angle Dutch tilt beneath the glider's port wing spar, framing upward past the mechanic's wrench toward the cliff edge and open sea.
3. **Kinetic / FACS Shift:** Mechanic releases the wrench and wipes grease from his cheekbone with the back of a canvas glove, shifting facial expression to an asymmetric smirk with gaze deflected 20° off-axis.
4. **Artist / Aesthetic Shift:** Swap to `(@murata range:1.2)` for tactile dieselpunk brass fittings, rounded dials, and pastel leather tones (*Last Exile*), or `@redjuice` for hyper-precise micro-panel seams and glossy composite finishes (*Beatless*).

---

### Example 5: Multi-Character Complex Staging / Asymmetric Action (Alchemy Workshop)
* **Configuration:** ANIMA-Aesthetic v1.0 | **Aspect Ratio:** `16:9` ($1344 \times 768$) | **Sampler/CFG:** `dpmpp_2m_sde_gpu` + `beta57` (38 steps, **CFG 4.0**) | **Artists:** `@shinkai makoto, @soejima shigenori`

**📝 Primary Positive Prompt:**
```text
1boy, 1girl, wide shot, scenery, standing side by side, alchemy workshop, alembic, potions, window, airship, short hair, silver hair, braided hair, amber hair, robe, apron, rolled sleeves, @shinkai makoto, @soejima shigenori, cel shading, anime screencap, 2d, clean lineart, vibrant anime aesthetic, In a sunlit fantasy alchemy workshop, the 24-year-old male scholar on the left stands in a dark navy robe with short silver hair, his inner brows pinched tight and lower eyelids taut as his steady fingertips decant a glowing 9000K azure vial into the brass vessel with fine tweezers, while across the room on the right, the 22-year-old female assistant in a cream linen apron and braided amber hair leans over the timber sill, eyes wide with delight as her outstretched arm points toward the distant floating vessel, enveloped in warm 3000K golden sunlight.
```

**🚫 Negative Prompt:**
```text
worst quality, low quality, split screen, multiple views, comic panel, manga panel, collage, border, diptych, triptych, grid, frame, partitioned, two shots, semi-realistic, 2.5d, 3d render, cgi, digital painting, photorealistic, realistic face, realistic nose, airbrush, oily skin, smooth digital art, 3d model, artist name, blurry, jpeg artifacts, chromatic aberration, bad anatomy, deformed hands, extra limbs, extra fingers, missing fingers, stiff pose, trait bleeding, color bleed
```

**🔄 Iteration Pathway:**
1. **Atmosphere & Kelvin Contrast Shift (Midnight Bioluminescence):** Replace the 3000K golden sunlight with a deep 10000K starry indigo sky outside the window, amplifying the 9000K azure potion into the primary high-contrast key light casting specular highlights across the scholar's silver hair and brass alembic.
2. **Optics & Depth-of-Field Perspective Shift (Over-the-Shoulder 3-Plane Staging):** Reposition camera to a dynamic low-angle 35mm perspective behind the alembic. Frame out-of-focus brass tubing in the foreground (25% defocus), keeping the 24-year-old scholar tack-sharp in the midground while the assistant and open sky dissolve into soft background bokeh.
3. **Facial Emotion & Kinetic Role Reversal:** Render the male scholar with arched brows, parted lips, and an alarmed gaze as an unexpected burst of azure steam erupts from the vessel, while the female assistant turns back over her shoulder with an asymmetric smirk and narrowed eyes (`jitome`).
4. **Stylistic Dialect & Key Animator Shift:** Swap `@shinkai makoto, @soejima shigenori` to `(@yoshida akihiko:1.1), @fuzichoco` for delicate botanical fantasy ornamentation and soft watercolor textures, or `@sadamoto yoshiyuki, @yamashita ikuto` for 1990s Gainax-era analog cel shading with sharp mechanical drafting lines.



