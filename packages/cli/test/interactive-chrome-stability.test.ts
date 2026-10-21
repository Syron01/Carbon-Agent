import { describe, expect, it } from "vitest";
import { AstroAgentHeaderComponent } from "../src/modes/interactive/components/Astro-Agent-header.js";
import { buildIntroLines } from "../src/modes/interactive/components/intro.js";

describe("interactive chrome stability", () => {
	it("intro renders one visual line per array entry", () => {
		const lines = buildIntroLines(120, 0);
		expect(lines.length).toBeGreaterThan(0);
		for (const line of lines) {
			expect(line.includes("\n")).toBe(false);
		}
	});

	it("intro height stays stable across phases", () => {
		const a = buildIntroLines(120, 0);
		const b = buildIntroLines(120, 12);
		const c = buildIntroLines(120, 48);
		expect(a.length).toBe(b.length);
		expect(b.length).toBe(c.length);
	});

	it("header height stays stable across renders", () => {
		const header = new AstroAgentHeaderComponent();
		const first = header.render(120);
		const second = header.render(120);
		expect(first.length).toBe(2);
		expect(second.length).toBe(2);
		for (const line of [...first, ...second]) {
			expect(line.includes("\n")).toBe(false);
		}
	});
});
