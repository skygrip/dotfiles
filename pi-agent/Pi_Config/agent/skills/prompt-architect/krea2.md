[← Back to Universal Prompt Architect Hub](SKILL.md)

# Krea 2 (K2) Advanced Prompting & Optical Steering Playbook

Krea 2 Large is a **Single-Stream MMDiT (Diffusion Transformer) with Rectified Flow-Matching (RF-DiT)** conditioned on a **Qwen3-VL** multimodal text encoder. It utilizes cross-layer feature aggregation (`txtfusion`) to blend 12 discrete hidden layers `[L2, L5, L8, L11, L14, L17, L20, L23, L26, L29, L32, L35]` coarse-to-fine.

---

## 1. Technical Architecture & Text Encoder Mechanics

### 4 Functional Layer Bands in Krea 2
Ground-truth layer analysis reveals that the 12 tapped hidden layers form **4 functional bands of 3 layers each ($3 \times 4$)**:

```
┌──────────────────────────────────────┬──────────────────────────────────────┐
│  BAND 1: SHALLOW SCAFFOLDING (w0-w2) │   BAND 2: STRUCTURE & LAYOUT (w3-w5) │
│  • Taps: L2, L5, L8                  │   • Taps: L11, L14, L17              │
│  • Lexical anchoring & token noise   │   • Structural geometry & vanishing  │
│  • Unusable alone (renders as noise) │   • L14 carries scene layout & glyphs│
├──────────────────────────────────────┼──────────────────────────────────────┤
│  BAND 3: GLOBAL ATTENTION HUB (w6-w8)│   BAND 4: DEEP CONTENT & FACS (w9-w11)│
│  • Taps: L20, L23, L26               │   • Taps: L29, L32, L35              │
│  • L20 is universal attention hub    │   • Carries bulk of semantic detail  │
│  • Volumetric lighting & transitions │   • FACS micro-expressions & pores   │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

> **Why Rebalancing Works:** Krea 2's learned `txtfusion.projector` is contrastive ("mid-minus-deep"), which naturally suppresses deep layers `L23–L32` to balance encoder norm growth ($48\times$). Rebalancing with RMS normalization re-inflates the deep Band 4 layers, restoring facial expression nuance and skin micro-pores without image degradation.

---

## 2. Model Variants & Parameter Matrix

```
┌─────────────────────────┬──────────────┬────────────────────────┬──────────────────────────────────────────┐
│ Variant                 │ Step Range   │ CFG Scale              │ Primary Characteristics                  │
├─────────────────────────┼──────────────┼────────────────────────┼──────────────────────────────────────────┤
│ 1. Krea 2 Large / RAW   │ 25–40 steps  │ **CFG 3.0–5.0**        │ Maximum fidelity, rich micro-textures,   │
│                         │              │                        │ full dynamic range and lighting nuance.  │
├─────────────────────────┼──────────────┼────────────────────────┼──────────────────────────────────────────┤
│ 2. Krea 2 Turbo         │ **8–12 steps**│ **CFG 1.0**           │ Distilled ultra-fast flow-matching.      │
│                         │              │                        │ Negative prompts are inert.              │
└─────────────────────────┴──────────────┴────────────────────────┴──────────────────────────────────────────┘
```

### 🚫 Negative Prompt Policy & Attention Inversion on K2 Turbo
- **Never use traditional negative prompt fields on Krea 2.**
- **K2 Turbo (CFG 1.0):** Negative text fields are inert at CFG 1.0. To suppress unwanted elements or adjust framing, use **Attention Inversion Weights**:
  - `(face close to the lens:-4.0)` $\rightarrow$ pushes camera back to force wide environmental framing.
  - `(dark aesthetics:-3.0)` $\rightarrow$ inverts dark tones into a bright, airy scene.
  - `(hat:-2.0)` $\rightarrow$ suppresses specific accessories without negative prompts.
- **Emphasis Band:** Keep positive weights between `1.1` and `2.5` (e.g. `(cinematic lighting:2.0)`). Weights $>3.0$ cause color burn and pixel degradation.

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
7. **Biomechanical Pose & Tactile Grip:** Asymmetry and weight (*"seated contrapposto, resting chin upon curled knuckles"*).
8. **Color Grading & Film Stock:** Grain and palette (*"35mm film still with unretouched skin micro-pores"*).

---

## 4. Emotional Context & FACS Micro-Facial Taxonomy

Abstract emotional words resolve into generic stock photos. Qwen3-VL responds with extreme fidelity to the **Facial Action Coding System (FACS)**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        FACS MICRO-EXPRESSION MATRIX                          │
├───────────────────┬────────────────────────────┬─────────────────────────────┤
│ Emotion / Subtext │ Physical Muscle Mechanics  │ Ocular & Surface Optics     │
├───────────────────┼────────────────────────────┼─────────────────────────────┤
│ Grief / Restraint │ AU1+AU4: Inner brows       │ Gaze breaks 15° off-camera; │
│                   │ pulled up and pinched;     │ lacrimal meniscus pools     │
│                   │ lips pressed thin (AU24).  │ along lower lid margin.     │
├───────────────────┼────────────────────────────┼─────────────────────────────┤
│ Suppressed Rage / │ AU4: Corrugator brow drop; │ Direct forward stare;       │
│ Resolve           │ AU31: Masseter jaw clench; │ dilated pupils; nostrils    │
│                   │ AU7: Lower eyelid tension. │ flared (AU38).              │
├───────────────────┼────────────────────────────┼─────────────────────────────┤
│ Fragile Wonder /  │ AU1+AU2: Subtle brow arch; │ Expanded ocular aperture;   │
│ Vulnerability     │ AU25: Parted dry lips;     │ twin pin-point catchlights; │
│                   │ AU12: Trace zygomatic pull.│ slight head tilt (5°).      │
├───────────────────┼────────────────────────────┼─────────────────────────────┤
│ Weary Exhaustion  │ AU43: Ptosis/drooping lids;│ Desaturated under-eye skin; │
│                   │ AU15: Mouth corner pull-   │ dry lip texture; unfocused  │
│                   │ down; slackened jaw.       │ distant gaze convergence.   │
└───────────────────┴────────────────────────────┴─────────────────────────────┘
```

