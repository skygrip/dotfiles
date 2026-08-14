import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  type BashOperations,
  createBashTool,
  createEditTool,
  createReadTool,
  createWriteTool,
  type EditOperations,
  type ReadOperations,
  type WriteOperations,
} from "@earendil-works/pi-coding-agent";
import * as path from "node:path";

/**
 * Default OpenSSH arguments configuring connection timeout and native ControlMaster multiplexing.
 * ControlPath uses ~/.ssh/pi-mux-%C which is safe, short (<45 chars), and cross-platform on Windows/Linux.
 */
const DEFAULT_SSH_OPTS = [
  "-o", "BatchMode=yes",
  "-o", "ConnectTimeout=10",
  "-o", "ControlMaster=auto",
  "-o", "ControlPersist=10m",
  "-o", "ControlPath=~/.ssh/pi-mux-%C"
];

/**
 * Spawns an SSH command with ControlMaster connection multiplexing.
 */
function sshExec(remote: string, command: string, signal?: AbortSignal): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error("aborted"));
    }

    const args = [...DEFAULT_SSH_OPTS, remote, command];
    const child = spawn("ssh", args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    child.stdout.on("data", (data) => chunks.push(data));
    child.stderr.on("data", (data) => errChunks.push(data));

    const onAbort = () => child.kill();
    signal?.addEventListener("abort", onAbort, { once: true });

    child.on("error", (err) => {
      signal?.removeEventListener("abort", onAbort);
      reject(err);
    });

    child.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);
      if (signal?.aborted) {
        reject(new Error("aborted"));
      } else if (code !== 0) {
        const stderrMsg = Buffer.concat(errChunks).toString().trim();
        reject(new Error(`SSH command failed (${code}): ${stderrMsg || `exit code ${code}`}`));
      } else {
        resolve(Buffer.concat(chunks));
      }
    });
  });
}

/**
 * Creates a POSIX path translator between local and remote environments.
 */
function createPathTranslator(remoteCwd: string, localCwd: string) {
  const normLocal = path.resolve(localCwd).replace(/\\/g, "/");

  return (inputPath: string): string => {
    let clean = inputPath.trim().replace(/^@/, "");
    if (!clean) return remoteCwd;

    // Expand ~
    if (clean === "~" || clean.startsWith("~/")) {
      return clean;
    }

    // Convert MSYS /c/Users/... -> C:/Users/... on Windows
    if (process.platform === "win32" && /^\/([a-zA-Z])\//.test(clean)) {
      clean = clean.replace(/^\/([a-zA-Z])\//, (_, drive) => `${drive.toUpperCase()}:/`);
    }

    // Check if path is within local working directory and project it onto remoteCwd
    try {
      const resolvedLocal = path.resolve(normLocal, clean).replace(/\\/g, "/");
      if (resolvedLocal.toLowerCase() === normLocal.toLowerCase()) {
        return remoteCwd;
      }

      if (resolvedLocal.toLowerCase().startsWith((normLocal + "/").toLowerCase())) {
        const rel = resolvedLocal.slice(normLocal.length + 1);
        return path.posix.join(remoteCwd, rel);
      }
    } catch {
      // Fall through
    }

    // Absolute POSIX path (already formatted for remote host)
    if (clean.startsWith("/")) {
      return path.posix.normalize(clean);
    }

    // Otherwise resolve relative to remoteCwd
    return path.posix.resolve(remoteCwd, clean.replace(/\\/g, "/"));
  };
}

function createRemoteReadOps(remote: string, remoteCwd: string, localCwd: string): ReadOperations {
  const toRemote = createPathTranslator(remoteCwd, localCwd);

  return {
    readFile: (p) => sshExec(remote, `cat ${JSON.stringify(toRemote(p))}`),
    access: (p) => sshExec(remote, `test -r ${JSON.stringify(toRemote(p))}`).then(() => {}),
    detectImageMimeType: async (p) => {
      try {
        const res = await sshExec(remote, `file --mime-type -b ${JSON.stringify(toRemote(p))}`);
        const mime = res.toString().trim();
        return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime) ? mime : null;
      } catch {
        return null;
      }
    }
  };
}

