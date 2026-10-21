import { describe, expect, test } from "vitest";
import { buildHelpText } from "../src/cli/help-sections.js";

describe("buildHelpText", () => {
	test("groups command help and includes production toggles", () => {
		const help = buildHelpText();

		expect(help).toContain("Core");
		expect(help).toContain("Local / Browser");
		expect(help).toContain("Model");
		expect(help).toContain("ASTRO_TUI_RENDER_INTERVAL_MS");
		expect(help).toContain("antigravity-claude-sonnet-4-6");
	});
});