### Key Micro-Facial Prompting Rules
1. **Ocular Mechanics & Catchlights:** Always define the light source reflection within the cornea (*"a single 3200K tungsten pin-light reflects in the upper crescent of her dark iris"*).
2. **The Lacrimal Meniscus:** Describe optical liquid boundaries: *"A thin film of moisture coats the lower eyelid margin without spilling into tears."*
3. **Asymmetry is Life:** *"The left eyebrow lifts slightly higher than the right"*, *"unilateral smirk pulls the right corner of her mouth"*.
4. **Skin Micro-Textures:** *"Matte unglazed skin texture with visible micro-pores, fine vellus peach-fuzz along the jawline, no smoothing, no retouching"*.

---

## 5. Dynamic Posing, Tactile Actions & 3-Plane Staging

### The "Core Four" Biomechanical Pose Schema
1. **`silhouette`:** Global dynamic shape (*"Broad asymmetric triangular silhouette with forward-reaching diagonal line"*).
2. **`weight_distribution`:** Asymmetrical balance (*"80% bodyweight planted on the right heel in deep contrapposto"*).
3. **`torso_orientation`:** Broken lines via spinal twist (*"Hips angled 45° camera-left with shoulders twisted back toward the lens"*).
4. **`movement_quality`:** Secondary wind and momentum (*"Momentum-driven forward sprint with coat billowing violently"*).

### Tactile Object Interaction Physics
* **Grip Specifics:** *"Her index finger rests along the receiver frame while her thumb clamps down on the walnut stock with whitened skin over the knuckles."*
* **Surface Resistance:** *"Her hip compresses the velvet cushion of the vintage armchair, wrinkling the fabric outward in radial stress lines."*

### 3-Plane Optical Staging Framework
```
Camera ──► [ FOREGROUND: Defocused Obstruction ] ──► [ MIDGROUND: Critical Focal Plane ] ──► [ BACKGROUND: Atmospheric Fall-Off ]
           • 15-30% frame coverage                   • Subject isolation                       • Soft anamorphic bokeh disks
           • Out-of-focus shoulder/rain/glass         • Tack-sharp skin micro-geometry          • Rayleigh scattering / haze
           • Low-contrast silhouette                  • Specular eye reflections                • Kelvin temperature contrast
```

---

## 6. SwarmUI / ComfyUI KGW Rebalance Presets

