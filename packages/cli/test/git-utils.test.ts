import { describe, expect, it } from "vitest";

import { safeBranchName } from "../src/core/git-utils";

describe("git utils", () => {
	it("sanitizes branch names into safe git refs", () => {
		expect(safeBranchName("Feature: Final Fix!!")).toBe("feature-final-fix");
		expect(safeBranchName("../../evil.lock")).toBe("evil");
		expect(safeBranchName("---")).toBe("astroagent/update");
		expect(safeBranchName("a//b///c.")).toBe("a/b/c");
	});
});
