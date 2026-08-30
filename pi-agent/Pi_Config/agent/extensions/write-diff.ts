/**
 * @fileoverview Enhanced Write Diff Visualizer Extension for Pi Coding Agent.
 *
 * Replaces the default `write` tool with a clean, theme-integrated file writer that:
 * 1. Uses Pi's native, battle-tested `generateDiffString` and `renderDiff` engines.
 * 2. Renders accurate line-numbered diffs with intra-line token highlights on file overwrites.
 * 3. Supports collapsible 12-line previews with `ctrl+o` expand/collapse in interactive mode.
 *
 * Mutual Exclusivity:
 * Exits early if an active `--ssh` session is requested so `ssh.ts` can register
 * the remote SFTP write transport without tool registration collisions.
 */

import {
  createWriteTool,
  generateDiffString,
  highlightCode,
  renderDiff,
} from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";
import * as fsSync from "node:fs";
import * as path from "node:path";

/**
 * Formats a native Pi diff string for TUI display with optional line truncation.
 */
function formatNativeDiff(filePath: string, diffText: string, theme: any, expanded = false): string {
  let renderedBody: string;
  try {
    renderedBody = renderDiff(diffText);
  } catch {
    // Fallback if theme is uninitialized in headless test runner
    renderedBody = diffText;
  }

  const lines = renderedBody.split(/\r?\n/);
  const totalLines = lines.length;
  const maxLines = expanded ? totalLines : 12;
  const displayed = lines.slice(0, maxLines);
  const remaining = totalLines - maxLines;

  const header = theme.fg("accent", "⚡ Overwrite Diff: ") + theme.bold(path.basename(filePath)) + "\n";
  let output = header + displayed.join("\n");

  if (remaining > 0) {
    output += `\n${theme.fg("muted", `... (${remaining} more lines, `)}${theme.fg("accent", "ctrl+o")}${theme.fg("muted", " to expand)")}`;
  }

  return output;
}

/**
 * Extension entrypoint for Write Diff Visualizer.
 */
export default function (pi: ExtensionAPI) {
  // Mutually exclusive: Exit early if remote SSH session is active
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

  pi.registerTool({
    ...localWrite,
    prepareArguments(args: any) {
      if (!args || typeof args !== "object") return args;
      return {
        path: args.path ?? "",
        content: args.content ?? ""
      };
    },
    renderCall(args: any, theme: any, _renderCtx: any) {
      const rawPath = args?.path ?? "file";
      return new Text(theme.fg("toolTitle", theme.bold("write")) + " " + theme.fg("accent", rawPath), 0, 0);
    },
    async execute(id, params: any, signal, onUpdate, _ctx) {
      const rawPath = params.path ?? "";
      const content = params.content ?? "";
      let oldContent: string | null = null;
      let isOverwrite = false;

      const absPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(localCwd, rawPath);
      if (fsSync.existsSync(absPath)) {
        try {
          oldContent = fsSync.readFileSync(absPath, "utf-8");
          isOverwrite = true;
        } catch {
          oldContent = null;
        }
      }

      const result: any = await localWrite.execute(id, { path: rawPath, content }, signal, onUpdate);

      if (isOverwrite && oldContent !== null && oldContent !== content && !result.isError) {
        const diffObj = generateDiffString(oldContent, content);
        const relPath = path.relative(localCwd, absPath);
        result.details = { isOverwrite: true, diff: diffObj.diff, filePath: relPath, content };
      } else if (isOverwrite && oldContent === content && !result.isError) {
        const relPath = path.relative(localCwd, absPath);
        result.details = { isOverwrite: true, noChanges: true, filePath: relPath };
      } else if (!isOverwrite && !result.isError) {
        const relPath = path.relative(localCwd, absPath);
        result.details = { isOverwrite: false, content, lineCount: content.split(/\r?\n/).length, filePath: relPath };
      }

      return result;
    },
    renderResult(result: any, options: any, theme: any, renderCtx: any) {
      if (result.isError) {
        const text = result.content?.[0]?.text || "Write error";
        return new Text(theme.fg("error", text), 0, 0);
      }

      const isExpanded = Boolean(options?.expanded || renderCtx?.expanded);
      const details = result.details;

      if (details?.noChanges) {
        return new Text(theme.fg("muted", "✓ no changes"), 0, 0);
      }

      if (details?.isOverwrite && details.diff) {
        const formatted = formatNativeDiff(details.filePath, details.diff, theme, isExpanded);
        return new Text(formatted, 0, 0);
      }

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

      const component = renderCtx?.lastComponent instanceof Container ? renderCtx.lastComponent : new Container();
      component.clear();
      return component;
    }
  });
}
