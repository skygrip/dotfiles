#!/usr/bin/env node

/**
 * ============================================================================
 * Comprehensive SSH Extension Test Suite for Pi Coding Agent
 * ============================================================================
 *
 * Consolidated single-file test suite covering:
 * - Section 1: Unit & Path Translation Tests (Offline)
 * - Section 2: In-Memory Mock SSH2 Server Tests (Offline / Ephemeral Loopback)
 * - Section 3: Permissions Gate Safety Coordination (Offline)
 * - Section 4: Live Remote Host E2E Sandbox Tests (Opt-in via --live <user@host>)
 *
 * Usage:
 *   node test_ssh.mjs                 # Runs Sections 1-3 offline in ~2.5s
 *   node test_ssh.mjs --live <target> # Runs all sections including real remote sandbox
 */

import assert from "node:assert/strict";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
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

// ----------------------------------------------------------------------------
// Module Loaders (JITI Dynamic Imports)
// ----------------------------------------------------------------------------

function loadSshModule() {
  const jitiPkg = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti");
  const jiti = require(jitiPkg);
  const globalBase = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent");
  const piNodeModules = path.join(globalBase, "node_modules");
  const load = jiti(path.join(import.meta.dirname, "dummy.js"), {
    alias: {
      "@earendil-works/pi-coding-agent": globalBase,
      "@earendil-works/pi-tui": path.join(piNodeModules, "@earendil-works", "pi-tui", "dist", "index.js")
    }
  });
  const targetPath = path.resolve(import.meta.dirname, "../Pi_Config/agent/extensions/ssh.ts");
  return load(targetPath);
}

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

// ----------------------------------------------------------------------------
// Section 1: Unit & Path Translation Tests
// ----------------------------------------------------------------------------

export async function runUnitTests() {
  const mod = loadSshModule();
  const { parseSshTarget, createPathTranslator, KNOWN_IMAGE_EXTS } = mod;

  const results = [];
  function test(name, fn) {
    try {
      fn();
      results.push({ name, pass: true });
    } catch (err) {
      results.push({ name, pass: false, error: err });
    }
  }

  // Target Parser
  test("parseSshTarget: user@host", () => {
    const t = parseSshTarget("ubuntu@192.168.1.50");
    assert.equal(t.username, "ubuntu");
    assert.equal(t.host, "192.168.1.50");
    assert.equal(t.port, 22);
    assert.equal(t.remoteCwd, "");
  });

  test("parseSshTarget: user@host:/custom/path", () => {
    const t = parseSshTarget("deploy@myserver.com:/var/www/html");
    assert.equal(t.username, "deploy");
    assert.equal(t.host, "myserver.com");
    assert.equal(t.port, 22);
    assert.equal(t.remoteCwd, "/var/www/html");
  });

  test("parseSshTarget: user@host:port:/path", () => {
    const t = parseSshTarget("admin@10.0.0.1:2222:/opt/app");
    assert.equal(t.username, "admin");
    assert.equal(t.host, "10.0.0.1");
    assert.equal(t.port, 2222);
    assert.equal(t.remoteCwd, "/opt/app");
  });

  test("parseSshTarget: bare hostname with default lowercased user", () => {
    const t = parseSshTarget("my-linux-host");
    assert.equal(t.host, "my-linux-host");
    assert.equal(t.port, 22);
    assert.ok(t.username.length > 0);
  });

  test("parseSshTarget: tilde path user@host:~", () => {
    const t = parseSshTarget("developer@remote-box:~");
    assert.equal(t.username, "developer");
    assert.equal(t.host, "remote-box");
    assert.equal(t.remoteCwd, "~");
  });

  // POSIX Path Translator
  test("createPathTranslator: relative path resolution", () => {
    const toRemote = createPathTranslator("/home/ubuntu/app", "C:/workspace/myproject");
    assert.equal(toRemote("src/index.ts"), "/home/ubuntu/app/src/index.ts");
    assert.equal(toRemote("./README.md"), "/home/ubuntu/app/README.md");
  });

  test("createPathTranslator: tilde preservation", () => {
    const toRemote = createPathTranslator("/var/www", "C:/local");
    assert.equal(toRemote("~/secret.txt"), "~/secret.txt");
    assert.equal(toRemote("~"), "~");
  });

  test("createPathTranslator: absolute POSIX path preservation", () => {
    const toRemote = createPathTranslator("/var/www", "C:/local");
    assert.equal(toRemote("/etc/nginx/nginx.conf"), "/etc/nginx/nginx.conf");
    assert.equal(toRemote("/tmp/log.txt"), "/tmp/log.txt");
  });

  test("createPathTranslator: leading @ symbol normalization", () => {
    const toRemote = createPathTranslator("/var/www", "C:/local");
    assert.equal(toRemote("@src/main.ts"), "/var/www/src/main.ts");
  });

  test("createPathTranslator: local workspace path projection", () => {
    const localCwd = "C:/workspace/myproject";
    const toRemote = createPathTranslator("/home/remote/myproject", localCwd);
    assert.equal(toRemote("C:/workspace/myproject/src/app.ts"), "/home/remote/myproject/src/app.ts");
    assert.equal(toRemote("C:\\workspace\\myproject\\package.json"), "/home/remote/myproject/package.json");
  });

  // MIME Map
  test("KNOWN_IMAGE_EXTS: common image extensions", () => {
    assert.equal(KNOWN_IMAGE_EXTS[".png"], "image/png");
    assert.equal(KNOWN_IMAGE_EXTS[".jpg"], "image/jpeg");
    assert.equal(KNOWN_IMAGE_EXTS[".jpeg"], "image/jpeg");
    assert.equal(KNOWN_IMAGE_EXTS[".webp"], "image/webp");
    assert.equal(KNOWN_IMAGE_EXTS[".gif"], "image/gif");
    assert.equal(KNOWN_IMAGE_EXTS[".svg"], "image/svg+xml");
  });

  return results;
}

