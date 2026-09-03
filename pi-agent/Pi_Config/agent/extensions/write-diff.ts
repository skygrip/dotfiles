/**
 * @fileoverview Enhanced Write Diff Visualizer Extension for Pi Coding Agent.
 *
 * -------------------------------------------------------------------------------------
 * Overview:
 * -------------------------------------------------------------------------------------
 * Replaces the default `write` tool with a clean, theme-integrated file visualizer that
 * provides immediate feedback on file modifications without altering Pi's core write semantics.
 *
 * -------------------------------------------------------------------------------------
 * Key Capabilities & Three-State Visual Feedback:
 * -------------------------------------------------------------------------------------
 * 1. File Overwrite Detection:
 *    Pre-reads existing files before write execution. If an existing file is modified,
 *    it generates a line-numbered, intra-line token-highlighted unified diff using Pi's
 *    native `generateDiffString()` and `renderDiff()` engines.
 * 2. New File Creation:
 *    For brand-new files, renders a syntax-highlighted code preview with total line counts.
 * 3. Identical / No-Op Overwrites:
 *    Detects when written content is byte-for-byte identical to existing content, rendering
 *    a clean, non-disruptive `✓ no changes` indicator.
 * 4. Interactive TUI Collapsing (`ctrl+o`):
 *    Collapses large diffs and long files to 10–12 line previews in the active terminal,
 *    with instant full-content expansion upon pressing `ctrl+o`.
 *
 * -------------------------------------------------------------------------------------
 * Mutual Exclusivity:
 * -------------------------------------------------------------------------------------
 * Exits immediately at startup if an active `--ssh` session is requested (via flag, env,
 * or CLI argument), allowing `ssh.ts` to take over the remote SFTP write transport without
 * tool registration collisions.
 */

import {
  createWriteTool,
  generateDiffString,
  highlightCode,
  renderDiff,
} from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import * as fsSync from "node:fs";
import * as path from "node:path";

/**
 * Formats a native Pi diff string for TUI display with optional line truncation.
 *
 * @param filePath Path to the modified file (used in header display).
 * @param diffText Raw diff output from Pi's `generateDiffString()`.
 * @param theme Pi TUI theme object supplying color and typography helpers.
 * @param expanded Whether to show the entire diff (true) or a 12-line preview (false).
 * @returns Formatted ANSI string ready for Text component rendering.
 */
