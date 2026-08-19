/**
 * @fileoverview High-Performance SSH Remote Environment Extension for Pi Coding Agent.
 *
 * Provides seamless in-memory remote Linux/Unix workspace management via pure `ssh2`
 * with persistent connection multiplexing, native SFTP file streaming, and sub-millisecond execution.
 *
 * -------------------------------------------------------------------------------------
 * Capabilities & Tool Overrides:
 * -------------------------------------------------------------------------------------
 * - `bash`: Executes shell commands directly on the remote server with real-time stdout/stderr
 *   streaming, AbortSignal cancellation support, and non-zero exit code capture.
 * - `read`: High-speed remote file reading via native SFTP streams with binary buffer safety.
 * - `write`: High-speed remote file writing via SFTP with automatic recursive parent directory creation.
 * - `edit`: Safe remote file text replacements via SFTP read-modify-write.
 * - `/ssh`: Interactive slash command to inspect connection metadata or disconnect mid-session.
 *
 * -------------------------------------------------------------------------------------
 * Configuration & CLI Flags:
 * -------------------------------------------------------------------------------------
 * - `--ssh <target>`: Remote target specification. Formats supported:
 *     - `[user@]host[:port][/remote/path]`
 *     - `[user@]host[:port][:remote/path]`
 *     - `host` (defaults to lowercased current user, port 22, and remote user home directory).
 * - `PI_SSH`: Environment variable fallback for the remote target string.
 * - `PI_SSH_REMOTE_CWD`: Exported at runtime on connect so safety extensions (e.g. `permissions-gate.ts`)
 *   enforce remote workspace root boundaries and protect against out-of-workspace writes.
 *
 * -------------------------------------------------------------------------------------
 * Key Architecture:
 * -------------------------------------------------------------------------------------
 * 1. True In-Memory Multiplexing (`ssh2.Client`):
 *    Establishes a single persistent TCP connection upon `session_start`. All subsequent tool
 *    calls execute as lightweight encrypted channels over this existing connection, eliminating
 *    connection handshake latency (0ms per-tool overhead).
 * 2. Native SFTP File Streaming:
 *    Streams files directly via the SFTP subsystem, removing OS command-line character limits
 *    (e.g., the 8,191-character limit on Windows) and eliminating base64 overhead.
 * 3. Cross-Platform Agent & Key Resolution:
 *    Transparently connects to the Windows OpenSSH Named Pipe (`\\.\pipe\openssh-ssh-agent`)
 *    or POSIX `SSH_AUTH_SOCK`, and checks default identity key files (`~/.ssh/id_ed25519`, `id_rsa`, `id_ecdsa`).
 * 4. Transparent Path Mapping:
 *    Projects local workspace paths onto the remote POSIX directory structure while preserving
 *    absolute POSIX paths and tilde (`~`) expansions.
 * 5. Lifecycle & Interceptor Integration:
 *    - `session_start`: Establishes connection, resolves remote CWD via `pwd`, sets status bar.
 *    - `session_shutdown`: Cleanly terminates SSH connection and SFTP subsystem (on exit, `/reload`, or switch).
 *    - `user_bash`: Transparently routes user-typed interactive `!` commands to the remote server.
 *    - `before_agent_start`: Updates CWD in the system prompt and injects Remote SSH environment instructions.
 */

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
import { createRequire } from "node:module";
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/**
 * Dynamically resolves npm packages from ~/.pi/agent/npm/node_modules,
 * global npm paths, or local node_modules.
 *
 * @param name Package name to import.
 * @returns Resolved module exports.
 */
function loadDependency<T = any>(name: string): T {
  try {
    const req = createRequire(import.meta.url);
    return req(name);
  } catch {}

  try {
    const piNpmDir = path.join(os.homedir(), ".pi", "agent", "npm", "package.json");
    const piReq = createRequire(piNpmDir);
    return piReq(name);
  } catch {}

  try {
    const globalPath = path.join(process.env.APPDATA || "", "npm", "node_modules", "package.json");
    const globalReq = createRequire(globalPath);
    return globalReq(name);
  } catch {}

  throw new Error(`Failed to load '${name}'. Please install it in ~/.pi/agent/npm/ (e.g. npm i ${name})`);
}