// ----------------------------------------------------------------------------
// Section 2: In-Memory Mock SSH2 Server Tests
// ----------------------------------------------------------------------------

function startMockSSHServer() {
  const ssh2Mod = require(path.join(os.homedir(), ".pi/agent/npm/node_modules/ssh2"));
  const Server = ssh2Mod.Server;
  const { generateKeyPairSync } = crypto;

  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" }
  });

  const vfs = new Map();
  vfs.set("/home/testuser/hello.txt", Buffer.from("Hello from Mock SFTP!"));

  const server = new Server({ hostKeys: [privateKey] }, (client) => {
    client.on("authentication", (ctx) => ctx.accept());

    client.on("ready", () => {
      client.on("session", (accept) => {
        const session = accept();

        session.on("sftp", (acceptSftp) => {
          const sftp = acceptSftp();
          const openHandles = new Map();
          let handleCounter = 1;

          sftp.on("OPEN", (reqid, filename, _flags) => {
            const h = Buffer.from(String(handleCounter++));
            openHandles.set(h.toString(), { path: filename, offset: 0 });
            sftp.handle(reqid, h);
          });

          sftp.on("STAT", (reqid, filename) => {
            if (vfs.has(filename)) {
              const data = vfs.get(filename);
              sftp.attrs(reqid, { size: data.length, mode: 0o644, mtime: Date.now() / 1000, atime: Date.now() / 1000 });
            } else {
              sftp.status(reqid, 2); // NO_SUCH_FILE
            }
          });

          sftp.on("READ", (reqid, handle, offset, length) => {
            const hStr = handle.toString();
            const h = openHandles.get(hStr);
            if (!h || !vfs.has(h.path)) return sftp.status(reqid, 2);
            const buf = vfs.get(h.path);
            if (offset >= buf.length) return sftp.status(reqid, 1); // EOF
            const slice = buf.subarray(offset, offset + length);
            sftp.data(reqid, slice);
          });

          sftp.on("WRITE", (reqid, handle, offset, data) => {
            const hStr = handle.toString();
            const h = openHandles.get(hStr);
            if (!h) return sftp.status(reqid, 4);
            let buf = vfs.get(h.path) || Buffer.alloc(0);
            if (offset + data.length > buf.length) {
              const newBuf = Buffer.alloc(offset + data.length);
              buf.copy(newBuf, 0);
              buf = newBuf;
            }
            data.copy(buf, offset);
            vfs.set(h.path, buf);
            sftp.status(reqid, 0); // OK
          });

          sftp.on("CLOSE", (reqid, handle) => {
            openHandles.delete(handle.toString());
            sftp.status(reqid, 0);
          });
        });

        session.on("exec", (acceptExec, _reject, info) => {
          const stream = acceptExec();
          const cmd = info.command || "";

          if (cmd.includes("pwd")) {
            stream.write("/home/testuser\n");
            stream.exit(0);
            stream.end();
            return;
          }

          if (cmd.includes("sleep 10")) {
            const t = setTimeout(() => {
              stream.write("finished sleep\n");
              stream.exit(0);
              stream.end();
            }, 10000);
            stream.on("close", () => clearTimeout(t));
            return;
          }

          if (cmd.includes("fail_command")) {
            stream.stderr.write("Command intentionally failed\n");
            stream.exit(1);
            stream.end();
            stream.close();
            return;
          }

          if (cmd.includes("echo_stream")) {
            stream.write("chunk 1\n");
            setTimeout(() => {
              stream.write("chunk 2\n");
              stream.exit(0);
              stream.end();
              stream.close();
            }, 50);
            return;
          }

          stream.write("OK\n");
          stream.exit(0);
          stream.end();
          stream.close();
        });
      });
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({
        port,
        vfs,
        close: () => new Promise((r) => server.close(r))
      });
    });
  });
}

