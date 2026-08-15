import fs from 'fs';
import path from 'path';

/**
 * Master End-to-End Orchestrator for Prompt Architect
 * 1. Bulk generates 10 prompts with Gemma 4 12B (5 Krea 2, 5 Anima)
 * 2. Enforces a 60-second GPU cooldown / VRAM unload break
 * 3. Bulk generates 10 images with SwarmUI (Krea 2 Turbo & Anima Turbo)
 * 4. Downloads and saves all images for inspection
 */

const LLAMA_SWAP_URL = process.env.LLAMA_SWAP_URL || 'http://127.0.0.1:8080/v1';
const SWARM_URL = process.env.SWARM_URL || 'http://localhost:7801';
const MODEL_NAME = 'gemma4-12b';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..');
const OUT_DIR = process.env.OUT_DIR || path.resolve(SKILL_DIR, 'scratch/generated_images');
const RESULTS_JSON = process.env.RESULTS_JSON || path.resolve(SKILL_DIR, 'scratch/e2e_results.json');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 10 Benchmark Scenarios
const SCENARIOS = [
  {
    id: 'K2-01',
    engine: 'krea2',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1216,
    height: 832,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Intimate Emotion (Blues Guitarist)',
    userPrompt: 'Generate a Krea 2 prompt of an aging blues guitarist in a dimly lit, smoky New Orleans underground cellar club.'
  },
  {
    id: 'K2-02',
    engine: 'krea2',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1216,
    height: 832,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'High-Torque Action (Skateboarder Ollie)',
    userPrompt: 'Generate a Krea 2 prompt of a street skateboarder landing a high ollie down a flight of concrete stairs at sunset.'
  },
  {
    id: 'K2-03',
    engine: 'krea2',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1216,
    height: 832,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Macro Artisan Craft (Master Jeweler)',
    userPrompt: 'Generate a Krea 2 prompt of a master jeweler setting a faceted emerald into a platinum ring using precision micro-prongs.'
  },
  {
    id: 'K2-04',
    engine: 'krea2',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1216,
    height: 832,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Atmospheric Narrative (Tasmanian Ranger)',
    userPrompt: 'Generate a Krea 2 prompt of a wildlife ranger wading through a misty Tasmanian eucalyptus forest at dawn.'
  },
  {
    id: 'K2-05',
    engine: 'krea2',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1216,
    height: 832,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Cinematic Fashion (Velvet Coat Tokyo Rain)',
    userPrompt: 'Generate a Krea 2 prompt of a fashion model wearing a tailored midnight-blue velvet trench coat on a rain-slicked Tokyo rooftop at night.'
  },
  {
    id: 'Anima-01',
    engine: 'anima',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Studio Slice of Life (Windowsill Rainstorm)',
    userPrompt: 'Generate an Anima prompt of a high school student sitting on a wooden windowsill during a golden-hour summer rainstorm holding an open sketchbook.'
  },
  {
    id: 'Anima-02',
    engine: 'anima',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Trigger Action (Cyber-Samurai Slash)',
    userPrompt: 'Generate an Anima prompt of a cybernetic samurai warrior mid-air executing a single-arm downward slash against security drones.'
  },
  {
    id: 'Anima-03',
    engine: 'anima',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Retro 1990s Cel (Mecha Pilot Hangar)',
    userPrompt: 'Generate an Anima prompt of a lone mecha pilot in a flight suit leaning against a giant robot hand in a ruined desert hangar.'
  },
  {
    id: 'Anima-04',
    engine: 'anima',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Fantasy Magic (Elf Mage Butterflies)',
    userPrompt: 'Generate an Anima prompt of an elf mage summoning glowing golden butterfly familiars beside a moonlit forest shrine.'
  },
  {
    id: 'Anima-05',
    engine: 'anima',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Theatrical Marine (Free-Diver Jellyfish)',
    userPrompt: 'Generate an Anima prompt of a free-diver floating weightlessly among bioluminescent pink jellyfish in deep ocean waters.'
  }
];