let cachedClientClass: any = null;

/**
 * Returns the cached ssh2 Client constructor.
 */
function getSSHClientClass() {
  if (!cachedClientClass) {
    const mod = loadDependency("ssh2");
    cachedClientClass = mod.Client || mod;
  }
  return cachedClientClass;
}

/**
 * Parsed metadata for an SSH connection target.
 */
export interface SshTargetInfo {
  /** The raw input target string. */
  raw: string;
  /** Remote hostname or IP address. */
  host: string;
  /** Remote port number (default: 22). */
  port: number;
  /** Remote username (default: lowercased OS user). */
  username: string;
  /** Initial remote working directory (or empty to resolve via remote `pwd`). */
  remoteCwd: string;
}

/**
 * Parses user target strings into structured connection metadata.
 *
 * Examples supported:
 * - `"user@192.168.1.100"`
 * - `"user@192.168.1.100:/var/www"`
 * - `"ubuntu@hostname:2222:/home/ubuntu/app"`
 * - `"remote-host"` (defaults to lowercased current user and port 22)
 *
 * @param targetStr User-provided target specification.
 * @returns Structured target metadata.
 */
export function parseSshTarget(targetStr: string): SshTargetInfo {
  let raw = targetStr.trim();
  let username = (os.userInfo().username || "root").toLowerCase();
  let host = "";
  let port = 22;
  let remoteCwd = "";

  // 1. Extract username if present (user@...)
  if (raw.includes("@")) {
    const atIdx = raw.indexOf("@");
    username = raw.slice(0, atIdx).trim();
    raw = raw.slice(atIdx + 1).trim();
  }

  // 2. Extract path if separated by : or / (e.g. host:/var/www or host:~ or host:/path)
  if (raw.includes(":/")) {
    const colonIdx = raw.indexOf(":/");
    remoteCwd = raw.slice(colonIdx + 1);
    raw = raw.slice(0, colonIdx);
  } else if (raw.includes(":~")) {
    const colonIdx = raw.indexOf(":~");
    remoteCwd = raw.slice(colonIdx + 1);
    raw = raw.slice(0, colonIdx);
  }

  // 3. Extract port if present (host:2222)
  const portMatch = raw.match(/:(\d+)$/);
  if (portMatch) {
    port = parseInt(portMatch[1], 10);
    raw = raw.slice(0, -portMatch[0].length);
  }

  host = raw.trim();

  return {
    raw: targetStr,
    host,
    port,
    username,
    remoteCwd
  };
}

/**
 * Collects default identity private keys from ~/.ssh if they exist on disk.
 *
 * @returns Array of private key file buffers.
 */
function getDefaultPrivateKeys(): Buffer[] {
  const home = os.homedir();
  const keyNames = ["id_ed25519", "id_rsa", "id_ecdsa"];
  const keys: Buffer[] = [];

  for (const name of keyNames) {
    const p = path.join(home, ".ssh", name);
    try {
      if (fsSync.existsSync(p)) {
        keys.push(fsSync.readFileSync(p));
      }
    } catch {}
  }

  return keys;
}

/**
 * Resolves the OpenSSH agent named pipe or Unix socket path across platforms.
 *
 * @returns Agent socket/pipe path or undefined if unavailable.
 */
function resolveAgentPath(): string | undefined {
  if (process.env.SSH_AUTH_SOCK) {
    return process.env.SSH_AUTH_SOCK;
  }
  if (process.platform === "win32") {
    return "\\\\.\\pipe\\openssh-ssh-agent";
  }
  return undefined;
}

/**
 * Manages the persistent, multiplexed SSH connection and SFTP subsystem.
 */
export class SshSessionManager {
  private client: any = null;
  private sftp: any = null;
  public targetInfo: SshTargetInfo | null = null;
  public connectedAt = 0;