export async function runMockServerTests() {
  const mod = loadSshModule();
  const {
    SshSessionManager,
    createRemoteReadOps,
    createRemoteWriteOps,
    createRemoteEditOps,
    createRemoteBashOps
  } = mod;

  const mock = await startMockSSHServer();
  const session = new SshSessionManager();

  const results = [];
  async function test(name, fn) {
    try {
      await fn();
      results.push({ name, pass: true });
    } catch (err) {
      results.push({ name, pass: false, error: err });
    }
  }

  const remoteCwd = "/home/testuser";
  const localCwd = process.cwd();

  try {
    await test("Connection: successfully connects to mock server on loopback", async () => {
      await session.connect({
        raw: `testuser@127.0.0.1:${mock.port}`,
        host: "127.0.0.1",
        port: mock.port,
        username: "testuser",
        remoteCwd
      });
      assert.ok(session.isConnected(), "Should be connected");
    });

    const readOps = createRemoteReadOps(session, remoteCwd, localCwd);
    const writeOps = createRemoteWriteOps(session, remoteCwd, localCwd);
    const editOps = createRemoteEditOps(session, remoteCwd, localCwd);
    const bashOps = createRemoteBashOps(session, remoteCwd, localCwd);

    await test("ReadOperations.readFile: reads existing virtual file over SFTP", async () => {
      const buf = await readOps.readFile("hello.txt");
      assert.equal(buf.toString(), "Hello from Mock SFTP!");
    });

    await test("ReadOperations.access: verifies file existence without throwing", async () => {
      await readOps.access("hello.txt");
    });

    await test("ReadOperations.readFile: throws on non-existent file", async () => {
      await assert.rejects(async () => {
        await readOps.readFile("does_not_exist.txt");
      });
    });

    await test("WriteOperations.writeFile: writes text content via SFTP", async () => {
      await writeOps.writeFile("output.txt", "New written content");
      assert.equal(mock.vfs.get("/home/testuser/output.txt")?.toString(), "New written content");
    });

    await test("WriteOperations.writeFile: handles large 100KB buffer without truncation", async () => {
      const largeData = "X".repeat(100 * 1024);
      await writeOps.writeFile("large.bin", Buffer.from(largeData));
      const readBack = await readOps.readFile("large.bin");
      assert.equal(readBack.length, 100 * 1024);
    });

    await test("EditOperations: performs read-modify-write cycle", async () => {
      const original = (await editOps.readFile("hello.txt")).toString();
      const updated = original.replace("Mock", "Updated Mock");
      await editOps.writeFile("hello.txt", updated);
      assert.equal(mock.vfs.get("/home/testuser/hello.txt")?.toString(), "Hello from Updated Mock SFTP!");
    });

    await test("BashOperations.exec: streams stdout in real time to onData", async () => {
      const chunks = [];
      const res = await bashOps.exec("echo_stream", remoteCwd, {
        onData: (d) => chunks.push(d.toString())
      });
      assert.equal(res.exitCode, 0);
      assert.equal(chunks.join(""), "chunk 1\nchunk 2\n");
    });

    await test("BashOperations.exec: propagates non-zero exit codes", async () => {
      const res = await bashOps.exec("fail_command", remoteCwd, {});
      assert.equal(res.exitCode, 1);
    });

    await test("BashOperations.exec: terminates on AbortSignal", async () => {
      const controller = new AbortController();
      const execPromise = bashOps.exec("sleep 10", remoteCwd, { signal: controller.signal });
      setTimeout(() => controller.abort(), 100);
      await assert.rejects(execPromise, /aborted/);
    });

    await test("BashOperations.exec: enforces timeout", async () => {
      await assert.rejects(
        bashOps.exec("sleep 10", remoteCwd, { timeout: 1 }),
        /timeout:1/
      );
    });

    await test("Pi Tool [read]: createReadTool execute returns formatted tool result", async () => {
      const globalBase = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent");
      const { createReadTool } = require(globalBase);
      const readTool = createReadTool(localCwd, { operations: readOps });
      const res = await readTool.execute("call_read_1", { path: "hello.txt" });
      assert.ok(res.content?.[0]?.text?.includes("Updated Mock SFTP"), "Read tool output must contain file text");
    });

    await test("Pi Tool [write]: createWriteTool execute creates remote file via SFTP", async () => {
      const globalBase = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent");
      const { createWriteTool } = require(globalBase);
      const writeTool = createWriteTool(localCwd, { operations: writeOps });
      const res = await writeTool.execute("call_write_1", { path: "tool_output.txt", content: "Content created via Pi write tool" });
      assert.equal(mock.vfs.get("/home/testuser/tool_output.txt")?.toString(), "Content created via Pi write tool");
    });

    await test("Pi Tool [edit]: createEditTool execute applies replacement on remote file", async () => {
      const globalBase = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent");
      const { createEditTool } = require(globalBase);
      const editTool = createEditTool(localCwd, { operations: editOps });
      const res = await editTool.execute("call_edit_1", {
        path: "tool_output.txt",
        edits: [{ oldText: "created via", newText: "modified via" }]
      });
      assert.equal(mock.vfs.get("/home/testuser/tool_output.txt")?.toString(), "Content modified via Pi write tool");
    });

    await test("Pi Tool [bash]: createBashTool execute streams and returns command output", async () => {
      const globalBase = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent");
      const { createBashTool } = require(globalBase);
      const bashTool = createBashTool(localCwd, { operations: bashOps });
      const res = await bashTool.execute("call_bash_1", { command: "echo_stream" });
      assert.ok(res.content?.[0]?.text?.includes("chunk 1") || res.details?.exitCode === 0);
    });

    await test("Extension Registration: overrides read, write, edit, bash tools on Pi harness", async () => {
      const extensionFactory = mod.default || mod;
      const registeredTools = new Map();
      const registeredCommands = new Map();
      const registeredEvents = new Map();
      const mockPi = {
        registerTool(tool) { registeredTools.set(tool.name, tool); },
        registerCommand(cmd, def) { registeredCommands.set(cmd, def); },
        registerFlag() {},
        on(ev, fn) { registeredEvents.set(ev, fn); },
        getFlag(flag) { if (flag === "ssh") return `testuser@127.0.0.1:${mock.port}`; return undefined; }
      };
      extensionFactory(mockPi);
      assert.ok(registeredTools.has("read"), "read tool must be registered");
      assert.ok(registeredTools.has("write"), "write tool must be registered");
      assert.ok(registeredTools.has("edit"), "edit tool must be registered");
      assert.ok(registeredTools.has("bash"), "bash tool must be registered");

      // Test /ssh command handler
      const sshCmd = registeredCommands.get("ssh");
      assert.ok(sshCmd, "/ssh command handler must be registered");

      // Test write tool diff & render functionality
      const writeTool = registeredTools.get("write");
      assert.ok(writeTool, "write tool must be registered");

      const mockTheme = {
        fg(role, text) {
          return `<fg:${role}>${text}</fg>`;
        },
        bold(text) {
          return `<b>${text}</b>`;
        }
      };

      // 1. renderCall format on existing file
      const callRenderExisting = writeTool.renderCall({ path: "src/app.ts" }, mockTheme);
      assert.ok(callRenderExisting.text.includes("write"), "renderCall must include tool name 'write'");

      // 2. New file creation
      const tempTestDir = await fs.mkdtemp(path.join(os.tmpdir(), "ssh-write-test-"));
      const newFilePath = path.join(tempTestDir, "new_file.txt");
      try {
        const multiContent = Array.from({ length: 15 }, (_, i) => `line ${i + 1}`).join("\n");
        const createRes = await writeTool.execute("call_w_1", { path: newFilePath, content: multiContent }, undefined, undefined, {});
        assert.equal(createRes.details?.isOverwrite, false, "Must detect new file creation");
        assert.equal(createRes.details?.lineCount, 15, "Must report 15 lines");

        const collapsedRender = writeTool.renderResult(createRes, { expanded: false }, mockTheme);
        assert.ok(collapsedRender.text.includes("ctrl+o"), "Collapsed new file render must include ctrl+o hint");

        const expandedRender = writeTool.renderResult(createRes, { expanded: true }, mockTheme);
        assert.ok(expandedRender.text.includes("line 15"), "Expanded new file render must show all lines");

        // 3. File overwrite with Myers diff (contextLines = 1)
        const overwriteRes = await writeTool.execute("call_w_2", { path: newFilePath, content: multiContent + "\nline 16" }, undefined, undefined, {});
        assert.equal(overwriteRes.details?.isOverwrite, true, "Must detect overwrite");
        assert.ok(overwriteRes.details?.diff, "Must compute diff");
        assert.equal(overwriteRes.details?.diff?.addedCount, 1, "Must detect 1 added line ('line 16')");

        // 4. renderResult formatted with diff and ctrl+o support
        const diffRender = writeTool.renderResult(overwriteRes, { expanded: false }, mockTheme);
        assert.ok(diffRender.text.includes("Overwrite Diff"), "renderResult must include 'Overwrite Diff' header");
        assert.ok(diffRender.text.includes("+1"), "renderResult must include +1 added");
        assert.ok(diffRender.text.includes("line 16"), "renderResult must include added content");

        const expandedDiffRender = writeTool.renderResult(overwriteRes, { expanded: true }, mockTheme);
        assert.ok(expandedDiffRender.text.includes("line 16"), "Expanded render must include full diff");

        // 5. No-change overwrite (exact duplicate write)
        const noChangeRes = await writeTool.execute("call_w_3", { path: newFilePath, content: multiContent + "\nline 16" }, undefined, undefined, {});
        assert.equal(noChangeRes.details?.noChanges, true, "Must detect no-change overwrite");
        const noChangeRender = writeTool.renderResult(noChangeRes, {}, mockTheme);
        assert.ok(noChangeRender.text.includes("no changes"), "Must render 'no changes'");

        // 6. Alternate parameter name: file_path
        const altParamPath = path.join(tempTestDir, "alt_param.txt");
        const altParamRes = await writeTool.execute("call_w_4", { file_path: altParamPath, content: "hello world" }, undefined, undefined, {});
        assert.equal(altParamRes.details?.isOverwrite, false, "Must handle file_path parameter");

        // 7. CRLF line endings normalization
        const crlfPath = path.join(tempTestDir, "crlf.txt");
        await writeTool.execute("call_w_5", { path: crlfPath, content: "line A\r\nline B" }, undefined, undefined, {});
        const crlfModRes = await writeTool.execute("call_w_6", { path: crlfPath, content: "line A\r\nline C" }, undefined, undefined, {});
        assert.equal(crlfModRes.details?.diff?.modifiedCount, 1, "Must detect modified count with CRLF endings");
      } finally {
        await fs.rm(tempTestDir, { recursive: true, force: true });
      }

      let notifiedMsg = "";
      let setStatusVal = "initial";
      const mockCtx = {
        ui: {
          notify(msg) { notifiedMsg = msg; },
          setStatus(key, val) { if (key === "ssh") setStatusVal = val; },
          theme: { fg: (_c, t) => t }
        }
      };

      // 1. Status when disconnected
      await sshCmd.handler("status", mockCtx);
      assert.ok(notifiedMsg.includes("No active SSH session"));

      // 2. Connect session via session_start hook
      const onStart = registeredEvents.get("session_start");
      if (onStart) {
        await onStart({}, mockCtx);
        assert.ok(setStatusVal !== "initial" && setStatusVal !== undefined, "Status must be set on connect");

        // 3. Status when connected
        await sshCmd.handler("status", mockCtx);
        assert.ok(notifiedMsg.includes("SSH Active"));

        // 4. Disconnect via slash command
        await sshCmd.handler("disconnect", mockCtx);
        assert.equal(setStatusVal, undefined, "Status must be cleared on disconnect");
      }
    });

    await test("Lifecycle: disconnect cleanly closes client connection", async () => {
      session.disconnect();
      assert.equal(session.isConnected(), false);
    });

  } finally {
    session.disconnect();
    await mock.close();
  }

  return results;
}