### The 5 Core Presets (Code-Verified)

#### 1. ⚖️ Balanced (Universal Production Default)
* **Best For:** General all-purpose production across photo, illustration, and diverse concepts without likeness drift.
* **Multiplier:** `1.0` (with RMS Renormalize: `True`)
* **Layer Vector:** `1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 2.5, 5.0, 1.1, 4.0, 1.0`

#### 2. 👤 Portrait & Micro-Emotion
* **Best For:** Close-up character portraits, facial FACS Action Units, corneal catchlights, iris texture, and skin micro-pores (boosts Band 4: `w9–w11`).
* **Multiplier:** `1.0` (with RMS Renormalize: `True`) or `1.80` (legacy)
* **Layer Vector:** `1.8, 1.8, 1.8, 1.8, 2.0, 2.0, 2.5, 4.5, 1.2, 3.5, 1.0, 1.0`

#### 3. 🏋️ Kinetic Pose & Anatomy Lock
* **Best For:** Complex multi-limb poses, acrobatic actions, hand interactions, and perspective geometry (boosts Bands 1 & 2: `w0–w5`).
* **Multiplier:** `1.0` (with RMS Renormalize: `True`) or `1.50` (legacy)
* **Layer Vector:** `2.5, 2.5, 2.5, 2.5, 1.5, 1.5, 1.5, 1.5, 1.0, 1.0, 1.0, 1.0`

#### 4. 🎬 Cinematic Lighting & Atmosphere
* **Best For:** Volumetric light shafts, dramatic chiaroscuro, neon night scenes, anamorphic flares, and color grading (boosts Band 3: `w6–w8`).
* **Multiplier:** `1.0` (with RMS Renormalize: `True`) or `1.60` (legacy)
* **Layer Vector:** `1.0, 1.0, 1.0, 1.0, 2.5, 3.5, 4.0, 4.0, 3.5, 4.5, 5.0, 4.0`

#### 5. ⚡ Dual-Anchor Hybrid (Action + Emotion)
* **Best For:** High-intensity scenes demanding simultaneous complex kinetic action/poses AND deep micro-facial emotion (combines Bands 1/2 with Band 4).
* **Multiplier:** `1.0` (with RMS Renormalize: `True`) or `1.75` (legacy)
* **Layer Vector:** `2.4, 2.4, 2.2, 2.0, 1.6, 1.8, 2.2, 3.8, 1.4, 3.8, 1.2, 1.0`

---

## 7. Production-Ready Worked Packages

### Package 1: Master Horologist (High-Emotion Intimate Character Portrait)

**🎛 Model & Engine Recommendation**
| Parameter | Value | Rationale |
|---|---|---|
| **Target Engine** | Krea 2 Large / RAW (SwarmUI) | Full dynamic range, micro-pore fidelity, and subtle chiaroscuro light falloff |
| **Aspect Ratio** | 4:5 Vertical Portrait | Emphasizes vertical facial hierarchy, workbench plane, and ocular intimacy |
| **Style Reference** | Low-key chiaroscuro artisan portraiture (Rembrandt lighting geometry, unretouched 35mm optical stock) | Anchors deep shadow roll-off, authentic skin micro-relief, and physical material textures |

**🎚️ SwarmUI / KGW Local Parameters**
- **Preset:** 👤 Portrait & Micro-Emotion
- **Multiplier:** `1.0` (with RMS Renormalize: `True`) or `1.80` (legacy)
- **per_layer_weights:** `1.8, 1.8, 1.8, 1.8, 2.0, 2.0, 2.5, 4.5, 1.2, 3.5, 1.0, 1.0`

**🚫 Negative Prompt**
```text
(Leave blank — natural language flow-matching engines perform best without negative prompting)
```

