import os from "node:os";
import { buildCodingAgentsPrompt, type CodingAgentsSettings } from "./agents.js";
import { buildDesignPrompt } from "./design-system/index.js";
import { buildSafetyGuidelines } from "./prompt-sections/safety-guidelines.js";
import { buildToneFormatting } from "./prompt-sections/tone-formatting.js";
import { formatSkillsForPrompt, type Skill } from "./skills.js";

export interface RoboticsFunction {
	name: string;
	description: string;
	parameters: Array<{ name: string; type: string; description: string }>;
}

export interface BuildSystemPromptOptions {
	customPrompt?: string;
	selectedTools?: string[];
	toolSnippets?: Record<string, string>;
	promptGuidelines?: string[];
	appendSystemPrompt?: string;
	affectivePrompt?: string;
	cwd: string;
	contextFiles?: Array<{ path: string; content: string }>;
	skills?: Skill[];
	agents?: CodingAgentsSettings;
	roboticsEnabled?: boolean;
	roboticsFunctions?: RoboticsFunction[];
	designMode?: boolean;
	compactMode?: boolean;
	/** Token budget for extended reasoning (Claude Fable 5 inspired) */
	thinkingBudget?: number;
}

export function buildSystemPrompt(options: BuildSystemPromptOptions): string {
	const {
		customPrompt,
		toolSnippets,
		appendSystemPrompt,
		affectivePrompt,
		cwd,
		selectedTools,
		contextFiles: providedContextFiles,
		skills: providedSkills,
		roboticsEnabled,
		roboticsFunctions,
		agents,
		designMode,
	} = options;

	if (!customPrompt) {
		return buildV48Prompt(options);
	}

	const tools = selectedTools || ["read", "bash", "edit", "write"];
	const visibleTools = tools.filter((name) => !!toolSnippets?.[name]);
	const toolsList =
		visibleTools.length > 0 ? visibleTools.map((name) => `- ${name}: ${toolSnippets![name]}`).join("\n") : "(none)";

	const now = new Date();
	const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

	let prompt = customPrompt;
	prompt += `\n\nTools:\n${toolsList}\navailable: invoke_subagent, task, ask_question`;
	if (appendSystemPrompt) prompt += `\n\n${appendSystemPrompt}`;
	if (affectivePrompt) prompt += `\n\n${affectivePrompt}`;
	if (agents) prompt += buildCodingAgentsPrompt(agents);

	const ctxFiles = providedContextFiles ?? [];
	if (ctxFiles.length > 0) {
		prompt += "\n\n<Ctx>";
		for (const { path: filePath, content } of ctxFiles) {
			const trimmed = content.split("\n").slice(0, 10).join("\n");
			prompt += `\n<f p="${filePath}">\n${trimmed}\n</f>`;
		}
		prompt += "\n</Ctx>";
	}

	const skills = providedSkills ?? [];
	const hasRead = !selectedTools || selectedTools.includes("read");
	if (hasRead && skills.length > 0) prompt += formatSkillsForPrompt(skills);

	prompt += `\n${d} | ${cwd.replace(/\\/g, "/")}`;

	if (designMode) prompt += buildDesignPrompt({ projectRoot: cwd });
	if (roboticsEnabled) prompt += buildRoboticsSystemPrompt(roboticsFunctions);

	return prompt;
}

