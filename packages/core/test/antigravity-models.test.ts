import { describe, expect, test } from "vitest";
import { MODELS } from "../src/models.generated.js";
import { buildRequest, needsClaudeThinkingBetaHeader } from "../src/providers/google-antigravity.js";

const antigravityModels = MODELS.antigravity;

describe("Antigravity model metadata", () => {
	test("matches public model ids and limits", () => {
		expect(Object.keys(antigravityModels).sort()).toEqual(
			[
				"antigravity-claude-opus-5-5-thinking",
				"antigravity-claude-sonnet-5-5-thinking",
				"antigravity-gemini-3-8-flash-high",
				"antigravity-gemini-4-argon",
				"antigravity-gpt-oss-120b-medium",
			].sort(),
		);
		expect(antigravityModels["antigravity-claude-opus-5-5-thinking"].maxTokens).toBe(64000);
		expect(antigravityModels["antigravity-gemini-4-argon"].maxTokens).toBe(65536);
	});

	test("maps prefixed public ids to model", () => {
		const request = buildRequest(
			antigravityModels["antigravity-claude-sonnet-5-5-thinking"],
			{ messages: [{ role: "user", content: [{ type: "text", text: "hi" }], timestamp: Date.now() }] },
			"moon-project",
			{},
			true,
		);

		expect(request.model).toBe("claude-sonnet-5-5");
	});

	test("adds Claude thinking beta eligibility for antigravity provider ids", () => {
		expect(needsClaudeThinkingBetaHeader(antigravityModels["antigravity-claude-sonnet-5-5-thinking"])).toBe(true);
	});
});
