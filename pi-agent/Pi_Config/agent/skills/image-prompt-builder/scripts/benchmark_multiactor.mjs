import fs from 'fs';
import path from 'path';

/**
 * Multi-Actor Stress Benchmark Runner for Prompt Architect
 * 1. Bulk generates 10 multi-actor prompts with Gemma 4 12B (5 Krea 2, 5 Anima)
 * 2. Enforces a 60-second GPU cooldown / VRAM unload break
 * 3. Bulk generates 10 images with SwarmUI (Krea 2 Turbo & Anima Turbo)
 * 4. Downloads and saves all images to scratch/generated_images/
 * 5. Saves structured results to scratch/multiactor_benchmark_results.json
 */

const LLAMA_SWAP_URL = process.env.LLAMA_SWAP_URL || 'http://127.0.0.1:8080/v1';
const SWARM_URL = process.env.SWARM_URL || 'http://localhost:7801';
const MODEL_NAME = 'gemma4-12b';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..');
const OUT_DIR = process.env.OUT_DIR || path.resolve(SKILL_DIR, 'scratch/generated_images');
const RESULTS_JSON = process.env.RESULTS_JSON || path.resolve(SKILL_DIR, 'scratch/multiactor_benchmark_results.json');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 10 Multi-Actor Benchmark Scenarios
const SCENARIOS = [
  // -------------------------------------------------------------
  // Part A: Krea 2 Turbo Multi-Actor Scenarios (16:9, CFG 1.0)
  // -------------------------------------------------------------
  {
    id: 'MA-K2-01',
    engine: 'krea2',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1216,
    height: 832,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Cafe Work & Service Split',
    stressFocus: 'Left-to-right spatial partitioning, independent props, distinct FACS, zero wardrobe bleed',
    userPrompt: 'Generate a Krea 2 prompt of a cozy sunlit cafe interior. On the left, a young female architect in a charcoal turtleneck sits reviewing architectural blueprints with a drafting pencil. On the right behind the counter, a male barista in a green canvas apron steams milk using an espresso machine steam wand.'
  },
  {
    id: 'MA-K2-02',
    engine: 'krea2',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1216,
    height: 832,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Park Bench Chess Match',
    stressFocus: 'Shared focal object (chessboard), converging eye-lines, tactile finger grips, contrapposto sitting',
    userPrompt: 'Generate a Krea 2 prompt of two elderly men playing chess on a stone table in a misty autumn park. The man on the left hovers a wooden knight piece over the board with steady fingers, while the man on the right rests his chin in his hand, squinting down intently at the squares.'
  },
  {
    id: 'MA-K2-03',
    engine: 'krea2',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1216,
    height: 832,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Aviation Hangar Tech Team',
    stressFocus: '3-plane optical depth staging, 3 distinct concurrent roles, token budget scaling (120-150 words)',
    userPrompt: 'Generate a Krea 2 prompt of a high-tech aircraft hangar with 3 people at work: In the foreground, a female mechanic on a low stepladder torques an engine bolt with a socket wrench. In the midground, a lead avionics engineer types rapidly at a ruggedized terminal. In the background, a flight supervisor reviews flight schematics on a digital clipboard.'
  },
  {
    id: 'MA-K2-04',
    engine: 'krea2',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1216,
    height: 832,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Interrogation Room Tension',
    stressFocus: 'High-contrast overhead cone lighting (3000K), divergent eye vectors, opposing posture kinetics',
    userPrompt: 'Generate a Krea 2 prompt of a tense interrogation room. A weary detective in a rumpled suit leans forward across a metal table with both hands flat over open manila case files. Across the table, a seated suspect in a dark hoodie sits back with crossed arms, staring sideways toward the one-way observation mirror.'
  },
  {
    id: 'MA-K2-05',
    engine: 'krea2',
    model: 'Krea2/krea2_turbo_int8_convrot',
    width: 1216,
    height: 832,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Backstage Theater Rush',
    stressFocus: 'Multi-character physical proximity, reflective vanity mirror interaction, tactile fabric tension',
    userPrompt: 'Generate a Krea 2 prompt of a bustling theater dressing room moments before curtain call. A stage manager in all-black speaks urgently into a radio headset while checking a stopwatch. Beside her, a wardrobe costumer kneels on the carpet quickly pinning the hem of an ornate sequin gown worn by the lead actress facing a lit vanity mirror.'
  },

  // -------------------------------------------------------------
  // Part B: CircleStone Labs ANIMA Scenarios (16:9, CFG 1.0)
  // -------------------------------------------------------------
  {
    id: 'MA-AN-01',
    engine: 'anima',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Clubroom Divergent Hobbies',
    stressFocus: 'Danbooru count tag handling (2girls), hair/eye color isolation, independent hand props',
    userPrompt: 'Generate an Anima prompt of an after-school literature clubroom with two girls. On the left sofa, a girl with short dark blue hair quietly reads an open manga. On the right table, a girl with long blonde twin tails sits drinking hot tea from a porcelain teacup.'
  },
  {
    id: 'MA-AN-02',
    engine: 'anima',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Duelist High-Stakes Faceoff',
    stressFocus: '1girl 1boy count tag, opposing kinetic stances, dual lighting temperatures (steel vs magic glow)',
    userPrompt: 'Generate an Anima prompt of a dramatic faceoff between a swordswoman and a mage in a stone colosseum. On the left, the swordswoman in black battle armor drops into a low stance with drawn katana blade. On the right, the male mage in a white mantle raises a glowing crystal staff with spiraling azure magic particles.'
  },
  {
    id: 'MA-AN-03',
    engine: 'anima',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Mecha Cockpit Tandem',
    stressFocus: '1boy 1girl count tag, tight interior spatial overlap, directional pointing physics, cockpit rim lighting',
    userPrompt: 'Generate an Anima prompt of a two-person giant mecha cockpit during atmospheric descent. In the pilot seat, a young male pilot in a pressurized flight suit grips dual control throttles with white knuckles. Leaning over the headrest from behind him, a female navigator points forward at the red flashing tactical HUD radar.'
  },
  {
    id: 'MA-AN-04',
    engine: 'anima',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'School Rooftop Afternoon',
    stressFocus: '2girls 1boy count tag, varied eye-line vectors, natural slice-of-life staging',
    userPrompt: 'Generate an Anima prompt of three high school friends on a sunny school rooftop at lunchtime. A boy leans back against the chain-link fence looking up at the clouds. A girl sits on a wooden bench opening a bento box with wooden chopsticks. Another girl stands beside her smiling and holding out a juice box.'
  },
  {
    id: 'MA-AN-05',
    engine: 'anima',
    model: 'Anima/anima_turboV10',
    width: 1216,
    height: 688,
    steps: 10,
    cfgscale: 1.0,
    sampler: 'euler',
    name: 'Fantasy Tavern Guild Party',
    stressFocus: '1boy 2girls count tag, distinct weapon/item binding, warm fireplace vs ambient shadow',
    userPrompt: 'Generate an Anima prompt of an adventuring party resting in a rustic stone tavern at night. An armored male knight sits polishing a steel broadsword with an oiled cloth at the main table. An elf ranger with long silver hair sits near the stone fireplace stringing a recurve longbow. A catgirl rogue sits perched on a corner booth flipping a gold coin.'
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
  console.log(`   MULTI-ACTOR STRESS BENCHMARK: 10 SCENARIOS (5 K2 + 5 ANIMA)  `);
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

    try {
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
        results.push({
          ...s,
          promptStatus: 'ERROR',
          promptError: `HTTP ${response.status}: ${errText}`
        });
        continue;
      }

      const data = await response.json();
      const rawOutput = data.choices?.[0]?.message?.content || '';
      const duration = ((Date.now() - promptStartTime) / 1000).toFixed(1);

      const { positivePrompt, negativePrompt } = extractPromptFromOutput(rawOutput);
      const wordCount = positivePrompt.split(/\s+/).filter(Boolean).length;

      results.push({
        ...s,
        promptStatus: 'SUCCESS',
        promptGenerationSec: parseFloat(duration),
        wordCount,
        rawOutput,
        positivePrompt,
        negativePrompt
      });

      console.log(`Done (${duration}s) -> ${wordCount} words`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      results.push({
        ...s,
        promptStatus: 'ERROR',
        promptError: err.message
      });
    }
  }

  const stage1Duration = ((Date.now() - stage1Start) / 1000).toFixed(1);
  console.log(`[+] Stage 1 Complete in ${stage1Duration}s!\n`);

  // Write intermediate prompt results
  fs.writeFileSync(RESULTS_JSON, JSON.stringify(results, null, 2), 'utf-8');

  // Check if any prompts succeeded
  const successfulPrompts = results.filter(r => r.promptStatus === 'SUCCESS');
  if (successfulPrompts.length === 0) {
    console.log(`[!] No successful prompts generated. Exiting.`);
    return;
  }

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
  console.log(`>>> [STAGE 3/3] Submitting Prompts to SwarmUI (${SWARM_URL})...`);
  const stage3Start = Date.now();

  let sessionId = null;
  try {
    sessionId = await getSwarmSession();
    console.log(`[+] SwarmUI Session ID: ${sessionId.slice(0, 10)}...`);
  } catch (err) {
    console.warn(`[!] Warning: Could not connect to SwarmUI (${err.message}). Skipping diffusion render stage.`);
    fs.writeFileSync(RESULTS_JSON, JSON.stringify(results, null, 2), 'utf-8');
    return;
  }

  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    if (item.promptStatus !== 'SUCCESS') continue;

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

    try {
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
        const filename = `multiactor_${item.id}_${item.engine}_${Date.now()}.png`;
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
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      item.imageStatus = 'ERROR';
      item.imageError = err.message;
    }
  }

  const stage3Duration = ((Date.now() - stage3Start) / 1000).toFixed(1);
  console.log(`\n[+] Stage 3 Complete in ${stage3Duration}s!`);

  // Write full results JSON
  fs.writeFileSync(RESULTS_JSON, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n===============================================================`);
  console.log(`🎉 Multi-Actor Benchmark Execution Complete!`);
  console.log(`Results saved to: ${RESULTS_JSON}`);
  console.log(`All images saved in: ${OUT_DIR}`);
  console.log(`===============================================================\n`);
}

main().catch(err => {
  console.error('\n[FATAL ERROR IN BENCHMARK]', err);
  process.exit(1);
});
