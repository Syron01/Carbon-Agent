import { DEFAULT_UI_STYLE_GUIDELINE } from "./design-system/index.js";

export type CodingAgentMode = "off" | "auto" | "always";
export type CodingAgentVerbosity = "quiet" | "summary" | "verbose";

export interface CodingAgentsSettings {
	enabled?: boolean;
	mode?: CodingAgentMode;
	verbosity?: CodingAgentVerbosity;
}

export type CodingAgentDepartment = "explore" | "build" | "verify";

export interface CodingAgentProfile {
	id: string;
	name: string;
	department: CodingAgentDepartment;
	focus: string;
	useWhen: string;
}

export const DEFAULT_CODING_AGENT_PROFILES: readonly CodingAgentProfile[] = [
	// ── EXPLORE (fast read-only, parallel) ────────────────────────────────────
	{
		id: "scanner",
		name: "Scanner",
		department: "explore",
		focus: "map files, imports, exports, deps — no writes",
		useWhen: "first pass on any task",
	},
	{
		id: "searcher",
		name: "Searcher",
		department: "explore",
		focus: "grep patterns, symbol refs, API usages",
		useWhen: "finding where things are used",
	},
	// ── BUILD (parallel where possible) ──────────────────────────────────────
	{
		id: "architect",
		name: "Architect",
		department: "build",
		focus: "data flow, interface contracts, integration risk",
		useWhen: "multi-file or cross-package work",
	},
	{
		id: "coder",
		name: "Coder",
		department: "build",
		focus: "implement, diff-only, runs on first try",
		useWhen: "all code writes",
	},
	{
		id: "backend",
		name: "Backend",
		department: "build",
		focus: "API, auth, validation, runtime correctness",
		useWhen: "server-side changes",
	},
	{
		id: "frontend",
		name: "Frontend",
		department: "build",
		focus: "TUI/UI flow, state, empty/error/loading states",
		useWhen: "UI changes",
	},
	// ── VERIFY (run last, parallel) ───────────────────────────────────────────
	{
		id: "reviewer",
		name: "Reviewer",
		department: "verify",
		focus: "correctness, edge cases, type safety",
		useWhen: "after implementation",
	},
	{
		id: "security",
		name: "Security",
		department: "verify",
		focus: "injection, secrets, path traversal, permissions",
		useWhen: "FS/network/auth/user input",
	},
];

function normalizeMode(mode: CodingAgentMode | undefined, enabled: boolean | undefined): CodingAgentMode {
	if (mode) return mode;
	return enabled === false ? "off" : "auto";
}

function normalizeVerbosity(verbosity: CodingAgentVerbosity | undefined): CodingAgentVerbosity {
	return verbosity ?? "summary";
}

export function buildCodingAgentsPrompt(settings: CodingAgentsSettings | undefined): string {
	if (!settings) return "";
	const mode = normalizeMode(settings.mode, settings.enabled);
	const enabled = (settings.enabled ?? mode !== "off") && mode !== "off";
	if (!enabled) return "";
	const verbosity = normalizeVerbosity(settings.verbosity);

	const byDept = (dept: CodingAgentDepartment) =>
		DEFAULT_CODING_AGENT_PROFILES.filter((a) => a.department === dept)
			.map((a) => `  ${a.id}: ${a.focus}`)
			.join("\n");

	const visibilityRule =
		verbosity === "quiet"
			? "∄agent commentary. Internal only."
			: verbosity === "verbose"
				? "Show agent board if useful. ∄fake transcripts."
				: "≤3ln agent board. Only if useful.";

	return `

## ━ AGENT SYSTEM
Mode: ${mode}  Visibility: ${verbosity}
${mode === "auto" ? "auto: complex/multi-file → agents. trivial → direct." : "always: all coding work → agents."}

Departments (run EXPLORE→BUILD→VERIFY):

EXPLORE — parallel, read-only:
${byDept("explore")}

BUILD — parallel where independent:
${byDept("build")}

VERIFY — parallel, final gate:
${byDept("verify")}

Protocol:
1. scanner+searcher → parallel → build context map
2. architect → plan (skip for trivial)
3. coder+backend+frontend → parallel where independent
4. reviewer+security → parallel → one final diff
5. ship single coherent patch

Speed rules:
- ∄sequential when parallel possible
- explore agents share one read pass, ∄duplicate reads
- small tasks: skip explore, go direct to coder
- ∄agent verbosity. ∄roleplay. one clean output.
- ${DEFAULT_UI_STYLE_GUIDELINE}
- ${visibilityRule}`;
}

const DEPT_LABEL: Record<CodingAgentDepartment, string> = {
	explore: "Explore",
	build: "Build",
	verify: "Verify",
};

const DEPT_COLOR: Record<CodingAgentDepartment, number> = {
	explore: 117,
	build: 45,
	verify: 82,
};

export interface CodingWorkspaceRenderOptions {
	activeTools?: readonly string[];
	modelName?: string;
	cwd?: string;
	color?: boolean;
}

const R = "\u001b[0m";
const B = "\u001b[1m";
const D = "\u001b[2m";

const a256 = (code: number, text: string, on: boolean) => (on ? `\u001b[38;5;${code}m${text}${R}` : text);
const bold = (t: string, on: boolean) => (on ? `${B}${t}${R}` : t);
const dim = (t: string, on: boolean) => (on ? `${D}${t}${R}` : t);

export function renderCodingAgentsWorkspace(
	settings: CodingAgentsSettings | undefined,
	options: CodingWorkspaceRenderOptions = {},
): string {
	const c = options.color ?? true;
	const mode = normalizeMode(settings?.mode, settings?.enabled);
	const enabled = (settings?.enabled ?? mode !== "off") && mode !== "off";
	const verbosity = normalizeVerbosity(settings?.verbosity);
	const status = enabled ? (mode === "always" ? "always" : "auto") : "off";

	const lines: string[] = [
		bold("agent workspace", c),
		dim("explore → build → verify", c),
		"",
		`${a256(244, "status".padEnd(10), c)} ${a256(enabled ? 82 : 203, status, c)}`,
		`${a256(244, "verbosity".padEnd(10), c)} ${a256(117, verbosity, c)}`,
	];

	if (options.modelName) lines.push(`${a256(244, "model".padEnd(10), c)} ${a256(229, options.modelName, c)}`);
	if (options.cwd) lines.push(`${a256(244, "cwd".padEnd(10), c)} ${a256(153, options.cwd, c)}`);
	if (options.activeTools?.length)
		lines.push(`${a256(244, "tools".padEnd(10), c)} ${a256(120, String(options.activeTools.length), c)}`);

	lines.push("");

	for (const dept of Object.keys(DEPT_LABEL) as CodingAgentDepartment[]) {
		const agents = DEFAULT_CODING_AGENT_PROFILES.filter((a) => a.department === dept);
		if (!agents.length) continue;
		lines.push(a256(DEPT_COLOR[dept], DEPT_LABEL[dept], c));
		for (const agent of agents) {
			lines.push(`  ${bold(agent.id.padEnd(12), c)} ${dim(agent.focus, c)}`);
		}
		lines.push("");
	}

	return lines.join("\n").trimEnd();
}
