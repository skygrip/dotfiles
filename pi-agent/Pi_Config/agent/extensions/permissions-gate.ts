import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import * as os from "node:os";

/**
 * Permissions Gate Extension for Pi Coding Agent
 *
 * Provides granular pre-execution security guards, safety barriers, and workspace
 * confinement for tool calls made by autonomous coding agents.
 *
 * Intercepted Tools & Commands:
 * - `bash`: Intercepts dangerous system destruction commands, fork bombs, recursive agent execution,
 *   forceful git deletions, elevated privileges (sudo/doas), credential exfiltration, and out-of-workspace paths.
 * - `read`: Guards against reading sensitive credential files (.env, .ssh, AWS/Kube keys) or arbitrary system paths outside workspace.
 * - `write` / `edit`: Prevents silent overwriting of sensitive credential files and accidental out-of-workspace modifications.
 * - `/permissions-gate`: Slash command to toggle or inspect the permission gate ([status|on|off|toggle]).
 *
 * Configuration & CLI Flags:
 * - `--no-permissions-gate`: CLI flag to disable permissions gate for unattended/automated runs.
 * - `PI_PERMISSIONS_GATE`: Environment variable override (set to "0" or "false" to disable).
 * - `PI_GATES`: Master environment variable override (set to "0" or "false" to disable all gates).
 */

const CONFIRM_TIMEOUT_MS = 30000; // 30-second countdown timer auto-defaulting to No (blocked)

/**
 * Evaluates whether a gate should be active at startup based on CLI flags and environment variables.
 */
function isGateInitiallyEnabled(gateKey: string, flagName: string, pi?: ExtensionAPI): boolean {
  if (pi && typeof pi.getFlag === "function" && pi.getFlag(flagName) === true) {
    return false;
  }
  if (process.argv.includes(`--${flagName}`) || process.argv.includes("--no-gates")) {
    return false;
  }

  const master = process.env.PI_GATES?.trim().toLowerCase();
  if (master && ["0", "false", "off", "disable", "disabled", "no"].includes(master)) {
    return false;
  }

  const val = process.env[gateKey]?.trim().toLowerCase();
  if (val && ["0", "false", "off", "disable", "disabled", "no"].includes(val)) {
    return false;
  }

  return true;
}

let gateEnabled = isGateInitiallyEnabled("PI_PERMISSIONS_GATE", "no-permissions-gate");

/**
 * Dangerous bash command regex patterns with human-readable violation explanations.
 */
interface DangerousPattern {
  name: string;
  regex: RegExp;
  reason: string;
}

