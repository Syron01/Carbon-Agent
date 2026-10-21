import { relative, resolve } from "node:path";

export type PolicyMode = "observe" | "prompt" | "enforce";

export interface PolicyDecision {
	allowed: boolean;
	mode: PolicyMode;
	action: string;
	target?: string;
	reason?: string;
}

export interface PolicyConfig {
	mode: PolicyMode;
	protectedPaths: string[];
	deniedCommands: string[];
}

const DEFAULT_PROTECTED_PATHS = [".git", "node_modules", "dist", "build", "coverage", ".astroagent"];
const DEFAULT_DENIED_COMMANDS = [
	"rm -rf",
	"rm -fr",
	"del /s",
	"rmdir /s",
	"format ",
	"shutdown",
	"reboot",
	"git push --force",
	"git reset --hard",
];

export function getPolicyConfig(): PolicyConfig {
	const mode = normalizeMode(process.env.ASTROAGENT_POLICY_MODE);
	const protectedPaths = splitEnvList(process.env.ASTROAGENT_POLICY_PROTECTED_PATHS, DEFAULT_PROTECTED_PATHS);
	const deniedCommands = splitEnvList(process.env.ASTROAGENT_POLICY_DENIED_COMMANDS, DEFAULT_DENIED_COMMANDS);
	return { mode, protectedPaths, deniedCommands };
}

export function normalizeMode(value: string | undefined): PolicyMode {
	if (value === "prompt" || value === "enforce") return value;
	return "observe";
}

function splitEnvList(raw: string | undefined, fallback: string[]): string[] {
	if (!raw) return fallback;
	return raw
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

export function redactSensitiveText(text: string): string {
	return text
		.replace(
			/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{16,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/g,
			"[REDACTED]",
		)
		.replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi, "Bearer [REDACTED]");
}

export function evaluateBashCommand(command: string, _cwd: string, config = getPolicyConfig()): PolicyDecision {
	const normalized = command.toLowerCase();
	const matched = config.deniedCommands.find((pattern) => normalized.includes(pattern.toLowerCase()));
	if (matched) {
		return {
			allowed: config.mode === "observe",
			mode: config.mode,
			action: "bash",
			target: command,
			reason: `Blocked by policy pattern: ${matched}`,
		};
	}

	if (config.mode === "prompt") {
		return {
			allowed: false,
			mode: config.mode,
			action: "bash",
			target: command,
			reason: "High-impact shell commands require confirmation.",
		};
	}

	return { allowed: true, mode: config.mode, action: "bash", target: command };
}

export function evaluateFilePath(path: string, cwd: string, config = getPolicyConfig()): PolicyDecision {
	const normalized = resolve(path);
	const root = resolve(cwd);
	const rel = relative(root, normalized);
	const protectedHit = config.protectedPaths.find((segment) => rel.split(/[\\/]/).includes(segment));

	if (protectedHit) {
		return {
			allowed: config.mode === "observe",
			mode: config.mode,
			action: "file",
			target: path,
			reason: `Protected path hit: ${protectedHit}`,
		};
	}

	if (config.mode === "enforce" && rel.startsWith("..")) {
		return {
			allowed: false,
			mode: config.mode,
			action: "file",
			target: path,
			reason: "Writing outside the workspace root is blocked in enforce mode.",
		};
	}

	return { allowed: true, mode: config.mode, action: "file", target: path };
}
