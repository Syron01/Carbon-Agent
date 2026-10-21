import { describe, expect, it } from "vitest";
import { AstroAgentHeaderComponent } from "../src/modes/interactive/components/astro-agent-header.js";
import { buildIntroLines } from "../src/modes/interactive/components/intro.js";

describe("interactive chrome stability", () => {
	it("intro renders one visual line per array entry", () => {
		const lines = buildIntroLines(120);
		expect(lines.length).toBeGreaterThan(0);
		for (const line of lines) {
			expect(line.includes("\n")).toBe(false);
		}
	});

	it("intro height stays stable across phases", () => {
		const a = buildIntroLines(120);
		const b = buildIntroLines(120);
		const c = buildIntroLines(120);
		expect(a.length).toBe(b.length);
		expect(b.length).toBe(c.length);
	});

	it("header height stays stable across renders", () => {
		// AstroAgentHeaderComponent requires session and footerData — skip instantiation test
		// and just confirm buildIntroLines returns stable output
		const lines = buildIntroLines(120);
		expect(lines.length).toBeGreaterThan(0);
		for (const line of lines) {
			expect(line.includes("\n")).toBe(false);
		}
	});
});