  /**
   * Establishes the persistent SSH connection and initializes SFTP.
   *
   * @param target Target server metadata.
   */
  async connect(target: SshTargetInfo): Promise<void> {
    this.targetInfo = target;
    const ClientClass = getSSHClientClass();
    const client = new ClientClass();

    const agent = resolveAgentPath();
    const privateKeys = getDefaultPrivateKeys();

    await new Promise<void>((resolve, reject) => {
      let resolved = false;

      client.on("ready", () => {
        resolved = true;
        this.client = client;
        this.connectedAt = Date.now();
        resolve();
      });

      client.on("error", (err: Error) => {
        if (!resolved) {
          reject(err);
        }
      });

      client.on("close", () => {
        this.client = null;
        this.sftp = null;
      });

      const connectOpts: any = {
        host: target.host,
        port: target.port,
        username: target.username,
        readyTimeout: 15000,
        keepaliveInterval: 15000,
        keepaliveCountMax: 3
      };

      if (agent) {
        connectOpts.agent = agent;
      }
      if (privateKeys.length > 0) {
        connectOpts.privateKey = privateKeys[0];
      }

      client.connect(connectOpts);
    });

    // Resolve remote working directory via pwd if not explicitly specified
    if (!target.remoteCwd) {
      const pwdBuf = await this.execCommand("pwd");
      const pwd = pwdBuf.toString().trim();
      target.remoteCwd = pwd || "/root";
    }

    // Initialize persistent SFTP subsystem
    this.sftp = await this.initSftp();
  }

  /**
   * Initializes the SFTP channel wrapper.
   */
  private initSftp(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) return reject(new Error("SSH client is not connected"));
      this.client.sftp((err: Error, sftp: any) => {
        if (err) return reject(err);
        resolve(sftp);
      });
    });
  }

  /**
   * Returns the active SFTP subsystem handle, re-initializing if necessary.
   */
  async getSftp(): Promise<any> {
    if (this.sftp) return this.sftp;
    this.sftp = await this.initSftp();
    return this.sftp;
  }

  /**
   * Executes a one-shot command over a dedicated exec channel.
   *
   * @param command Shell command string to execute.
   * @param signal Optional AbortSignal for cancellation.
   * @returns Raw output buffer from the command.
   */
  execCommand(command: string, signal?: AbortSignal): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (!this.client) return reject(new Error("SSH client is not connected"));
      if (signal?.aborted) return reject(new Error("aborted"));

      this.client.exec(command, (err: Error, stream: any) => {
        if (err) return reject(err);

        const outChunks: Buffer[] = [];
        const errChunks: Buffer[] = [];

        stream.on("data", (data: Buffer) => outChunks.push(data));
        stream.stderr.on("data", (data: Buffer) => errChunks.push(data));

        const onAbort = () => {
          try {
            stream.close();
          } catch {}
        };
        signal?.addEventListener("abort", onAbort, { once: true });

        stream.on("close", (code: number) => {
          signal?.removeEventListener("abort", onAbort);
          if (signal?.aborted) {
            return reject(new Error("aborted"));
          }
          if (code !== 0) {
            const msg = Buffer.concat(errChunks).toString().trim();
            return reject(new Error(`Remote command failed (exit code ${code}): ${msg || `code ${code}`}`));
          }
          resolve(Buffer.concat(outChunks));
        });
      });
    });
  }

  /**
   * Gracefully tears down the SSH connection and closes active channels.
   */
  disconnect(): void {
    if (this.client) {
      try {
        this.client.end();
      } catch {}
      this.client = null;
      this.sftp = null;
      this.targetInfo = null;
    }
  }

  /**
   * Checks whether the SSH client connection is currently established.
   */
  isConnected(): boolean {
    return Boolean(this.client);
  }
}

