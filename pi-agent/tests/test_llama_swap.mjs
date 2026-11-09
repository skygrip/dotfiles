#!/usr/bin/env node

/**
 * ============================================================================
 * Llama-Swap Extension Test Suite for Pi Coding Agent
 * ============================================================================
 *
 * Test suite verifying:
 * - Section 1: URL Normalization & Inference Base URL
 * - Section 2: Model Metadata Translation (Modalities, Context, MaxTokens, ThinkingLevelMap)
 * - Section 3: Catalog Fetching, Auth Header Injection & Error Handling
 * - Section 4: Multi-Instance Registration, Friendly Name [badge], Migration & Login/Logout
 * - Section 5: Live Integration against running llama-swap server (when online)
 *
 * Usage:
 *   node pi-agent/tests/test_llama_swap.mjs
 *   node pi-agent/tests/test_llama_swap.mjs --offline
 */

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadExtension, createTestRecorder, isOfflineMode } from "./test_harness.mjs";

function loadLlamaSwapModule() {
  return loadExtension("llama-swap.ts");
}

function createTempAuthFile(initialData = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-llama-swap-test-"));
  const authPath = path.join(tmpDir, "auth.json");
  fs.writeFileSync(authPath, JSON.stringify(initialData, null, 2), "utf8");
  return {
    authPath,
    cleanup() {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  };
}

const SAMPLE_CATALOG = [
  {
    id: "gemma4-12b",
    name: "Unsloth Gemma 4 12B",
    description: "unsloth/gemma-4-12b-it-qat-GGUF:UD-Q4_K_XL",
    context_window: 131072,
    architecture: {
      input_modalities: ["text", "image", "audio"],
      output_modalities: ["text"]
    },
    capabilities: {
      vision: true,
      function_calling: true
    },
    meta: {
      n_ctx: 131072,
      llamaswap: {
        type: "model",
        reasoning: true,
        maxTokens: 16384,
        thinkingLevelMap: {
          off: "none",
          minimal: null,
          low: null,
          medium: "medium",
          high: null
        }
      }
    }
  },
  {
    id: "qwen3.8-flash-next-basalt",
    name: "Qwen 3.8 Flash Next 125B (Basalt)",
    description: "Qwen3.8-Flash-Next running on Basalt",
    context_window: 262144,
    architecture: {
      input_modalities: ["text", "image"],
      output_modalities: ["text"]
    },
    capabilities: {
      vision: true,
      function_calling: true
    },
    meta: {
      n_ctx: 262144,
      llamaswap: {
        type: "model",
        reasoning: true,
        maxTokens: 32768,
        thinkingLevelMap: {
          off: "none",
          minimal: null,
          low: "low",
          medium: "medium",
          high: "xhigh"
        }
      }
    }
  },
  {
    id: "lightonocr3_4b",
    name: "LightOnOCR 3 4B",
    description: "prithivMLmods/LightOnOCR-3-4B-GGUF:Q8_0",
    context_window: 65536,
    architecture: {
      input_modalities: ["text", "image"],
      output_modalities: ["text"]
    },
    capabilities: {
      vision: true,
      function_calling: false
    },
    meta: {
      n_ctx: 65536,
      llamaswap: {
        type: "model",
        reasoning: false,
        maxTokens: 12288
      }
    }
  }
];

export async function runLlamaSwapTests() {
  const mod = loadLlamaSwapModule();
  const extensionFactory = mod.default || mod;
  const {
    normalizeServerUrl,
    inferenceBaseUrl,
    fetchCatalog,
    toPiModel,
    migrateAndLoadStoredServers,
    BINARY_THINKING_MAP,
    MULTI_LEVEL_THINKING_MAP
  } = mod;

  const { test, asyncTest, results, printSummary } = createTestRecorder("Llama-Swap");
  const startTime = Date.now();

  // -------------------------------------------------------------------------
  // Section 1: URL Normalization & Inference Base URL
  // -------------------------------------------------------------------------
  test("URL Normalization: strips trailing slashes, /v1 suffix, query, and hash", () => {
    assert.equal(normalizeServerUrl("http://127.0.0.1:8080/"), "http://127.0.0.1:8080");
    assert.equal(normalizeServerUrl("http://127.0.0.1:8080/v1"), "http://127.0.0.1:8080");
    assert.equal(normalizeServerUrl("http://127.0.0.1:8080/v1/"), "http://127.0.0.1:8080");
    assert.equal(normalizeServerUrl("https://swap.local:9000/api/v1?foo=1#bar"), "https://swap.local:9000/api");
  });

  test("URL Normalization: infers http:// for local/IP/custom-port and https:// for bare domains or :443", () => {
    assert.equal(normalizeServerUrl("127.0.0.1:8080"), "http://127.0.0.1:8080");
    assert.equal(normalizeServerUrl("swap.local:443/v1/"), "https://swap.local");
    assert.equal(normalizeServerUrl("swap.example.com"), "https://swap.example.com");
    assert.equal(normalizeServerUrl("swap.example.com/v1"), "https://swap.example.com");
    assert.equal(normalizeServerUrl("swap.example.com:8080"), "http://swap.example.com:8080");
    assert.equal(inferenceBaseUrl("192.168.1.50:8080/v1/"), "http://192.168.1.50:8080/v1");
    assert.throws(() => normalizeServerUrl(""), /empty/i);
    assert.throws(() => normalizeServerUrl("ftp://127.0.0.1:8080"), /http or https/);
  });

  // -------------------------------------------------------------------------
  // Section 2: Model Metadata Translation
  // -------------------------------------------------------------------------
  test("Model Translation: maps standard llama-server model with meta.llamaswap", () => {
    const model = toPiModel(SAMPLE_CATALOG[0], "http://127.0.0.1:8080", "node-1");
    assert.equal(model.id, "gemma4-12b");
    assert.equal(model.name, "Unsloth Gemma 4 12B");
    assert.equal(model.provider, "node-1");
    assert.equal(model.baseUrl, "http://127.0.0.1:8080/v1");
    assert.equal(model.contextWindow, 131072);
    assert.equal(model.maxTokens, 16384);
    assert.equal(model.reasoning, true);
    assert.deepEqual(model.input, ["text", "image"]);
    assert.deepEqual(model.thinkingLevelMap, {
      off: "none",
      minimal: null,
      low: null,
      medium: "medium",
      high: null,
      xhigh: null
    });
    assert.equal(model.compat.supportsReasoningEffort, true);
    assert.equal(model.compat.maxTokensField, "max_tokens");
  });

  test("Model Translation: maps Basalt multi-level reasoning model", () => {
    const model = toPiModel(SAMPLE_CATALOG[1], "http://127.0.0.1:8080", "node-1");
    assert.equal(model.id, "qwen3.8-flash-next-basalt");
    assert.equal(model.provider, "node-1");
    assert.equal(model.contextWindow, 262144);
    assert.equal(model.maxTokens, 32768);
    assert.equal(model.reasoning, true);
    assert.equal(model.thinkingLevelMap.low, "low");
    assert.equal(model.thinkingLevelMap.medium, "medium");
    assert.equal(model.thinkingLevelMap.high, "xhigh");
  });

  test("Model Translation: maps OCR / non-reasoning model with reasoning=false and no thinkingLevelMap", () => {
    const model = toPiModel(SAMPLE_CATALOG[2], "http://127.0.0.1:8080", "node-1");
    assert.equal(model.id, "lightonocr3_4b");
    assert.equal(model.contextWindow, 65536);
    assert.equal(model.maxTokens, 12288);
    assert.equal(model.reasoning, false);
    assert.equal(model.thinkingLevelMap, undefined);
  });

  test("Model Translation: applies smart fallbacks when meta.llamaswap is omitted", () => {
    const bareChat = toPiModel({ id: "custom-7b" }, "http://127.0.0.1:8080", "node-2");
    assert.equal(bareChat.provider, "node-2");
    assert.equal(bareChat.contextWindow, 131072);
    assert.equal(bareChat.maxTokens, 16384);
    assert.equal(bareChat.reasoning, true);
    assert.deepEqual(bareChat.input, ["text"]);
    assert.deepEqual(bareChat.thinkingLevelMap, BINARY_THINKING_MAP);

    const bareBasalt = toPiModel(
      { id: "qwen-basalt-test", context_length: 262144 },
      "http://127.0.0.1:8080",
      "node-2"
    );
    assert.equal(bareBasalt.contextWindow, 262144);
    assert.equal(bareBasalt.maxTokens, 32768);
    assert.deepEqual(bareBasalt.thinkingLevelMap, MULTI_LEVEL_THINKING_MAP);

    const configYamlStyle = toPiModel(
      {
        id: "yaml-style-model",
        capabilities: {
          in: ["text", "image"],
          out: ["text"],
          tools: false,
          context: 65536
        },
        metadata: {
          maxTokens: 12288
        }
      },
      "https://swap.local:8443",
      "node-2"
    );
    assert.equal(configYamlStyle.contextWindow, 65536);
    assert.equal(configYamlStyle.maxTokens, 12288);
    assert.equal(configYamlStyle.reasoning, false);
    assert.deepEqual(configYamlStyle.input, ["text", "image"]);
    assert.equal(configYamlStyle.baseUrl, "https://swap.local:8443/v1");
  });

  // -------------------------------------------------------------------------
  // Section 3: Catalog Fetching & Error Handling
  // -------------------------------------------------------------------------
  await asyncTest("Catalog Fetch: sends Bearer token and parses valid entries", async () => {
    let capturedUrl = "";
    let capturedAuth = "";
    const mockFetch = async (url, init) => {
      capturedUrl = String(url);
      capturedAuth = init.headers.get("Authorization");
      return new Response(JSON.stringify({ data: SAMPLE_CATALOG }), { status: 200 });
    };

    const entries = await fetchCatalog("http://127.0.0.1:8080/", "secret-token", undefined, mockFetch);
    assert.equal(capturedUrl, "http://127.0.0.1:8080/v1/models");
    assert.equal(capturedAuth, "Bearer secret-token");
    assert.equal(entries.length, 3);

    // Default placeholder key ("not-needed") should not send an Authorization header
    let defaultKeyAuth = null;
    await fetchCatalog("https://swap.local:8443/", "not-needed", undefined, async (_url, init) => {
      defaultKeyAuth = init.headers.get("Authorization");
      return new Response(JSON.stringify({ data: SAMPLE_CATALOG }), { status: 200 });
    });
    assert.equal(defaultKeyAuth, null);
  });

  await asyncTest("Catalog Fetch: throws descriptive error on HTTP failure or malformed payload", async () => {
    const http500Fetch = async () => new Response("error", { status: 500 });
    await assert.rejects(
      () => fetchCatalog("http://127.0.0.1:8080", "not-needed", undefined, http500Fetch),
      /HTTP 500/
    );

    const badJsonFetch = async () => new Response(JSON.stringify({ wrong: true }), { status: 200 });
    await assert.rejects(
      () => fetchCatalog("http://127.0.0.1:8080", "not-needed", undefined, badJsonFetch),
      /invalid \/v1\/models catalog/
    );
  });

  // -------------------------------------------------------------------------
  // Section 4: Multi-Instance Registration, Friendly Name [badge] & Migration
  // -------------------------------------------------------------------------
  test("Auth Migration: migrates root 'llama-swap' entry with LLAMA_SWAP_NAME to named provider", () => {
    const { authPath, cleanup } = createTempAuthFile({
      "llama-swap": {
        type: "api_key",
        key: "not-needed",
        env: {
          LLAMA_SWAP_NAME: "node-1",
          LLAMA_SWAP_URL: "http://127.0.0.1:8080"
        }
      }
    });

    try {
      const servers = migrateAndLoadStoredServers(authPath);
      assert.equal(servers.size, 1);
      assert.ok(servers.has("node-1"));
      assert.equal(servers.get("node-1").serverUrl, "http://127.0.0.1:8080");

      const persisted = JSON.parse(fs.readFileSync(authPath, "utf8"));
      assert.ok(persisted["node-1"], "node-1 key must exist in auth.json");
      assert.equal(persisted["llama-swap"], undefined, "Root llama-swap key must be cleaned up");
    } finally {
      cleanup();
    }
  });

  await asyncTest("Multi-Instance: registers multiple symmetric instances simultaneously ([node-1], [node-2])", async () => {
    const { authPath, cleanup } = createTempAuthFile({
      "node-1": {
        type: "api_key",
        key: "not-needed",
        env: {
          LLAMA_SWAP_NAME: "node-1",
          LLAMA_SWAP_URL: "http://10.0.0.1:8080"
        }
      },
      "node-2": {
        type: "api_key",
        key: "node2-token",
        env: {
          LLAMA_SWAP_NAME: "node-2",
          LLAMA_SWAP_URL: "http://10.0.0.2:8080"
        }
      }
    });

    try {
      const providers = new Map();
      const mockPi = {
        registerProvider(p) {
          providers.set(p.id, p);
        },
        unregisterProvider(id) {
          providers.delete(id);
        }
      };

      const mockFetch = async (url) => {
        const isNode2 = String(url).includes("10.0.0.2");
        const data = isNode2 ? [SAMPLE_CATALOG[0]] : [SAMPLE_CATALOG[1]];
        return new Response(JSON.stringify({ data }), { status: 200 });
      };

      extensionFactory(mockPi, { authPath, fetchImpl: mockFetch });

      assert.ok(providers.has("node-1"), "node-1 provider must be registered");
      assert.ok(providers.has("node-2"), "node-2 provider must be registered");
      assert.ok(providers.has("llama-swap"), "llama-swap adder provider must be registered");

      // Refresh both instances and verify model.provider matches each endpoint name
      for (const id of ["node-1", "node-2"]) {
        const p = providers.get(id);
        await p.refreshModels({
          allowNetwork: true,
          signal: new AbortController().signal,
          publish: async ({ update }) => {
            update?.();
            return true;
          }
        });
      }

      const node1Models = providers.get("node-1").getModels();
      assert.equal(node1Models.length, 1);
      assert.equal(node1Models[0].id, "qwen3.8-flash-next-basalt");
      assert.equal(node1Models[0].provider, "node-1");

      const node2Models = providers.get("node-2").getModels();
      assert.equal(node2Models.length, 1);
      assert.equal(node2Models[0].id, "gemma4-12b");
      assert.equal(node2Models[0].provider, "node-2");
    } finally {
      cleanup();
    }
  });

  await asyncTest("Interactive Login & Logout: /login llama-swap dynamically creates named endpoint with default API key", async () => {
    const { authPath, cleanup } = createTempAuthFile({});

    try {
      const providers = new Map();
      const mockPi = {
        registerProvider(p) {
          providers.set(p.id, p);
        },
        unregisterProvider(id) {
          providers.delete(id);
        }
      };

      const mockFetch = async () =>
        new Response(JSON.stringify({ data: SAMPLE_CATALOG }), { status: 200 });

      extensionFactory(mockPi, { authPath, fetchImpl: mockFetch });

      const rootProvider = providers.get("llama-swap");
      assert.ok(rootProvider, "Root llama-swap provider must exist");

      const prompts = [];
      const cred = await rootProvider.auth.apiKey.login({
        signal: new AbortController().signal,
        notify() {},
        async prompt(p) {
          prompts.push(p.message);
          if (p.message.includes("Endpoint name") || p.message.includes("Friendly name")) return "node-1";
          if (p.message.includes("URL") || p.message.includes("server URL")) return "http://127.0.0.1:8080";
          if (p.message.includes("API token")) return ""; // blank -> defaults to "not-needed"
          return "";
        }
      });

      assert.equal(prompts.length, 3, "Login must prompt for endpoint name, URL, and API token");
      assert.equal(cred.key, "not-needed", "Blank API token must default to 'not-needed'");
      assert.equal(cred.env.LLAMA_SWAP_NAME, "node-1");
      assert.equal(cred.env.LLAMA_SWAP_URL, "http://127.0.0.1:8080");

      // Verify node-1 was immediately registered with models populated
      const node1Provider = providers.get("node-1");
      assert.ok(node1Provider, "node-1 provider must be registered immediately on login");
      assert.equal(node1Provider.getModels().length, 3);
      assert.equal(node1Provider.getModels()[0].provider, "node-1");

      // Simulate post-login refreshModels on rootProvider migrating auth.json
      await rootProvider.refreshModels({
        credential: cred,
        allowNetwork: true,
        signal: new AbortController().signal,
        publish: async ({ update }) => {
          update?.();
          return true;
        }
      });

      const savedAuth = JSON.parse(fs.readFileSync(authPath, "utf8"));
      assert.ok(savedAuth["node-1"], "node-1 must be persisted in auth.json");

      // Simulate logout by removing node-1 from auth.json and calling check()
      fs.writeFileSync(authPath, "{}", "utf8");
      const checkAfterLogout = await node1Provider.auth.apiKey.check({
        ctx: { env: async () => undefined, fileExists: async () => false },
        credential: undefined,
        signal: new AbortController().signal
      });
      assert.equal(checkAfterLogout, undefined);
      assert.equal(providers.has("node-1"), false, "Logged-out instance must be unregistered");
    } finally {
      cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // Section 5: Live Endpoint Verification (when online and endpoints are configured)
  // -------------------------------------------------------------------------
  if (!isOfflineMode()) {
    await asyncTest("Live Endpoints: fetches catalog from configured llama-swap endpoints", async () => {
      const configured = [...migrateAndLoadStoredServers().values()];
      if (configured.length === 0 && process.env.LLAMA_SWAP_URL?.trim()) {
        configured.push({
          name: process.env.LLAMA_SWAP_NAME?.trim() || "node-1",
          serverUrl: normalizeServerUrl(process.env.LLAMA_SWAP_URL),
          apiKey: process.env.LLAMA_SWAP_API_KEY?.trim() || "not-needed"
        });
      }

      for (const endpoint of configured) {
        let catalog;
        try {
          catalog = await fetchCatalog(endpoint.serverUrl, endpoint.apiKey, AbortSignal.timeout(3000));
        } catch {
          // Skip unreachable endpoints gracefully
          continue;
        }
        assert.ok(catalog.length > 0, `Live catalog from ${endpoint.name} should return at least 1 model`);
        const models = catalog.map((entry) => toPiModel(entry, endpoint.serverUrl, endpoint.name));
        for (const m of models) {
          assert.equal(m.provider, endpoint.name);
          assert.ok(m.contextWindow > 0);
          assert.ok(m.maxTokens > 0);
        }
      }
    });
  }

  return printSummary(startTime);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("test_llama_swap.mjs")) {
  runLlamaSwapTests().then((results) => {
    const failed = results.filter((r) => !r.pass).length;
    process.exit(failed > 0 ? 1 : 0);
  });
}
