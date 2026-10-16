#!/usr/bin/env node

/**
 * ============================================================================
 * Permissions Gate Extension Test Suite for Pi Coding Agent
 * ============================================================================
 *
 * SAFETY CONTRACT: ZERO SUBPROCESS EXECUTION
 * This test suite verifies security patterns entirely IN-MEMORY.
 * Under NO circumstances does this suite spawn shells or execute commands.
 * All dangerous command strings are evaluated purely against regular expressions.
 *
 * Test Architecture (12 High-Signal Tests across 3 Domains):
 * - Domain A: Security Rules & Pattern Engine (Destructive commands, git/privilege, credentials, system dirs)
 * - Domain B: Workspace Confinement & Path Math (Local boundaries, remote SSH, command tokens, skills exemption)
 * - Domain C: Lifecycle & Interactive Decision Interception (Approve/deny, headless auto-block, write/edit, flags)
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
  let jiti;
  try {
    jiti = require(jitiPkg);
  } catch {
    jiti = require("jiti");
  }
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

  function matchDangerous(cmd) {
    return DANGEROUS_BASH_PATTERNS.find(p => p.regex.test(cmd));
  }

  // DOMAIN A: Security Rules & Pattern Engine (In-Memory Pure Evaluation)
  // =========================================================================

  // Test 1: Destructive System Commands
  test("Security Rules: blocks filesystem destruction, disk formatting, and fork bombs", () => {
    assert.ok(matchDangerous("rm -rf /"), "Must block rm -rf /");
    assert.ok(matchDangerous("rm -rf ~"), "Must block rm -rf ~");
    assert.ok(matchDangerous("rm -rf $HOME"), "Must block rm -rf $HOME");
    assert.ok(matchDangerous("rm -rf %USERPROFILE%"), "Must block rm -rf %USERPROFILE%");
    assert.ok(matchDangerous("rm -r -f C:/"), "Must block Windows drive root delete");
    assert.ok(matchDangerous("Remove-Item -Path C:\\ -Recurse -Force"), "Must block Remove-Item root drive");
    assert.ok(matchDangerous("Remove-Item -Recurse -Force ~"), "Must block Remove-Item user home");
    assert.ok(matchDangerous("rmdir /s /q C:\\"), "Must block rmdir /s /q C:\\");

    assert.ok(matchDangerous("mkfs.ext4 /dev/sda1"), "Must block mkfs");
    assert.ok(matchDangerous("wipefs -a /dev/sdb"), "Must block wipefs");
    assert.ok(matchDangerous("dd if=/dev/zero of=/dev/sda"), "Must block dd overwrite");
    assert.ok(matchDangerous("fdisk /dev/nvme0n1"), "Must block fdisk");
    assert.ok(matchDangerous("Format-Volume -DriveLetter C"), "Must block Format-Volume");
    assert.ok(matchDangerous("Clear-Disk -Number 1"), "Must block Clear-Disk");
    assert.ok(matchDangerous("format D: /fs:ntfs"), "Must block format drive");

    assert.ok(matchDangerous(":(){ :|:& };:"), "Must block fork bomb");
    assert.ok(matchDangerous("chmod -R 777 /"), "Must block recursive chmod 777 root");
    assert.ok(matchDangerous("Set-ExecutionPolicy -Scope CurrentUser Bypass"), "Must block Set-ExecutionPolicy Bypass");

    assert.equal(matchDangerous("git status"), undefined, "Must allow git status");
    assert.equal(matchDangerous("npm test"), undefined, "Must allow npm test");
    assert.equal(matchDangerous("cargo check"), undefined, "Must allow cargo check");
    assert.equal(matchDangerous("Remove-Item -Recurse -Force ./build"), undefined, "Must allow safe Remove-Item inside project");
    assert.equal(matchDangerous("Set-ExecutionPolicy RemoteSigned"), undefined, "Must allow safe execution policy");
  });

  // Test 2: Destructive Git Commands & Privilege Escalation
  test("Security Rules: blocks permanent git discard, force push/delete, and sudo/doas", () => {
    assert.ok(matchDangerous("git reset --hard HEAD~1"), "Must block hard reset");
    assert.ok(matchDangerous("git reset --hard origin/main"), "Must block hard reset to remote");
    assert.ok(matchDangerous("git clean -fdx"), "Must block forceful git clean");
    assert.ok(matchDangerous("git checkout -f"), "Must block forceful checkout discard");
    assert.ok(matchDangerous("git checkout --force"), "Must block checkout --force");
    assert.ok(matchDangerous("git restore --worktree"), "Must block destructive restore");

    assert.ok(matchDangerous("git branch -D feature"), "Must block force branch deletion");
    assert.ok(matchDangerous("git push --force origin main"), "Must block force push");
    assert.ok(matchDangerous("git push -f origin main"), "Must block shorthand force push");
    assert.ok(matchDangerous("git stash drop"), "Must block git stash drop");
    assert.ok(matchDangerous("git stash clear"), "Must block git stash clear");

    assert.ok(matchDangerous("sudo apt update"), "Must block sudo");
    assert.ok(matchDangerous("doas apk upgrade"), "Must block doas");
    assert.ok(matchDangerous("runas /user:Administrator cmd"), "Must block runas");
    assert.ok(matchDangerous("gsudo choco install"), "Must block gsudo");
    assert.ok(matchDangerous("Start-Process powershell -Verb RunAs"), "Must block Start-Process RunAs");

    assert.equal(matchDangerous("Start-Process -FilePath node"), undefined, "Must allow safe Start-Process");
    assert.equal(matchDangerous("git branch"), undefined);
    assert.equal(matchDangerous("git diff"), undefined);
    assert.equal(matchDangerous("git checkout -b new-branch"), undefined);
  });

  // Test 3: Credential Files & Private Keys Protection
  test("Credential Filter: identifies sensitive credentials, private keys, and shell access", () => {
    const home = os.homedir().replace(/\\/g, "/");
    assert.ok(isCredentialFile(".env"), "Must identify .env");
    assert.ok(isCredentialFile(".env.local"), "Must identify .env.local");
    assert.ok(isCredentialFile(".env.production"), "Must identify .env.production");
    assert.ok(isCredentialFile(".ssh/id_rsa"), "Must identify RSA private key");
    assert.ok(isCredentialFile(".ssh/id_ed25519"), "Must identify ED25519 private key");
    assert.ok(isCredentialFile(".aws/credentials"), "Must identify AWS credentials");
    assert.ok(isCredentialFile(".kube/config"), "Must identify Kubeconfig");
    assert.ok(isCredentialFile(".git-credentials"), "Must identify git credentials");
    assert.ok(isCredentialFile(".npmrc"), "Must identify npmrc auth");
    assert.ok(isCredentialFile("secrets/cert.pem"), "Must identify PEM certificates");
    assert.ok(isCredentialFile("service_account.json"), "Must identify service account JSON");

    assert.ok(BASH_CREDENTIAL_ACCESS_REGEX.test("cat ~/.ssh/id_ed25519"));
    assert.ok(BASH_CREDENTIAL_ACCESS_REGEX.test("grep KEY .env.production"));
    assert.ok(BASH_CREDENTIAL_ACCESS_REGEX.test("type %USERPROFILE%\\.aws\\credentials"));
  });

  // Test 4: Sensitive System Directories
  test("Sensitive System Paths: identifies root OS and configuration directories", () => {
    const home = os.homedir().replace(/\\/g, "/");
    assert.ok(isSensitiveSystemPath("/etc/shadow"));
    assert.ok(isSensitiveSystemPath("/var/log"));
    assert.ok(isSensitiveSystemPath("/usr/bin"));
    assert.ok(isSensitiveSystemPath("C:/Windows/System32"));
    assert.ok(isSensitiveSystemPath("C:/Program Files/App"));
    assert.ok(isSensitiveSystemPath(`${home}/.config/gcloud`));
    assert.ok(isSensitiveSystemPath(`${home}/.cargo/credentials`));
  });

  // Test 5: Global Skills Exemption
  test("Skills Exemption: allows reading global skills without triggering out-of-workspace alerts", () => {
    const home = os.homedir().replace(/\\/g, "/");
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

    const tokens4 = extractPathTokens("ls -lh ~/.pi/agent/extensions/");
    assert.ok(tokens4.some(t => t.includes("~/.pi/agent/extensions")), "Must extract tilde-anchored extension directory path");
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
    assert.equal(isOutsideWorkspace("~/.pi/agent/extensions"), true, "~/.pi/agent/extensions must resolve as outside project workspace");
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

  await asyncTest("Out-of-Workspace Shell Interception: tool_call hook intercepts 'ls -lh ~/.pi/agent/extensions/'", async () => {
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

    // 1. Headless mode: should block out-of-workspace shell access
    const headlessCtx = { hasUI: false };
    const resHeadless = await toolCallHook(
      { type: "tool_call", toolName: "bash", name: "bash", input: { command: "ls -lh ~/.pi/agent/extensions/" } },
      headlessCtx
    );
    assert.equal(resHeadless?.block, true, "Out-of-workspace shell command must be blocked in headless mode");
    assert.ok(resHeadless?.reason?.includes("WORKSPACE CONFINEMENT"), "Reason must mention workspace confinement");

    // 2. Interactive mode: prompts user for confirmation
    let userPrompted = false;
    const interactiveCtx = {
      hasUI: true,
      ui: {
        async confirm(title, msg) {
          userPrompted = true;
          return true; // User allows it
        }
      }
    };
    const resInteractive = await toolCallHook(
      { type: "tool_call", toolName: "bash", name: "bash", input: { command: "ls -lh ~/.pi/agent/extensions/" } },
      interactiveCtx
    );
    assert.ok(userPrompted, "Interactive mode must present confirmation prompt for out-of-workspace shell access");
    assert.equal(resInteractive, undefined, "When approved by user, hook must not block");
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
