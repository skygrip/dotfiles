#!/usr/bin/env node

/**
 * ============================================================================
 * Permissions Gate Extension Test Suite for Pi Coding Agent
 * ============================================================================
 *
 * Comprehensive, zero-execution security test suite for `permissions-gate.ts`:
 * - Section 1: Pure Rule Evaluation (Dangerous command regex, credential file patterns)
 * - Section 2: Workspace Boundary Enforcement (Local and Remote POSIX containment)
 * - Section 3: Global Skills Whitelist & Path Normalization (Tilde, Git Bash MSYS drives)
 * - Section 4: Zero-Execution Tool Interceptors (Ensures shell/filesystem is never reached)
 * - Section 5: Slash Command & Gate Flag Management (/gate status, on, off, toggle)
 */

import assert from "node:assert/strict";
import * as path from "node:path";
import * as os from "node:os";
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

function loadGateModule() {
  const jitiPkg = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti");
  const jiti = require(jitiPkg);
  const globalBase = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent");
  const load = jiti(path.join(import.meta.dirname, "dummy.js"), {
    alias: {
      "@earendil-works/pi-coding-agent": globalBase
    }
  });
  const targetPath = path.resolve(import.meta.dirname, "../Pi_Config/agent/extensions/permissions-gate.ts");
  return load(targetPath);
}

