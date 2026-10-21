import { describe, expect, it } from "vitest";
import { assertNoPersonaLeak, findPersonaLeak } from "../src/core/tools/persona-guard.js";

describe("persona guard", () => {
	it("is disabled and allows arbitrary user-approved content", () => {
		const personalText = `${"su"}de ${"can"}im ${"sevgi"}lim ${"ask"}im`;
		expect(findPersonaLeak(personalText)).toBeUndefined();
		expect(() => assertNoPersonaLeak(personalText)).not.toThrow();
	});
});
