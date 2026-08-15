import fs from 'fs';
import path from 'path';

/**
 * SwarmUI Client: Generates images via SwarmUI API (http://localhost:7801)
 * and downloads the resulting image files for inspection.
 */

const DEFAULT_SWARM_URL = process.env.SWARM_URL || 'http://localhost:7801';
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DEFAULT_OUT_DIR = process.env.OUT_DIR || path.resolve(SCRIPT_DIR, '../scratch/generated_images');

export async function getSwarmSession(swarmUrl = DEFAULT_SWARM_URL) {
  const res = await fetch(`${swarmUrl}/API/GetNewSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!res.ok) {
    throw new Error(`Failed to acquire SwarmUI session (HTTP ${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(`SwarmUI session error: ${data.error}`);
  return data.session_id;
}

export async function generateAndInspect(options = {}) {
  const {
    prompt,
    negativeprompt = '',
    model,
    width = 1216,
    height = 832,
    steps = 30,
    cfgscale = 4.0,
    sampler = 'euler',
    seed = -1,
    images = 1,
    swarmUrl = DEFAULT_SWARM_URL,
    outDir = DEFAULT_OUT_DIR
  } = options;

  if (!prompt) {
    throw new Error('Prompt is required.');
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`\n========================================`);
  console.log(`  SWARMUI IMAGE GENERATION & INSPECTION `);
  console.log(`========================================`);
  console.log(`Target Server: ${swarmUrl}`);
  console.log(`Model:         ${model || '(Default active model)'}`);
  console.log(`Resolution:    ${width}x${height}`);
  console.log(`Steps / CFG:   ${steps} steps / CFG ${cfgscale}`);
  console.log(`Sampler:       ${sampler}`);
  console.log(`Prompt:        "${prompt.length > 100 ? prompt.slice(0, 100) + '...' : prompt}"`);
  if (negativeprompt) {
    console.log(`Negative:      "${negativeprompt.slice(0, 60)}..."`);
  }
  console.log(`----------------------------------------`);

  const sessionId = await getSwarmSession(swarmUrl);
  console.log(`[+] Session ID acquired: ${sessionId.slice(0, 8)}...`);

  const payload = {
    session_id: sessionId,
    prompt,
    negativeprompt,
    images,
    width,
    height,
    steps,
    cfgscale,
    sampler,
    seed,
    donotsave: false
  };

  if (model) {
    payload.model = model;
  }

  console.log(`[+] Sending generation request to /API/GenerateText2Image...`);
  const startTime = Date.now();

  const res = await fetch(`${swarmUrl}/API/GenerateText2Image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`GenerateText2Image request failed (HTTP ${res.status}): ${await res.text()}`);
  }

  const result = await res.json();
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

  if (result.error) {
    throw new Error(`SwarmUI Generation Error: ${result.error}`);
  }

  console.log(`[+] Generation finished in ${elapsedSec}s!`);

  const downloadedFiles = [];

  if (result.images && Array.isArray(result.images)) {
    for (let i = 0; i < result.images.length; i++) {
      const imgPathOrData = result.images[i];
      const timestamp = Date.now();
      const filename = `swarm_${timestamp}_${i + 1}.png`;
      const localFilePath = path.join(outDir, filename);

      if (imgPathOrData.startsWith('data:image') || imgPathOrData.includes('base64,')) {
        const base64Str = imgPathOrData.split('base64,')[1];
        fs.writeFileSync(localFilePath, Buffer.from(base64Str, 'base64'));
      } else {
        const downloadUrl = imgPathOrData.startsWith('http') 
          ? imgPathOrData 
          : `${swarmUrl}/${imgPathOrData.replace(/^\/+/, '')}`;

        console.log(`[+] Downloading generated image: ${downloadUrl}`);
        const imgRes = await fetch(downloadUrl);
        if (!imgRes.ok) {
          throw new Error(`Failed to download image from ${downloadUrl}: HTTP ${imgRes.status}`);
        }
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        fs.writeFileSync(localFilePath, buffer);
      }

      const stats = fs.statSync(localFilePath);
      console.log(`\n----------------------------------------`);
      console.log(`  IMAGE FILE INSPECTION REPORT`);
      console.log(`----------------------------------------`);
      console.log(`Local Path: ${localFilePath}`);
      console.log(`File Size:  ${(stats.size / 1024).toFixed(1)} KB`);
      console.log(`Created:    ${stats.birthtime.toISOString()}`);
      console.log(`----------------------------------------\n`);

      downloadedFiles.push({
        path: localFilePath,
        sizeBytes: stats.size,
        swarmRef: imgPathOrData
      });
    }
  }

  return {
    success: true,
    elapsedSec: parseFloat(elapsedSec),
    files: downloadedFiles,
    metadata: result
  };
}

// CLI Execution Handler
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--prompt' || args[i] === '-p') options.prompt = args[++i];
    else if (args[i] === '--negative' || args[i] === '-n') options.negativeprompt = args[++i];
    else if (args[i] === '--model' || args[i] === '-m') options.model = args[++i];
    else if (args[i] === '--width' || args[i] === '-w') options.width = parseInt(args[++i], 10);
    else if (args[i] === '--height' || args[i] === '-h') options.height = parseInt(args[++i], 10);
    else if (args[i] === '--steps' || args[i] === '-s') options.steps = parseInt(args[++i], 10);
    else if (args[i] === '--cfg') options.cfgscale = parseFloat(args[++i]);
    else if (args[i] === '--sampler') options.sampler = args[++i];
    else if (args[i] === '--seed') options.seed = parseInt(args[++i], 10);
    else if (args[i] === '--images') options.images = parseInt(args[++i], 10);
    else if (args[i] === '--url') options.swarmUrl = args[++i];
    else if (args[i] === '--out') options.outDir = args[++i];
    else if (!options.prompt) options.prompt = args[i];
  }

  return options;
}

if (process.argv[1] && process.argv[1].endsWith('swarm_generate.mjs')) {
  const options = parseArgs();
  if (!options.prompt) {
    console.log(`Usage: node swarm_generate.mjs --prompt "Your prompt here" [options]`);
    console.log(`Options:`);
    console.log(`  --model, -m     Model name (e.g. krea2_turbo or anima)`);
    console.log(`  --negative, -n  Negative prompt`);
    console.log(`  --width, -w     Width in pixels (default: 1216)`);
    console.log(`  --height, -h    Height in pixels (default: 832)`);
    console.log(`  --steps, -s     Step count (default: 30)`);
    console.log(`  --cfg           CFG scale (default: 4.0)`);
    console.log(`  --sampler       Sampler name (default: euler)`);
    console.log(`  --url           SwarmUI URL (default: http://localhost:7801)`);
    process.exit(0);
  }

  generateAndInspect(options)
    .then(res => {
      console.log(`[SUCCESS] Process complete with ${res.files.length} image(s) retrieved.`);
    })
    .catch(err => {
      console.error(`\n[FATAL ERROR]`, err.message);
      process.exit(1);
    });
}
