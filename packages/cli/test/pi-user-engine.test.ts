import { describe, expect, it } from "vitest";
import { getAstroUserEngine } from "../src/utils/astro-user-engine.js";

describe("getAstroUserEngine", () => {
	it("formats the user engine expected by AstroAgent.dev", () => {
		const runtime = process.versions.bun ? `bun/${process.versions.bun}` : `node/${process.version}`;
		const userEngine = getAstroUserEngine("1.2.3");

		expect(userEngine).toBe(`AstroAgent/1.2.3 (${process.platform}; ${runtime}; ${process.arch})`);
		expect(userEngine).toMatch(/^AstroAgent\/[^\s()]+ \([^;()]+;\s*[^;()]+;\s*[^()]+\)$/);
	});
});