function formatNativeDiff(filePath: string, diffText: string, theme: any, expanded = false): string {
  let renderedBody: string;
  try {
    // Render diff with syntax colors and gutter indicators via Pi's native renderer
    renderedBody = renderDiff(diffText);
  } catch {
    // Graceful fallback if theme is uninitialized in headless test environments
    renderedBody = diffText;
  }

  const lines = renderedBody.split(/\r?\n/);
  const totalLines = lines.length;
  const maxLines = expanded ? totalLines : 12;
  const displayed = lines.slice(0, maxLines);
  const remaining = totalLines - maxLines;

  const header = theme.fg("accent", "⚡ Overwrite Diff: ") + theme.bold(path.basename(filePath)) + "\n";
  let output = header + displayed.join("\n");

  // Append ctrl+o expansion hint if lines were truncated
  if (remaining > 0) {
    output += `\n${theme.fg("muted", `... (${remaining} more lines, `)}${theme.fg("accent", "ctrl+o")}${theme.fg("muted", " to expand)")}`;
  }

  return output;
}

/**
 * Extension entrypoint for Write Diff Visualizer.
 *
 * Registers the enhanced `write` tool with pre-execution overwrite detection
 * and native Pi TUI diff rendering.
 *
 * @param pi ExtensionAPI interface provided by Pi Agent.
 */
export default function (pi: ExtensionAPI) {
  // -----------------------------------------------------------------------------------
  // 1. Mutual Exclusivity Guard
  // -----------------------------------------------------------------------------------
  // If an SSH target is configured, yield write tool registration to ssh.ts
  const hasSsh = Boolean(
    (typeof pi.getFlag === "function" && pi.getFlag("ssh")) ||
    process.env.PI_SSH ||
    process.argv.some(arg => arg === "--ssh" || arg.startsWith("--ssh="))
  );

  if (hasSsh) {
    return;
  }

  const localCwd = process.cwd();
  const localWrite = createWriteTool(localCwd);

  // -----------------------------------------------------------------------------------
  // 2. Enhanced Write Tool Registration
  // -----------------------------------------------------------------------------------
  pi.registerTool({
    ...localWrite,

    /**
     * Pre-validation argument pass-through.
     * Enforces strict schema conformity without injecting unneeded parameter aliases.
     */
    prepareArguments(args: any) {
      if (!args || typeof args !== "object") return args;
      return {
        path: args.path ?? "",
        content: args.content ?? ""
      };
    },

    /**
     * Custom TUI header rendered when the tool call is initiated.
     */
    renderCall(args: any, theme: any, _renderCtx: any) {
      const rawPath = args?.path ?? "file";
      return new Text(theme.fg("toolTitle", theme.bold("write")) + " " + theme.fg("accent", rawPath), 0, 0);
    },

    /**
     * Executes the write operation while capturing pre-existing file state to compute diffs.
     */
    async execute(id, params: any, signal, onUpdate, _ctx) {
      const rawPath = params.path ?? "";
      const content = params.content ?? "";
      let oldContent: string | null = null;
      let isOverwrite = false;

      // Check if target file already exists on disk before performing write
      const absPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(localCwd, rawPath);
      const relPath = path.relative(localCwd, absPath);

      if (fsSync.existsSync(absPath)) {
        try {
          oldContent = fsSync.readFileSync(absPath, "utf-8");
          isOverwrite = true;
        } catch {
          oldContent = null;
        }
      }

      // Delegate actual file writing to Pi's robust native write handler
      const result: any = await localWrite.execute(id, { path: rawPath, content }, signal, onUpdate);

      // Attach structured details metadata for renderResult
      if (isOverwrite && oldContent !== null && oldContent !== content && !result.isError) {
        // State 1: Modified overwrite -> compute native diff
        const diffObj = generateDiffString(oldContent, content);
        result.details = { isOverwrite: true, diff: diffObj.diff, filePath: relPath, content };
      } else if (isOverwrite && oldContent === content && !result.isError) {
        // State 2: No-op overwrite -> identical content
        result.details = { isOverwrite: true, noChanges: true, filePath: relPath };
      } else if (!isOverwrite && !result.isError) {
        // State 3: Brand new file -> syntax preview with line counts
        result.details = { isOverwrite: false, content, lineCount: content.split(/\r?\n/).length, filePath: relPath };
      }

      return result;
    },

    /**
     * Renders the visual completion card in the terminal TUI.
     */
    renderResult(result: any, options: any, theme: any, renderCtx: any) {
      // 1. Error state
      if (result.isError) {
        const text = result.content?.[0]?.text || "Write error";
        return new Text(theme.fg("error", text), 0, 0);
      }

      const isExpanded = Boolean(options?.expanded || renderCtx?.expanded);
      const details = result.details;

      // 2. No changes state
      if (details?.noChanges) {
        return new Text(theme.fg("muted", "✓ no changes"), 0, 0);
      }

      // 3. Overwrite diff state
      if (details?.isOverwrite && details.diff) {
        const formatted = formatNativeDiff(details.filePath, details.diff, theme, isExpanded);
        return new Text(formatted, 0, 0);
      }

      // 4. New file syntax-highlighted preview state
      if (details && !details.isOverwrite && details.content) {
        const ext = path.extname(details.filePath || "").slice(1);
        let lines: string[];
        try {
          lines = highlightCode(details.content, ext);
        } catch {
          lines = details.content.split(/\r?\n/).map((l: string) => theme.fg("dim", l));
        }

        const totalLines = lines.length;
        const maxLines = isExpanded ? totalLines : 10;
        const displayLines = lines.slice(0, maxLines);
        const remaining = totalLines - maxLines;

        let body = displayLines.join("\n");
        if (remaining > 0) {
          body += `\n${theme.fg("muted", `... (${remaining} more lines, ${totalLines} total, `)}${theme.fg("accent", "ctrl+o")}${theme.fg("muted", " to expand)")}`;
        }
        return new Text(body, 0, 0);
      }

      return new Text("", 0, 0);
    }
  });
}