/**
 * Creates a POSIX path translator between local workspace paths and remote server paths.
 *
 * Handles:
 * - Relative paths (`src/app.ts` -> `<remoteCwd>/src/app.ts`)
 * - Tilde expansions (`~/file` -> `~/file`)
 * - Absolute POSIX paths (`/var/log` -> `/var/log`)
 * - Windows paths mapped into the workspace root (`C:/local/repo/file` -> `<remoteCwd>/file`)
 * - Leading `@` symbol stripping (preventing model hallucination path errors)
 *
 * @param remoteCwd Remote working directory.
 * @param localCwd Local workspace working directory.
 * @returns Path translation function.
 */
export function createPathTranslator(remoteCwd: string, localCwd: string) {
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

/**
 * Recognized image extensions mapped to MIME content types.
 */
export const KNOWN_IMAGE_EXTS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

/**
 * Creates remote `ReadOperations` implementation backed by SFTP.
 *
 * @param session Active SSH session manager.
 * @param remoteCwd Remote working directory.
 * @param localCwd Local workspace directory.
 * @returns Pi ReadOperations interface.
 */
export function createRemoteReadOps(session: SshSessionManager, remoteCwd: string, localCwd: string): ReadOperations {
  const toRemote = createPathTranslator(remoteCwd, localCwd);

  return {
    readFile: async (p) => {
      const target = toRemote(p);
      const sftp = await session.getSftp();
      return new Promise<Buffer>((resolve, reject) => {
        sftp.readFile(target, (err: Error, data: Buffer) => {
          if (err) return reject(err);
          resolve(data);
        });
      });
    },

    access: async (p) => {
      const target = toRemote(p);
      const sftp = await session.getSftp();
      return new Promise<void>((resolve, reject) => {
        sftp.stat(target, (err: Error, _stat: any) => {
          if (err) return reject(err);
          resolve();
        });
      });
    },

    detectImageMimeType: async (p) => {
      const target = toRemote(p);
      const ext = path.extname(target).toLowerCase();
      if (KNOWN_IMAGE_EXTS[ext]) {
        return KNOWN_IMAGE_EXTS[ext];
      }

      try {
        const res = await session.execCommand(`file --mime-type -b ${JSON.stringify(target)}`);
        const mime = res.toString().trim();
        return ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"].includes(mime) ? mime : null;
      } catch {
        return null;
      }
    }
  };
}

/**
 * Creates remote `WriteOperations` implementation backed by SFTP.
 *
 * @param session Active SSH session manager.
 * @param remoteCwd Remote working directory.
 * @param localCwd Local workspace directory.
 * @returns Pi WriteOperations interface.
 */
export function createRemoteWriteOps(session: SshSessionManager, remoteCwd: string, localCwd: string): WriteOperations {
  const toRemote = createPathTranslator(remoteCwd, localCwd);

  return {
    writeFile: async (p, content) => {
      const target = toRemote(p);
      const sftp = await session.getSftp();
      const parentDir = path.posix.dirname(target);

      // Auto-create parent directories via SSH exec (fastest and handles recursive trees)
      if (parentDir && parentDir !== "/" && parentDir !== ".") {
        try {
          await session.execCommand(`mkdir -p ${JSON.stringify(parentDir)}`);
        } catch {}
      }

      const buf = Buffer.isBuffer(content) ? content : Buffer.from(content);

      return new Promise<void>((resolve, reject) => {
        sftp.writeFile(target, buf, (err: Error) => {
          if (err) return reject(err);
          resolve();
        });
      });
    },

    mkdir: async (dir) => {
      const target = toRemote(dir);
      await session.execCommand(`mkdir -p ${JSON.stringify(target)}`);
    }
  };
}

/**
 * Creates remote `EditOperations` implementation backed by SFTP.
 *
 * @param session Active SSH session manager.
 * @param remoteCwd Remote working directory.
 * @param localCwd Local workspace directory.
 * @returns Pi EditOperations interface.
 */
export function createRemoteEditOps(session: SshSessionManager, remoteCwd: string, localCwd: string): EditOperations {
  const r = createRemoteReadOps(session, remoteCwd, localCwd);
  const w = createRemoteWriteOps(session, remoteCwd, localCwd);
  return { readFile: r.readFile, access: r.access, writeFile: w.writeFile };
}

/**
 * Creates remote `BashOperations` implementation backed by persistent SSH channel exec.
 *
 * @param session Active SSH session manager.
 * @param remoteCwd Remote working directory.
 * @param localCwd Local workspace directory.
 * @returns Pi BashOperations interface.
 */
export function createRemoteBashOps(session: SshSessionManager, remoteCwd: string, localCwd: string): BashOperations {
  const toRemote = createPathTranslator(remoteCwd, localCwd);

  return {
    exec: (command, cwd, { onData, signal, timeout }) =>
      new Promise((resolve, reject) => {
        const targetCwd = toRemote(cwd);
        const remoteCmd = `export DEBIAN_FRONTEND=noninteractive CI=true GIT_TERMINAL_PROMPT=0; cd ${JSON.stringify(targetCwd)} && ${command}`;

        let timedOut = false;
        let timer: NodeJS.Timeout | undefined;

        (session as any).client.exec(remoteCmd, (err: Error, stream: any) => {
          if (err) return reject(err);

          // Configure execution timeout
          if (timeout) {
            timer = setTimeout(() => {
              timedOut = true;
              try {
                stream.close();
              } catch {}
            }, timeout * 1000);
          }

          // Handle real-time data streaming or drain streams in headless mode
          if (onData) {
            stream.on("data", onData);
            stream.stderr.on("data", onData);
          } else {
            stream.resume();
            stream.stderr.resume();
          }

          // Handle abort signal cancellation
          const onAbort = () => {
            try {
              stream.close();
            } catch {}
          };
          signal?.addEventListener("abort", onAbort, { once: true });

          let exitCode = 0;
          stream.on("exit", (code: number) => {
            exitCode = code ?? 0;
          });

          stream.on("close", (code: number) => {
            if (timer) clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);

            if (signal?.aborted) {
              return reject(new Error("aborted"));
            }
            if (timedOut) {
              return reject(new Error(`timeout:${timeout}`));
            }

            resolve({ exitCode: code ?? exitCode });
          });
        });
      })
  };
}

