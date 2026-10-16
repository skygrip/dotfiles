#!/usr/bin/env node

/**
 * ============================================================================
 * Prompt Cleaner & Tool In-Context Normalizer Test Suite for Pi Coding Agent
 * ============================================================================
 *
 * Comprehensive test suite verifying:
 * - Section 1: Argument Normalizer (`prioritizePathFirst`) JSON string & object key ordering
 * - Section 2: Message History Sanitization (`sanitizeMessages`) across OpenAI, Anthropic, and Content formats
 * - Section 3: System Prompt Boilerplate Stripping (`before_agent_start`)
 * - Section 4: Outgoing Provider Payload Interception (`before_provider_request` & `context`)
 * - Section 5: In-Context Replay & Key Ordering Invariants
 *
 * Usage:
 *   node test_prompt_cleaner.mjs
 */

import assert from "node:assert/strict";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m"
};

function loadPromptCleanerModule() {
  const jitiPkg = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti");
  let jiti;
  try {
    jiti = require(jitiPkg);
  } catch {
    // Fallback if running via bun or local node
    jiti = require("jiti");
  }

  const globalBase = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent");
  const load = jiti(path.join(import.meta.dirname, "dummy.js"), {
    alias: {
      "@earendil-works/pi-coding-agent": globalBase
    }
  });

  const targetPath = path.resolve(import.meta.dirname, "../Pi_Config/agent/extensions/prompt-cleaner.ts");
  return load(targetPath);
}

