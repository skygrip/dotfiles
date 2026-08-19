import fs from 'fs';
import path from 'path';

/**
 * CircleStone ANIMA Dedicated Benchmark Suite
 * Evaluates 10 core prompt engineering components:
 * 1. Multi-Actor Count Tags & Color Isolation (2girls, 1boy 1girl)
 * 2. Danbooru Facial Micro-Geometry Taxonomy (tsurime, tareme, jitome)
 * 3. Dynamic Perspective & Extreme Foreshortening (from below, dynamic angle)
 * 4. High-Contrast Chiaroscuro & Studio Trigger Hyper-Dynamism
 * 5. 1990s Retro Cel Animation & Gouache Matte Backdrops (with 2.5D shield)
 * 6. Painterly Fantasy & Botanical Watercolor Layers
 * 7. Theatrical Golden Hour & Atmospheric Cloudscape Bloom
 * 8. High-Tech Cyberpunk & Mechanical Precision Linework
 * 9. Secondary Wind Kinematics & Floating Particles
 * 10. Multi-Character Mixed Gender Stance Opposites
 *
 * Workflow:
 * 1. Bulk generates 10 prompts via local LLM with SKILL.md + anima.md
 * 2. Enforces 60-second GPU cooldown / VRAM unload
 * 3. Renders all 10 images with SwarmUI (Anima Turbo)
 * 4. Downloads and validates all generated image assets
 */

const LLAMA_SWAP_URL = process.env.LLAMA_SWAP_URL || 'http://127.0.0.1:8080/v1';
const SWARM_URL = process.env.SWARM_URL || 'http://localhost:7801';
const MODEL_NAME = process.env.LLM_MODEL || 'gemma4-12b';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..');
const OUT_DIR = process.env.OUT_DIR || path.resolve(SKILL_DIR, 'scratch/generated_images');
const RESULTS_JSON = process.env.RESULTS_JSON || path.resolve(SKILL_DIR, 'scratch/anima_benchmark_results.json');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 10 Anima Component Test Cases
const SCENARIOS = [
  {
    id: 'AN-01-CountTags-Isolation',
    component: 'Multi-Actor Count Tags & Feature Isolation',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Clubroom Two Girls Divergent Hobbies',
    testCriteria: 'Explicit "2girls" tag, clean feature separation (short blue hair vs blonde twintails), independent props (manga vs teacup), zero color bleed.',
    userPrompt: 'Generate an Anima prompt of an after-school literature clubroom with two girls: On the left sofa, a girl with short dark blue hair quietly reads an open manga. On the right table, a girl with long blonde twin tails sits drinking hot tea from a porcelain teacup.'
  },
  {
    id: 'AN-02-Facial-MicroGeometry',
    component: 'Danbooru Facial Micro-Geometry Taxonomy',
    model: 'Anima/anima_turboV10',
    width: 832,
    height: 1040,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Tsurime Defiant Swordswoman',
    testCriteria: 'Accurate eye tags (tsurime, constricted pupils, eye glint), mouth tension (clenched teeth), zero generic "angry" descriptors.',
    userPrompt: 'Generate an Anima prompt of a defiant female swordsman facing down an overwhelming enemy army with intense upward-angled tsurime eyes, constricted pupils, clenched teeth, and blade drawn.'
  },
  {
    id: 'AN-03-Dynamic-Foreshortening',
    component: 'Dynamic Perspective & Foreshortening',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Mid-Air Flying Kick Strike',
    testCriteria: 'Perspective anchors (from below, dynamic angle, dynamic foreshortening), single-arm/leg kinetic dominance, secondary motion trails.',
    userPrompt: 'Generate an Anima prompt of a martial arts monk mid-air executing a dynamic downward flying kick from a low-angle perspective, with severe foreshortening on the lead boot.'
  },
  {
    id: 'AN-04-Chiaroscuro-StudioTrigger',
    component: 'Studio Trigger Graphic Chiaroscuro',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Cyber Samurai Slash & Pop Shadows',
    testCriteria: 'Artist anchors (@imaishi hiroyuki, @soejima shigenori), bold angular ink line weights, high pop-contrast rim light against dark twilight.',
    userPrompt: 'Generate an Anima prompt of a cybernetic samurai executing an explosive single-arm katana slash against combat drones in Studio Trigger and Persona 5 graphic chiaroscuro style.'
  },
  {
    id: 'AN-05-RetroCel-Gainax1990s',
    component: '1990s Retro Cel Animation & Gouache',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Mecha Pilot in Cliffside Hangar',
    testCriteria: '1990s Gainax styling (@sadamoto yoshiyuki, @yamashita ikuto), hand-painted gouache background, targeted 2.5D anti-realism negative shield.',
    userPrompt: 'Generate an Anima prompt of a young mecha pilot in denim overalls repairing a giant robotic hand in a cliffside hangar during golden twilight, rendered in authentic 1990s retro cel animation style.'
  },
  {
    id: 'AN-06-Painterly-BotanicalFantasy',
    component: 'Painterly Watercolor & Botanical Layers',
    model: 'Anima/anima_turboV10',
    width: 832,
    height: 1040,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Herbalist in Ancient Spore Forest',
    testCriteria: 'Earthy muted fantasy palette (@yoshida akihiko, @fuzichoco), soft tareme eyes, glowing floating spores, delicate cross-hatching without 3D CGI gloss.',
    userPrompt: 'Generate an Anima prompt of an apprentice herbalist with gentle tareme eyes gathering moss in an ancient fantasy root forest filled with floating bioluminescent spores in Yoshida Akihiko watercolor style.'
  },
  {
    id: 'AN-07-Theatrical-GoldenHourBloom',
    component: 'Theatrical Sunset & Atmospheric Optics',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Observatory Twilight & Starlight Bloom',
    testCriteria: 'Makoto Shinkai atmosphere (@shinkai makoto), backlit translucent hair bangs, optical lens bloom, warm 2600K horizon gradient melting into indigo.',
    userPrompt: 'Generate an Anima prompt of a high school student leaning against a brass astronomical telescope in an open-roof observatory dome overlooking distant city lights at sunset in Makoto Shinkai style.'
  },
  {
    id: 'AN-08-SciFi-MechaTelemetry',
    component: 'Cyberpunk Precision Linework & HUD',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Tactical Android HUD Interface',
    testCriteria: 'Precision panel linework (@redjuice), glowing 9000K cyan holographic HUD telemetry, slender biomechanical contours, Jitome eyes.',
    userPrompt: 'Generate an Anima prompt of a combat android girl with sleek cybernetic armor and cool jitome eyes interacting with floating translucent neon cyan holographic HUD telemetry screens.'
  },
  {
    id: 'AN-09-Secondary-WindKinematics',
    component: 'Secondary Wind Physics & Flowing Fabrics',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Shrine Maiden Sakura Vortex',
    testCriteria: 'Dynamic wind physics (hair flowing, wind blown clothing, floating ribbons), swirling cherry blossom petals, contrapposto shrine stance.',
    userPrompt: 'Generate an Anima prompt of a shrine maiden holding a ceremonial wooden staff on a stone mountain shrine stairway as sudden mountain winds swirl her red hakama robes and loose dark hair amid flying pink cherry blossom petals.'
  },
  {
    id: 'AN-10-MixedGender-DuelStances',
    component: 'Mixed-Gender Stance & Dual Magic Lighting',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Colosseum Swordswoman vs Mage Faceoff',
    testCriteria: '1girl 1boy count tag, opposing kinetic stances (low katana vs high staff), dual lighting temperatures (cold steel rim vs azure arcane glow).',
    userPrompt: 'Generate an Anima prompt of a dramatic arena duel between a swordswoman in black armor in a low combat stance and a male mage in a white mantle channeling a spiraling blue mana vortex.'
  }
];