// ----------------------------------------------------------------------------
// Section 3: Permissions Gate Safety Coordination
// ----------------------------------------------------------------------------

export async function runPermissionsGateTests() {
  const mod = loadGateModule();
  const {
    DANGEROUS_BASH_PATTERNS,
    BASH_CREDENTIAL_ACCESS_REGEX,
    isOutsideWorkspace,
    getWorkspaceRoot
  } = mod;

  const results = [];
  function test(name, fn) {
    try {
      fn();
      results.push({ name, pass: true });
    } catch (err) {
      results.push({ name, pass: false, error: err });
    }
  }

  // Workspace Root & Boundary
  test("Remote Workspace Root: getWorkspaceRoot respects PI_SSH_REMOTE_CWD", () => {
    process.env.PI_SSH_REMOTE_CWD = "/home/developer/sample_remote_project";
    assert.equal(getWorkspaceRoot(), "/home/developer/sample_remote_project");

    delete process.env.PI_SSH_REMOTE_CWD;
    assert.equal(getWorkspaceRoot(), process.cwd());
  });

  test("Remote Workspace Boundary: isOutsideWorkspace enforces remote POSIX boundaries", () => {
    process.env.PI_SSH_REMOTE_CWD = "/home/developer/sample_remote_project";

    assert.equal(isOutsideWorkspace("src/index.ts"), false, "Relative path inside workspace should be allowed");
    assert.equal(isOutsideWorkspace("/home/developer/sample_remote_project/package.json"), false, "Absolute path in workspace should be allowed");
    assert.equal(isOutsideWorkspace("/etc/nginx/nginx.conf"), true, "Path outside remote workspace must be flagged");
    assert.equal(isOutsideWorkspace("/var/log/syslog"), true, "Remote system directory must be flagged");
    assert.equal(isOutsideWorkspace("../../other_user/secret"), true, "Directory traversal must be flagged");

    delete process.env.PI_SSH_REMOTE_CWD;
  });

  // Dangerous Command Filters
  function matchDangerous(cmd) {
    return DANGEROUS_BASH_PATTERNS.find(p => p.regex.test(cmd));
  }

  test("Gate Detection: blocks root recursive rm -rf /", () => {
    assert.ok(matchDangerous("rm -rf /"), "Must block rm -rf /");
    assert.ok(matchDangerous("rm -rf ~"), "Must block rm -rf ~");
    assert.ok(matchDangerous("rm -rf $HOME"), "Must block rm -rf $HOME");
  });

  test("Gate Detection: blocks remote filesystem formatting (mkfs, fdisk, dd)", () => {
    assert.ok(matchDangerous("mkfs.ext4 /dev/sda1"), "Must block mkfs");
    assert.ok(matchDangerous("dd if=/dev/zero of=/dev/sda"), "Must block dd");
    assert.ok(matchDangerous("fdisk /dev/nvme0n1"), "Must block fdisk");
  });

  test("Gate Detection: blocks fork bombs", () => {
    assert.ok(matchDangerous(":(){ :|:& };:"), "Must block fork bomb");
  });

  test("Gate Detection: blocks git destructive commands", () => {
    assert.ok(matchDangerous("git reset --hard HEAD~1"));
    assert.ok(matchDangerous("git clean -fdx"));
    assert.ok(matchDangerous("git push --force origin main"));
    assert.ok(matchDangerous("git branch -D feature"));
  });

  test("Gate Detection: blocks sudo/doas elevation", () => {
    assert.ok(matchDangerous("sudo systemctl restart nginx"));
    assert.ok(matchDangerous("doas pacman -Syu"));
  });

  test("Gate Detection: allows safe developer commands", () => {
    assert.equal(matchDangerous("git status"), undefined);
    assert.equal(matchDangerous("npm run build"), undefined);
    assert.equal(matchDangerous("cargo test"), undefined);
    assert.equal(matchDangerous("python main.py"), undefined);
  });

  test("Credential Gate: intercepts reading SSH keys and .env files", () => {
    assert.ok(BASH_CREDENTIAL_ACCESS_REGEX.test("cat ~/.ssh/id_rsa"));
    assert.ok(BASH_CREDENTIAL_ACCESS_REGEX.test("cat .env"));
    assert.ok(BASH_CREDENTIAL_ACCESS_REGEX.test("rg SECRET_KEY .env.production"));
    assert.ok(BASH_CREDENTIAL_ACCESS_REGEX.test("cat /etc/shadow"));
  });

  return results;
}

