import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let isGateEnabled = true;

  const dangerousBashPatterns = [
    // RM commands (recursive/force, Unix/Windows equivalents)
    /\brm\s+-[rRfF]+/i,
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
   * Regex matching known credential/secret file basenames.
   * Used to gate read access to high-value files.
   */
  const credentialFilePatterns = /(?:^|\/)(?:\.env(?:\..+)?|id_rsa|id_ed25519|id_ecdsa|id_dsa|\.ssh\/config|\.ssh\/known_hosts|\.netrc|\.pgpass)$|\.(?:pem|key)$/i;

  /**
   * Checks if a file path targets a sensitive location that should be gated.
   * Handles both Windows-local and Unix-remote (SSH) paths correctly by avoiding
   * path.resolve() on Unix-absolute paths when running on Windows.
   * 
   * @param filePath - The path to check.
   * @param workspaceRoot - Optional Unix-style remote workspace root (used in SSH mode
   *   to resolve relative paths correctly).
   */
  function isSensitivePath(filePath: string, workspaceRoot?: string): boolean {
    if (!filePath) return false;

    const raw = filePath.replace(/\\/g, "/");

    // Check the raw input for relative .git / .env patterns before resolve can corrupt them.
    // (path.resolve turns ".git" into "C:\...\project\.git" — absolute — so these checks
    //  must run against the original value.)
    if (raw === ".git" || raw.startsWith(".git/")) return true;
    if (/(?:^|\/)\.env(?:\..+)?$/.test(raw)) return true;

    // For Unix absolute paths (common during SSH from a Windows host), do NOT run through
    // path.resolve — on Windows that would turn "/etc/hosts" into "C:\etc\hosts".
    const isUnixAbsolute = filePath.startsWith("/");
    let normalized: string;
    if (isUnixAbsolute) {
      normalized = raw.toLowerCase();
    } else if (workspaceRoot) {
      // Resolve relative path against remote workspace root in SSH/Unix mode using POSIX normalization
      normalized = path.posix.normalize(workspaceRoot + "/" + raw).toLowerCase();
    } else {
      try {
        normalized = path.resolve(filePath).replace(/\\/g, "/").toLowerCase();
      } catch {
        normalized = raw.toLowerCase();
      }
    }
    
    // Git internals (absolute paths)
    if (normalized.includes("/.git/") || normalized.endsWith("/.git")) return true;

    // Sensitive env files (absolute paths — basename-anchored to avoid false positives
    // on paths like "src/environment.ts" or "dev.environment.d/")
    if (/(?:^|\/)\.env(?:\..+)?$/.test(normalized)) return true;
    
    // Sensitive Windows folders (case insensitive, matches any drive letter)
    if (/^[a-z]:\/(windows|program files)/i.test(normalized)) return true;

    // Sensitive Unix directories
    if (/^\/(etc|var|usr|bin|sbin|lib|sys|proc|dev|boot|root)\b/i.test(normalized)) return true;
    
    return false;
  }

  /**
   * Checks if a file path is outside the project workspace.
   * 
   * @param filePath - The path to check.
   * @param workspaceRoot - Optional Unix-style remote workspace root (used in SSH mode
   *   to compare and resolve relative paths correctly).
   */
  function isOutsideWorkspace(filePath: string, workspaceRoot?: string): boolean {
    if (!filePath) return false;

    // For Unix absolute paths (common during SSH), don't corrupt with Windows path.resolve
    const isUnixAbsolute = filePath.startsWith("/");
    let absolutePath: string;
    if (isUnixAbsolute) {
      absolutePath = filePath;
    } else if (workspaceRoot) {
      // In SSH mode, resolve relative paths against the remote Unix CWD using POSIX normalization
      absolutePath = path.posix.normalize(workspaceRoot + "/" + filePath.replace(/\\/g, "/"));
    } else {
      try {
        absolutePath = path.resolve(filePath);
      } catch {
        absolutePath = filePath;
      }
    }

    const workspaceDir = (workspaceRoot ?? path.resolve(process.cwd()))
      .replace(/\\/g, "/").toLowerCase();
    const normalizedFile = absolutePath.replace(/\\/g, "/").toLowerCase();

    // Check if the path is exactly the workspace directory or inside it
    const isInside = normalizedFile === workspaceDir || normalizedFile.startsWith(workspaceDir + "/");
    return !isInside;
  }

  /**
   * Resolves the effective workspace root for out-of-workspace checks.
   * In SSH mode, attempts to determine the remote CWD from the --ssh flag value or
   * the shared process.env.PI_SSH_REMOTE_CWD set by ssh.ts.
   */
  function getWorkspaceRoot(isSshActive: boolean): string | undefined {
    if (!isSshActive) return undefined; // Use default (local process.cwd())

    const sshArg = pi.getFlag("ssh") as string | undefined;
    if (sshArg) {
      // Parse user@host:/remote/path — the colon separates host from path
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

  // Register a command to check status or toggle
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

  pi.on("tool_call", async (event: any, ctx: any) => {
    if (!isGateEnabled) return undefined;

    // Detect SSH mode for workspace-boundary logic
    const isSshActive = !!pi.getFlag("ssh");

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

    // 2. Credential file read-gating
    if (event.toolName === "read") {
      const filePath = typeof event.input?.path === "string" ? event.input.path : "";

      if (filePath && credentialFilePatterns.test(filePath.replace(/\\/g, "/"))) {
        if (!ctx.hasUI || !ctx.ui) {
          return { block: true, reason: `Read of credential file "${filePath}" blocked in headless mode.` };
        }

        const choice = await ctx.ui.select(
          `⚠️ Read access to credential/secret file detected!\n\n  ${filePath}\n\nDo you want to allow this operation?`,
          ["No, Block it", "Yes, Allow it"]
        );

        if (choice !== "Yes, Allow it") {
          return { block: true, reason: "Blocked by user (credential file read protection active)" };
        }
      }
    }

    // 3. Sensitive path or Out-of-Workspace validation (write / edit tools)
    if (event.toolName === "write" || event.toolName === "edit") {
      const filePath = typeof event.input?.path === "string" ? event.input.path : "";

      if (filePath) {
        const workspaceRoot = getWorkspaceRoot(isSshActive);
        const isSensitive = isSensitivePath(filePath, workspaceRoot);

        // Workspace-boundary check: in SSH mode, compare against the remote workspace
        // root if known. If the remote CWD can't be determined (no path in --ssh flag),
        // skip the boundary check and relies on isSensitivePath alone.
        const canCheckBoundary = !isSshActive || workspaceRoot !== undefined;
        const isOutside = canCheckBoundary && isOutsideWorkspace(filePath, workspaceRoot);

        if (isSensitive || isOutside) {
          if (!ctx.hasUI || !ctx.ui) {
            const reason = isSensitive 
              ? `Modification of sensitive path "${filePath}" blocked in headless mode.`
              : `Out-of-workspace file modification on "${filePath}" blocked in headless mode.`;
            return { block: true, reason };
          }

          const messageTitle = isSensitive
            ? `⚠️ Modification of sensitive path detected!\n\n  ${filePath}`
            : `⚠️ File modification OUTSIDE the project workspace detected!\n\n  ${filePath}`;

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