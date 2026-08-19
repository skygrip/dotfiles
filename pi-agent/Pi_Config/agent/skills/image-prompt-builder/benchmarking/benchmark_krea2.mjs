import fs from 'fs';
import path from 'path';

/**
 * Krea 2 Dedicated Benchmark Suite
 * Evaluates 10 core prompt engineering components:
 * 1. Multi-Actor Left/Right Spatial Partitioning
 * 2. FACS Micro-Facial Muscle Mechanics (AU Units)
 * 3. High-Torque Kinetic Action & Shutter Speed Freeze
 * 4. Macro Tactile Grip & Mechanical Resistance
 * 5. Multi-Source Kelvin Temperature Contrast (5000K vs 2800K)
 * 6. 3-Plane Optical Depth Staging & Defocus
 * 7. Weathered Material Textures & Physical Aging
 * 8. Atmospheric Volumetrics & Tyndall Light Rays
 * 9. Contact Surface Physics & Weight Occlusion
 * 10. Multi-Character Occupational Staging
 */

const LLAMA_SWAP_URL = process.env.LLAMA_SWAP_URL || 'http://127.0.0.1:8080/v1';
const SWARM_URL = process.env.SWARM_URL || 'http://localhost:7801';
const MODEL_NAME = process.env.LLM_MODEL || 'gemma4-12b';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..');
const OUT_DIR = process.env.OUT_DIR || path.resolve(SKILL_DIR, 'scratch/generated_images');
const RESULTS_JSON = process.env.RESULTS_JSON || path.resolve(SKILL_DIR, 'scratch/krea2_benchmark_results.json');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 10 Krea 2 Component Test Cases
const SCENARIOS = [
  {
    id: 'K2-01-Spatial-MultiActor',
    component: 'Multi-Actor Spatial Partitioning',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1216,
    height: 832,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Cafe Architect & Barista Division',
    testCriteria: 'Clear left-to-right division, zero wardrobe bleed, independent tools (blueprints vs steam wand), divergent eye vectors.',
    userPrompt: 'Generate a Krea 2 prompt of a sunlit cafe interior. On the left, a female architect in a charcoal turtleneck reviews architectural blueprints with a drafting pencil. On the right behind the counter, a male barista in a green canvas apron steams milk using an espresso machine steam wand.'
  },
  {
    id: 'K2-02-FACS-MicroEmotion',
    component: 'FACS Facial Muscle Mechanics',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 896,
    height: 1152,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Master Watchmaker Concentration',
    testCriteria: 'Specific Action Units (AU1+AU4 brow pinch, AU7 lid tension), unretouched skin pores, zero Latin clinical labels.',
    userPrompt: 'Generate a Krea 2 prompt of an elderly master watchmaker wearing a monocle loupe over his right eye, carefully adjusting an antique escapement gear with micro-tweezers under a warm desk lamp.'
  },
  {
    id: 'K2-03-Kinetic-ShutterSpeed',
    component: 'Kinetic Action & Shutter Speed Freeze',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1216,
    height: 832,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'High-Torque Equestrian Hurdle',
    testCriteria: '1/2000s shutter speed freeze, airborne water spray particles, bent-knee contrapposto, gloved leather grip tension.',
    userPrompt: 'Generate a Krea 2 prompt of an equestrian rider in a navy jacket guiding a bay warmblood horse clearing a timber water hurdle at mid-leap with airborne water droplets freezing in bright midday sun.'
  },
  {
    id: 'K2-04-Tactile-GripPhysics',
    component: 'Tactile Grip & Mechanical Resistance',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1024,
    height: 1024,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Jeweler Emerald Prong Setting',
    testCriteria: 'Fingertip pulp deformation, metal prong contact resistance, macroscopic texture fidelity on polished platinum and rough gem facets.',
    userPrompt: 'Generate a Krea 2 prompt of a close-up macro view of a jeweler using fine brass pliers to seat an emerald gemstone into platinum prong mountings on a wooden bench.'
  },
  {
    id: 'K2-05-Kelvin-DualLight',
    component: 'Dual-Source Kelvin Color Lighting',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 896,
    height: 1152,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Cold Daylight vs Warm Tungsten Balance',
    testCriteria: 'Explicit 5000K diffuse daylight from window contrasting with warm 2800K brass lamp pool, clean shadow falloff without color mud.',
    userPrompt: 'Generate a Krea 2 prompt of a ceramicist in a pottery studio. Cool 5000K overcast morning light streams through paned glass while an incandescent 2800K tungsten lamp casts warm amber raking light across her spinning pottery wheel.'
  },
  {
    id: 'K2-06-Optical-3PlaneDepth',
    component: '3-Plane Optical Depth & Bokeh Separation',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1216,
    height: 832,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Street Fashion Tokyo Rain Staging',
    testCriteria: 'Defocused foreground element (rain-streaked pane or umbrella edge), razor-sharp midground model, background dissolving into creamy circular bokeh discs.',
    userPrompt: 'Generate a Krea 2 prompt of a fashion model in a tailored velvet coat standing on a rain-slicked Tokyo street at night, framed through foreground rain streaks with background neon signs melting into circular bokeh.'
  },
  {
    id: 'K2-07-Material-TextureAging',
    component: 'Weathered Materials & Physical Degradation',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1216,
    height: 832,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Antique Blacksmith Anvil & Tools',
    testCriteria: 'Pitted cast iron, charred hickory hammer handles, scuffed oil-stained leather apron, glowing orange slag sparks with physical contact shadows.',
    userPrompt: 'Generate a Krea 2 prompt of a traditional blacksmith hammering a glowing 1800K orange iron billet on an antique steel anvil, sending hot sparks showering across a soot-stained brick forge.'
  },
  {
    id: 'K2-08-Atmospheric-Volumetric',
    component: 'Volumetric Mist & Tyndall Light Shafts',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1216,
    height: 832,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Alpine Summit Botanist Dawn',
    testCriteria: 'Volumetric dawn light beams cutting through cool mountain mist, dew droplets on alpine flora, deep rock contact shadows.',
    userPrompt: 'Generate a Krea 2 prompt of a botanical researcher in a canvas field jacket kneeling on a high rocky alpine ridge at dawn as golden sunbeams pierce swirling mountain valley mist.'
  },
  {
    id: 'K2-09-Contact-SurfacePhysics',
    component: 'Surface Deformation & Weight Occlusion',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 896,
    height: 1152,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Arctic Explorer Weighted Footing',
    testCriteria: 'Heavy rubber/lug boot treads compacting fresh snow with deep occlusion shadows, physical posture weight transfer, frosted fabric creases.',
    userPrompt: 'Generate a Krea 2 prompt of an arctic scientist in a heavy expedition parka planting a GPS telemetry beacon into deep compacted snow under pale sub-zero polar sunlight.'
  },
  {
    id: 'K2-10-Occupational-ComplexTeam',
    component: '3-Plane Multi-Character Aviation Crew',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1216,
    height: 832,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Hangar Multi-Role Maintenance Crew',
    testCriteria: '3 distinct roles across 3 depth planes (stepladder mechanic in foreground, avionics tech at terminal in midground, supervisor in background), word budget 120-150 words.',
    userPrompt: 'Generate a Krea 2 prompt of a busy aircraft maintenance hangar with 3 people: a mechanic on a low ladder tightening a turbine bolt in foreground, an avionics technician typing at a diagnostic console in midground, and a flight officer reviewing a tablet in background.'
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
  console.log(`   KREA 2 BENCHMARK RUNNER: 10 COMPONENT TEST CASES            `);
  console.log(`===============================================================`);
  console.log(`LLM Provider:    ${MODEL_NAME} (${LLAMA_SWAP_URL})`);
  console.log(`Image Engine:    SwarmUI (${SWARM_URL})`);
  console.log(`Target Model:    Krea 2 Turbo (CFG 1.0, Euler, 10 steps)\n`);

  const skillMd = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf-8');
  const krea2Md = fs.readFileSync(path.join(SKILL_DIR, 'krea2.md'), 'utf-8');
  const docContext = `=== SKILL GUIDELINES ===\n${skillMd}\n\n=== KREA 2 ENGINE SPEC ===\n${krea2Md}`;

  const results = [];

  // STAGE 1: LLM Prompt Generation
  console.log(`>>> [STAGE 1/3] Generating 10 Krea 2 Prompts via ${MODEL_NAME}...`);
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
  console.log(`    ✅ Cooldown finished! GPU ready for Krea 2 Turbo rendering.\n`);

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
      const filename = `krea2_bm_${item.id}_${Date.now()}.png`;
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
  console.log(`🎉 Krea 2 Benchmark Run Complete!`);
  console.log(`Results JSON: ${RESULTS_JSON}`);
  console.log(`Rendered PNGs: ${OUT_DIR}`);
  console.log(`===============================================================\n`);
}

main().catch(err => {
  console.error('\n[FATAL ERROR IN KREA 2 BENCHMARK]', err);
  process.exit(1);
});