// ----------------------------------------------------------------------------
// Section 4: Live Remote Host E2E Sandbox Tests
// ----------------------------------------------------------------------------

export async function runLiveE2ETests(targetStr) {
  if (!targetStr) {
    throw new Error("Target server specification is required (e.g. user@hostname or hostname).");
  }

  const mod = loadSshModule();
  const {
    parseSshTarget,
    SshSessionManager,
    createRemoteReadOps,
    createRemoteWriteOps,
    createRemoteEditOps,
    createRemoteBashOps
  } = mod;

  const results = [];
  async function test(name, fn) {
    try {
      await fn();
      results.push({ name, pass: true });
    } catch (err) {
      results.push({ name, pass: false, error: err });
    }
  }

  const session = new SshSessionManager();
  const target = parseSshTarget(targetStr);
  const sandboxDir = `/tmp/pi_test_${crypto.randomBytes(4).toString("hex")}`;
  const localCwd = process.cwd();

  try {
    await test(`Live Connect: connect to real SSH host '${target.host}'`, async () => {
      await session.connect(target);
      assert.ok(session.isConnected(), "Should be connected to live SSH server");
    });

    const readOps = createRemoteReadOps(session, sandboxDir, localCwd);
    const writeOps = createRemoteWriteOps(session, sandboxDir, localCwd);
    const editOps = createRemoteEditOps(session, sandboxDir, localCwd);
    const bashOps = createRemoteBashOps(session, sandboxDir, localCwd);

    await test("Live Sandbox: create isolated temporary directory in /tmp", async () => {
      await writeOps.mkdir(sandboxDir);
      const res = await bashOps.exec(`ls -d ${sandboxDir}`, sandboxDir, {});
      assert.equal(res.exitCode, 0);
    });

    await test("Live SFTP Write & Read: roundtrip UTF-8 file in sandbox", async () => {
      const payload = `Live test generated at ${new Date().toISOString()}\nKey: ${crypto.randomBytes(8).toString("hex")}`;
      await writeOps.writeFile("test.txt", payload);
      const readBack = await readOps.readFile("test.txt");
      assert.equal(readBack.toString(), payload);
    });

    await test("Live SFTP Edit: exact string replacement in sandbox", async () => {
      const original = (await editOps.readFile("test.txt")).toString();
      const updated = original + "\nAppended via Pi EditOps";
      await editOps.writeFile("test.txt", updated);
      const finalContent = (await editOps.readFile("test.txt")).toString();
      assert.ok(finalContent.includes("Appended via Pi EditOps"));
    });

    await test("Live Pi Tool Stack: read, write, edit, and bash tools on live remote host", async () => {
      const globalBase = path.join(process.env.APPDATA || "", "npm/node_modules/@earendil-works/pi-coding-agent");
      const { createReadTool, createWriteTool, createEditTool, createBashTool } = require(globalBase);

      const rTool = createReadTool(localCwd, { operations: readOps });
      const wTool = createWriteTool(localCwd, { operations: writeOps });
      const eTool = createEditTool(localCwd, { operations: editOps });
      const bTool = createBashTool(localCwd, { operations: bashOps });

      // 1. Write tool
      await wTool.execute("live_w", { path: "pi_live.txt", content: "Initial live text" });

      // 2. Read tool
      const rRes = await rTool.execute("live_r", { path: "pi_live.txt" });
      assert.ok(rRes.content?.[0]?.text?.includes("Initial live text"));

      // 3. Edit tool
      await eTool.execute("live_e", {
        path: "pi_live.txt",
        edits: [{ oldText: "Initial", newText: "Updated" }]
      });
      const rRes2 = await rTool.execute("live_r2", { path: "pi_live.txt" });
      assert.ok(rRes2.content?.[0]?.text?.includes("Updated live text"));

      // 4. Bash tool
      const bRes = await bTool.execute("live_b", { command: "cat pi_live.txt" });
      assert.ok(bRes.content?.[0]?.text?.includes("Updated live text"));
    });

    await test("Live Sandbox Cleanup: verify temporary sandbox deletion", async () => {
      const res = await bashOps.exec(`rm -rf ${sandboxDir}`, "/tmp", {});
      assert.equal(res.exitCode, 0);
    });

  } finally {
    if (session.isConnected()) {
      try {
        await session.execCommand(`rm -rf ${sandboxDir}`);
      } catch {}
      session.disconnect();
    }
  }

  return results;
}