function createRemoteWriteOps(remote: string, remoteCwd: string, localCwd: string): WriteOperations {
  const toRemote = createPathTranslator(remoteCwd, localCwd);

  return {
    writeFile: async (p, content) => {
      const target = toRemote(p);
      const b64 = Buffer.from(content).toString("base64");
      // Auto-create parent directories on write
      const cmd = `mkdir -p $(dirname ${JSON.stringify(target)}) && echo ${JSON.stringify(b64)} | base64 -d > ${JSON.stringify(target)}`;
      await sshExec(remote, cmd);
    },
    mkdir: (dir) => sshExec(remote, `mkdir -p ${JSON.stringify(toRemote(dir))}`).then(() => {})
  };
}

function createRemoteEditOps(remote: string, remoteCwd: string, localCwd: string): EditOperations {
  const r = createRemoteReadOps(remote, remoteCwd, localCwd);
  const w = createRemoteWriteOps(remote, remoteCwd, localCwd);
  return { readFile: r.readFile, access: r.access, writeFile: w.writeFile };
}

function createRemoteBashOps(remote: string, remoteCwd: string, localCwd: string): BashOperations {
  const toRemote = createPathTranslator(remoteCwd, localCwd);

  return {
    exec: (command, cwd, { onData, signal, timeout }) =>
      new Promise((resolve, reject) => {
        const targetCwd = toRemote(cwd);
        // Ensure non-interactive execution flags to prevent hanging prompts
        const remoteCmd = `export DEBIAN_FRONTEND=noninteractive CI=true GIT_TERMINAL_PROMPT=0; cd ${JSON.stringify(targetCwd)} && ${command}`;
        const args = [...DEFAULT_SSH_OPTS, remote, remoteCmd];

        const child = spawn("ssh", args, { stdio: ["ignore", "pipe", "pipe"] });
        let timedOut = false;

        const timer = timeout
          ? setTimeout(() => {
              timedOut = true;
              child.kill();
            }, timeout * 1000)
          : undefined;

        if (onData) {
          child.stdout.on("data", onData);
          child.stderr.on("data", onData);
        }

        child.on("error", (err) => {
          if (timer) clearTimeout(timer);
          reject(err);
        });

        const onAbort = () => child.kill();
        signal?.addEventListener("abort", onAbort, { once: true });

        child.on("close", (code) => {
          if (timer) clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          if (signal?.aborted) {
            reject(new Error("aborted"));
          } else if (timedOut) {
            reject(new Error(`timeout:${timeout}`));
          } else {
            resolve({ exitCode: code ?? 0 });
          }
        });
      })
  };
}

