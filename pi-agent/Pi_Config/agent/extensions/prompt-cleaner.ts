import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Prompt Cleaner Extension for Pi Coding Agent.
 *
 * Intercepts the generated system prompt before it is sent to the LLM and strips
 * Pi's hardcoded "Available tools" text boilerplate. This allows the API's native
 * schema-defined tools to speak for themselves without confusing smaller/local models.
 */
export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event) => {
    let prompt = event.systemPrompt;

    // Remove the hardcoded "Available tools: ..." block and "In addition to the tools above..."
    prompt = prompt.replace(
      /Available tools:\s*[\s\S]*?In addition to the tools above[^\n]*\n+/g,
      ""
    );

    return { systemPrompt: prompt };
  });
}
