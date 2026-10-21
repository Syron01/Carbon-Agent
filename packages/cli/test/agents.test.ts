import { describe, expect, test } from "vitest";
import { renderCodingAgentsWorkspace } from "../src/core/agents.js";
import { BUILTIN_SLASH_COMMANDS } from "../src/core/slash-commands.js";

describe("agent workspace", () => {
	test("renders the company-style workspace departments", () => {
		const output = renderCodingAgentsWorkspace(
			{ enabled: true, mode: "auto", verbosity: "summary" },
			{ activeTools: ["read", "bash"], cwd: "/repo", modelName: "test-model" },
		);

		expect(output).toContain("Astro-Agent Company Workspace");
		expect(output).toContain("Leadership Office");
		expect(output).toContain("Engineering Floor");
		expect(output).toContain("Product Studio");
		expect(output).toContain("Quality Gate");
		expect(output).toContain("Delivery Room");
		expect(output).toContain("Patron Agent / Orchestrator");
		expect(output).toContain("UI/UX Agent");
		expect(output).toContain("DevOps Agent");
		expect(output).toContain("Code Reviewer Agent");
		expect(output).toContain("/agentmode on");
		expect(output).toContain("/agentmode off");
	});

	test("registers agent commands as built-in slash commands", () => {
		const commandNames = BUILTIN_SLASH_COMMANDS.map((command) => command.name);
		expect(commandNames).toContain("agentmode");
		expect(commandNames).toContain("workspace");
	});
});