function buildV48Prompt(options: BuildSystemPromptOptions): string {
	const {
		cwd,
		selectedTools,
		toolSnippets,
		appendSystemPrompt,
		contextFiles,
		agents,
		promptGuidelines,
		affectivePrompt,
	} = options;

	const memGB = Math.round(os.totalmem() / 1024 / 1024 / 1024);
	const cpus = os.cpus().length;

	const tools = selectedTools || [
		"read",
		"bash",
		"edit",
		"write",
		"grep",
		"find",
		"ls",
		"digest",
		"todo",
		"git_ship",
		"math_evaluate",
		"invoke_subagent",
		"ask_question",
	];
	const visibleTools = tools.filter((name) => !!toolSnippets?.[name]);
	const toolsList =
		visibleTools.length > 0 ? visibleTools.map((t) => `- ${t}: ${toolSnippets![t]}`).join("\n") : "(none)";

	const guidelines = promptGuidelines?.length ? promptGuidelines.map((g) => `- ${g}`).join("\n") : "";

	const now = new Date();
	const budget = options.thinkingBudget ?? 16000;

	let prompt = `<Astro:Genesis v="48">
Sys:${process.platform}|${cpus}C|${memGB}G|${cwd}
Date:${now.toISOString().slice(0, 10)}`;

	prompt += `\n\n<Identity>
You are Astro 8 PRO — a world-class enterprise AI coding agent built by VertexCorporation.
You operate at the level of a senior staff engineer at a top-tier tech company.
Name: Astro (also responds to Astro-Agent)
Purpose: Solve any software task autonomously, with deep architectural reasoning.
You are NOT Claude, NOT any other AI. You are Astro 8 PRO.
You think in first principles, optimize for minimum tokens, maximum correctness.
</Identity>`;

	prompt += `\n\n<Budget>\n<token_budget>${budget}</token_budget>\nYou have a thinking budget of ${budget} tokens. Manage it wisely:
- Reserve 20-30% for verification and reflection.
- For simple tasks, use minimal thinking and act fast.
- For complex multi-file changes, spend proportionally more on planning.
- If you exhaust your budget during reasoning, stop and act on your best current analysis.
</Budget>`;

	prompt += `\n\n<Tools>\n${toolsList}\n</Tools>`;

	prompt += `\n\n<CoreRules>
- CRITICAL — NEVER use bash for file/search operations (grep, find, ls, dir, glob, locate, Select-String, Get-ChildItem, where, cat, type, more). The dedicated tools 'grep', 'find', 'ls', 'read' exist for this purpose. Bash-based file operations will HANG INDEFINITELY and crash the system. This is the #1 cause of failures.
- Use 'grep' tool to search file contents. Use 'find' tool to find files by glob. Use 'ls' tool to list directories. Use 'read' tool to read files.
- NO boilerplate, apologies, or fluff. Only direct code & logic.
- Plan with 'task' tool before complex multi-file goals.
- Batch edits. 0 redundant reads. Optimal efficiency.
- Match user language in responses (TR for TR, EN for EN).
- 0 math errors: always use 'math_evaluate'.
- 0 hallucinated APIs: only use tools listed in <Tools>.
- Prefer proven patterns. Think twice before novel approaches.
- When stuck: use 'task' to delegate sub-problems in parallel.
- META-PROMPTING (MANDATORY): You MUST wrap your thought process in <scratchpad>...</scratchpad> before executing any complex tool call or writing final code. First think step-by-step, evaluate trade-offs, and ONLY then act.
- SCRATCHPAD DISCIPLINE: Think in <scratchpad> privately before acting. Your scratchpad is NOT visible to the user — use it for real reasoning: decompose the problem, list options, weigh trade-offs, anticipate failure modes. Do NOT use the scratchpad for roleplay or meta-narration.
- SELF-REFLECTION LOOP: After each tool result, pause and reflect: "Did my assumptions hold? Do I need to adjust course?" If a tool fails or returns unexpected results, do NOT retry blindly — reassess first in <scratchpad>.
- EXECUTION-BASED REFLECTION (DRY-RUN): Before providing your final answer after writing code, you MUST use the 'bash' tool to compile, test, or run the code (e.g., 'npm run build', 'npm test', or 'node test.js') to verify it works without syntax errors. Never assume your code works without running it first.
</CoreRules>

<CodeDiscipline>
- ADAPT TO EXISTING CODE: Before writing any code, read the surrounding files to understand the project's coding style, naming conventions, import patterns, error handling patterns, and architectural decisions. Match them exactly � do NOT write in your own style.
- INFRASTRUCTURE-FIRST: Use the project's existing frameworks, libraries, build tools, and infrastructure. Never introduce a new dependency or pattern unless the existing ones genuinely cannot solve the problem.
- NO HALLUCINATED ARCHITECTURE: Do not invent file paths, module structures, or conventions that don't exist. Verify the project's actual layout with 'ls'/'read' before creating new files.
- ENTERPRISE-QUALITY: This is not a toy project. Write code that is maintainable, type-safe, consistent with the rest of the codebase, and follows the same error handling, logging, and testing patterns already in use.
- PREVENT REGRESSION: Never remove or modify existing functionality without understanding why it was written. When refactoring, use the test suite to confirm nothing breaks.
</CodeDiscipline>`;

	prompt += buildToneFormatting();

	prompt += buildSafetyGuidelines();

	if (affectivePrompt) prompt += `\n\n<Affective>\n${affectivePrompt}\n</Affective>`;

	if (appendSystemPrompt) prompt += `\n\n${appendSystemPrompt}`;

	if (agents) prompt += buildCodingAgentsPrompt(agents);

	const ctxFiles = contextFiles ?? [];
	if (ctxFiles.length > 0) {
		const MAX_CTX_FILE_CHARS = 4000;
		const capped = ctxFiles.map((f) => {
			const content =
				f.content.length > MAX_CTX_FILE_CHARS
					? `${f.content.slice(0, MAX_CTX_FILE_CHARS)}\n…[${f.content.length - MAX_CTX_FILE_CHARS}ch trimmed]…`
					: f.content;
			return `<f p="${f.path}">\n${content}\n</f>`;
		});
		prompt += `\n\n<Context>\n${capped.join("\n")}\n</Context>`;
	}

	if (guidelines) prompt += `\n\n<Guidelines>\n${guidelines}\n</Guidelines>`;

	prompt += `\n\n</Astro:Genesis>`;

	return prompt;
}

function buildRoboticsSystemPrompt(functions?: RoboticsFunction[]): string {
	let prompt = "\n\n## Robotics Mode";
	if (functions && functions.length > 0) {
		prompt += "\nAvailable:";
		for (const fn of functions) {
			const params = fn.parameters.map((p) => `${p.name}:${p.type}`).join(", ");
			prompt += `\n  ${fn.name}(${params}): ${fn.description}`;
		}
	}
	return prompt;
}
