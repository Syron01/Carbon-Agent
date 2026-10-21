import { describe, expect, it } from "vitest";
import { shouldCompact } from "../src/core/compaction/compaction.js";

describe("compaction threshold", () => {
	it("uses a conservative fallback when model context window is unknown", () => {
		expect(shouldCompact(10_000, 0, { enabled: true, reserveTokens: 32_768, keepRecentTokens: 12_000 })).toBe(false);
		expect(shouldCompact(100_000, 0, { enabled: true, reserveTokens: 32_768, keepRecentTokens: 12_000 })).toBe(true);
	});

	it("compacts well before the hard provider limit", () => {
		expect(shouldCompact(70_000, 100_000, { enabled: true, reserveTokens: 16_384, keepRecentTokens: 20_000 })).toBe(
			true,
		);
		expect(shouldCompact(78_000, 100_000, { enabled: true, reserveTokens: 16_384, keepRecentTokens: 20_000 })).toBe(
			true,
		);
	});

	it("stays off when disabled", () => {
		expect(shouldCompact(200_000, 100_000, { enabled: false, reserveTokens: 16_384, keepRecentTokens: 20_000 })).toBe(
			false,
		);
	});
});
