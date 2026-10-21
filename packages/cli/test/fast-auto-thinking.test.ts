import { describe, expect, it } from "vitest";
import { DEFAULT_THINKING_LEVEL } from "../src/core/defaults.js";
import { resolveFastAutoThinkingLevel } from "../src/core/engine-session.js";

describe("fast auto thinking policy", () => {
	it("defaults to no reasoning for speed", () => {
		expect(DEFAULT_THINKING_LEVEL).toBe("off");
	});

	it("keeps normal coding requests cheap", () => {
		expect(resolveFastAutoThinkingLevel("fix this chat guard bug")).toBe("low");
		expect(resolveFastAutoThinkingLevel("write this event file")).toBe("low");
	});

	it("does not escalate broad performance words to xhigh", () => {
		expect(resolveFastAutoThinkingLevel("performans optimize et")).toBe("minimal");
		expect(resolveFastAutoThinkingLevel("debug this quickly")).toBe("minimal");
	});

	it("caps explicit deep requests at high instead of xhigh", () => {
		expect(resolveFastAutoThinkingLevel("deepthink this architecture")).toBe("high");
		expect(resolveFastAutoThinkingLevel("use xhigh reasoning")).toBe("high");
	});
});
