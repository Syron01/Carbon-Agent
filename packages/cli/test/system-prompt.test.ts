import { describe, expect, test } from "vitest";
import { buildSystemPrompt } from "../src/core/system-prompt.js";

describe("buildSystemPrompt", () => {
	describe("empty tools", () => {
		test("shows (none) for empty tools list", () => {
			const prompt = buildSystemPrompt({
				selectedTools: [],
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).toContain("(none)");
		});

		test("shows file paths guideline even with no tools", () => {
			const prompt = buildSystemPrompt({
				selectedTools: [],
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).toMatch(/(Show file paths clearly|Dosya yollarini acik goster)/i);
		});
	});

	describe("default tools", () => {
		test("includes all default tools when snippets are provided", () => {
			const prompt = buildSystemPrompt({
				toolSnippets: {
					read: "Read file contents",
					bash: "Execute bash commands",
					edit: "Make surgical edits",
					write: "Create or overwrite files",
				},
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).toContain("- read:");
			expect(prompt).toContain("- bash:");
			expect(prompt).toContain("- edit:");
			expect(prompt).toContain("- write:");
		});
	});

	describe("custom tool snippets", () => {
		test("includes custom tools in available tools section when promptSnippet is provided", () => {
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "dynamic_tool"],
				toolSnippets: {
					dynamic_tool: "Run dynamic test behavior",
				},
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).toContain("- dynamic_tool: Run dynamic test behavior");
		});

		test("omits custom tools from available tools section when promptSnippet is not provided", () => {
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "dynamic_tool"],
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).not.toContain("dynamic_tool");
		});
	});

	describe("agent system", () => {
		test("includes company-style coding agents when enabled", () => {
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "bash"],
				agents: { enabled: true, mode: "always", verbosity: "summary" },
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).toContain("## Agent System (Company Mode)");
			expect(prompt).toContain("Patron Agent / Orchestrator");
			expect(prompt).toContain("Backend Agent");
			expect(prompt).toContain("UI/UX Agent");
			expect(prompt).toContain("DevOps Agent");
			expect(prompt).toContain("Code Reviewer Agent");
		});

		test("omits company-style coding agents when disabled", () => {
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "bash"],
				agents: { enabled: false, mode: "off", verbosity: "summary" },
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).not.toContain("## Agent System (Company Mode)");
		});
	});

	describe("reasoning discipline", () => {
		test("includes target discipline and token economy rules", () => {
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "bash"],
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).toContain("Inspect only what is needed");
			expect(prompt).toContain("smallest correct change");
			expect(prompt).toContain("Do not add boilerplate");
			expect(prompt).toContain("Turbo coding mode");
			expect(prompt).toContain("Prefer one targeted edit");
		});

		test("compact mode keeps the same discipline in shorter form", () => {
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "bash"],
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
				compactMode: true,
			});

			expect(prompt).toContain("Inspect only what is needed");
			expect(prompt).toContain("Make the smallest correct change");
			expect(prompt).toContain("Turbo coding");
			expect(prompt).toContain("Prefer edit over write");
		});
	});

	describe("prompt guidelines", () => {
		test("appends promptGuidelines to default guidelines", () => {
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "dynamic_tool"],
				promptGuidelines: ["Use dynamic_tool for project summaries."],
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).toContain("- Use dynamic_tool for project summaries.");
		});

		test("deduplicates and trims promptGuidelines", () => {
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "dynamic_tool"],
				promptGuidelines: ["Use dynamic_tool for summaries.", "  Use dynamic_tool for summaries.  ", "   "],
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt.match(/- Use dynamic_tool for summaries\./g)).toHaveLength(1);
		});
	});

	describe("blender mode", () => {
		test("adds production loop and quality gate when blender tools are selected", () => {
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "blender_execute_blender_code"],
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
			});

			expect(prompt).toContain("## Blender MCP Professional Mode");
			expect(prompt).toContain("Production loop:");
			expect(prompt).toContain("Quality gate:");
			expect(prompt).toContain("Do not create random floating blocks");
		});

		test("adds compact quality guard when compact blender mode is selected", () => {
			const prompt = buildSystemPrompt({
				selectedTools: ["read", "blender_execute_blender_code"],
				contextFiles: [],
				skills: [],
				cwd: process.cwd(),
				compactMode: true,
			});

			expect(prompt).toContain("## Blender MCP Mode");
			expect(prompt).toContain("Quality gate:");
			expect(prompt).toContain("just recolored primitives");
		});
	});
});
