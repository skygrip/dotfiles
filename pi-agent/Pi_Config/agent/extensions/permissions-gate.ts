/**
 * @fileoverview Pi Coding Agent Permissions Gate Extension.
 * @description Intercepts bash commands and file operations (read/write/edit) to enforce:
 *   1. Dangerous command blocking (e.g. recursive deletes, privilege escalation, disk/partition wipe).
 *   2. Agent recursion prevention (blocks nested 'pi' invocation).
 *   3. Secret & credential read protection (e.g. .env, ssh keys, AWS/Kube/Docker configs, shadow/sudoers).
 *   4. Sensitive system folder protection (e.g. /etc, /System, ~/Library, C:\Windows, ~/.ssh, ~/.bashrc).
 *   5. Out-of-workspace boundary enforcement with cross-platform path canonicalization,
 *      environment variable expansion (%VAR%, $VAR, ${VAR}), and tilde (~) resolution.
 * @author Glen
 * @version 1.2.1
 */

import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let isGateEnabled = true;

  /**
   * High-risk terminal command patterns that require explicit user approval
   * in interactive mode, and are automatically rejected in headless mode.
   */
  const dangerousBashPatterns = [
    // RM commands (recursive/force, Unix/Windows equivalents)
    /\brm\s+.*(?:-[a-zA-Z]*[rR]|--recursive)\b/i,
    /\b(Remove-Item|del|rm|ri)\b.*-(Recurse|Force)/i,
    /\bdel\b.*(\/s|\/q|\/f)/i,
    /\b(rmdir|rd)\b.*(\/s|-Recurse)/i,
    
    // Privilege escalation / admin / local accounts / user modification
    /\bsudo\b/i,
    /\bnet\s+(user|localgroup|group)\s+/i,
    /\b(passwd|useradd|groupadd|userdel|groupdel|usermod)\b/i,
    
    // Permissions and ACL modifications
    /\bchmod\b/i,
    /\bchown\b/i,
    /\bicacls\b/i,
    /\bcacls\b/i,
    /\btakeown\b/i,
    /\bchattr\b/i,
    
    // Git destructive operations
    /\bgit\s+reset\s+--(hard|mixed)/i,
    /\bgit\s+clean\s+-[fdx]+/i,
    /\bgit\s+push\b.*(--force\b|\s-f(?:\s|$)|\+)/i,
    /\bgit\s+branch\s+-[dD]\b/i,

    // Disk/Partition manipulation and destructive copying
    /\b(format|mkfs|fdisk|parted|wipefs|blkdiscard)\b/i,
    /\bdd\s+.*(if=|of=)/i,

    // System Shutdown / Reboot
    /\b(shutdown|reboot|poweroff|init\s+0)\b/i,

    // Service and Registry manipulation
    /(?:^|[;&|]\s*)sc(?:\.exe)?\s+(config|create|delete|start|stop)\b/i,
    /\breg\s+(add|delete|import|export)\b/i,

    // Dangerous download & execution (Pipe-to-shell, WebClient IEX)
    /\|\s*(bash|sh|zsh|powershell|pwsh)\b/i,
    /\b(iex|Invoke-Expression)\b/i,
    /new-object\s+system\.net\.webclient/i,

    // Nested SSH tunnelling / data exfiltration (prevents agent hopping to other machines)
    /\bssh\s+/i,
    /\b(scp|rsync)\s+/i,
  ];

  /**
   * Regex matching known credential, secret, and authentication token file basenames/paths.
   * Used to gate read access to high-value credentials and private keys.
   */
  const credentialFilePatterns = /(?:^|\/)(?:\.env(?:\..+)?|id_rsa|id_ed25519|id_ecdsa|id_dsa|\.ssh\/(?:config|known_hosts|authorized_keys)|\.aws\/(?:credentials|config)|\.docker\/config\.json|\.kube\/(?:config|.*token.*)|\.npmrc|\.pypirc|\.cargo\/credentials(?:\.toml)?|\.git-credentials|\.netrc|\.pgpass|shadow|sudoers)$|\.(?:pem|key|pfx|p12|pkcs12)$/i;

  /**
   * Helper to retrieve common cross-platform environment variables with fallbacks.
   */
  function getEnvVar(name: string): string | undefined {
    if (process.env[name] !== undefined) {
      return process.env[name];
    }
    // Cross-platform fallbacks for HOME / USERPROFILE / TMPDIR
    if (name === "HOME" || name === "USERPROFILE") {
      return process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
    }
    if (name === "TMPDIR" || name === "TEMP" || name === "TMP") {
      return process.env.TMPDIR ?? process.env.TEMP ?? process.env.TMP ?? os.tmpdir();
    }
    return undefined;
  }

  /**
   * Canonicalizes and fully expands a file path by:
   * 1. Expanding Windows environment variables (%VAR%) via process.env.
   * 2. Expanding POSIX environment variables ($VAR, ${VAR}) via process.env.
   * 3. Expanding tilde (~) to os.homedir() (or remote home marker in SSH).
   * 4. Normalizing Git Bash drive paths (/c/... -> C:/...) on Windows hosts.
   * 5. Resolving relative paths, dot-dot (..) segments, and path separators.
   * 
   * @param filePath - The raw input path from the tool call.
   * @param isSshActive - Whether the session is operating in remote SSH mode.
   * @param workspaceRoot - The remote workspace root directory (if in SSH mode).
   * @returns Canonical path, whether any unresolvable variables exist, and if it targets home.
   */
  function expandPath(
    filePath: string,
    isSshActive: boolean,
    workspaceRoot?: string
  ): { canonicalPath: string; hasUnresolvedVars: boolean; isHomePath: boolean } {
    if (!filePath) return { canonicalPath: "", hasUnresolvedVars: false, isHomePath: false };

    let p = filePath.trim();

    // 1. Expand Windows-style environment variables: %VAR%
    p = p.replace(/%([^%]+)%/g, (_, name) => {
      const val = getEnvVar(name);
      return val !== undefined ? val : `__UNRESOLVED_${name}__`;
    });

    // 2. Expand POSIX-style environment variables:
    // a) Explicitly wrapped: ${VAR}
    p = p.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_, name) => {
      const val = getEnvVar(name);
      return val !== undefined ? val : `__UNRESOLVED_${name}__`;
    });

    // b) Unwrapped at segment boundary: $VAR (e.g. $HOME/..., /$USER/...)
    // Avoids false positives on valid filename identifiers like user$.ts
    p = p.replace(/(^|[\/\\])\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, prefix, name) => {
      const val = getEnvVar(name);
      if (val !== undefined) {
        return prefix + val;
      }
      return `${prefix}__UNRESOLVED_${name}__`;
    });

    // Flag if any environment variable could not be resolved statically
    const hasUnresolvedVars = p.includes("__UNRESOLVED_");

    // Standardize slashes to forward slashes for uniform analysis
    p = p.replace(/\\/g, "/");

    // 3. Tilde expansion (~, ~/, ~\, ~user)
    let isHomePath = false;
    if (p === "~" || p.startsWith("~/") || p.startsWith("~\\") || /^~[a-zA-Z0-9_-]+(\/|$)/.test(p)) {
      isHomePath = true;
      if (isSshActive) {
        // In remote SSH mode, ~ represents the remote user's home directory.
        p = p.startsWith("~") ? "/~" + p.slice(1) : p;
      } else {
        if (p === "~" || p.startsWith("~/") || p.startsWith("~\\")) {
          const home = os.homedir().replace(/\\/g, "/");
          p = home + p.slice(1);
        } else {
          // ~otheruser path in local mode
          p = "/home/" + p.slice(1);
        }
      }
    }

    // 4. Git Bash / MSYS drive path normalization on Windows: /c/Users/... -> C:/Users/...
    if (!isSshActive && process.platform === "win32" && /^\/([a-zA-Z])\//.test(p)) {
      p = p.replace(/^\/([a-zA-Z])\//, (_, drive) => `${drive.toUpperCase()}:/`);
    }

    // 5. Canonical Path Resolution
    let canonicalPath: string;
    const isUnixAbsolute = p.startsWith("/");

    if (isSshActive) {
      if (isUnixAbsolute) {
        canonicalPath = path.posix.normalize(p);
      } else if (workspaceRoot) {
        canonicalPath = path.posix.normalize(workspaceRoot.replace(/\\/g, "/") + "/" + p);
      } else {
        canonicalPath = path.posix.normalize(p);
      }
    } else {
      try {
        canonicalPath = path.resolve(p).replace(/\\/g, "/");
      } catch {
        canonicalPath = p;
      }
    }

    // Check if canonical path resides within local user home directory
    if (!isSshActive && !isHomePath) {
      const homeNormalized = os.homedir().replace(/\\/g, "/").toLowerCase();
      const canonicalLower = canonicalPath.toLowerCase();
      if (canonicalLower === homeNormalized || canonicalLower.startsWith(homeNormalized + "/")) {
        isHomePath = true;
      }
    }

    return { canonicalPath, hasUnresolvedVars, isHomePath };
  }

  /**
   * Checks if a file path targets a sensitive system or user configuration location.
   * Covers Git internals, .env files, OS system directories (Windows, Linux, macOS),
   * and user shell/startup/keychain configurations.
   * 
   * @param filePath - The path to check.
   * @param isSshActive - Whether running in remote SSH mode.
   * @param workspaceRoot - Optional remote workspace root.
   */
  function isSensitivePath(filePath: string, isSshActive: boolean, workspaceRoot?: string): boolean {
    if (!filePath) return false;

    const { canonicalPath, hasUnresolvedVars, isHomePath } = expandPath(filePath, isSshActive, workspaceRoot);

    // Fail-closed on unresolved variables in path
    if (hasUnresolvedVars) return true;

    const rawLower = filePath.replace(/\\/g, "/").toLowerCase();
    const normalizedLower = canonicalPath.toLowerCase();

    // Check raw input & canonical path for .git / .env
    if (rawLower === ".git" || rawLower.startsWith(".git/")) return true;
    if (normalizedLower.includes("/.git/") || normalizedLower.endsWith("/.git")) return true;
    if (/(?:^|\/)\.env(?:\..+)?$/.test(rawLower) || /(?:^|\/)\.env(?:\..+)?$/.test(normalizedLower)) return true;

    // Sensitive Home Directory files & folders (handles Windows, Linux ~/.config, and macOS ~/Library)
    if (/(?:^|\/)(?:\.ssh|\.aws|\.gnupg|\.kube|\.docker|\.config|\.bashrc|\.zshrc|\.profile|\.bash_profile|\.gitconfig|\.npmrc|\.pypirc|\.cargo|\.git-credentials|Library\/Keychains)(?:\/|$)/i.test(normalizedLower) ||
        /(?:^|\/)(?:\.ssh|\.aws|\.gnupg|\.kube|\.docker|\.config|\.bashrc|\.zshrc|\.profile|\.bash_profile|\.gitconfig|\.npmrc|\.pypirc|\.cargo|\.git-credentials|Library\/Keychains)(?:\/|$)/i.test(rawLower)) {
      return true;
    }

    // Sensitive Windows folders
    if (/^[a-z]:\/(windows|program files|program files \(x86\)|programdata)/i.test(normalizedLower)) return true;

    // Sensitive Unix & macOS system directories (with optional drive prefix for Windows Git Bash)
    if (/^(?:[a-z]:)?\/(etc|var|usr|bin|sbin|lib|sys|proc|dev|boot|root|System|Library|private)\b/i.test(normalizedLower) ||
        /^\/(etc|var|usr|bin|sbin|lib|sys|proc|dev|boot|root|System|Library|private)\b/i.test(rawLower)) {
      return true;
    }

    return false;
  }

  /**
   * Checks if a file path falls outside the current project workspace directory.
   * Handles local workspaces (with root drive edge-case protection) and remote SSH workspaces.
   * 
   * @param filePath - The path to check.
   * @param isSshActive - Whether running in remote SSH mode.
   * @param workspaceRoot - Optional remote workspace root.
   */
  function isOutsideWorkspace(filePath: string, isSshActive: boolean, workspaceRoot?: string): boolean {
    if (!filePath) return false;

    const { canonicalPath, hasUnresolvedVars, isHomePath } = expandPath(filePath, isSshActive, workspaceRoot);

    // Fail-closed on unresolved environment variables
    if (hasUnresolvedVars) return true;

    const rawWorkspace = (workspaceRoot ?? path.resolve(process.cwd())).replace(/\\/g, "/").toLowerCase();
    const cleanWorkspaceDir = rawWorkspace.endsWith("/") && rawWorkspace.length > 1 ? rawWorkspace.slice(0, -1) : rawWorkspace;
    const normalizedFile = canonicalPath.toLowerCase();

    // In SSH mode with ~, unless the workspace itself is ~ or the home directory, it's outside workspace
    if (isHomePath && isSshActive) {
      const wsNormalized = (workspaceRoot ?? "").replace(/\\/g, "/").toLowerCase();
      if (wsNormalized !== "~" && wsNormalized !== "/~" && !wsNormalized.startsWith("/home/")) {
        return true;
      }
    }

    // Check if the path is exactly the workspace directory or inside it
    const isInside = cleanWorkspaceDir === "/"
      ? true
      : normalizedFile === cleanWorkspaceDir || normalizedFile.startsWith(cleanWorkspaceDir.endsWith("/") ? cleanWorkspaceDir : cleanWorkspaceDir + "/");
    return !isInside;
  }

  /**
   * Resolves the effective workspace root for out-of-workspace checks.
   * In SSH mode, parses the --ssh flag or retrieves process.env.PI_SSH_REMOTE_CWD set by ssh.ts.
   */
  function getWorkspaceRoot(isSshActive: boolean): string | undefined {
    if (!isSshActive) return undefined; // Use default (local process.cwd())

    const sshArg = pi.getFlag("ssh") as string | undefined;
    if (sshArg) {
      const colonIdx = sshArg.indexOf(":");
      if (colonIdx !== -1) {
        const remotePath = sshArg.slice(colonIdx + 1);
        if (remotePath) return remotePath;
      }
    }

    // Fallback: Check if ssh.ts shared the dynamically resolved remote CWD
    if (process.env.PI_SSH_REMOTE_CWD) {
      return process.env.PI_SSH_REMOTE_CWD;
    }

    return undefined;
  }

  // Register command to check status or toggle permission gate
  pi.registerCommand("gate", {
    description: "Toggle or check status of the permissions gate. Usage: /gate [on|off]",
    handler: async (args: any, ctx: any) => {
      const isString = typeof args === "string";
      const hasOn = isString ? args.trim().toLowerCase() === "on" : Array.isArray(args) && args.includes("on");
      const hasOff = isString ? args.trim().toLowerCase() === "off" : Array.isArray(args) && args.includes("off");

      if (hasOn) {
        isGateEnabled = true;
        ctx.ui.notify("Permissions Gate is now ENABLED", "info");
      } else if (hasOff) {
        isGateEnabled = false;
        ctx.ui.notify("⚠️ Permissions Gate is now DISABLED", "warning");
      } else {
        isGateEnabled = !isGateEnabled;
        const status = isGateEnabled ? "ENABLED" : "DISABLED";
        const type = isGateEnabled ? "info" : "warning";
        ctx.ui.notify(`Permissions Gate is now ${status}`, type);
      }
    }
  });

  // Intercept tool calls before execution to enforce safety policies
  pi.on("tool_call", async (event: any, ctx: any) => {
    if (!isGateEnabled) return undefined;

    // Detect SSH mode for workspace-boundary logic
    const isSshActive = !!pi.getFlag("ssh");
    const workspaceRoot = getWorkspaceRoot(isSshActive);

    // 1. Bash command validation
    if (event.toolName === "bash") {
      const command = typeof event.input?.command === "string" ? event.input.command : "";

      // Prevent recursive / nested Pi execution (hard block to prevent agent nesting / loops)
      const recursivePiPatterns = [
        /(?:^|[;&|`\n]|\bdo|\bthen)\s*(?:[A-Z0-9_]+=\S+\s+)*\bpi\b/i,
        /\bnpx\s+(@[a-z0-9-]+\/)?pi\b/i,
        /\b(npm|yarn|pnpm|bun|deno)\s+(run\s+|exec\s+)?pi\b/i
      ];
      const matchedRecursivePi = recursivePiPatterns.find((p) => p.test(command));
      if (matchedRecursivePi) {
        return { block: true, reason: `Recursive execution of "pi" is blocked to prevent agent nesting / loops.` };
      }

      const matchedPattern = dangerousBashPatterns.find((p) => p.test(command));

      if (matchedPattern) {
        if (!ctx.hasUI || !ctx.ui) {
          return { block: true, reason: `Dangerous command "${command}" blocked in headless mode (matched: ${matchedPattern}).` };
        }

        const choice = await ctx.ui.select(
          `⚠️ Dangerous command detected!\n\n  ${command}\n\nMatched Safety Pattern: ${matchedPattern}\nDo you want to allow this operation?`,
          ["No, Block it", "Yes, Allow it"]
        );

        if (choice !== "Yes, Allow it") {
          return { block: true, reason: `Blocked by user (matched dangerous pattern: ${matchedPattern})` };
        }
      }
    }

    // 2. Credential and Sensitive file read-gating
    if (event.toolName === "read") {
      const filePath = typeof event.input?.path === "string" ? event.input.path : "";

      if (filePath) {
        const { canonicalPath, hasUnresolvedVars, isHomePath } = expandPath(filePath, isSshActive, workspaceRoot);
        const rawLower = filePath.replace(/\\/g, "/").toLowerCase();
        const canonicalLower = canonicalPath.toLowerCase();

        const isSensitive = isSensitivePath(filePath, isSshActive, workspaceRoot);
        const isCredential = isSensitive ||
                             credentialFilePatterns.test(rawLower) ||
                             credentialFilePatterns.test(canonicalLower) ||
                             hasUnresolvedVars ||
                             (isHomePath && /(?:^|\/)(?:\.ssh|\.aws|\.gnupg|\.kube|\.docker|\.config|\.git-credentials|\.npmrc|\.pypirc|\.cargo|\.bash_history)(?:\/|$)/i.test(canonicalLower));

        if (isCredential) {
          if (!ctx.hasUI || !ctx.ui) {
            return { block: true, reason: `Read of credential/sensitive file "${filePath}" blocked in headless mode.` };
          }

          const choice = await ctx.ui.select(
            `⚠️ Read access to credential/sensitive file detected!\n\n  ${filePath}\n  (Resolved: ${canonicalPath})\n\nDo you want to allow this operation?`,
            ["No, Block it", "Yes, Allow it"]
          );

          if (choice !== "Yes, Allow it") {
            return { block: true, reason: "Blocked by user (credential/sensitive file read protection active)" };
          }
        }
      }
    }

    // 3. Sensitive path or Out-of-Workspace validation (write / edit tools)
    if (event.toolName === "write" || event.toolName === "edit") {
      const filePath = typeof event.input?.path === "string" ? event.input.path : "";

      if (filePath) {
        const { canonicalPath, hasUnresolvedVars } = expandPath(filePath, isSshActive, workspaceRoot);
        const isSensitive = isSensitivePath(filePath, isSshActive, workspaceRoot);

        // Workspace-boundary check: in SSH mode, compare against the remote workspace root if known.
        const canCheckBoundary = !isSshActive || workspaceRoot !== undefined;
        const isOutside = hasUnresolvedVars || (canCheckBoundary && isOutsideWorkspace(filePath, isSshActive, workspaceRoot));

        if (isSensitive || isOutside) {
          if (!ctx.hasUI || !ctx.ui) {
            const reason = isSensitive 
              ? `Modification of sensitive path "${filePath}" blocked in headless mode.`
              : `Out-of-workspace file modification on "${filePath}" blocked in headless mode.`;
            return { block: true, reason };
          }

          const messageTitle = isSensitive
            ? `⚠️ Modification of sensitive path detected!\n\n  ${filePath}\n  (Resolved: ${canonicalPath})`
            : `⚠️ File modification OUTSIDE the project workspace detected!\n\n  ${filePath}\n  (Resolved: ${canonicalPath})`;

          const choice = await ctx.ui.select(
            `${messageTitle}\n\nDo you want to allow this operation?`,
            ["No, Block it", "Yes, Allow it"]
          );

          if (choice !== "Yes, Allow it") {
            const blockReason = isSensitive 
              ? "Blocked by user (sensitive path protection active)" 
              : "Blocked by user (out-of-workspace write protection active)";
            return { block: true, reason: blockReason };
          }
        }
      }
    }

    return undefined;
  });
}