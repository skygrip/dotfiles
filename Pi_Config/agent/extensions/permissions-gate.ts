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
    /\bgit\s+push\b.*(--force|-f|\+)/i,
    /\bgit\s+branch\s+-[dD]\b/i,

    // Disk/Partition manipulation and destructive copying
    /\b(format|mkfs|fdisk|parted)\b/i,
    /\bdd\s+if=/i,

    // System Shutdown / Reboot
    /\b(shutdown|reboot|poweroff|init\s+0)\b/i,

    // Service and Registry manipulation
    /\b(sc\s+(config|create|delete|start|stop))\b/i,
    /\breg\s+(add|delete|import|export)\b/i,

    // Dangerous download & execution (Pipe-to-shell, WebClient IEX)
    /\|\s*(bash|sh|zsh|powershell|pwsh)\b/i,
    /\b(iex|Invoke-Expression)\b/i,
    /new-object\s+system\.net\.webclient/i
  ];

  function isSensitivePath(filePath: string): boolean {
    if (!filePath) return false;
    
    // Resolve relative paths to absolute to prevent directory traversal bypasses
    let absolutePath = filePath;
    try {
      absolutePath = path.resolve(filePath);
    } catch {
      // Fallback to raw path if resolve fails
    }

    const normalized = absolutePath.replace(/\\/g, "/").toLowerCase();
    
    // 1. Git internals (covers absolute, sub-directories, relative, and exact matches)
    if (
      normalized.includes("/.git/") || 
      normalized.startsWith(".git/") ||
      normalized === ".git" || 
      normalized.endsWith("/.git")
    ) return true;
    
    // 2. Sensitive env files
    if (
      normalized === ".env" || 
      normalized.startsWith(".env/") ||
      normalized.endsWith("/.env") || 
      normalized.includes("/.env/") ||
      normalized.includes(".env.")
    ) return true;
    
    // 3. Sensitive Windows folders (case insensitive, matches any drive letter)
    if (/^[a-z]:\/(windows|program files)/i.test(normalized)) return true;

    // 4. Sensitive Unix directories
    if (/^\/(etc|var|usr|bin|sbin|lib|sys|proc|dev|boot|root)\b/i.test(normalized)) return true;
    
    return false;
  }

  function isOutsideWorkspace(filePath: string): boolean {
    if (!filePath) return false;
    
    let absolutePath = filePath;
    try {
      absolutePath = path.resolve(filePath);
    } catch {
      // Fallback
    }

    const workspaceDir = path.resolve(process.cwd()).replace(/\\/g, "/").toLowerCase();
    const normalizedFile = absolutePath.replace(/\\/g, "/").toLowerCase();

    // Check if the path is exactly the workspace directory or inside it
    const isInside = normalizedFile === workspaceDir || normalizedFile.startsWith(workspaceDir + "/");
    return !isInside;
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

    // Detect SSH mode. If active, bypass local file boundary constraints.
    const isSshActive = !!pi.getFlag("ssh");

    // 1. Bash command validation
    if (event.toolName === "bash") {
      const command = typeof event.input?.command === "string" ? event.input.command : "";
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

    // 2. Sensitive path or Out-of-Workspace validation (write / edit tools)
    if (event.toolName === "write" || event.toolName === "edit") {
      const filePath = typeof event.input?.path === "string" ? event.input.path : "";

      if (filePath) {
        // Only run the out-of-workspace check if we are acting locally
        const isOutside = !isSshActive && isOutsideWorkspace(filePath);
        // We still check sensitive paths globally (Unix checks will catch remote, Windows checks will catch local)
        const isSensitive = isSensitivePath(filePath);

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