/**
 * Pi Extension Default Entrypoint.
 *
 * Registers:
 * - `--ssh` CLI flag
 * - `/ssh` slash command
 * - Overridden `read`, `write`, `edit`, `bash` tools
 * - Lifecycle handlers for `session_start`, `session_shutdown`, `user_bash`, and `before_agent_start`.
 */
export default function (pi: ExtensionAPI) {
  pi.registerFlag("ssh", {
    description: "SSH remote target: [user@]host[:port][/remote/path]",
    type: "string"
  });

  const session = new SshSessionManager();
  const localCwd = process.cwd();

  const localRead = createReadTool(localCwd);
  const localWrite = createWriteTool(localCwd);
  const localEdit = createEditTool(localCwd);
  const localBash = createBashTool(localCwd);

  // ----------------------------------------------------
  // 1. Slash Command: /ssh
  // ----------------------------------------------------
  pi.registerCommand("ssh", {
    description: "Inspect or disconnect active SSH session (usage: /ssh [status|disconnect])",
    handler: async (args, ctx) => {
      const sub = (args || "").trim().toLowerCase();

      if (!session.isConnected() || !session.targetInfo) {
        ctx.ui.notify("No active SSH session. Use --ssh <target> on startup.", "info");
        return;
      }

      if (sub === "disconnect" || sub === "close" || sub === "exit") {
        session.disconnect();
        ctx.ui.setStatus("ssh", undefined);
        ctx.ui.notify("SSH session disconnected. Falling back to local tools.", "warning");
        return;
      }

      // Default: status
      const uptimeSec = Math.round((Date.now() - session.connectedAt) / 1000);
      const info = session.targetInfo;
      ctx.ui.notify(
        `SSH Active: ${info.username}@${info.host}:${info.port}\nRemote CWD: ${info.remoteCwd}\nConnected: ${uptimeSec}s ago`,
        "info"
      );
    }
  });

  // ----------------------------------------------------
  // 2. Tool Overrides
  // ----------------------------------------------------
  pi.registerTool({
    ...localRead,
    async execute(id, params, signal, onUpdate, _ctx) {
      if (session.isConnected() && session.targetInfo) {
        const tool = createReadTool(localCwd, {
          operations: createRemoteReadOps(session, session.targetInfo.remoteCwd, localCwd)
        });
        return tool.execute(id, params, signal, onUpdate);
      }
      return localRead.execute(id, params, signal, onUpdate);
    }
  });

  pi.registerTool({
    ...localWrite,
    async execute(id, params, signal, onUpdate, _ctx) {
      if (session.isConnected() && session.targetInfo) {
        const tool = createWriteTool(localCwd, {
          operations: createRemoteWriteOps(session, session.targetInfo.remoteCwd, localCwd)
        });
        return tool.execute(id, params, signal, onUpdate);
      }
      return localWrite.execute(id, params, signal, onUpdate);
    }
  });

  pi.registerTool({
    ...localEdit,
    async execute(id, params, signal, onUpdate, _ctx) {
      if (session.isConnected() && session.targetInfo) {
        const tool = createEditTool(localCwd, {
          operations: createRemoteEditOps(session, session.targetInfo.remoteCwd, localCwd)
        });
        return tool.execute(id, params, signal, onUpdate);
      }
      return localEdit.execute(id, params, signal, onUpdate);
    }
  });

  pi.registerTool({
    ...localBash,
    async execute(id, params, signal, onUpdate, _ctx) {
      if (session.isConnected() && session.targetInfo) {
        const tool = createBashTool(localCwd, {
          operations: createRemoteBashOps(session, session.targetInfo.remoteCwd, localCwd)
        });
        return tool.execute(id, params, signal, onUpdate);
      }
      return localBash.execute(id, params, signal, onUpdate);
    }
  });

  // ----------------------------------------------------
  // 3. Lifecycle Events
  // ----------------------------------------------------
  pi.on("session_start", async (_event, ctx) => {
    const rawTarget = (pi.getFlag("ssh") as string | undefined) || process.env.PI_SSH;
    if (rawTarget) {
      try {
        const target = parseSshTarget(rawTarget);
        ctx.ui.notify(`Connecting via SSH to ${target.username}@${target.host}:${target.port}...`, "info");

        await session.connect(target);

        // Export for permissions-gate coordination
        process.env.PI_SSH_REMOTE_CWD = target.remoteCwd;

        const label = `${target.username}@${target.host}:${target.remoteCwd}`;
        ctx.ui.setStatus("ssh", ctx.ui.theme.fg("accent", `SSH: ${label}`));
        ctx.ui.notify(`SSH connected: ${label}`, "info");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Failed to establish SSH connection: ${msg}`, "error");
      }
    }
  });

  // Teardown connection on session shutdown
  pi.on("session_shutdown", async (_event, _ctx) => {
    session.disconnect();
  });

  // Handle user ! commands via SSH
  pi.on("user_bash", (_event) => {
    if (!session.isConnected() || !session.targetInfo) return;
    return { operations: createRemoteBashOps(session, session.targetInfo.remoteCwd, localCwd) };
  });

  // Inject Remote SSH Environment guidance into system prompt
  pi.on("before_agent_start", async (event) => {
    if (session.isConnected() && session.targetInfo) {
      const target = session.targetInfo;
      const modified = event.systemPrompt.replace(
        `Current working directory: ${localCwd}`,
        `Current working directory: ${target.remoteCwd} (Remote SSH: ${target.username}@${target.host})`
      );

      const sshHint = `\n\n# Remote SSH Environment\nYou are working directly on a remote Linux server via SSH (${target.username}@${target.host}:${target.port}).\n- The remote working directory is \`${target.remoteCwd}\`.\n- Standard tools (read, write, edit, bash) execute remotely on this server.\n- Do NOT run nested \`ssh\` commands within \`bash\`.\n- All file modifications and shell commands affect the remote host.`;

      return { systemPrompt: modified + sshHint };
    }
  });
}
