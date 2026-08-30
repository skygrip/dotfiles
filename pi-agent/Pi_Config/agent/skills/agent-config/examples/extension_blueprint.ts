/**
 * @fileoverview Custom Pi Coding Agent Extension Blueprint.
 * @description Demonstrates custom tools, commands, and non-conflicting event hooks.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType, isWriteToolResult } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";

export default function (pi: ExtensionAPI) {
  // 1. Register a custom tool (Unique name)
  pi.registerTool({
    name: "custom_tool_name",
    label: "Custom Tool",
    description: "Executes custom analysis or action.",
    promptGuidelines: ["Specific constraint or boundary rule for tool use."],
    parameters: Type.Object({
      inputPath: Type.String({ description: "Path to input file" }),
      dryRun: Type.Optional(Type.Boolean({ description: "If true, previews without modifying" }))
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      // Headless / CI fallback check
      if (!ctx.hasUI || !ctx.ui) {
        return {
          content: [{ type: "text", text: `Processed in headless mode: ${params.inputPath}` }],
          details: { handled: true }
        };
      }

      return {
        content: [{ type: "text", text: `Success: processed ${params.inputPath}` }],
        details: { status: "ok" }
      };
    },
    renderCall(args, theme, _ctx) {
      return new Text(theme.fg("toolTitle", "custom_tool_name") + `: ${args.inputPath}`, 0, 0);
    }
  });

  // 2. Register an interactive slash command
  pi.registerCommand("mycommand", {
    description: "Custom slash command. Usage: /mycommand [arg]",
    handler: async (args: any, ctx: any) => {
      ctx.ui.notify("Command executed successfully", "info");
    }
  });

  // 3. Pre-execution Lifecycle Hook (tool_call: argument patching & safety checks)
  pi.on("tool_call", async (event, ctx) => {
    if (isToolCallEventType("bash", event)) {
      if (event.input.command?.includes("dangerous_cmd")) {
        return { block: true, reason: "Blocked by safety policy." };
      }
    }
  });

  // 4. Post-execution Lifecycle Hook (tool_result: output enrichment)
  pi.on("tool_result", async (event, ctx) => {
    if (isWriteToolResult(event)) {
      // Non-destructively enrich or format tool output
    }
  });
}