export async function runPromptCleanerTests() {
  const mod = loadPromptCleanerModule();
  const extensionFactory = mod.default || mod;

  const results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name, pass: true });
    } catch (err) {
      results.push({ name, pass: false, error: err });
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      results.push({ name, pass: true });
    } catch (err) {
      results.push({ name, pass: false, error: err });
    }
  }

  // ----------------------------------------------------
  // Section 1: Argument Key Reordering (prioritizePathFirst)
  // ----------------------------------------------------
  test("Argument Ordering: stringified JSON with 'edits' first is reordered to 'path' first", () => {
    const registeredEvents = new Map();
    const mockPi = {
      on(event, handler) { registeredEvents.set(event, handler); }
    };
    extensionFactory(mockPi);

    const beforeReqHook = registeredEvents.get("before_provider_request");
    assert.ok(beforeReqHook, "before_provider_request hook must be registered");

    const rawJson = JSON.stringify({
      edits: [{ oldText: "const a = 1;", newText: "const a = 2;" }],
      path: "src/index.ts"
    });

    const payload = {
      model: "gemma4-26ba4b-abliterated",
      messages: [
        {
          role: "assistant",
          tool_calls: [
            {
              id: "call_123",
              type: "function",
              function: {
                name: "edit",
                arguments: rawJson
              }
            }
          ]
        }
      ]
    };

    beforeReqHook({ type: "before_provider_request", payload });

    const updatedRaw = payload.messages[0].tool_calls[0].function.arguments;
    assert.equal(typeof updatedRaw, "string");
    const parsed = JSON.parse(updatedRaw);

    const keys = Object.keys(parsed);
    assert.equal(keys[0], "path", "Property 'path' must be the first key in the JSON object");
    assert.equal(keys[1], "edits", "Property 'edits' must be the second key");
    assert.equal(parsed.path, "src/index.ts");
    assert.equal(parsed.edits[0].newText, "const a = 2;");
  });

  test("Argument Ordering: raw JavaScript objects are reordered with 'path' as key #1", () => {
    const registeredEvents = new Map();
    const mockPi = {
      on(event, handler) { registeredEvents.set(event, handler); }
    };
    extensionFactory(mockPi);

    const contextHook = registeredEvents.get("context");
    assert.ok(contextHook, "context hook must be registered");

    const rawObj = {
      content: "export const foo = 123;",
      path: "src/utils.ts"
    };

    const messages = [
      {
        role: "assistant",
        toolCalls: [
          {
            id: "call_456",
            name: "write",
            arguments: rawObj
          }
        ]
      }
    ];

    contextHook({ type: "context", messages });

    const updatedObj = messages[0].toolCalls[0].arguments;
    const keys = Object.keys(updatedObj);
    assert.equal(keys[0], "path", "First key must be 'path'");
    assert.equal(keys[1], "content", "Second key must be 'content'");
    assert.equal(updatedObj.path, "src/utils.ts");
  });

  test("Argument Ordering: maps path aliases (filePath, file_path) to 'path' as key #1", () => {
    const registeredEvents = new Map();
    const mockPi = {
      on(event, handler) { registeredEvents.set(event, handler); }
    };
    extensionFactory(mockPi);

    const beforeReqHook = registeredEvents.get("before_provider_request");

    const payload = {
      messages: [
        {
          role: "assistant",
          tool_calls: [
            {
              function: {
                name: "critic_review",
                arguments: JSON.stringify({ focus: "security", filePath: "src/server.ts" })
              }
            }
          ]
        }
      ]
    };

    beforeReqHook({ type: "before_provider_request", payload });

    const parsed = JSON.parse(payload.messages[0].tool_calls[0].function.arguments);
    const keys = Object.keys(parsed);
    assert.equal(keys[0], "path", "Alias 'filePath' must be converted and positioned as key #1");
    assert.equal(parsed.path, "src/server.ts");
    assert.equal(parsed.focus, "security");
  });

  test("Argument Ordering: preserves non-path tool arguments without corruption", () => {
    const registeredEvents = new Map();
    const mockPi = {
      on(event, handler) { registeredEvents.set(event, handler); }
    };
    extensionFactory(mockPi);

    const beforeReqHook = registeredEvents.get("before_provider_request");

    const bashArgs = JSON.stringify({ command: "npm test -- --watch=false" });
    const payload = {
      messages: [
        {
          role: "assistant",
          tool_calls: [
            {
              function: {
                name: "bash",
                arguments: bashArgs
              }
            }
          ]
        }
      ]
    };

    beforeReqHook({ type: "before_provider_request", payload });

    const parsed = JSON.parse(payload.messages[0].tool_calls[0].function.arguments);
    assert.equal(parsed.command, "npm test -- --watch=false");
  });

  test("Malformed Tool Resilience: safely passes through invalid JSON, nulls, arrays, and primitives", () => {
    const registeredEvents = new Map();
    const mockPi = {
      on(event, handler) { registeredEvents.set(event, handler); }
    };
    extensionFactory(mockPi);

    const beforeReqHook = registeredEvents.get("before_provider_request");

    const payload = {
      messages: [
        {
          role: "assistant",
          tool_calls: [
            { function: { name: "broken_1", arguments: '{"invalid_json": true' } },
            { function: { name: "broken_2", arguments: null } },
            { function: { name: "broken_3", arguments: 42 } },
            { function: { name: "broken_4", arguments: ["item1", "item2"] } },
            { function: { name: "target_alias", arguments: JSON.stringify({ edits: [], target: "src/foo.ts" }) } },
            { function: { name: "file_alias", arguments: JSON.stringify({ content: "bar", file: "src/bar.ts" }) } }
          ]
        },
        null,
        {},
        { role: "assistant", tool_calls: null },
        { role: "assistant", tool_calls: [{ function: null }] }
      ]
    };

    // Must execute with zero exceptions
    assert.doesNotThrow(() => {
      beforeReqHook({ type: "before_provider_request", payload });
    });

    const calls = payload.messages[0].tool_calls;
    assert.equal(calls[0].function.arguments, '{"invalid_json": true', "Invalid JSON string must pass through unmodified");
    assert.equal(calls[1].function.arguments, null);
    assert.equal(calls[2].function.arguments, 42);

    const targetParsed = JSON.parse(calls[4].function.arguments);
    assert.deepEqual(Object.keys(targetParsed), ["path", "edits"]);
    assert.equal(targetParsed.path, "src/foo.ts");

    const fileParsed = JSON.parse(calls[5].function.arguments);
    assert.deepEqual(Object.keys(fileParsed), ["path", "content"]);
    assert.equal(fileParsed.path, "src/bar.ts");
  });

  // ----------------------------------------------------
  // Section 2: Multi-Turn Conversation History Sanitization
  // ----------------------------------------------------
  test("History Sanitization: cleans multi-turn history containing mixed tool calls and formats", () => {
    const registeredEvents = new Map();
    const mockPi = {
      on(event, handler) { registeredEvents.set(event, handler); }
    };
    extensionFactory(mockPi);

    const beforeReqHook = registeredEvents.get("before_provider_request");

    const payload = {
      messages: [
        { role: "user", content: "Please update index.ts" },
        {
          role: "assistant",
          tool_calls: [
            {
              id: "tc_1",
              type: "function",
              function: {
                name: "edit",
                arguments: JSON.stringify({ edits: [{ oldText: "A", newText: "B" }], path: "src/index.ts" })
              }
            }
          ]
        },
        { role: "tool", content: "Edit applied successfully" },
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tc_2",
              name: "write",
              input: { content: "test", path: "tests/test.ts" }
            }
          ]
        }
      ]
    };

    beforeReqHook({ type: "before_provider_request", payload });

    // Verify turn 1 edit tool call
    const editArgs = JSON.parse(payload.messages[1].tool_calls[0].function.arguments);
    assert.deepEqual(Object.keys(editArgs), ["path", "edits"]);

    // Verify turn 3 content block tool_use
    const writeInput = payload.messages[3].content[0].input;
    assert.deepEqual(Object.keys(writeInput), ["path", "content"]);
  });

  // ----------------------------------------------------
  // Section 3: System Prompt Boilerplate Stripping
  // ----------------------------------------------------
  await asyncTest("System Prompt Hygiene: strips 'Available tools:' text block", async () => {
    const registeredEvents = new Map();
    const mockPi = {
      on(event, handler) { registeredEvents.set(event, handler); }
    };
    extensionFactory(mockPi);

    const beforeAgentStartHook = registeredEvents.get("before_agent_start");
    assert.ok(beforeAgentStartHook, "before_agent_start hook must be registered");

    const dirtyPrompt = `# System Environment
You are a coding assistant.

Available tools:
- read: Read file contents
- write: Write file contents
- edit: Make targeted changes
- bash: Execute terminal commands

In addition to the tools above, you may use external utilities.

## Operational Rules
- Never run cd.
- Always emit path first.`;

    const result = await beforeAgentStartHook({ systemPrompt: dirtyPrompt });

    assert.ok(!result.systemPrompt.includes("Available tools:"), "Must strip 'Available tools:' block");
    assert.ok(!result.systemPrompt.includes("In addition to the tools above"), "Must strip 'In addition to...' line");
    assert.ok(result.systemPrompt.includes("## Operational Rules"), "Must preserve custom operational rules");
    assert.ok(result.systemPrompt.includes("Always emit path first"), "Must preserve prompt rules");

    // Also verify Pi 1.3.0 XML <tools> block format is stripped
    const pi13Prompt = `You are an expert coding assistant.

<tools>
- read: Read file
- bash: Exec bash
- edit: Edit file
- write: Write file

In addition to the tools above, you may have access to other custom tools depending on the project.
</tools>

<rules>
- Always emit path first
</rules>`;

    const result13 = await beforeAgentStartHook({ systemPrompt: pi13Prompt });
    assert.ok(!result13.systemPrompt.includes("<tools>"), "Must strip Pi 1.3.0 <tools> block");
    assert.ok(!result13.systemPrompt.includes("</tools>"), "Must strip Pi 1.3.0 </tools> block");
    assert.ok(result13.systemPrompt.includes("<rules>"), "Must preserve rules section");
  });

  await asyncTest("System Prompt Hygiene: normalizes Windows backslashes in documentation, context, and skills (Issue #8841)", async () => {
    const registeredEvents = new Map();
    const mockPi = {
      on(event, handler) { registeredEvents.set(event, handler); }
    };
    extensionFactory(mockPi);

    const beforeAgentStartHook = registeredEvents.get("before_agent_start");
    assert.ok(beforeAgentStartHook, "before_agent_start hook must be registered");

    const rawWindowsPrompt = `Pi documentation (read only when the user asks about pi itself, its SDK, extensions, themes, skills, or TUI):
- Main documentation: C:\\Users\\username\\AppData\\Roaming\\npm\\node_modules\\@earendil-works\\pi-coding-agent\\README.md
- Additional docs: C:\\Users\\username\\AppData\\Roaming\\npm\\node_modules\\@earendil-works\\pi-coding-agent\\docs
- Examples: C:\\Users\\username\\AppData\\Roaming\\npm\\node_modules\\@earendil-works\\pi-coding-agent\\examples (extensions, custom tools, SDK)

<project_instructions path="C:\\Users\\username\\.pi\\agent\\AGENTS.md">
## Quality & Safety Gates
</project_instructions>

<available_skills>
  <skill>
    <name>agent-config</name>
    <location>C:\\Users\\username\\.pi\\agent\\skills\\agent-config\\SKILL.md</location>
  </skill>
</available_skills>`;

    const result = await beforeAgentStartHook({ systemPrompt: rawWindowsPrompt });

    assert.ok(
      result.systemPrompt.includes("Main documentation: C:/Users/username/AppData/Roaming/npm/node_modules/@earendil-works/pi-coding-agent/README.md"),
      "Main documentation path must have forward slashes"
    );
    assert.ok(
      result.systemPrompt.includes("Additional docs: C:/Users/username/AppData/Roaming/npm/node_modules/@earendil-works/pi-coding-agent/docs"),
      "Docs path must have forward slashes"
    );
    assert.ok(
      result.systemPrompt.includes("Examples: C:/Users/username/AppData/Roaming/npm/node_modules/@earendil-works/pi-coding-agent/examples (extensions, custom tools, SDK)"),
      "Examples path must have forward slashes and retain trailing metadata"
    );
    assert.ok(
      result.systemPrompt.includes('<project_instructions path="C:/Users/username/.pi/agent/AGENTS.md">'),
      "Project instructions path attribute must have forward slashes"
    );
    assert.ok(
      result.systemPrompt.includes("<location>C:/Users/username/.pi/agent/skills/agent-config/SKILL.md</location>"),
      "Skill location tag must have forward slashes"
    );
    assert.ok(!result.systemPrompt.includes("C:\\"), "No unnormalized C:\\ Windows drive paths should remain");
  });

  test("Provider Request Hygiene: normalizes Windows backslashes in developer / system message payloads (Issue #8841)", () => {
    const registeredEvents = new Map();
    const mockPi = {
      on(event, handler) { registeredEvents.set(event, handler); }
    };
    extensionFactory(mockPi);

    const beforeReqHook = registeredEvents.get("before_provider_request");
    assert.ok(beforeReqHook, "before_provider_request hook must be registered");

    const payload = {
      model: "gemma4-12b",
      messages: [
        {
          role: "developer",
          content: 'Notice <location>C:\\Users\\username\\.pi\\agent\\skills\\duckdb\\SKILL.md</location> and <project_instructions path="C:\\Users\\username\\.pi\\agent\\AGENTS.md">'
        }
      ]
    };

    beforeReqHook({ type: "before_provider_request", payload });

    assert.ok(
      payload.messages[0].content.includes("<location>C:/Users/username/.pi/agent/skills/duckdb/SKILL.md</location>"),
      "Developer role message skill location must be normalized to forward slashes"
    );
    assert.ok(
      payload.messages[0].content.includes('<project_instructions path="C:/Users/username/.pi/agent/AGENTS.md">'),
      "Developer role message project_instructions path must be normalized to forward slashes"
    );
  });

  // ----------------------------------------------------
  // Section 4: In-Context Induction Head Alignment
  // ----------------------------------------------------
  test("In-Context Induction: ensures JSON string serialization guarantees 'path' immediately after opening brace", () => {
    const registeredEvents = new Map();
    const mockPi = {
      on(event, handler) { registeredEvents.set(event, handler); }
    };
    extensionFactory(mockPi);

    const beforeReqHook = registeredEvents.get("before_provider_request");

    const payload = {
      messages: [
        {
          role: "assistant",
          tool_calls: [
            {
              function: {
                name: "edit",
                arguments: JSON.stringify({
                  edits: [{ oldText: "foo()", newText: "bar()" }],
                  path: "src/core/engine.ts"
                })
              }
            }
          ]
        }
      ]
    };

    beforeReqHook({ type: "before_provider_request", payload });

    const rawString = payload.messages[0].tool_calls[0].function.arguments;
    // Regex verification: {"path":"..." must be at the very start of the JSON string
    assert.ok(/^\{"path":"src\/core\/engine\.ts"/.test(rawString), `JSON string must start with path: ${rawString}`);
  });

  return results;
}