// ----------------------------------------------------------------------------
// Master CLI Test Orchestrator
// ----------------------------------------------------------------------------

async function main() {
  const startTime = Date.now();
  console.log(`\n${ANSI.bold}${ANSI.cyan}====================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}  Pi Coding Agent: SSH Remote Extension Test Suite  ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.cyan}====================================================${ANSI.reset}\n`);

  const suites = [
    { name: "Section 1: Unit & Path Translation Tests", runner: runUnitTests },
    { name: "Section 2: In-Memory Mock SSH2 Server Tests", runner: runMockServerTests },
    { name: "Section 3: Permissions Gate Safety Coordination", runner: runPermissionsGateTests }
  ];

  // Parse live target from CLI arguments or environment variable
  let liveTarget = process.env.PI_SSH_TEST_TARGET || null;

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith("--live=")) {
      liveTarget = arg.slice(7);
    } else if (arg.startsWith("--target=")) {
      liveTarget = arg.slice(9);
    } else if ((arg === "--live" || arg === "--target") && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
      liveTarget = process.argv[++i];
    } else if (arg === "--live" && (!process.argv[i + 1] || process.argv[i + 1].startsWith("--"))) {
      liveTarget = process.env.PI_SSH || null;
      if (!liveTarget) {
        console.log(`${ANSI.yellow}Notice: --live specified without a target host. Provide a host (e.g. --live <user@host>) to run live E2E tests.${ANSI.reset}\n`);
      }
    }
  }

  if (liveTarget) {
    suites.push({
      name: `Section 4: Live Host E2E Sandbox Tests (${liveTarget})`,
      runner: () => runLiveE2ETests(liveTarget)
    });
  }

  let totalPassed = 0;
  let totalFailed = 0;
  const allFailures = [];

  for (const suite of suites) {
    console.log(`${ANSI.bold}${ANSI.yellow}▶ ${suite.name}${ANSI.reset}`);
    const suiteStart = Date.now();

    try {
      const results = await suite.runner();
      const durationMs = Date.now() - suiteStart;

      for (const r of results) {
        if (r.pass) {
          totalPassed++;
          console.log(`  ${ANSI.green}✓${ANSI.reset} ${r.name}`);
        } else {
          totalFailed++;
          allFailures.push({ suite: suite.name, ...r });
          console.log(`  ${ANSI.red}✗${ANSI.reset} ${r.name}`);
          console.log(`    ${ANSI.red}${r.error?.message || r.error}${ANSI.reset}`);
        }
      }
      console.log(`  ${ANSI.dim}Completed in ${durationMs}ms${ANSI.reset}\n`);
    } catch (suiteErr) {
      totalFailed++;
      allFailures.push({ suite: suite.name, name: "Suite Execution", error: suiteErr });
      console.log(`  ${ANSI.red}✗ Suite execution failed: ${suiteErr.message}${ANSI.reset}\n`);
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`${ANSI.bold}${ANSI.cyan}----------------------------------------------------${ANSI.reset}`);
  console.log(`${ANSI.bold}Test Summary:${ANSI.reset}`);
  console.log(`  Passed: ${ANSI.green}${totalPassed}${ANSI.reset}`);
  console.log(`  Failed: ${totalFailed > 0 ? ANSI.red : ANSI.dim}${totalFailed}${ANSI.reset}`);
  console.log(`  Duration: ${totalDuration}s`);

  if (!liveTarget) {
    console.log(`  ${ANSI.dim}(Tip: Pass --live <user@host> to include real-world remote server tests)${ANSI.reset}`);
  }

  if (allFailures.length > 0) {
    console.log(`\n${ANSI.bold}${ANSI.red}Failures:${ANSI.reset}`);
    for (const f of allFailures) {
      console.log(`  - [${f.suite}] ${f.name}: ${f.error?.message || f.error}`);
    }
    process.exit(1);
  } else {
    console.log(`\n${ANSI.bold}${ANSI.green}✓ All test layers passed successfully!${ANSI.reset}\n`);
    process.exit(0);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isMain || process.argv[1]?.endsWith("test_ssh.mjs")) {
  main().catch((err) => {
    console.error("Test runner crashed:", err);
    process.exit(1);
  });
}
