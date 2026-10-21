import chalk from "chalk";
import { APP_NAME, CONFIG_DIR_NAME } from "../config.js";
import type { ExtensionFlag } from "../core/extensions/types.js";

const commandGroups = [
	{
		title: "Core",
		items: [
			["install <source> [-l]", "Install an extension source and add it to settings"],
			["remove <source> [-l]", "Remove an extension source from settings"],
			["update [source|self|Moon]", "Update Astro-Agent and installed extensions"],
			["doctor", "Diagnose install, PATH, version, and updates"],
		],
	},
	{
		title: "Local / Browser",
		items: [
			["browser-bridge", "Run only the Chrome extension bridge server"],
			["ollama doctor", "Check local Ollama connection and models"],
			["ollama profile <profile>", "Print Ollama speed/RAM profile commands"],
		],
	},
	{
		title: "Package UI",
		items: [
			["list", "List installed extensions"],
			["config", "Open the package-source TUI"],
			["<command> --help", "Show help for install/remove/update/list"],
		],
	},
] as const;

const optionGroups = [
	{
		title: "Model",
		items: [
			["--provider <name>", "Provider name"],
			["--model <pattern>", "Model ID/pattern; supports provider/id and :thinking"],
			["--models <patterns>", "Comma-separated quick-switch models for Ctrl+P"],
			["--thinking <level>", "off, minimal, low, medium, high, xhigh"],
			["--api-key <key>", "API key override"],
		],
	},
	{
		title: "Session",
		items: [
			["--continue, -c", "Continue previous session"],
			["--resume, -r", "Pick a session to resume"],
			["--session <path|id>", "Use a specific session"],
			["--fork <path|id>", "Fork a specific session"],
			["--no-session", "Do not save the session"],
			["--clear-memory", "Delete saved session memory and exit"],
		],
	},
	{
		title: "Execution",
		items: [
			["--print, -p", "Run prompt and exit"],
			["--headless", "CI/headless JSON stdin/stdout mode"],
			["--mode <text|json|rpc>", "Output mode"],
			["--timeout <sec>", "Headless timeout"],
			["--output-format <json|text>", "Headless output format"],
			["--offline", "Disable startup network operations"],
		],
	},
	{
		title: "Context / Tools",
		items: [
			["--tools, -t <tools>", "Comma-separated tool allowlist"],
			["--no-tools, -nt", "Disable all tools by default"],
			["--no-builtin-tools, -nbt", "Disable built-in tools only"],
			["--skill <path>", "Load a skill file or directory"],
			["--no-skills, -ns", "Disable skill discovery"],
			["--no-context-files, -nc", "Disable AGENTS.md/CLAUDE.md discovery"],
		],
	},
	{
		title: "Project Assets",
		items: [
			["--extension, -e <path>", "Load an extension file"],
			["--no-extensions, -ne", "Disable extension discovery"],
			["--prompt-template <path>", "Load prompt-template file/directory"],
			["--theme <path>", "Load theme file/directory"],
			["--no-themes", "Disable theme discovery"],
		],
	},
	{
		title: "Info",
		items: [
			["--export <file>", "Export session to HTML"],
			["--list-models [search]", "List available models"],
			["--verbose", "Force verbose startup"],
			["--help, -h", "Show this help"],
			["--version, -v", "Show version"],
		],
	},
] as const;

function rows(items: readonly (readonly [string, string])[]): string {
	const width = Math.max(...items.map(([left]) => left.length)) + 4;
	return items.map(([left, right]) => `  ${left.padEnd(width)}${right}`).join("\n");
}

function groups(sections: typeof commandGroups | typeof optionGroups): string {
	return sections.map((section) => `${chalk.bold(section.title)}\n${rows(section.items)}`).join("\n\n");
}

export function buildHelpText(extensionFlags?: ExtensionFlag[]): string {
	const extensionFlagsText =
		extensionFlags && extensionFlags.length > 0
			? `\n\n${chalk.bold("Extension CLI Flags")}\n${extensionFlags
					.map((flag) => {
						const value = flag.type === "string" ? " <value>" : "";
						const description = flag.description ?? `${flag.extensionPath} registered by`;
						return `  --${flag.name}${value}`.padEnd(30) + description;
					})
					.join("\n")}`
			: "";

	return `${chalk.bold(APP_NAME)} - serious terminal coding agent: inspect → act → verify

${chalk.bold("Usage")}
  ${APP_NAME} [options] [@files...] [messages...]
  echo '{"type":"prompt","text":"Fix lint"}' | ${APP_NAME} --headless --timeout 120

${chalk.bold("Commands")}
${groups(commandGroups)}

${chalk.bold("Options")}
${groups(optionGroups)}${extensionFlagsText}

${chalk.bold("Examples")}
  ${APP_NAME}
  ${APP_NAME} "List all .ts files in src/"
  ${APP_NAME} @prompt.md @image.png "What color is the sky?"
  ${APP_NAME} -p "Review the code in src/"
  ${APP_NAME} --continue "What did we discuss?"
  ${APP_NAME} --clear-memory
  ${APP_NAME} --model antigravity-claude-sonnet-4-6 "Fix this project"
  ${APP_NAME} --model sonnet:high "Solve this complex issue"
  ${APP_NAME} --models sonnet:high,haiku:low
  ${APP_NAME} --tools read,grep,find,ls -p "Review safely"
  ${APP_NAME} --export ~/${CONFIG_DIR_NAME}/engine/sessions/--path--/session.jsonl

${chalk.bold("Environment Variables")}
  ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY
  ASTRO_TUI_RENDER_INTERVAL_MS       Tune TUI render throttle
  ASTRO_TUI_CLEAR_SCROLLBACK=1       Restore legacy full scrollback clears
`;
}