export default function (pi: ExtensionAPI) {
  pi.registerFlag("ssh", {
    description: "SSH remote target: user@host or user@host:/remote/path",
    type: "string"
  });

  const localCwd = process.cwd();
  const localRead = createReadTool(localCwd);
  const localWrite = createWriteTool(localCwd);
  const localEdit = createEditTool(localCwd);
  const localBash = createBashTool(localCwd);

  let resolvedSsh: { remote: string; remoteCwd: string } | null = null;
  const getSsh = () => resolvedSsh;

  // ----------------------------------------------------
  // 1. Tool Overrides
  // ----------------------------------------------------
  pi.registerTool({
    ...localRead,
    async execute(id, params, signal, onUpdate, _ctx) {
      const ssh = getSsh();
      if (ssh) {
        const tool = createReadTool(localCwd, {
          operations: createRemoteReadOps(ssh.remote, ssh.remoteCwd, localCwd)
        });
        return tool.execute(id, params, signal, onUpdate);
      }
      return localRead.execute(id, params, signal, onUpdate);
    }
  });

  pi.registerTool({
    ...localWrite,
    async execute(id, params, signal, onUpdate, _ctx) {
      const ssh = getSsh();
      if (ssh) {
        const tool = createWriteTool(localCwd, {
          operations: createRemoteWriteOps(ssh.remote, ssh.remoteCwd, localCwd)
        });
        return tool.execute(id, params, signal, onUpdate);
      }
      return localWrite.execute(id, params, signal, onUpdate);
    }
  });

  pi.registerTool({
    ...localEdit,
    async execute(id, params, signal, onUpdate, _ctx) {
      const ssh = getSsh();
      if (ssh) {
        const tool = createEditTool(localCwd, {
          operations: createRemoteEditOps(ssh.remote, ssh.remoteCwd, localCwd)
        });
        return tool.execute(id, params, signal, onUpdate);
      }
      return localEdit.execute(id, params, signal, onUpdate);
    }
  });

  pi.registerTool({
    ...localBash,
    async execute(id, params, signal, onUpdate, _ctx) {
      const ssh = getSsh();
      if (ssh) {
        const tool = createBashTool(localCwd, {
          operations: createRemoteBashOps(ssh.remote, ssh.remoteCwd, localCwd)
        });
        return tool.execute(id, params, signal, onUpdate);
      }
      return localBash.execute(id, params, signal, onUpdate);
    }
  });

  // ----------------------------------------------------
  // 2. Lifecycle Events
  // ----------------------------------------------------
  pi.on("session_start", async (_event, ctx) => {
    const flagVal = (pi.getFlag("ssh") as string | undefined) || process.env.PI_SSH;
    if (flagVal) {
      try {
        if (flagVal.includes(":")) {
          const [remote, ...pathParts] = flagVal.split(":");
          resolvedSsh = { remote, remoteCwd: pathParts.join(":") };
        } else {
          const remote = flagVal;
          const pwdBuf = await sshExec(remote, "pwd");
          const pwd = pwdBuf.toString().trim();
          resolvedSsh = { remote, remoteCwd: pwd };
        }

        // Export for permissions-gate coordination
        process.env.PI_SSH_REMOTE_CWD = resolvedSsh.remoteCwd;

        ctx.ui.setStatus("ssh", ctx.ui.theme.fg("accent", `SSH: ${resolvedSsh.remote}:${resolvedSsh.remoteCwd}`));
        ctx.ui.notify(`SSH mode active: ${resolvedSsh.remote}:${resolvedSsh.remoteCwd}`, "info");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Failed to initialize SSH connection: ${msg}`, "error");
      }
    }
  });

  // Teardown multiplexer on session shutdown
  pi.on("session_shutdown", async (_event, _ctx) => {
    const ssh = getSsh();
    if (ssh) {
      try {
        await pi.exec("ssh", ["-O", "exit", "-o", "ControlPath=~/.ssh/pi-mux-%C", ssh.remote], { timeout: 2000 });
      } catch {
        // Ignored during shutdown
      }
    }
  });

  // Handle user ! commands via SSH
  pi.on("user_bash", (_event) => {
    const ssh = getSsh();
    if (!ssh) return;
    return { operations: createRemoteBashOps(ssh.remote, ssh.remoteCwd, localCwd) };
  });

  // Inject Remote SSH Environment guidance into system prompt
  pi.on("before_agent_start", async (event) => {
    const ssh = getSsh();
    if (ssh) {
      let modified = event.systemPrompt.replace(
        `Current working directory: ${localCwd}`,
        `Current working directory: ${ssh.remoteCwd} (Remote SSH: ${ssh.remote})`
      );

      const sshHint = `\n\n# Remote SSH Environment\nYou are working directly on a remote Linux server via SSH (${ssh.remote}).\n- The remote working directory is \`${ssh.remoteCwd}\`.\n- Standard tools (read, write, edit, bash) execute remotely on this server.\n- Do NOT run nested \`ssh\` commands within \`bash\`.\n- All file modifications and shell commands affect the remote host.`;

      return { systemPrompt: modified + sshHint };
    }
  });
}