export const DANGEROUS_BASH_PATTERNS: DangerousPattern[] = [
  {
    name: "Recursive Agent Execution",
    regex: /(?:^|\s|;|&&|\|\|)(?:npx\s+|bunx\s+|pnpm\s+dlx\s+)?pi(?:\.exe)?(?:\s+|$)(?!-v|--version|-h|--help)/i,
    reason: "Prevented recursive Pi agent invocation within shell."
  },
  {
    name: "Filesystem Destruction",
    regex: /\brm\s+(?:-[a-zA-Z]+\s+)*(?:-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|-[a-zA-Z]*r[a-zA-Z]*\s+-[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*\s+-[a-zA-Z]*r[a-zA-Z]*)\s+(?:[\/\\]|~|\$HOME|\%USERPROFILE\%|[a-zA-Z]:[\\\/])/i,
    reason: "Root or home directory recursive forceful removal is forbidden."
  },
  {
    name: "Disk Partitioning & Formatting",
    regex: /\b(?:mkfs|wipefs|fdisk|parted|gdisk)\b|\bdd\s+if=/i,
    reason: "Low-level disk format/write operations are blocked."
  },
  {
    name: "Unsafe Permission Modification",
    regex: /\bchmod\s+-[a-zA-Z]*R\s+777\s+(?:[\/\\]|~|\$HOME)/i,
    reason: "Unrestricted global recursive permission modification is blocked."
  },
  {
    name: "Fork Bomb",
    regex: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    reason: "Fork bomb execution pattern detected."
  },
  {
    name: "Destructive Working Tree Discard",
    regex: /\bgit\s+(?:clean\s+(?:[^\n;&|]*\s+)?(?:-[a-zA-Z]*f[a-zA-Z]*|--force)|reset\s+--(?:hard|merge|keep)|checkout\s+(?:[^\n;&|]*\s+)?(?:--\s+\.|\.|-[a-zA-Z]*f[a-zA-Z]*|--force)|restore\s+(?:[^\n;&|]*\s+)?(?:\.|\*\.|--worktree|-W|-s\s+HEAD))\b/i,
    reason: "Command permanently discards uncommitted working tree modifications."
  },
  {
    name: "Force Branch Deletion",
    regex: /\bgit\s+branch\s+(?:[^\n;&|]*\s+)?(?:-[a-zA-Z]*D[a-zA-Z]*|--delete\s+--force|-d\s+-f)\b/i,
    reason: "Force-deleting a branch can destroy unmerged commits."
  },
  {
    name: "Force Push",
    regex: /\bgit\s+push\s+(?:[^\n;&|]*\s+)?(?:-[a-zA-Z]*f[a-zA-Z]*|--force(?!-with-lease)|\+\S+:\S+)\b/i,
    reason: "Force-pushing can overwrite remote branch history and erase commits."
  },
  {
    name: "Stash Deletion",
    regex: /\bgit\s+stash\s+(?:clear|drop)\b/i,
    reason: "Permanently deletes uncommitted stashed changes."
  },
  {
    name: "Elevated Privileges",
    regex: /(?:^|\s|;|&&|\|\|)(?:sudo|doas|runas)\s+/i,
    reason: "Command requests elevated/root privileges."
  }
];

export const BASH_CREDENTIAL_ACCESS_REGEX = /(?:^|[\s\/'"\\])(?:\.env(?:\.[\w-]+)?|\.ssh(?:[\\\/][\w.-]+)?|\.aws(?:[\\\/][\w.-]+)?|\.kube(?:[\\\/]config)?|\.git-credentials|\.npmrc|\.pypirc|\.netrc|\.docker[\\\/]config\.json|\.gnupg[\\\/]?|\.bash_history|\.zsh_history|etc[\\\/]shadow|etc[\\\/]master\.passwd|id_rsa|id_ed25519|id_ecdsa|id_dsa|service_account.*\.json|client_secret.*\.json|\w+\.(?:pem|key|p12|pfx))\b/i;

export const CREDENTIAL_FILE_PATTERNS = [
  /(?:^|[\\\/])\.env(?:\.local|\.production|\.development|\.staging|\.test|\.example)?$/i,
  /(?:^|[\\\/])\.ssh(?:[\\\/](?:id_rsa|id_ed25519|id_ecdsa|id_dsa|authorized_keys|known_hosts|config))?$/i,
  /(?:^|[\\\/])\.aws(?:[\\\/](?:credentials|config))?$/i,
  /(?:^|[\\\/])\.kube(?:[\\\/]config)?$/i,
  /(?:^|[\\\/])\.git-credentials$/i,
  /(?:^|[\\\/])\.npmrc$/i,
  /(?:^|[\\\/])\.pypirc$/i,
  /(?:^|[\\\/])\.netrc$/i,
  /(?:^|[\\\/])\.gnupg(?:[\\\/]|$)/i,
  /(?:^|[\\\/])\.docker[\\\/]config\.json$/i,
  /(?:^|[\\\/])(?:\.bash_history|\.zsh_history|\.ps_history)$/i,
  /(?:^|[\\\/])(?:etc[\\\/]shadow|etc[\\\/]master\.passwd)$/i,
  /(?:^|[\\\/]).*\.(?:pem|key|p12|pfx)$/i,
  /(?:^|[\\\/])(?:service_account|client_secret).*\.json$/i
];

export function isOutsideWorkspace(targetPath: string): boolean {
  if (!targetPath) return false;
  const workspaceRoot = getWorkspaceRoot();
  const isRemote = Boolean(process.env.PI_SSH_REMOTE_CWD);

  if (isRemote) {
    let p = targetPath.trim().replace(/\\/g, "/");
    if (p === "~" || p.startsWith("~/")) {
      const remoteHome = path.posix.dirname(workspaceRoot);
      p = remoteHome + p.slice(1);
    }
    const resolved = path.posix.resolve(workspaceRoot, p);
    const normRoot = path.posix.normalize(workspaceRoot);
    return !resolved.startsWith(normRoot + "/") && resolved !== normRoot;
  }

  // Local filesystem path resolution with ~ and drive normalization
  const normTarget = normalizePath(targetPath);
  const normRoot = path.resolve(workspaceRoot).replace(/\\/g, "/");
  const rel = path.relative(normRoot, normTarget);
  return rel.startsWith("..") || path.isAbsolute(rel);
}

export function isCredentialFile(targetPath: string): boolean {
  if (!targetPath) return false;
  const raw = targetPath.trim();
  const norm = normalizePath(raw);
  return CREDENTIAL_FILE_PATTERNS.some(p => p.test(raw) || p.test(norm));
}

export function isSensitiveSystemPath(targetPath: string): boolean {
  if (!targetPath) return false;
  const raw = targetPath.trim().replace(/\\/g, "/").toLowerCase();
  const norm = normalizePath(targetPath).toLowerCase();
  const home = os.homedir().replace(/\\/g, "/").toLowerCase();

  // Root / system sensitive directories
  const sensitiveRegex = /^(?:[a-z]:)?\/(?:etc|var|usr|bin|sbin|sys|proc|dev|boot|root|System|Library|Windows|Program Files|Program Files \(x86\)|ProgramData)\b/i;
  if (sensitiveRegex.test(raw) || sensitiveRegex.test(norm)) {
    return true;
  }

  // Home-anchored user configuration
  if (norm.startsWith(`${home}/.config/`) ||
      norm.startsWith(`${home}/.cargo/`) ||
      norm.startsWith(`${home}/.gnupg`) ||
      norm.startsWith(`${home}/.npmrc`)) {
    return true;
  }

  return false;
}

export function getWorkspaceRoot(): string {
  if (process.env.PI_SSH_REMOTE_CWD) {
    return process.env.PI_SSH_REMOTE_CWD;
  }
  return process.cwd();
}

/**
 * Normalizes and expands paths for uniform analysis.
 */
function normalizePath(targetPath: string): string {
  if (!targetPath) return "";
  let p = targetPath.trim().replace(/\\/g, "/");

  // Tilde expansion
  if (p === "~" || p.startsWith("~/")) {
    const home = os.homedir().replace(/\\/g, "/");
    p = home + p.slice(1);
  }

  // Windows drive normalization: /c/Users/... -> C:/Users/...
  if (process.platform === "win32" && /^\/([a-zA-Z])\//.test(p)) {
    p = p.replace(/^\/([a-zA-Z])\//, (_, drive) => `${drive.toUpperCase()}:/`);
  }

  try {
    return path.resolve(p).replace(/\\/g, "/");
  } catch {
    return p;
  }
}



/**
 * Checks if a target path is located inside the global Pi or Agent skills directory.
 * Handles ~ expansion, Windows/POSIX slashes, Git Bash drive prefixes, and environment variables.
 */
export function isGlobalSkillPath(targetPath: string): boolean {
  if (!targetPath) return false;

  const home = os.homedir().replace(/\\/g, "/").toLowerCase();
  let norm = targetPath.trim().replace(/\\/g, "/").toLowerCase();

  // Strip wrapping quotes
  norm = norm.replace(/^['"]+|['"]+$/g, "");

  // Expand environment variables & tildes
  norm = norm
    .replace(/^~(?:\/|$)/, `${home}/`)
    .replace(/^\$home(?:\/|$)/, `${home}/`)
    .replace(/^%userprofile%(?:\/|$)/, `${home}/`)
    .replace(/^\$env:userprofile(?:\/|$)/, `${home}/`);

  // Normalize MSYS2 / Git Bash /c/Users -> C:/Users
  if (process.platform === "win32" && /^\/([a-z])\//i.test(norm)) {
    norm = norm.replace(/^\/([a-z])\//i, (_, drive) => `${drive.toUpperCase()}:/`);
  }

  try {
    norm = path.resolve(norm).replace(/\\/g, "/").toLowerCase();
  } catch {
    // Keep unnormalized if path.resolve fails
  }

  const piSkills = `${home}/.pi/agent/skills`;
  const agentsSkills = `${home}/.agents/skills`;

  return (
    norm === piSkills ||
    norm.startsWith(`${piSkills}/`) ||
    norm === agentsSkills ||
    norm.startsWith(`${agentsSkills}/`)
  );
}

const BENIGN_SHELL_PATHS = new Set([
  "/dev/null",
  "/dev/stdin",
  "/dev/stdout",
  "/dev/stderr",
  "/dev/zero",
  "/dev/random",
  "/dev/urandom"
]);

/**
 * Extracts potential path arguments from a shell command string (e.g. rg, ck, fd, cat, python).
 */
export function extractPathTokens(command: string): string[] {
  if (!command) return [];

  // Match path tokens:
  // 1. Tildes: ~/foo or ~
  // 2. Directory traversals: .. or ../ or ./.. or ./../foo or ../../foo
  // 3. Windows drives: C:\foo or C:/foo
  // 4. Root/system paths: /c/foo, /etc/foo, /var/foo, /Users/foo, etc.
  const pathRegex = /(?:^|[\s"'=<>|&;])((?:~(?:\/[\w.-]+)*|(?:\.[\/\\])*\.\.(?:[\/\\][\w.\\\/-]*)?|[a-zA-Z]:[\\\/][\w.\\\/-]+|\/(?:[a-zA-Z]\/|etc|var|usr|home|tmp|opt|root|bin|sbin|boot|dev|sys|proc|windows|program files|users)[\w.\\\/-]*))/gi;

  const results: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pathRegex.exec(command)) !== null) {
    const raw = (match[1] || "").trim();
    if (!raw) continue;

    const norm = raw.replace(/\\/g, "/").toLowerCase();
    if (BENIGN_SHELL_PATHS.has(norm)) continue;

    const clean = raw.replace(/['"]+$/, "");
    results.push(clean);
  }

  return results;
}

export default function (pi: ExtensionAPI) {
  // ----------------------------------------------------
  // 0. CLI Flag Registration
  // ----------------------------------------------------
  pi.registerFlag("no-permissions-gate", {
    description: "Disable permissions gate safety intercepts",
    type: "boolean"
  });

  gateEnabled = isGateInitiallyEnabled("PI_PERMISSIONS_GATE", "no-permissions-gate", pi);

  // ----------------------------------------------------
  // 1. Slash Command: /permissions-gate
  // ----------------------------------------------------
  pi.registerCommand("permissions-gate", {
    description: "Toggle or inspect permissions gate (usage: /permissions-gate [status|on|off|toggle])",
    handler: async (args, ctx) => {
      const sub = (args || "").trim().toLowerCase();

      if (sub === "status" || sub === "info") {
        ctx.ui.notify(`Permissions Gate is currently: ${gateEnabled ? "ENABLED (Active)" : "DISABLED (Bypassed)"}`, "info");
        return;
      }

      if (sub === "on" || sub === "enable") {
        gateEnabled = true;
      } else if (sub === "off" || sub === "disable") {
        gateEnabled = false;
      } else {
        // Default: toggle
        gateEnabled = !gateEnabled;
      }

      const stateText = gateEnabled ? "ENABLED (Enforcing safety & credential rules)" : "DISABLED (Bypassing guards)";
      ctx.ui.setStatus("permissions-gate", gateEnabled ? undefined : "⚠️ Permissions-Gate: OFF");
      ctx.ui.notify(`Permissions Gate: ${stateText}`, gateEnabled ? "info" : "warning");
    }
  });



  // ----------------------------------------------------
  // 2. Event Hook: tool_call Interception
  // ----------------------------------------------------
  pi.on("tool_call", async (event, ctx) => {
    if (!gateEnabled) return;

    // --------------------------------------------------
    // A. Bash Tool Safety Inspection
    // --------------------------------------------------
    if (isToolCallEventType("bash", event)) {
      const command = event.input.command || "";

      // 1. Dangerous Command Regex Patterns
      for (const pattern of DANGEROUS_BASH_PATTERNS) {
        if (pattern.regex.test(command)) {
          if (!ctx.hasUI || !ctx.ui) {
            return {
              block: true,
              reason: `[SAFETY GUARD]: ${pattern.reason} Command: "${command}". (Headless mode auto-blocked)`
            };
          }

          const approved = await ctx.ui.confirm(
            "⚠️ Dangerous Command Alert",
            `The agent wants to execute:\n\n${command}\n\nReason: ${pattern.reason}\n\nAllow execution?`,
            { timeout: CONFIRM_TIMEOUT_MS }
          );

          if (!approved) {
            return {
              block: true,
              reason: `[SAFETY GUARD BLOCKED BY USER]: ${pattern.reason}. Please choose a safer alternative.`
            };
          }
        }
      }

      // 2. Secret Credential Access via Bash
      if (BASH_CREDENTIAL_ACCESS_REGEX.test(command)) {
        if (!ctx.hasUI || !ctx.ui) {
          return {
            block: true,
            reason: `[SECRET PROTECTION]: Shell access to credential files is blocked in headless mode. Command: "${command}"`
          };
        }

        const approved = await ctx.ui.confirm(
          "🔒 Credential Access Alert",
          `The agent wants to access sensitive secrets via shell:\n\n${command}\n\nAllow execution?`,
          { timeout: CONFIRM_TIMEOUT_MS }
        );

        if (!approved) {
          return {
            block: true,
            reason: `[SECRET PROTECTION BLOCKED BY USER]: Direct shell access to credential files was denied.`
          };
        }
      }

      // 3. Out-of-Workspace & Sensitive System Path Access via Shell (rg, ck, sc, fd, find, cat, etc.)
      const pathTokens = extractPathTokens(command);
      for (const token of pathTokens) {
        if (isSensitiveSystemPath(token)) {
          if (!ctx.hasUI || !ctx.ui) {
            return {
              block: true,
              reason: `[SECRET PROTECTION]: Shell access to sensitive system path "${token}" is blocked in headless mode. Command: "${command}"`
            };
          }

          const approved = await ctx.ui.confirm(
            "🔒 Sensitive System Path Access",
            `The agent wants to access a sensitive system path via shell:\n\nCommand: ${command}\nDetected Path: ${token}\n\nAllow execution?`,
            { timeout: CONFIRM_TIMEOUT_MS }
          );

          if (!approved) {
            return {
              block: true,
              reason: `[SECRET PROTECTION BLOCKED BY USER]: Shell access to "${token}" was denied.`
            };
          }
          break;
        }

        if (isOutsideWorkspace(token) && !isGlobalSkillPath(token)) {
          const workspace = getWorkspaceRoot();
          if (!ctx.hasUI || !ctx.ui) {
            return {
              block: true,
              reason: `[WORKSPACE CONFINEMENT]: Shell command references path "${token}" outside workspace "${workspace}". Blocked in headless mode.`
            };
          }

          const approved = await ctx.ui.confirm(
            "⚠️ Out-of-Workspace Shell Access",
            `The agent wants to execute a command targeting an external path:\n\nCommand: ${command}\nDetected Path: ${token}\nWorkspace: ${workspace}\n\nAllow execution?`,
            { timeout: CONFIRM_TIMEOUT_MS }
          );

          if (!approved) {
            return {
              block: true,
              reason: `[WORKSPACE CONFINEMENT BLOCKED BY USER]: Shell command targeting "${token}" outside workspace "${workspace}" was denied.`
            };
          }
          break;
        }
      }
    }

    // --------------------------------------------------
    // B. Read Tool Secret, System Path & Workspace Inspection
    // --------------------------------------------------
    if (isToolCallEventType("read", event)) {
      const targetPath = event.input.path || "";

      // 1. Sensitive file / credential protection
      if (isCredentialFile(targetPath) || isSensitiveSystemPath(targetPath)) {
        if (!ctx.hasUI || !ctx.ui) {
          return {
            block: true,
            reason: `[SECRET PROTECTION]: Read access to sensitive file "${targetPath}" is blocked in headless mode.`
          };
        }

        const approved = await ctx.ui.confirm(
          "🔒 Sensitive File Access",
          `The agent wants to read sensitive file:\n\n${targetPath}\n\nAllow read access?`,
          { timeout: CONFIRM_TIMEOUT_MS }
        );

        if (!approved) {
          return {
            block: true,
            reason: `[SECRET PROTECTION BLOCKED BY USER]: Reading "${targetPath}" was denied by user.`
          };
        }
      }

      // 2. Out of Workspace Read Confinement
      if (isOutsideWorkspace(targetPath) && !isGlobalSkillPath(targetPath)) {
        const workspace = getWorkspaceRoot();
        if (!ctx.hasUI || !ctx.ui) {
          return {
            block: true,
            reason: `[WORKSPACE CONFINEMENT]: Reading file "${targetPath}" outside active workspace "${workspace}". Blocked in headless mode.`
          };
        }

        const approved = await ctx.ui.confirm(
          "⚠️ Out-of-Workspace Read Access",
          `Target: ${targetPath}\nWorkspace: ${workspace}\n\nThe agent is attempting to read a file outside the project workspace.\n\nAllow read access?`,
          { timeout: CONFIRM_TIMEOUT_MS }
        );

        if (!approved) {
          return {
            block: true,
            reason: `[WORKSPACE CONFINEMENT BLOCKED BY USER]: Reading outside workspace "${workspace}" was denied.`
          };
        }
      }
    }

    // --------------------------------------------------
    // C. Write & Edit Tool Confinement & Secret Overwrite
    // --------------------------------------------------
    if (isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
      const targetPath = event.input.path || "";

      // 1. Block secret file overwrites
      if (isCredentialFile(targetPath) || isSensitiveSystemPath(targetPath)) {
        if (!ctx.hasUI || !ctx.ui) {
          return {
            block: true,
            reason: `[SECRET PROTECTION]: Modifying sensitive file "${targetPath}" is blocked in headless mode.`
          };
        }

        const approved = await ctx.ui.confirm(
          "⚠️ Sensitive File Modification",
          `The agent wants to write/edit sensitive file:\n\n${targetPath}\n\nAllow modification?`,
          { timeout: CONFIRM_TIMEOUT_MS }
        );

        if (!approved) {
          return {
            block: true,
            reason: `[SECRET PROTECTION BLOCKED BY USER]: Modifying "${targetPath}" was denied by user.`
          };
        }
      }

      // 2. Out of Workspace Confinement
      if (isOutsideWorkspace(targetPath)) {
        const workspace = getWorkspaceRoot();
        if (!ctx.hasUI || !ctx.ui) {
          return {
            block: true,
            reason: `[WORKSPACE CONFINEMENT]: File "${targetPath}" is outside the active workspace "${workspace}". Blocked in headless mode.`
          };
        }

        const approved = await ctx.ui.confirm(
          "⚠️ Out-of-Workspace Modification",
          `Target: ${targetPath}\nWorkspace: ${workspace}\n\nThe agent is attempting to modify a file outside the project workspace.\n\nAllow modification?`,
          { timeout: CONFIRM_TIMEOUT_MS }
        );

        if (!approved) {
          return {
            block: true,
            reason: `[WORKSPACE CONFINEMENT BLOCKED BY USER]: Modification outside workspace "${workspace}" was denied.`
          };
        }
      }
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    if (typeof pi.getFlag === "function" && pi.getFlag("no-permissions-gate") === true) {
      gateEnabled = false;
    }
    if (!gateEnabled) {
      ctx.ui.setStatus("permissions-gate", "⚠️ Permissions-Gate: OFF");
    }
  });
}