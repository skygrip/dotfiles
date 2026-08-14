# Krea 2 Engine Guide & Parameter Playbook

Krea 2 Large is a state-of-the-art flow-matching diffusion transformer powered by a **Qwen3-VL** multimodal text encoder. It excels at complex lighting physics, photorealistic textures, compositional balance, and prompt adherence.

---

## 1. Engine Quirks & Best Practices

### 🚫 Negative Prompt Policy: STRICTLY BLANK
- **Never provide a negative prompt for Krea 2.**
- Flow-matching models process semantic space continuously. Passing negative tokens introduces attention drift, desaturates colors, and causes visual degradation.

### 🎥 Optics & Cinematography
Krea 2 understands optical physics and camera hardware. Ground all photographic scenes with concrete camera specs:
- **Lenses:** `85mm f/1.4 prime lens` (portraits), `35mm anamorphic lens with horizontal streak bokeh` (cinematic), `24mm wide-angle lens` (environmental architecture), `100mm macro lens` (micro-textures).
- **Sensors & Film Stock:** `35mm Kodak Portra 400 grain structure`, `Fujifilm Superia cool green undertones`, `Hasselblad medium format sensor resolution`.
- **Framing:** `Dutch angle`, `low-angle hero perspective`, `tight close-up eye framing`, `wide establishing shot`.

### 💡 Kelvin Lighting Physics
Specify exact color temperatures rather than vague adjectives:
- **`2200K–2700K`:** Candlelight, warm fireside glow, tungsten filament bulbs.
- **`3200K`:** Studio tungsten key light, golden hour backlight.
- **`4000K–4500K`:** Fluorescent streetlamps, pale sodium vapor lighting.
- **`5500K`:** Clean midday solar daylight.
- **`6500K–7500K`:** Diffuse overcast daylight, cloudy open sky.
- **`9000K–12000K`:** Blue hour twilight, cold winter shadows.

---

## 2. SwarmUI / KGW Local Parameters Guide

When generating with Krea 2 in local **SwarmUI** environments, the **KGW Rebalance** node enables per-layer attention steering across the 12 Qwen3-VL hidden states (`w0..w11`):