function extractPromptFromOutput(rawOutput) {
  // Extract text from Primary Positive Prompt block
  const positiveMatch = rawOutput.match(/### 📝 Primary Positive Prompt[\s\S]*?```(?:text)?\s*([\s\S]*?)\s*```/i);
  let positivePrompt = positiveMatch ? positiveMatch[1].trim() : '';

  // Fallback: search for first code block if header not strictly matched
  if (!positivePrompt) {
    const firstCodeBlock = rawOutput.match(/```(?:text)?\s*([\s\S]*?)\s*```/);
    if (firstCodeBlock) positivePrompt = firstCodeBlock[1].trim();
  }

  // Extract Negative prompt if present
  const negativeMatch = rawOutput.match(/### 🚫 Negative Prompt[\s\S]*?```(?:text)?\s*([\s\S]*?)\s*```/i);
  let negativePrompt = negativeMatch ? negativeMatch[1].trim() : '';

  // Clean out inert comments like "(Leave blank...)"
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
  console.log(`   END-TO-END PIPELINE: 10-IMAGE LLM + SWARMUI GENERATION      `);
  console.log(`===============================================================`);
  console.log(`LLM Provider:  Gemma 4 12B (${LLAMA_SWAP_URL})`);
  console.log(`Image Engine:  SwarmUI (${SWARM_URL})`);
  console.log(`Total Scenarios: 10 (5 Krea 2 Turbo + 5 Anima Turbo)\n`);

  const skillMd = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf-8');
  const krea2Md = fs.readFileSync(path.join(SKILL_DIR, 'krea2.md'), 'utf-8');
  const animaMd = fs.readFileSync(path.join(SKILL_DIR, 'anima.md'), 'utf-8');

  const results = [];

  // ==========================================
  // STAGE 1: LLM Prompt Generation
  // ==========================================
  console.log(`>>> [STAGE 1/3] Generating Prompts via Gemma 4 12B...`);
  const stage1Start = Date.now();

  for (let i = 0; i < SCENARIOS.length; i++) {
    const s = SCENARIOS[i];
    process.stdout.write(`  [${i + 1}/10] ${s.id}: ${s.name}... `);

    const docContext = s.engine === 'krea2' 
      ? `=== SKILL GUIDELINES ===\n${skillMd}\n\n=== KREA 2 ENGINE SPEC ===\n${krea2Md}`
      : `=== SKILL GUIDELINES ===\n${skillMd}\n\n=== ANIMA ENGINE SPEC ===\n${animaMd}`;

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

    results.push({
      ...s,
      promptGenerationSec: parseFloat(duration),
      rawOutput,
      positivePrompt,
      negativePrompt
    });

    console.log(`Done (${duration}s) -> Extracted ${positivePrompt.split(/\s+/).length} words`);
  }

  const stage1Duration = ((Date.now() - stage1Start) / 1000).toFixed(1);
  console.log(`[+] Stage 1 Complete in ${stage1Duration}s!\n`);

  // ==========================================
  // STAGE 2: Mandatory 60-Second Cooldown
  // ==========================================
  console.log(`>>> [STAGE 2/3] Mandatory 60-Second GPU Cooldown & VRAM Unload Break...`);
  console.log(`    (Allowing GPU memory to clear and thermals to stabilize before SwarmUI batch)`);

  for (let c = 60; c > 0; c -= 10) {
    console.log(`    ⏳ Cooldown Remaining: ${c} seconds...`);
    await new Promise(r => setTimeout(r, 10000));
  }
  console.log(`    ✅ Cooldown finished! GPU ready for diffusion rendering.\n`);

  // ==========================================
  // STAGE 3: SwarmUI Image Generation
  // ==========================================
  console.log(`>>> [STAGE 3/3] Submitting 10 Prompts to SwarmUI (${SWARM_URL})...`);
  const stage3Start = Date.now();

  const sessionId = await getSwarmSession();
  console.log(`[+] SwarmUI Session ID: ${sessionId.slice(0, 10)}...`);

  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    process.stdout.write(`  [${i + 1}/10] Rendering ${item.id} (${item.model})... `);

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
      const filename = `e2e_${item.id}_${item.engine}_${Date.now()}.png`;
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

      console.log(`Done (${renderDuration}s) -> Saved ${(stats.size / 1024).toFixed(1)} KB`);
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
  console.log(`🎉 Pipeline Execution Complete!`);
  console.log(`Results saved to: ${RESULTS_JSON}`);
  console.log(`All images saved in: ${OUT_DIR}`);
  console.log(`===============================================================\n`);
}

main().catch(err => {
  console.error('\n[FATAL ERROR IN PIPELINE]', err);
  process.exit(1);
});
