# Anima / Anime Foundation Engine Guide

The **Anima / Cosmos / Animagine** model family specializes in high-fidelity 2D illustration, anime character design, clean linework, cell-shading, and stylized game key art. 

Unlike purely natural language engines, anime models rely on a **Hybrid Tag + Narrative Architecture**: structured Danbooru tags act as immutable semantic anchors, while active natural language prose shapes cinematic lighting, volumetric atmosphere, and dynamic depth.

---

## 1. Engine Quirks & Best Practices

### 🏷️ Hybrid Danbooru + Natural Language Strategy
Anime text encoders parse tags for precise anatomy, clothing cuts, and character features, while interpreting natural prose for scene staging:
1. **Danbooru Tags First (The Anchor Block):** Put 8–15 precise tags in the dedicated tag block to anchor subject identity, hair color, wardrobe, and primary pose.
2. **Active Prose Narrative (The Environment Block):** Write the descriptive paragraph in direct, present-tense sentences to control lighting temperature, depth of field, fabric texture, and background composition.

### 🚫 Negative Prompt Policy: MANDATORY
- **Always provide a targeted negative prompt for Anima and anime diffusion models.**
- Without negative conditioning, anime engines suffer from 3D CGI plastic bleed, western photorealistic skin creep, duplicate limbs, and rendering noise.

---

## 2. Standard Danbooru Tag Taxonomies

| Category | Recommended Danbooru Tags |
|---|---|
| **Subject Count** | `1girl`, `1boy`, `2girls`, `solo`, `multiple girls` |
| **Facial & Hair** | `silver hair`, `twintails`, `bangs`, `heterochromia`, `crescent eyes`, `open mouth`, `blush`, `pointy ears`, `horns` |
| **Wardrobe** | `sailor collar`, `pleated skirt`, `black corset`, `thighhighs`, `fingerless gloves`, `hoodie`, `trench coat` |
| **Posing & Staging** | `leaning forward`, `hand on hip`, `sitting on railing`, `looking at viewer`, `arms behind back`, `holding sword`, `profile` |
| **Camera & Framing** | `upper body`, `cowboy shot`, `full body`, `close-up`, `from below`, `from above`, `dynamic angle`, `dutch angle` |
| **Atmosphere** | `wind`, `floating petals`, `falling leaves`, `sparkles`, `lens flare`, `city lights`, `rain` |

---

## 3. Curated Negative Prompt Presets

### 🎨 Preset 1: Standard High-Grade 2D Anime
*Use for general anime illustrations, character portraits, and light novel covers:*
> `(worst quality, low quality:1.4), 3d, realistic, photorealistic, realistic skin texture, cgi, render, bad anatomy, bad hands, missing fingers, extra digits, poorly drawn face, mutation, deformed limbs, floating limbs, cropped, watermark, signature, username, blurry`

### 🗡️ Preset 2: Dynamic Action & Key Art
*Use for combat scenes, dynamic perspective shots, and complex multi-limb action:*
> `(worst quality, low quality:1.4), 3d, realistic, bad proportions, bad perspective, disconnected limbs, deformed fingers, extra arms, extra legs, static pose, flat colors, blurry background, logo, text, artifacts`

### ✒️ Preset 3: Flat Manga & Clean Cell-Shading
*Use for crisp linework, manga panels, and flat graphic anime art:*
> `(worst quality:1.4), 3d, photorealistic, soft shading, painterly, heavy gradients, messy lines, multiple views, sketch, draft, speech bubble, text, screentone moire`

---

## 4. Recommended Generation Parameters

| Setting | Recommended Range | Notes |
|---|---|---|
| **Sampler** | `Euler a` or `DPM++ 2M Karras` | Smooth gradients and crisp line definition |
| **Steps** | `24 – 32` | Below 20 causes line blur; above 35 oversaturates details |
| **CFG Scale** | `5.0 – 7.0` | Higher than 7.5 causes harsh high-contrast artifacting |
| **Clip Skip** | `2` (if configurable) | Standard for anime diffusion checkpoints |

---

## 5. Complete Anima Prompt Package Example

### Concept: "Silver-haired anime battle mage summoning ice crystals"

**🎛 Model & Engine Recommendation**
| Parameter | Value |
|---|---|
| **Target Engine** | Anima 2D / Animagine XL |
| **Aspect Ratio** | 4:5 Vertical Portrait |
| **Style Reference** | *Genshin Impact* & *Honkai Star Rail* splash key art — dynamic cell-shading, vibrant magical volumetric lighting, sharp linework |

**🏷️ Danbooru / Anchor Tags**
> `1girl, solo, silver hair, long twintails, ice horns, blue eyes, stern expression, closed mouth, white battle coat, gold trim, black thighhighs, detached sleeves, summoning ice, floating crystals, dynamic angle, upper body, looking at viewer`

**🚫 Negative Prompt**
> `(worst quality, low quality:1.4), 3d, realistic, photorealistic, realistic skin texture, cgi, render, bad anatomy, bad hands, missing fingers, extra digits, poorly drawn face, mutation, deformed limbs, floating limbs, cropped, watermark, signature, username, blurry`

**📝 Primary Narrative Prompt**
> A young battle mage with waist-length silver twintails channels frost magic on a shattered marble balcony. Sharp ice crystals float around her raised left hand. She stands in a three-quarter combat stance with her weight balanced on her back foot. A focused, determined gaze narrows her vivid sapphire eyes. She wears a tailored white military coat with ornate gold-embroidered epaulets and layered blue silk lapels. Cool 8000K cyan light radiates from the hovering ice shards, casting sharp rim highlights across her hair strands and gold buttons. In the background, dark stormy clouds part to reveal a massive pale crescent moon. An eye-level 50mm composition captures the crisp linework and clean cell-shaded shadows across her silhouette.

**🔄 Iteration Pathway**
1. Add wind mechanics: intense gusts lash her long twintails and coat tails horizontally across frame-right.
2. Elevate camera to a high dynamic angle looking down as ice spikes burst through the stone floor.
3. Shift expression to a subtle confident smirk as she points a glowing crystalline wand forward.