**📝 Primary Narrative Prompt (Copy-Paste Ready)**
```text
85mm f/1.4 portrait prime lens at eye-level framing with shallow depth of field. A 2700K warm tungsten task lamp casts raking chiaroscuro across the scene against 7500K cool shadow falloff. Subject: an aging master horologist in a worn dark leather apron over a coarse linen shirt. Environment: an oiled oak workbench with scattered brass gears, micro-screwdrivers, and velvet pads. Expression: his inner brows pinch upward in intense scrutiny (AU1+AU4) while his lower eyelids tighten (AU7). A thin lacrimal meniscus coats his lower lid margin, and a sharp 2700K catchlight gleams in his dark iris. Secondary motion: stray silver hair wisps settle across his furrowed brow. Pose: he leans forward in seated contrapposto and anchors his left elbow to the table. His right thumb and forefinger squeeze precision brass tweezers onto a hairspring and blanch the skin across his distal knuckles under mechanical pinch force. Foreground: defocused brass calipers frame the lower edge. Background: the workshop shelving dissolves into soft circular bokeh discs. Style: 35mm film still with visible skin micro-pores, deep crow's feet, and matte epidermal texture.
```

**🔄 Iteration Pathway**
```text
1. Lighting Shift: Switch key light to 5600K cool morning daylight through a north-facing window. Soft blue shadows fill the workshop table.
2. Lens Shift: Switch to 50mm f/1.4 lens at a 30-degree overhead table perspective. Expand frame to reveal antique wooden clock cabinets lining the wall.
3. Interaction Shift: Subject lifts the brass eye loupe away from his eye. His left thumb presses an oiled polishing cloth across the balance bridge.
```

---

### Package 2: Alpine Crevasse Leap (High-Torque Kinetic Action)

**🎛 Model & Engine Recommendation**
| Parameter | Value | Rationale |
|---|---|---|
| **Target Engine** | Krea 2 Large / RAW (SwarmUI) | Preserves high-frequency snow particles, gear tension physics, and anatomical force vectors |
| **Aspect Ratio** | 16:9 Cinematic Widescreen | Captures dynamic lateral leap trajectory across the glacial chasm |
| **Style Reference** | High-altitude mountain expedition photojournalism (harsh alpine blizzard optics, extreme diagonal geometry, tactical survival gear) | Establishes raw environmental hostility, high-speed shutter freezing, and tangible equipment load |

**🎚️ SwarmUI / KGW Local Parameters**
- **Preset:** ⚡ Dual-Anchor Hybrid (Action + Emotion)
- **Multiplier:** `1.0` (with RMS Renormalize: `True`) or `1.75` (legacy)
- **per_layer_weights:** `2.4, 2.4, 2.2, 2.0, 1.6, 1.8, 2.2, 3.8, 1.4, 3.8, 1.2, 1.0`

**🚫 Negative Prompt**
```text
(Leave blank — natural language flow-matching engines perform best without negative prompting)
```

**📝 Primary Narrative Prompt (Copy-Paste Ready)**
```text
24mm f/2.8 ultra-wide lens at a dynamic low-angle 20-degree Dutch tilt with a 1/2000s shutter speed. Diffuse 7000K cold blizzard light rakes across airborne snow and projects deep cyan shadows into the glacial abyss below. Subject: a high-altitude mountain rescue specialist in an orange ripstop alpine storm suit and climbing harness. Environment: a sheer glacial crevasse with fractured blue serac walls and jagged ice cornices. Expression: his jaw clenches tight (AU31) beneath a frost-rimed balaclava, nostrils flare in exertion (AU38), and narrowed eyes lock forward as ice crystals frost his eyelashes. Secondary motion: harness safety lanyards, loose gear loops, and parka tails whip violently backward in 60-knot gale winds. Pose: (Airborne Crevasse Leap:1.3), left knee drives forward at a 75-degree acute angle while trailing right leg extends fully backward off the crampon toe, torso twists 35 degrees relative to hips, taut 11mm kernmantle rope bites deeply into his shoulder seam and bunches the fabric into tight stress creases, right insulated glove clamps the textured shaft of an ice axe with firm palm pressure. Foreground: defocused airborne ice shards streak across the lens glass. Background: the opposite ice wall dissolves into raging whiteout. Style: 35mm photojournalism still with crisp edge fidelity, raw surface textures, and zero digital smoothing.
```

**🔄 Iteration Pathway**
```text
1. Weather Shift: Intensify gale to zero-visibility whiteout with 6500K twilight. Harsh blizzard squalls obscure the far crevasse lip.
2. Angle Shift: Lower camera to ice level inside the crevasse. Point lens 60 degrees upward toward the jumper framed against the storm sky.
3. Action Shift: Subject swings the ice axe overhead toward the opposite ice wall. Steel pick bites into blue glacial hardpack with flying ice chips.
```
