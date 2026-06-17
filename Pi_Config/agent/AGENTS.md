# Configuration File Blueprint
The following files control the operational states, capabilities, and instruction boundaries of your engine within this workspace. If the .pi directory or any of these configuration files do not exist, create them natively.

## Project-Local Core Layers
- ./.pi/AGENTS.md: The behavioral and task instruction layer. Enforces project personas, development styles, step-by-step methodologies, self-evolution logic, and workspace execution policies. It shapes how the agent thinks, communicates, and navigates tasks in this repository. 
  > Loaded: Injected into the prompt stack at every chat turn to establish ongoing behavioral context.
- ./.pi/APPEND_SYSTEM.md: The environmental and runtime constraint layer. Hardcodes the underlying infrastructure parameters, platform-specific shell defaults (e.g., PowerShell syntax), strict file line-ending mechanics, compiler/linter rules, and absolute tool execution boundaries. It defines the rigid rules of what the environment permits.
  > Loaded: Appended directly into the core system instruction layer on every single LLM call.
- ./.pi/skills/[skill_name]/SKILL.md: Workspace-local skills. The user can manually create new project-specific skill directories and markdown instruction files here.
  > Loaded: Dynamically on demand when explicitly triggered using the use command.
  > Structural Blueprint: Every SKILL.md must begin with a YAML frontmatter block containing a mandatory description field to prevent skill conflicts:
    ---
    description: Clear, concise summary of what this specific skill does and when the engine should pull it into execution context.
    ---
    # Skill Instructions
    - Specific workflow step 1
    - Specific workflow step 2
- ./.pi/prompts/[prompt_name].md: Prompt templates are Markdown snippets that expand into full prompts. 
  > Loaded: Instantly expanded into the chat input stream when typing /[prompt_name]. Requires a /reload to register new template shortcuts.
- ./.pi/extensions/[extension_name].ts: Workspace-local TypeScript modules. The user can manually create or modify custom .ts script files here to compile and build new custom tools directly into the active tool inventory for this repository. 
  > Loaded: Compiled and registered into the active tool-calling inventory only after running the /reload command.
  > Structural Blueprint: Extensions must export a default factory function accepting ExtensionAPI, utilizing TypeBox for parameters, and sourcing core types strictly from the agent harness:
    import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
    import { Type } from "@sinclair/typebox";
    export default function (pi: ExtensionAPI) {
      pi.registerTool({
        name: "custom_tool_name",
        description: "What the tool does",
        parameters: Type.Object({ ... }),
        async execute(id, params, signal, update, ctx) { ... }
      });
    }

# Project-Local Self-Evolution
- ./EVOLUTION.md: Dynamic long-term memory layer containing automated environment adjustments written by the agent inside the active repository. 
  > Loaded: Read continuously by the context retrieval loops during tool execution.
- Monitor Redundant Failures: If you encounter an execution, configuration, or tool error more than once and identify a definitive fix unique to this repository, treat this as permanent project memory.
- Record Successful Custom Commands: If you discover or construct a non-obvious, complex, or highly effective command (e.g., unique database migrations, test runs, environment setups, or build pipelines) that succeeds, treat this as permanent project knowledge. Autonomously document it in ./EVOLUTION.md under a 'Useful Commands' section so it can be reused in future sessions without re-discovery.
- Update Local Workspace Memory: Autonomously use the write or edit tool to append the rule or command directly to the bottom of ./EVOLUTION.md inside the current working directory. If ./EVOLUTION.md does not exist yet, create it with a clean markdown title header.
- Multi-Layer Evolution Evaluation: When capturing a workflow fix, evaluate the structural complexity of the lesson to determine the best target path for expansion:
  - For standard runtime workarounds or tool line-matching adjustments, append directly to ./EVOLUTION.md.
  - If a skill file is currently being executed, prioritize updating that skill's markdown file first while preserving its mandatory frontmatter description layout.
  - For complex or highly structured multi-step recovery workflows, consider framing the solution by writing a brand new dedicated skill file in ./.pi/skills/ with valid frontmatter or an isolated prompt template inside ./.pi/prompts/.
- Formulating System-Level Evolution: For permanent, unbreakable environment laws, architecture dependencies, or platform-level constraints discovered during troubleshooting, consider making clean additions to ./.pi/APPEND_SYSTEM.md to lock those rules into the core system layer. For overarching changes to persona, communication strategies, development philosophies, or task navigation policies, make corresponding clean additions to ./.pi/AGENTS.md.
- Context Window and Resource Guardrails: To maintain engine performance and prevent file corruption during autonomous updates, you must adhere to these operational constraints:
  - Context Bloat Prevention: Do not append long, verbose troubleshooting histories or raw execution logs to system-level files like ./.pi/APPEND_SYSTEM.md or ./.pi/AGENTS.md. Because these are injected on every turn, keeping them highly concise, only editing them when essential, protects token availability and minimizes inference latency. Use ./EVOLUTION.md or dedicated skills for specific codebase fixes.
  - Output Token Conservation: When appending rules or workarounds, keep updates focused and modular. Writing massive text blocks or completely rewriting files at the end of a long debugging session risks hitting maximum output token limits mid-write, causing file truncation or corruption. Utilize targeted edit patches and concise bullet points.
- Compilation and Refresh Boundaries: Understand that markdown memory files (./EVOLUTION.md, ./.pi/AGENTS.md) and on-demand skills (via the use command) are processed dynamically without engine interruptions. However, if changes or additions are made to programmatic extensions (.ts tools) or prompt templates, explicitly request the user to execute the /reload command so the updates compile.
- Formatting Guidelines: Write rules as clean, project-specific bullet points under explicit markdown headers describing the problem space. Do not modify configuration files directly unless addressing permanent, baseline system layer or behavioral policy adjustments.
- Notification: Notify the user immediately after updating a local file or creating a new asset so they know a project-specific memory or tool extension has been committed to the repository.