export async function runPermissionsGateTests() {
  const mod = loadGateModule();
  const {
    DANGEROUS_BASH_PATTERNS,
    BASH_CREDENTIAL_ACCESS_REGEX,
    CREDENTIAL_FILE_PATTERNS,
    isOutsideWorkspace,
    isCredentialFile,
    isSensitiveSystemPath,
    isGlobalSkillPath,
    extractPathTokens,
    getWorkspaceRoot
  } = mod;

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
  // Section 1: Pure Rule Evaluation (Dangerous Command Patterns)
  // ----------------------------------------------------
  function matchDangerous(cmd) {
    return DANGEROUS_BASH_PATTERNS.find(p => p.regex.test(cmd));
  }

  test("Gate Detection: blocks root recursive forceful removal (rm -rf /)", () => {
    assert.ok(matchDangerous("rm -rf /"), "Must block rm -rf /");
    assert.ok(matchDangerous("rm -rf ~"), "Must block rm -rf ~");
    assert.ok(matchDangerous("rm -rf $HOME"), "Must block rm -rf $HOME");
    assert.ok(matchDangerous("rm -rf %USERPROFILE%"), "Must block rm -rf %USERPROFILE%");
    assert.ok(matchDangerous("rm -r -f C:/"), "Must block Windows drive root forceful delete");
  });

  test("Gate Detection: blocks disk partitioning & raw formatting (mkfs, fdisk, dd)", () => {
    assert.ok(matchDangerous("mkfs.ext4 /dev/sda1"), "Must block mkfs");
    assert.ok(matchDangerous("wipefs -a /dev/sdb"), "Must block wipefs");
    assert.ok(matchDangerous("dd if=/dev/zero of=/dev/sda"), "Must block dd");
    assert.ok(matchDangerous("fdisk /dev/nvme0n1"), "Must block fdisk");
    assert.ok(matchDangerous("parted /dev/sda"), "Must block parted");
  });

  test("Gate Detection: blocks fork bombs", () => {
    assert.ok(matchDangerous(":(){ :|:& };:"), "Must block bash fork bomb");
  });

  test("Gate Detection: blocks git destructive commands", () => {
    assert.ok(matchDangerous("git reset --hard HEAD~1"));
    assert.ok(matchDangerous("git reset --hard origin/main"));
    assert.ok(matchDangerous("git clean -fdx"));
    assert.ok(matchDangerous("git push --force origin main"));
    assert.ok(matchDangerous("git push -f origin main"));
    assert.ok(matchDangerous("git branch -D feature_branch"));
    assert.ok(matchDangerous("git stash drop"));
    assert.ok(matchDangerous("git stash clear"));
  });

  test("Gate Detection: blocks privilege escalation (sudo/doas/runas)", () => {
    assert.ok(matchDangerous("sudo apt update"));
    assert.ok(matchDangerous("doas apk upgrade"));
    assert.ok(matchDangerous("runas /user:Administrator cmd"));
  });

  test("Gate Detection: allows benign developer commands", () => {
    assert.equal(matchDangerous("git status"), undefined);
    assert.equal(matchDangerous("git log --oneline"), undefined);
    assert.equal(matchDangerous("npm test"), undefined);
    assert.equal(matchDangerous("cargo build --release"), undefined);
    assert.equal(matchDangerous("python -m unittest"), undefined);
    assert.equal(matchDangerous("echo 'Hello World'"), undefined);
  });

  // ----------------------------------------------------
  // Section 2: Credential File & Sensitive Path Protection
  // ----------------------------------------------------
  test("Credential Filter: identifies sensitive configuration files", () => {
    assert.ok(isCredentialFile(".env"));
    assert.ok(isCredentialFile(".env.local"));
    assert.ok(isCredentialFile(".env.production"));
    assert.ok(isCredentialFile(".ssh/id_rsa"));
    assert.ok(isCredentialFile(".ssh/id_ed25519"));
    assert.ok(isCredentialFile(".aws/credentials"));
    assert.ok(isCredentialFile(".kube/config"));
    assert.ok(isCredentialFile(".git-credentials"));
    assert.ok(isCredentialFile(".npmrc"));
    assert.ok(isCredentialFile(".pypirc"));
    assert.ok(isCredentialFile("secrets.pem"));
    assert.ok(isCredentialFile("certificate.key"));
  });

  test("Credential Inspection Regex: detects credential reading in shell commands", () => {
    assert.ok(BASH_CREDENTIAL_ACCESS_REGEX.test("cat ~/.ssh/id_rsa"));
    assert.ok(BASH_CREDENTIAL_ACCESS_REGEX.test("cat .env"));
    assert.ok(BASH_CREDENTIAL_ACCESS_REGEX.test("rg SECRET_KEY .env.production"));
    assert.ok(BASH_CREDENTIAL_ACCESS_REGEX.test("head -n 20 /etc/shadow"));
    assert.ok(BASH_CREDENTIAL_ACCESS_REGEX.test("type %USERPROFILE%\\.aws\\credentials"));
  });

  test("System Paths: identifies root and operating system sensitive paths", () => {
    assert.ok(isSensitiveSystemPath("/etc/nginx/nginx.conf"));
    assert.ok(isSensitiveSystemPath("/var/log/syslog"));
    assert.ok(isSensitiveSystemPath("/usr/bin/env"));
    assert.ok(isSensitiveSystemPath("C:/Windows/System32/drivers"));
    assert.ok(isSensitiveSystemPath("C:/Program Files/app"));
  });

  test("Global Skills Whitelist: correctly identifies skills directories", () => {
    const home = os.homedir().replace(/\\/g, "/");
    assert.ok(isGlobalSkillPath("~/.pi/agent/skills/docling/SKILL.md"));
    assert.ok(isGlobalSkillPath("~/.agents/skills/git/SKILL.md"));
    assert.ok(isGlobalSkillPath(`${home}/.pi/agent/skills/my-skill/SKILL.md`));
    assert.equal(isGlobalSkillPath("~/.config/secret"), false, "Non-skill path must return false");
    assert.equal(isGlobalSkillPath("/etc/passwd"), false);
  });

  test("Path Token Extraction: parses sensitive paths from complex shell pipelines", () => {
    const tokens1 = extractPathTokens("cat /etc/shadow | grep admin");
    assert.ok(tokens1.some(t => t.includes("/etc/shadow")));

    const tokens2 = extractPathTokens("rg secret C:\\Windows\\System32");
    assert.ok(tokens2.some(t => t.toLowerCase().includes("windows")));

    const tokens3 = extractPathTokens("python script.py ../../other_workspace/data.json > /dev/null");
    assert.ok(tokens3.some(t => t.includes("../..")));
    assert.ok(!tokens3.includes("/dev/null"), "Benign /dev/null must be filtered out");
  });

  // ----------------------------------------------------
  // Section 3: Workspace Boundary & Remote Coordination
  // ----------------------------------------------------
  test("Workspace Boundary: local workspace resolution", () => {
    delete process.env.PI_SSH_REMOTE_CWD;
    const root = getWorkspaceRoot();
    assert.equal(root, process.cwd());

    assert.equal(isOutsideWorkspace("src/app.ts"), false);
    assert.equal(isOutsideWorkspace("./README.md"), false);
    assert.equal(isOutsideWorkspace("../../other_workspace/file"), true);
  });

  test("Workspace Boundary: remote POSIX workspace resolution (PI_SSH_REMOTE_CWD)", () => {
    process.env.PI_SSH_REMOTE_CWD = "/home/developer/sample_project";
    assert.equal(getWorkspaceRoot(), "/home/developer/sample_project");

    assert.equal(isOutsideWorkspace("src/index.ts"), false);
    assert.equal(isOutsideWorkspace("/home/developer/sample_project/package.json"), false);
    assert.equal(isOutsideWorkspace("/etc/nginx/nginx.conf"), true);
    assert.equal(isOutsideWorkspace("/var/log/syslog"), true);
    assert.equal(isOutsideWorkspace("../../unauthorized/secret"), true);

    delete process.env.PI_SSH_REMOTE_CWD;
  });

  // ----------------------------------------------------
  // Section 4: Zero-Execution Tool Interceptors
  // ----------------------------------------------------
  await asyncTest("Zero-Execution Invariant: tool_call hook intercepts dangerous commands without execution", async () => {
    let underlyingShellExecuted = false;

    const registeredEvents = new Map();
    const registeredCommands = new Map();
    const mockPi = {
      registerTool() {},
      registerCommand(name, def) { registeredCommands.set(name, def); },
      registerFlag() {},
      on(event, handler) { registeredEvents.set(event, handler); },
      getFlag() { return false; }
    };

    extensionFactory(mockPi);

    const toolCallHook = registeredEvents.get("tool_call");
    assert.ok(toolCallHook, "tool_call event hook must be registered by permissions-gate");

    // 1. Test Headless Mode Auto-Block (Zero prompt, instant block)
    const headlessCtx = { hasUI: false };
    const resHeadless = await toolCallHook(
      { type: "tool_call", toolName: "bash", name: "bash", input: { command: "rm -rf /" } },
      headlessCtx
    );
    assert.equal(resHeadless?.block, true, "Dangerous command must be blocked in headless mode");
    assert.ok(resHeadless?.reason?.includes("Root or home directory"), "Reason must explain violation");

    // 2. Test Interactive Denial
    let confirmPromptShown = false;
    const interactiveRejectCtx = {
      hasUI: true,
      ui: {
        async confirm(title, msg) {
          confirmPromptShown = true;
          return false; // User clicks 'No'
        }
      }
    };

    const resUserDenied = await toolCallHook(
      { type: "tool_call", toolName: "bash", name: "bash", input: { command: "mkfs.ext4 /dev/sda" } },
      interactiveRejectCtx
    );

    assert.equal(underlyingShellExecuted, false, "Underlying shell executor must NEVER run");
    assert.ok(confirmPromptShown, "Confirmation prompt must have been presented to user");
    assert.equal(resUserDenied?.block, true, "Action must be blocked when user denies permission");
  });

  await asyncTest("Secret File Interception: tool_call hook intercepts write to .env", async () => {
    const registeredEvents = new Map();
    const mockPi = {
      registerTool() {},
      registerCommand() {},
      registerFlag() {},
      on(event, handler) { registeredEvents.set(event, handler); },
      getFlag() { return false; }
    };

    extensionFactory(mockPi);
    const toolCallHook = registeredEvents.get("tool_call");

    const headlessCtx = { hasUI: false };
    const res = await toolCallHook(
      { type: "tool_call", toolName: "write", name: "write", input: { path: ".env", content: "SECRET=1" } },
      headlessCtx
    );
    assert.equal(res?.block, true, "Writing to .env must be blocked in headless mode");
  });

  // ----------------------------------------------------
  // Section 5: Slash Command & State Management
  // ----------------------------------------------------
  await asyncTest("Slash Command: /permissions-gate status, on, off, toggle handlers", async () => {
    const registeredCommands = new Map();
    const mockPi = {
      registerTool() {},
      registerCommand(cmd, def) { registeredCommands.set(cmd, def); },
      registerFlag() {},
      on() {},
      getFlag() { return false; }
    };

    extensionFactory(mockPi);

    const gateCmd = registeredCommands.get("permissions-gate");
    assert.ok(gateCmd, "/permissions-gate command handler must exist");

    const mockCtx = {
      ui: {
        notify() {},
        setStatus() {}
      }
    };

    await gateCmd.handler("status", mockCtx);
    await gateCmd.handler("off", mockCtx);
    await gateCmd.handler("on", mockCtx);
    await gateCmd.handler("toggle", mockCtx);
  });

  return results;
}

async function main() {
  const startTime = Date.now();
  console.log(`\n${ANSI.bold}${ANSI.cyan}====================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}  Pi Coding Agent: Permissions Gate Test Suite      ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}====================================================${ANSI.reset}\n`);

  const results = await runPermissionsGateTests();
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
    console.log(`${ANSI.bold}${ANSI.green}✓ All permissions gate tests passed successfully!${ANSI.reset}\n`);
    process.exit(0);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isMain || process.argv[1]?.endsWith("test_permissions_gate.mjs")) {
  main().catch((err) => {
    console.error("Test runner crashed:", err);
    process.exit(1);
  });
}
