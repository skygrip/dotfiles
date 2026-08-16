#!/usr/bin/env node
/**
 * fetch_civitai_prompts.mjs
 * 
 * Fetches top community prompts and image metadata from Civitai
 * 
 * Outputs pure JSON to stdout so you can pipe or redirect to a file:
 *   node fetch_civitai_prompts.mjs --base-model "Anima" --limit 40 > prompts.json
 */

// Parse CLI Arguments
const args = process.argv.slice(2);
function getArg(name, defaultValue = null) {
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return defaultValue;
}

const API_KEY = getArg('key', process.env.CIVITAI_API_KEY);
const BASE_MODEL = getArg('base-model', getArg('base', null));
const MODEL_QUERY = getArg('model', BASE_MODEL ? null : 'Anima');
const MODEL_ID_OVERRIDE = getArg('model-id', null);
const MODEL_VERSION_OVERRIDE = getArg('version-id', null);
const LIMIT = parseInt(getArg('limit', '40'), 10);
const SORT = getArg('sort', 'Most Collected');           // 'Most Collected', 'Most Reactions', 'Most Comments', 'Newest', 'Oldest', 'Random'
const PERIOD = getArg('period', 'Month');               // 'Month', 'Week', 'Day', 'Year', 'AllTime'
const BROWSING_LEVEL = getArg('browsing-level', '1');   // Bitmask: 1=PG, 2=PG-13, 4=R, 8=X, 16=XXX, 31=ALL
const WITH_META = getArg('with-meta', 'true');          // Modern API requires withMeta=true for prompts
const TAG = getArg('tag', null);                        // Filter by tag (e.g., "cyberpunk", "anime")
const TYPE = getArg('type', null);                      // Filter by media type ('image', 'video', 'audio')
const BASE_URL = (getArg('base-url', process.env.CIVITAI_BASE_URL || 'https://civitai.com/api/v1')).replace(/\/+$/, '');

