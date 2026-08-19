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

| Variant | File Name | Step Range | CFG Scale | Primary Use Case & Characteristics |
|---|---|---|---|---|
| **1. Anima-Base v1.0** | `anima-base-v1.0` | 30–50 steps | **CFG 4.0–5.0** | Pretrained, unrefined base. Maximum flexibility, diversity, LoRA training. |
| **2. Anima-Aesthetic v1.0 / v1.1 / v1.0b** | `anima-aesthetic` | 30–50 steps | **CFG 4.0–5.0** (or 3.5–4.5) | Fine-tuned on high-aesthetic images. High default consistency. No score tags. |
| **3. Anima-Turbo v1.0** | `anima-turbo-v1.0` | **8–12 steps** | **CFG 1.0** | Distilled for ultra-fast generation. Strong default style, lower diversity. |

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

### 5. Multi-Character Staging & Anti-Split-Screen Protocol

When generating multiple characters in Anima (especially **Anima-Turbo at CFG 1.0** where negative prompts are inert), avoid meta-layout phrases (`split into`, `segmented into`, `two halves`) which cause literal panel borders. Anchor characters directly to continuous environmental props (see [**`SKILL.md` §8: Multi-Actor Environmental Staging**](SKILL.md#8-multi-actor-environmental-staging--anti-split-screen-protocol-turbo--base-models)).

#### Anima-Specific Staging Rules:
1. **Camera Framing Tags:** Prepend `wide shot` or `scenery` alongside the count tag in the Danbooru prefix (`2girls, wide shot, scenery, `) and use continuous wide phrasing in the prose (*"A wide-angle continuous shot..."*).
2. **Danbooru Count Tag Precision:** Always align the count tag with the exact cast:
   - `2girls` (2 female characters)
   - `1boy, 1girl` (1 male, 1 female character)
   - `2girls, 1boy` (2 female, 1 male characters)
   - `multiple girls` / `multiple boys` (4+ characters)
3. **Negative Prompt Shield (CFG > 1.0 / Base & Aesthetic):**
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

When prompting technical equipment, tactical gear, or suits that predominantly exist in photographic training data (e.g. `scuba gear`, `diving regulator`, `spacesuit`, `tactical armor`, `firefighter gear`, `gas mask`), photographic priors can leak into character faces and shaders (see [**`SKILL.md` §5: Mitigating Domain Leakage**](SKILL.md#mitigating-domain-leakage-real-world-gear--medium-bleed)).

#### Anima Double-Shield Mitigation:
1. **Positive 2D Medium Anchors (Prefix):** Prepend explicit 2D cel medium anchors alongside gear tags:
   ```text
   cel shading, anime screencap, 2d, clean lineart, vibrant anime aesthetic, scuba gear, diving regulator
   ```
2. **Negative Anti-Realism Shield (for CFG > 1.0):** Append the anti-realism token block:
   ```text
   semi-realistic, 2.5d, 3d render, cgi, digital painting, photorealistic, realistic nose, realistic face, airbrush, oily skin
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

Anima combines Danbooru perspective tags with rich narrative prose. For universal contrapposto rules, tactile blueprints, Kelvin lighting, and 3-plane optical staging, see [**`SKILL.md` §2–§4**](SKILL.md#2-kinetic-posing-mechanics--anti-stiffness).

### Danbooru Dynamic Posing Anchors (Anti-Stiffness)
* **Perspective & Camera Angles:** `dynamic angle`, `dutch angle`, `from below`, `from above`, `dynamic foreshortening`.
* **Kinetic Weight & Stance:** `contrapposto`, `twisted torso`, `reaching towards viewer`, `combat stance`, `mid-stride`.
* **Action Pose Asymmetry:** Always specify single-arm dominance in prose (*"single-arm spike, left arm dropped to waist for counterbalance"*) and pair with negative terms (*"two hands on ball, symmetrical pose"*) to prevent models from defaulting to symmetrical two-handed poses.
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

### Example 1: Theatrical Slice of Life / Atmospheric Anime (Makoto Shinkai Observatory Twilight)
* **Configuration:** ANIMA-Base v1.0 | **Aspect Ratio:** `16:9` ($1216 \times 688$) | **Sampler/CFG:** `er_sde` + `beta57` (36 steps, **CFG 4.5**) | **Artist:** `@shinkai makoto`

**📝 Primary Positive Prompt:**
```text
masterpiece, best quality, score_7, safe, 1girl, solo, @shinkai makoto, school uniform, pleated skirt, ponytail, tareme, observatory, telescope, twilight, distant city, depth of field, Foreground: a curved copper dome shutter frames the left edge in soft defocus. A student shifts her full weight onto her right heel and tilts her hips toward the heavy optic barrel. Her thumb and index finger grip the knurled brass wheel with firm contact pressure to turn the fine focus gear. Inner brows lift in quiet wonder (AU1+AU2) while dark irises catch pinpoint 6000K starlight. Background: a 2600K amber horizon gradient melts into indigo night, where valley streetlamps dissolve into creamy circular bokeh discs.
```

**🚫 Negative Prompt:**
```text
worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration, 3d render, plastic skin, bad anatomy, deformed hands, extra limbs, stiff pose
```

**🔄 Iteration Pathway:**
1. Atmospheric Shift: Change the sky to 6500K overcast drizzle. Rain streaks across the copper dome aperture.
2. Perspective Shift: Lower the camera to floor level beside the tripod base and tilt the lens 45 degrees upward toward the open roof slit.
3. Interaction Shift: Shift her grip to the primary focuser barrel and turn her gaze 20 degrees toward the viewer with a subtle smile.
4. Artist Style Shift: Swap to `@demizu posuka` for dense whimsical architectural perspective (*The Promised Neverland*), or `@tiv` for pristine commercial character linework (*Masamune-kun's Revenge*).

---

### Example 2: Dynamic Kinetic Action / Shonen Energy (Studio Trigger & Persona 5 Chiaroscuro)
* **Configuration:** ANIMA-Base v1.0 | **Aspect Ratio:** `16:9` ($1216 \times 688$) | **Sampler/CFG:** `dpmpp_2m_sde_gpu` + `beta57` (40 steps, **CFG 4.5**) | **Artists:** `@imaishi hiroyuki, @soejima shigenori`

**📝 Primary Positive Prompt:**
```text
masterpiece, best quality, score_7, safe, 1boy, solo, @imaishi hiroyuki, @soejima shigenori, martial artist, sleeveless dogi, sash, wrist wraps, tsurime, clenched teeth, jump kick, midair, from below, dynamic angle, dynamic foreshortening, cyclone, maple foliage, dusk, depth of field, In the foreground, a glowing autumn leaf vortex whips across the lower lens. The young warrior leaps into a flying spin and twists his torso 35 degrees. He extends a single-arm strike and clamps his lead fist in a white-knuckled grip. His jaw tightens (AU31) beneath an intense, upward-angled gaze. Hard 3000K sunset rim light carves his athletic silhouette against an 8000K cyan wind glow. In the distant background, a rugged mountain ridge fades into purple twilight.
```

**🚫 Negative Prompt:**
```text
worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration, 3d render, plastic skin, bad anatomy, deformed hands, extra limbs, stiff pose
```

**🔄 Iteration Pathway:**
1. Lighting Shift: Switch to 6500K moonlit midnight. An electric violet lightning aura replaces the cyan wind glow.
2. Perspective Shift: Lower the camera to ground level. Point the lens 80 degrees upward through the leaf vortex.
3. Action Shift: Change the strike into a two-handed downward palm thrust that shatters cracked basalt stone.
4. Artist Style Shift: Swap to `@kubo tite` for stark high-contrast black-and-white ink tension (*Bleach*), or `@toriyama akira` for classic rounded muscular planar shading and kinetic manga stances (*Dragon Ball*).

---

### Example 3: Painterly Fine Art / Botanical Fantasy (Yoshida Akihiko & Fuzichoco Aesthetic)
* **Configuration:** ANIMA-Base v1.0 | **Aspect Ratio:** `4:5` ($832 \times 1040$) | **Sampler/CFG:** `er_sde` + `beta57` (38 steps, **CFG 4.5**) | **Artists:** `@yoshida akihiko, @fuzichoco`

**📝 Primary Positive Prompt:**
```text
masterpiece, best quality, score_7, safe, 1girl, solo, @yoshida akihiko, @fuzichoco, tareme, apprentice, linen tunic, leather satchel, woven basket, ancient forest, floating particles, depth of field, A young herbalist steps along a mossy trail in a graceful contrapposto stride. Delicate fingertips support the wicker handle of gathered botanicals. A serene smile lifts her cheeks (AU12). Dappled 4800K canopy sunbeams strike her shoulders while soft spore luminescence glows in the misty air. In the foreground, out-of-focus ferns frame the lower path. Behind her, towering tree roots dissolve into creamy circular bokeh discs.
```

**🚫 Negative Prompt:**
```text
worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration, 3d render, plastic skin, bad anatomy, deformed hands, extra limbs, stiff pose
```

**🔄 Iteration Pathway:**
1. Atmospheric Shift: Switch lighting to 2800K dawn mist. Golden morning rays pierce heavy fog across the trail.
2. Perspective Shift: Lower camera to ground level among the ferns. Angle the lens 45 degrees up toward the canopy.
3. Interaction Shift: The herbalist pauses her stride and extends one hand outward to catch a drifting luminous spore.
4. Artist Style Shift: Swap to `@amano yoshitaka` for ethereal flowing watercolor washes (*Final Fantasy*), or `@demizu posuka` for dense whimsical botanical architecture (*The Promised Neverland*).

---

### Example 4: 1990s Retro Cel Sci-Fi / Mecha & Robotics (Young Flight Mechanic in Cliffside Hangar)
* **Configuration:** ANIMA-Base v1.0 | **Aspect Ratio:** `16:9` ($1216 \times 688$) | **Sampler/CFG:** `dpmpp_2m_sde_gpu` + `beta57` (38 steps, **CFG 4.5**) | **Artists:** `@sadamoto yoshiyuki, @yamashita ikuto`

**📝 Primary Positive Prompt:**
```text
masterpiece, best quality, score_7, safe, 1boy, solo, @sadamoto yoshiyuki, @yamashita ikuto, 1990s anime, retro anime, cel animation, gouache background, slender glider, flight mechanic, short brown hair, denim overalls, work gloves, tsurime, cliffside hangar, sunset, depth of field, Foreground: an out-of-focus metal rack of spanners and calipers frames the lower edge. In the midground, the youth drops his weight onto his left boot in tense contrapposto beside the open chassis. His gloved hands crank a steel socket wrench against mechanical resistance at the hydraulic actuator. Focused resolve sharpens his gaze as a bright pin-light spark flashes across his irises. A 9000K cyan telemetry display casts a cool rim light along his jaw and cuts across warm 2400K golden twilight. Beyond the open bay, massive cumulus cloud banks drift over distant coastal crags.
```

**🚫 Negative Prompt (with 2.5D Anti-Realism Shield):**
```text
worst quality, low quality, score_1, score_2, score_3, semi-realistic, 2.5d, 3d render, cgi, digital painting, photorealistic, realistic face, realistic nose, airbrush, oily skin, smooth digital art, 3d model, artist name, blurry, jpeg artifacts, chromatic aberration, bad anatomy, deformed hands, extra limbs, stiff pose
```

**🔄 Iteration Pathway:**
1. Lighting Shift: Shift ambient light to 1800K dusk. Electric cobalt sparks arc from the exposed battery terminal across the chassis.
2. Perspective Shift: Lower camera to a ground-level Dutch tilt beneath the wing spar. Frame upward past the mechanic toward the cliff edge.
3. Interaction Shift: The apprentice wipes grease from his cheek with a gloved wrist and inspects a handheld diagnostic display.
4. Artist Style Shift: Swap to `@murata range` for tactile retro-dieselpunk brass fittings and muted leather textures (*Last Exile*), or `@redjuice` for ultra-precise high-tech panel linework (*Beatless*).