async function main() {
  const startTime = Date.now();
  console.log(`\n${ANSI.bold}${ANSI.cyan}====================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}  Pi Coding Agent: Prompt Cleaner Test Suite       ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}====================================================${ANSI.reset}\n`);

  const results = await runPromptCleanerTests();
  const durationMs = Date.now() - startTime;

  let totalPassed = 0;
  let totalFailed = 0;
  const failures = [];

  for (const r of results) {
    if (r.pass) {
      totalPassed++;
      console.log(`  ${ANSI.green}✓${ANSI.reset} ${r.name}`);
    } else {
      totalFailed++;
      failures.push(r);
      console.log(`  ${ANSI.red}✗${ANSI.reset} ${r.name}`);
      console.log(`    ${ANSI.red}${r.error?.message || r.error}${ANSI.reset}`);
    }
  }

  console.log(`\n${ANSI.bold}${ANSI.cyan}----------------------------------------------------${ANSI.reset}`);
  console.log(`${ANSI.bold}Test Summary:${ANSI.reset}`);
  console.log(`  Passed: ${ANSI.green}${totalPassed}${ANSI.reset}`);
  console.log(`  Failed: ${totalFailed > 0 ? ANSI.red : ANSI.dim}${totalFailed}${ANSI.reset}`);
  console.log(`  Duration: ${(durationMs / 1000).toFixed(2)}s\n`);

  if (failures.length > 0) {
    process.exit(1);
  } else {
    console.log(`${ANSI.bold}${ANSI.green}✓ All prompt cleaner & history tests passed successfully!${ANSI.reset}\n`);
    process.exit(0);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isMain || process.argv[1]?.endsWith("test_prompt_cleaner.mjs")) {
  main().catch((err) => {
    console.error("Test runner crashed:", err);
    process.exit(1);
  });
}
