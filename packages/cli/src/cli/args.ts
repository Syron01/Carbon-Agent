/**
 * CLI argument parsing and help display
 */

import type { ThinkingLevel } from "astro-engine";
import type { ExtensionFlag } from "../core/extensions/types.js";
import { APP_NAME, VERSION } from "../config.js";

export type Mode = "text" | "json" | "rpc";

export interface Args {
	provider?: string;
	headless?: boolean;
	studio?: boolean;
	timeout?: number;
	outputFormat?: "json" | "text";
	model?: string;
	apiKey?: string;
	systemPrompt?: string;
	appendSystemPrompt?: string[];
	thinking?: ThinkingLevel;
	continue?: boolean;
	resume?: boolean;
	help?: boolean;
	version?: boolean;
	mode?: Mode;
	noSession?: boolean;
	clearMemory?: boolean;
	session?: string;
	fork?: string;
	sessionDir?: string;
	models?: string[];
	tools?: string[];
	noTools?: boolean;
	noBuiltinTools?: boolean;
	extensions?: string[];
	noExtensions?: boolean;
	print?: boolean;
	export?: string;
	noSkills?: boolean;
	skills?: string[];
	promptTemplates?: string[];
	noPromptTemplates?: boolean;
	themes?: string[];
	noThemes?: boolean;
	noContextFiles?: boolean;
	noMemory?: boolean;
	listModels?: string | true;
	offline?: boolean;
	verbose?: boolean;
	messages: string[];
	fileArgs: string[];
	/** Unknown flags (potentially extension flags) - map of flag name to value */
	unknownFlags: Map<string, boolean | string>;
	diagnostics: Array<{ type: "warning" | "error"; message: string }>;
}

const VALID_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

export function isValidThinkingLevel(level: string): level is ThinkingLevel {
	return VALID_THINKING_LEVELS.includes(level as ThinkingLevel);
}

export function parseArgs(args: string[]): Args {
	const result: Args = {
		messages: [],
		fileArgs: [],
		unknownFlags: new Map(),
		diagnostics: [],
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === "--help" || arg === "-h") {
			result.help = true;
		} else if (arg === "--version" || arg === "-v") {
			result.version = true;
		} else if (arg === "--headless") {
			result.headless = true;
		} else if (arg === "--studio") {
			result.studio = true;
		} else if (arg === "--timeout" && i + 1 < args.length) {
			result.timeout = Number(args[++i]);
		} else if (arg === "--output-format" && i + 1 < args.length) {
			const value = args[++i];
			if (value === "json" || value === "text") result.outputFormat = value;
		} else if (arg === "--mode" && i + 1 < args.length) {
			const mode = args[++i];
			if (mode === "text" || mode === "json" || mode === "rpc") {
				result.mode = mode;
			}
		} else if (arg === "--continue" || arg === "-c") {
			result.continue = true;
		} else if (arg === "--resume" || arg === "-r") {
			result.resume = true;
		} else if (arg === "--provider" && i + 1 < args.length) {
			result.provider = args[++i];
		} else if (arg === "--model" && i + 1 < args.length) {
			result.model = args[++i];
		} else if (arg === "--api-key" && i + 1 < args.length) {
			result.apiKey = args[++i];
		} else if (arg === "--system-prompt" && i + 1 < args.length) {
			result.systemPrompt = args[++i];
		} else if (arg === "--append-system-prompt" && i + 1 < args.length) {
			result.appendSystemPrompt = result.appendSystemPrompt ?? [];
			result.appendSystemPrompt.push(args[++i]);
		} else if (arg === "--no-session") {
			result.noSession = true;
		} else if (arg === "--clear-memory" || arg === "--reset-memory") {
			result.clearMemory = true;
		} else if (arg === "--session" && i + 1 < args.length) {
			result.session = args[++i];
		} else if (arg === "--fork" && i + 1 < args.length) {
			result.fork = args[++i];
		} else if (arg === "--session-dir" && i + 1 < args.length) {
			result.sessionDir = args[++i];
		} else if (arg === "--models" && i + 1 < args.length) {
			result.models = args[++i].split(",").map((s) => s.trim());
		} else if (arg === "--no-tools" || arg === "-nt") {
			result.noTools = true;
		} else if (arg === "--no-builtin-tools" || arg === "-nbt") {
			result.noBuiltinTools = true;
		} else if ((arg === "--tools" || arg === "-t") && i + 1 < args.length) {
			result.tools = args[++i]
				.split(",")
				.map((s) => s.trim())
				.filter((name) => name.length > 0);
		} else if (arg === "--thinking" && i + 1 < args.length) {
			const level = args[++i];
			if (isValidThinkingLevel(level)) {
				result.thinking = level;
			} else {
				result.diagnostics.push({
					type: "warning",
					message: `Invalid thinking level "${level}". Valid values: ${VALID_THINKING_LEVELS.join(", ")}`,
				});
			}
		} else if (arg === "--print" || arg === "-p") {
			result.print = true;
		} else if (arg === "--export" && i + 1 < args.length) {
			result.export = args[++i];
		} else if ((arg === "--extension" || arg === "-e") && i + 1 < args.length) {
			result.extensions = result.extensions ?? [];
			result.extensions.push(args[++i]);
		} else if (arg === "--no-extensions" || arg === "-ne") {
			result.noExtensions = true;
		} else if (arg === "--skill" && i + 1 < args.length) {
			result.skills = result.skills ?? [];
			result.skills.push(args[++i]);
		} else if (arg === "--prompt-template" && i + 1 < args.length) {
			result.promptTemplates = result.promptTemplates ?? [];
			result.promptTemplates.push(args[++i]);
		} else if (arg === "--theme" && i + 1 < args.length) {
			result.themes = result.themes ?? [];
			result.themes.push(args[++i]);
		} else if (arg === "--no-skills" || arg === "-ns") {
			result.noSkills = true;
		} else if (arg === "--no-prompt-templates" || arg === "-np") {
			result.noPromptTemplates = true;
		} else if (arg === "--no-themes") {
			result.noThemes = true;
		} else if (arg === "--no-context-files" || arg === "-nc") {
			result.noContextFiles = true;
		} else if (arg === "--no-memory" || arg === "-nm") {
			result.noMemory = true;
		} else if (arg === "--list-models") {
			// Check if next arg is a search pattern (not a flag or file arg)
			if (i + 1 < args.length && !args[i + 1].startsWith("-") && !args[i + 1].startsWith("@")) {
				result.listModels = args[++i];
			} else {
				result.listModels = true;
			}
		} else if (arg === "--verbose") {
			result.verbose = true;
		} else if (arg === "--offline") {
			result.offline = true;
		} else if (arg.startsWith("@")) {
			result.fileArgs.push(arg.slice(1)); // Remove @ prefix
		} else if (arg.startsWith("--")) {
			const eqIndex = arg.indexOf("=");
			if (eqIndex !== -1) {
				result.unknownFlags.set(arg.slice(2, eqIndex), arg.slice(eqIndex + 1));
			} else {
				const flagName = arg.slice(2);
				const next = args[i + 1];
				if (next !== undefined && !next.startsWith("-") && !next.startsWith("@")) {
					result.unknownFlags.set(flagName, next);
					i++;
				} else {
					result.unknownFlags.set(flagName, true);
				}
			}
		} else if (arg.startsWith("-") && !arg.startsWith("--")) {
			result.diagnostics.push({ type: "error", message: `Unknown option: ${arg}` });
		} else if (!arg.startsWith("-")) {
			result.messages.push(arg);
		}
	}

	return result;
}