```
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│   Early Layers (0..3)   │    Mid Layers (4..7)    │   Late Layers (8..11)   │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ • Layout & Composition  │ • Object Form Binding   │ • Fine Surface Textures │
│ • Spatial Scale         │ • Color Harmony         │ • Specular Highlights   │
│ • Figure Posing & Lock  │ • Wardrobe & Styling    │ • Micro-Facial Geometry │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

---

## 3. The 8-Preset Suite (12-Layer, Code-Verified)

### 🏋️ 1. Pose & Anatomy Lock
* **Best For:** Complex multi-limb poses, acrobatic actions, hand interactions, groups.
* **KGW Multiplier:** `1.0–2.0` (Default: `1.50`)
* **Layer Vector:** `2.5,2.5,2.5,2.5,1.5,1.5,1.5,1.5,1.0,1.0,1.0,1.0`

### 🎬 2. Ultra-Cinematic & Creative Lighting
* **Best For:** Volumetric shafts, dramatic chiaroscuro, neon night scenes, anamorphic flares.
* **KGW Multiplier:** `1.0–2.0` (Default: `1.60`)
* **Layer Vector:** `1.0,1.0,1.0,1.0,2.5,3.5,4.0,4.0,3.5,4.5,5.0,4.0`

### 🎨 3. Clean 2D Anime & Linework
* **Best For:** Cell-shaded illustration, graphic novels, clean vector lines in Krea 2.
* **KGW Multiplier:** `1.0–1.5` (Default: `1.20`)
* **Layer Vector:** `2.0,2.0,2.0,2.0,1.5,1.5,1.0,1.0,1.0,1.0,1.2,1.2`

### 🎞️ 4. Raw 35mm Analog Film
* **Best For:** Documentary photography, street candids, vintage film grain, retro vibes.
* **KGW Multiplier:** `1.0–1.5` (Default: `1.30`)
* **Layer Vector:** `1.5,1.5,1.5,1.5,1.0,1.0,0.5,0.5,1.5,1.0,1.0,1.0`

### 🏛️ 5. Architecture & Environments
* **Best For:** Wide cityscapes, interior design, monumental structures, complex perspectives.
* **KGW Multiplier:** `1.0–1.5` (Default: `1.25`)
* **Layer Vector:** `2.0,2.0,2.0,2.0,2.5,2.5,2.5,2.5,1.5,3.0,1.5,1.0`

### 👤 6. Hyper-Focused Portraiture
* **Best For:** Close-up character portraits, skin pores, iris detail, hair strands.
* **KGW Multiplier:** `1.0–2.0` (Default: `1.80`)
* **Layer Vector:** `1.8,1.8,1.8,1.8,2.0,2.0,2.5,4.5,1.2,3.5,1.0,1.0`

### 🖌️ 7. Fine Art & Oil Painting
* **Best For:** Impasto textures, thick brush strokes, impressionist landscapes, canvas grain.
* **KGW Multiplier:** `1.5–2.5` (Default: `1.90`)
* **Layer Vector:** `1.0,1.0,1.0,1.0,1.5,1.5,1.5,4.0,8.0,2.0,6.0,1.0`

### ✨ 8. Flat Graphic & Minimalism
* **Best For:** Poster design, screen printing, high-contrast branding, minimal compositions.
* **KGW Multiplier:** `0.8–1.2` (Default: `1.00`)
* **Layer Vector:** `2.0,2.0,2.0,2.0,1.5,1.0,1.0,-1.0,1.0,-1.0,1.0,1.0`

---

## 4. Preset Blending Formula

To combine two challenges (e.g. detailed portrait with complex action pose):
1. **Average the 12-layer weights element-by-element**:
   $$\text{Layer}_i = \frac{\text{PresetA}_i + \text{PresetB}_i}{2}$$
2. **Set the multiplier to the midpoint** between both preset ranges.

> **Example (Pose Lock + Portraiture):**
> Multiplier: `1.65`  
> Vector: `2.15,2.15,2.15,2.15,1.75,1.75,2.0,3.0,1.1,2.25,1.0,1.0`

---

## 5. Complete Krea 2 Prompt Package Example

### Concept: "Cyberpunk investigative journalist in neon alley"

**🎛 Model & Engine Recommendation**
| Parameter | Value |
|---|---|
| **Target Engine** | Krea 2 Large (SwarmUI) |
| **Aspect Ratio** | 9:16 Vertical |
| **Style Reference** | *Blade Runner 2049* (Roger Deakins cinematography) — high-contrast volumetric teal and orange atmospheric haze |

**🎚️ SwarmUI / KGW Local Parameters**
- **Preset:** 🎬 Ultra-Cinematic & Creative Lighting
- **Multiplier:** `1.60`
- **per_layer_weights:** `1.0,1.0,1.0,1.0,2.5,3.5,4.0,4.0,3.5,4.5,5.0,4.0`

**🚫 Negative Prompt**
*(Leave blank — Krea 2 performs best without negative prompting)*

**📝 Primary Narrative Prompt**
> A determined investigative journalist wearing a worn leather trench coat stands in a rain-soaked cyberpunk back-alley. She holds a glowing amber holographic data-pad in her right hand at chest height. Raindrops streak her cheekbones and damp strands of dark hair stick to her forehead. She sets her jaw firmly and glances toward camera-left with sharp, focused eyes. 3200K amber glow from the data-pad illuminates her face, while 9000K cyan neon billboards overhead cast stark rim lighting along the wet shoulders of her coat. Shallow puddles reflect shattered neon signage across the asphalt. A 50mm f/1.4 prime lens captures the frame with cinematic depth of field, dissolving the crowded high-tech alley into soft anamorphic bokeh.

**🔄 Iteration Pathway**
1. Shift to high-angle surveillance perspective looking down through rusted fire escapes.
2. Add steam vents billowing 4500K pale backlight behind her silhouette.
3. Switch expression to sudden alarm as headlights sweep across her face from the alley entrance.
