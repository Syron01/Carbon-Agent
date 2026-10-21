import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./test-harness.js";

describe("memory defaults", () => {
	let harness: Harness | undefined;

	afterEach(() => {
		harness?.cleanup();
		harness = undefined;
	});

	it("does not inject saved memory signals into prompts by default", async () => {
		harness = createHarness({ responses: ["ok"] });
		const configDir = join(harness.tempDir, ".astroagent");
		if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
		writeFileSync(
			join(configDir, "memory-signals.json"),
			JSON.stringify([
				{ timestamp: new Date().toISOString(), text: "Always add old noisy boilerplate.", tag: "preference" },
			]),
		);

		await harness.session.prompt("hi");

		const systemPrompt = (harness.faux.contexts[0] as any).systemPrompt ?? "";
		expect(systemPrompt).not.toContain("User preferences");
		expect(systemPrompt).not.toContain("old noisy boilerplate");
	});

	it("does not inject affective state prompt unless explicitly enabled", async () => {
		harness = createHarness({ responses: ["ok"] });

		await harness.session.prompt("hi");

		const systemPrompt = (harness.faux.contexts[0] as any).systemPrompt ?? "";
		expect(systemPrompt).not.toContain("Affective State Layer");
	});
});
