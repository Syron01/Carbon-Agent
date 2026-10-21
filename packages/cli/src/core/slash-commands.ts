import { APP_NAME } from "../config.js";
import type { SourceInfo } from "./source-info.js";

export type SlashCommandSource = "extension" | "prompt" | "skill";

export interface SlashCommandInfo {
	name: string;
	description?: string;
	source: SlashCommandSource;
	sourceInfo: SourceInfo;
}

export interface BuiltinSlashCommand {
	name: string;
	description: string;
}

export const BUILTIN_SLASH_COMMANDS: ReadonlyArray<BuiltinSlashCommand> = [
	// === Session ===
	{ name: "new", description: "Start a new session" },
	{ name: "resume", description: "Resume another session" },
	{ name: "name", description: "Rename session" },
	{ name: "session", description: "Show session info and stats" },
	{ name: "context", description: "Show context and token usage" },
	{ name: "compact", description: "Compact session context" },
	{ name: "fork", description: "Fork from a message" },
	{ name: "clone", description: "Clone session in current location" },
	{ name: "tree", description: "Navigate session tree" },
	{ name: "export", description: "Export session (.html or .jsonl)" },
	{ name: "import", description: "Import a session from JSONL" },
	{ name: "share", description: "Share session as a GitHub Gist" },
	{ name: "copy", description: "Copy the last response" },

	// === Model & Settings ===
	{ name: "models", description: "Select a model" },
	{ name: "scoped-models", description: "Edit quick-switch models" },
	{ name: "settings", description: "Open settings" },
	{ name: "autothink", description: "Toggle automatic thinking level" },
	{ name: "login", description: "Configure Provider API keys" },
	{ name: "panel", description: "Open local account and control panel" },

	// === Modes ===
	{ name: "plan", description: "Toggle plan mode" },
	{ name: "fable", description: "Toggle Fable mode (stage-planning with tier: opus/sonnet/haiku)" },
	{ name: "automation", description: "Toggle automation mode" },
	{ name: "agentmode", description: "Toggle agent mode" },
	{ name: "zen", description: "Toggle Zen mode (hide UI elements)" },
	{ name: "taskmode", description: "Toggle task panel (default: on)" },

	// === Tools & Integration ===
	{ name: "init", description: "Create project config files" },
	{ name: "ship", description: "Ship changes (branch/commit/push/PR)" },
	{ name: "diff", description: "Show git changes" },
	{ name: "index", description: "Index codebase for semantic search" },
	{ name: "browser", description: "Chrome extension status and control" },
	{ name: "app", description: "Open /app Web Studio and lock TUI" },
	{ name: "interface", description: "Open Astro-Agent Special OpenClaw OS Interface" },
	{ name: "videoedit", description: "Open Astro-Agent Pro Video Studio (Browser)" },
	{ name: "photoedit", description: "Open Astro-Agent Pro Photo Editor (Browser)" },
	{ name: "mcp", description: "List connected MCP servers" },
	{ name: "blendermcp", description: "Install or connect Blender MCP on demand" },
	{ name: "scratchmcp", description: "Connect Scratch/TurboWarp MCP on demand" },
	{ name: "swarm", description: "Trigger Multi-Agent Swarm" },
	{ name: "fix", description: "Run Autonomous Auto-Healer" },
	{ name: "evolve", description: "Trigger Meta-Evolution (Self-Improvement Loop)" },

	// === Extensions & Marketplace ===
	{ name: "marketplace", description: "Extension and theme marketplace" },
	{ name: "agents", description: "Agent management" },

	// === Update & System ===
	{ name: "status", description: "Show detailed diagnostics" },
	{ name: "update", description: "Update Astro-Agent to latest version" },
	{ name: "ollama", description: "Ollama model management" },
	{ name: "hotkeys", description: "List keyboard shortcuts" },
	{ name: "changelog", description: "Show changelog" },
	{ name: "reload", description: "Reload system components" },
	{ name: "hub", description: "Astro-Agent Dashboard and Project Hub" },
	{ name: "metrics", description: "Show system metrics and token usage" },
	{ name: "quit", description: `Quit ${APP_NAME}` },
];