async function fetchCivitai(endpoint, params = {}, retries = 3) {
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  const url = new URL(`${BASE_URL}/${cleanEndpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      url.searchParams.append(k, v);
    }
  }

  if (API_KEY) {
    url.searchParams.append('token', API_KEY);
  }

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };

  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url.toString(), { headers });
      if (res.status === 503 || res.status === 429) {
        if (attempt === retries) {
          throw new Error(`Civitai API rate limit or service overloaded (${res.status}) after ${retries} attempts.`);
        }
        console.error(`⏳ Civitai API busy (${res.status}). Retrying attempt ${attempt}/${retries} in 2s...`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Civitai API Error ${res.status} (${res.statusText}): ${errorText}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

async function getModelVersionIds(modelId) {
  try {
    const data = await fetchCivitai(`models/${modelId}`);
    if (data && data.modelVersions) {
      return data.modelVersions.map(v => v.id);
    }
  } catch (err) {
    console.error(`⚠️ Could not retrieve model versions for ${modelId}: ${err.message}`);
  }
  return [];
}

function scoreModelMatch(modelName, query) {
  const name = modelName.trim().toLowerCase();
  const q = query.trim().toLowerCase();
  
  if (name === q) return 100; // 1. Exact string equality
  if (new RegExp(`(^|[^a-zA-Z0-9])${q}([^a-zA-Z0-9]|$)`, 'i').test(name)) return 80; // 2. Standalone word match
  if (name.startsWith(q)) return 40; // 3. Prefix match
  if (name.includes(q)) return 20;   // 4. Substring match
  return 0;
}

async function resolveModel(query) {
  try {
    const trimmed = query.trim();
    console.error(`🔍 Searching Civitai for model: "${trimmed}"...`);
    const data = await fetchCivitai('models', {
      query: trimmed,
      types: 'Checkpoint',
      limit: 10
    });

    if (!data || !data.items || data.items.length === 0) {
      console.error(`⚠️ No Checkpoint models found matching query "${trimmed}".`);
      return null;
    }

    // Rank candidates by relevance score
    const ranked = [...data.items]
      .map(item => ({ ...item, relevance: scoreModelMatch(item.name, trimmed) }))
      .filter(item => item.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance);

    if (ranked.length === 0) {
      console.error(`⚠️ No relevant models matched "${trimmed}".`);
      return null;
    }

    const selected = ranked[0];

    // If there's an exact match (score 100), log cleanly
    if (selected.relevance === 100) {
      console.error(`✅ Found exact model match: "${selected.name}" (Model ID: ${selected.id})`);
    } else {
      console.error(`\nTop matching models for "${trimmed}":`);
      ranked.slice(0, 5).forEach((m, idx) => {
        console.error(`  [${idx + 1}] ID: ${m.id} | Name: "${m.name}" (Score: ${m.relevance})`);
      });
    }

    const versionIds = selected.modelVersions ? selected.modelVersions.map(v => v.id) : await getModelVersionIds(selected.id);
    console.error(`\n✅ Pinned to: "${selected.name}" (Model ID: ${selected.id}, ${versionIds.length} version(s))\n`);
    return { id: selected.id, name: selected.name, versionIds };
  } catch (err) {
    console.error(`⚠️ Model search failed (${err.message}). You can specify --model-id directly.`);
    return null;
  }
}

async function main() {
  if (!API_KEY) {
    console.error('⚠️ Warning: No Civitai API key provided. Using public unauthenticated rate limits.');
    console.error('  (Pass via --key <YOUR_KEY> or set $env:CIVITAI_API_KEY="...")\n');
  } else {
    console.error('🔑 Authenticated with Civitai API key.\n');
  }

  let targetModelId = MODEL_ID_OVERRIDE;
  let targetVersionIds = [];

  if (BASE_MODEL) {
    console.error(`🏗️ Pinned to Base Model Architecture: "${BASE_MODEL}"`);
  } else if (MODEL_VERSION_OVERRIDE) {
    targetVersionIds = [parseInt(MODEL_VERSION_OVERRIDE, 10)];
  } else if (targetModelId) {
    targetVersionIds = await getModelVersionIds(targetModelId);
  } else if (MODEL_QUERY) {
    const resolved = await resolveModel(MODEL_QUERY);
    if (resolved) {
      targetModelId = resolved.id;
      targetVersionIds = resolved.versionIds;
    }
  }

  console.error(`🚀 Fetching up to ${LIMIT} images with prompts (Sort: ${SORT}, Period: ${PERIOD}, BrowsingLevel: ${BROWSING_LEVEL})...`);

  const fetchedImages = [];
  const seenIds = new Set();

  // If we have specific version IDs, iterate over versions to collect images
  const versionQueue = targetVersionIds.length > 0 ? targetVersionIds : [null];

  for (const vId of versionQueue) {
    if (fetchedImages.length >= LIMIT) break;
    let page = 1;
    const pageSize = 100; // Request maximum per page to maximize images with valid metadata

    if (vId) {
      console.error(`📡 Querying model version ID: ${vId}...`);
    }

    while (fetchedImages.length < LIMIT) {
      const params = {
        limit: pageSize,
        sort: SORT,
        period: PERIOD,
        page: page,
        withMeta: WITH_META,
        browsingLevel: parseInt(BROWSING_LEVEL, 10) || 1
      };

      if (BASE_MODEL) {
        params.baseModels = BASE_MODEL;
      } else if (vId) {
        params.modelVersionId = vId;
      } else if (targetModelId) {
        params.modelId = parseInt(targetModelId, 10);
      }

      if (TAG) {
        if (/^[\d,]+$/.test(TAG.trim())) {
          params.tags = TAG.trim();
        }
      }
      if (TYPE) {
        params.type = TYPE;
      }

      let data;
      try {
        data = await fetchCivitai('images', params);
      } catch (err) {
        console.error(`  ⚠️ Failed fetching page ${page}: ${err.message}`);
        break;
      }

      const items = data.items || [];
      if (items.length === 0) break;

      for (const item of items) {
        if (seenIds.has(item.id)) continue;

        const meta = item.meta || {};
        const prompt = meta.prompt || meta.Prompt || '';

        // Only save items that actually have prompt metadata
        if (prompt.trim().length > 0) {
          // If a text tag/keyword is specified, filter for it in the prompt/tags
          if (TAG && !/^[\d,]+$/.test(TAG.trim())) {
            const tagLower = TAG.trim().toLowerCase();
            const promptLower = prompt.toLowerCase();
            const negPromptLower = (meta.negativePrompt || meta.NegativePrompt || '').toLowerCase();
            const hasTag = promptLower.includes(tagLower) || 
                           negPromptLower.includes(tagLower) ||
                           (item.tags && item.tags.some(t => String(t.name || t).toLowerCase().includes(tagLower)));
            if (!hasTag) continue;
          }

          seenIds.add(item.id);
          fetchedImages.push({
            id: item.id,
            model: item.meta?.Model || item.meta?.model || item.meta?.baseModel || BASE_MODEL || (targetModelId ? `Model_${targetModelId}` : 'N/A'),
            imageUrl: item.url,
            width: item.width,
            height: item.height,
            reactions: item.stats?.likeCount || item.stats?.heartCount || 0,
            stats: item.stats,
            prompt: prompt.trim(),
            negativePrompt: (meta.negativePrompt || meta.NegativePrompt || '').trim(),
            meta: {
              steps: meta.steps || meta.Steps,
              cfgScale: meta.cfgScale || meta.CFG,
              sampler: meta.sampler || meta.Sampler,
              seed: meta.seed || meta.Seed,
              model: meta.Model || meta.model || meta.baseModel,
              loras: Object.keys(meta)
                .filter(k => k.toLowerCase().startsWith('lora:'))
                .reduce((acc, k) => { acc[k] = meta[k]; return acc; }, {})
            },
            createdAt: item.createdAt
          });

          if (fetchedImages.length >= LIMIT) break;
        }
      }

      if (items.length < pageSize) break;
      page++;
    }
  }

  console.error(`\n✨ Successfully collected ${fetchedImages.length} prompt entries.\n`);

  // Output pure JSON to stdout for piping / redirection
  process.stdout.write(JSON.stringify(fetchedImages, null, 2) + '\n');
}

main().catch(err => {
  console.error('\n❌ Fatal Execution Error:', err.message);
  process.exit(1);
});