export function printHelp(extensionFlags?: ExtensionFlag[]): void {
	const lines: string[] = [];
	lines.push(`${APP_NAME} ${VERSION} — AI coding agent for the terminal and web`);
	lines.push("");
	lines.push("Usage:");
	lines.push("  carbon [options] [message...]");
	lines.push("  carbon @file \"summarize this\"");
	lines.push("");
	lines.push("Options:");
	lines.push("  -h, --help                 Show this help and exit");
	lines.push("  -v, --version              Show the version and exit");
	lines.push("  -p, --print                One-shot: print the response and exit");
	lines.push("      --mode <text|json|rpc> Output mode (default: interactive)");
	lines.push("      --output-format <fmt>  Output format for headless: json | text");
	lines.push("      --headless             Start without the TUI (API server only)");
	lines.push("      --studio               Start the Web Studio UI and open it in your browser");
	lines.push("      --provider <name>      Provider id (anthropic, openai, google, ...)");
	lines.push("      --model <id>           Model id to start with");
	lines.push("      --api-key <key>        API key for the selected provider");
	lines.push("      --thinking <level>     off | minimal | low | medium | high | xhigh");
	lines.push("      --models <list>        Comma-separated model scope for cycling");
	lines.push("  -c, --continue             Continue the most recent session");
	lines.push("  -r, --resume               Pick a session to resume");
	lines.push("      --session <id>         Continue a specific session by id");
	lines.push("      --fork <id>            Branch from an existing session");
	lines.push("      --session-dir <dir>    Override the sessions directory");
	lines.push("      --no-session           Do not persist this session");
	lines.push("  -t, --tools <list>         Comma-separated allowlist of tools");
	lines.push("      --no-tools             Disable all tools");
	lines.push("      --no-builtin-tools     Disable built-in tools only");
	lines.push("  -e, --extension <path>     Load an extension (repeatable)");
	lines.push("      --no-extensions        Disable extension loading");
	lines.push("      --skill <path>         Load a skill (repeatable)");
	lines.push("      --no-skills            Disable skill loading");
	lines.push("      --prompt-template <p>  Load a prompt template (repeatable)");
	lines.push("      --no-prompt-templates  Disable prompt templates");
	lines.push("      --theme <name>         Load a theme (repeatable)");
	lines.push("      --no-themes            Disable theme loading");
	lines.push("      --no-context-files     Ignore AGENTS.md/context files");
	lines.push("      --no-memory            Disable memory");
	lines.push("      --clear-memory         Clear stored memory");
	lines.push("      --list-models [query]  List available models and exit");
	lines.push("      --export <file>        Export a session file to HTML");
	lines.push("      --timeout <seconds>    Request timeout");
	lines.push("      --offline              Skip network checks (version, etc.)");
	lines.push("      --verbose              Verbose output");
	lines.push("      --system-prompt <s>    Override the system prompt");
	lines.push("      --append-system-prompt <s>  Append to the system prompt");

	if (extensionFlags && extensionFlags.length > 0) {
		lines.push("");
		lines.push("Extension flags:");
		for (const flag of extensionFlags) {
			const name = (flag as { name?: string }).name ?? String(flag);
			const description = (flag as { description?: string }).description;
			lines.push(description ? `      --${name}    ${description}` : `      --${name}`);
		}
	}

	lines.push("");
	lines.push("Commands:");
	lines.push("  doctor                     Print environment diagnostics");
	lines.push("  browser-bridge             Start the browser bridge server");
	lines.push("");
	lines.push("Web Studio opens at http://127.0.0.1:3135 when started interactively.");

	console.log(lines.join("\n"));
}