function extractPromptFromOutput(rawOutput) {
  const positiveMatch = rawOutput.match(/### 📝 Primary Positive Prompt[\s\S]*?```(?:text)?\s*([\s\S]*?)\s*```/i);
  let positivePrompt = positiveMatch ? positiveMatch[1].trim() : '';

  if (!positivePrompt) {
    const firstCodeBlock = rawOutput.match(/```(?:text)?\s*([\s\S]*?)\s*```/);
    if (firstCodeBlock) positivePrompt = firstCodeBlock[1].trim();
  }

  const negativeMatch = rawOutput.match(/### 🚫 Negative Prompt[\s\S]*?```(?:text)?\s*([\s\S]*?)\s*```/i);
  let negativePrompt = negativeMatch ? negativeMatch[1].trim() : '';

  if (negativePrompt.startsWith('(') && negativePrompt.endsWith(')')) {
    negativePrompt = '';
  }

  return { positivePrompt, negativePrompt };
}

async function getSwarmSession() {
  const res = await fetch(`${SWARM_URL}/API/GetNewSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!res.ok) throw new Error(`Failed to get SwarmUI session: HTTP ${res.status}`);
  const data = await res.json();
  return data.session_id;
}

async function main() {
  console.log(`\n===============================================================`);
  console.log(`   ANIMA BENCHMARK RUNNER: 10 COMPONENT TEST CASES             `);
  console.log(`===============================================================`);
  console.log(`LLM Provider:    ${MODEL_NAME} (${LLAMA_SWAP_URL})`);
  console.log(`Image Engine:    SwarmUI (${SWARM_URL})`);
  console.log(`Target Model:    Anima Turbo (CFG 1.0, Euler, 10 steps)\n`);

  const skillMd = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf-8');
  const animaMd = fs.readFileSync(path.join(SKILL_DIR, 'anima.md'), 'utf-8');
  const docContext = `=== SKILL GUIDELINES ===\n${skillMd}\n\n=== ANIMA ENGINE SPEC ===\n${animaMd}`;

  const results = [];

  // STAGE 1: LLM Prompt Generation
  console.log(`>>> [STAGE 1/3] Generating 10 Anima Prompts via ${MODEL_NAME}...`);
  const stage1Start = Date.now();

  for (let i = 0; i < SCENARIOS.length; i++) {
    const s = SCENARIOS[i];
    process.stdout.write(`  [${i + 1}/10] ${s.id} (${s.component})... `);

    const promptStartTime = Date.now();

    const response = await fetch(`${LLAMA_SWAP_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: docContext },
          { role: 'user', content: s.userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.log(`FAILED (HTTP ${response.status})`);
      throw new Error(`LLM call failed for ${s.id}: ${errText}`);
    }

    const data = await response.json();
    const rawOutput = data.choices?.[0]?.message?.content || '';
    const duration = ((Date.now() - promptStartTime) / 1000).toFixed(1);

    const { positivePrompt, negativePrompt } = extractPromptFromOutput(rawOutput);
    const wordCount = positivePrompt.split(/\s+/).filter(Boolean).length;

    results.push({
      ...s,
      promptGenerationSec: parseFloat(duration),
      wordCount,
      rawOutput,
      positivePrompt,
      negativePrompt
    });

    console.log(`Done (${duration}s) -> ${wordCount} words`);
  }

  const stage1Duration = ((Date.now() - stage1Start) / 1000).toFixed(1);
  console.log(`[+] Stage 1 Complete in ${stage1Duration}s!\n`);

  // STAGE 2: 60-Second GPU Cooldown
  console.log(`>>> [STAGE 2/3] Mandatory 60-Second GPU Cooldown & VRAM Unload Break...`);
  for (let c = 60; c > 0; c -= 10) {
    console.log(`    ⏳ Cooldown Remaining: ${c} seconds...`);
    await new Promise(r => setTimeout(r, 10000));
  }
  console.log(`    ✅ Cooldown finished! GPU ready for Anima Turbo rendering.\n`);

  // STAGE 3: SwarmUI Image Generation
  console.log(`>>> [STAGE 3/3] Submitting 10 Prompts to SwarmUI (${SWARM_URL})...`);
  const stage3Start = Date.now();
  const sessionId = await getSwarmSession();

  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    process.stdout.write(`  [${i + 1}/10] Rendering ${item.id}... `);

    const renderStart = Date.now();
    const payload = {
      session_id: sessionId,
      prompt: item.positivePrompt,
      negativeprompt: item.negativePrompt || '',
      model: item.model,
      width: item.width,
      height: item.height,
      steps: item.steps,
      cfgscale: item.cfgscale,
      sampler: item.sampler,
      seed: -1,
      images: 1,
      donotsave: false
    };

    const res = await fetch(`${SWARM_URL}/API/GenerateText2Image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.log(`FAILED HTTP ${res.status}`);
      item.imageStatus = 'ERROR';
      item.imageError = await res.text();
      continue;
    }

    const genResult = await res.json();
    const renderDuration = ((Date.now() - renderStart) / 1000).toFixed(1);

    if (genResult.error) {
      console.log(`ERROR: ${genResult.error}`);
      item.imageStatus = 'ERROR';
      item.imageError = genResult.error;
      continue;
    }

    if (genResult.images && genResult.images.length > 0) {
      const imgRef = genResult.images[0];
      const filename = `anima_bm_${item.id}_${Date.now()}.png`;
      const localPath = path.join(OUT_DIR, filename);

      const downloadUrl = imgRef.startsWith('http') ? imgRef : `${SWARM_URL}/${imgRef.replace(/^\/+/, '')}`;
      const imgRes = await fetch(downloadUrl);
      const imgBuf = Buffer.from(await imgRes.arrayBuffer());
      fs.writeFileSync(localPath, imgBuf);

      const stats = fs.statSync(localPath);
      item.imageStatus = 'SUCCESS';
      item.imagePath = localPath;
      item.imageSizeBytes = stats.size;
      item.imageRenderSec = parseFloat(renderDuration);

      console.log(`Done (${renderDuration}s) -> ${(stats.size / 1024).toFixed(1)} KB`);
    } else {
      console.log(`No images returned`);
      item.imageStatus = 'NO_IMAGE';
    }
  }

  const stage3Duration = ((Date.now() - stage3Start) / 1000).toFixed(1);
  console.log(`\n[+] Stage 3 Complete in ${stage3Duration}s!`);

  // Write full results JSON
  fs.writeFileSync(RESULTS_JSON, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n===============================================================`);
  console.log(`🎉 Anima Benchmark Run Complete!`);
  console.log(`Results JSON: ${RESULTS_JSON}`);
  console.log(`Rendered PNGs: ${OUT_DIR}`);
  console.log(`===============================================================\n`);
}

main().catch(err => {
  console.error('\n[FATAL ERROR IN ANIMA BENCHMARK]', err);
  process.exit(1);
});
