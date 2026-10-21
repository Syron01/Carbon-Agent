import { describe, expect, test } from "vitest";
import {
	appraiseAssistantOutcome,
	appraiseUserInput,
	buildAffectiveSystemPrompt,
	createInitialAffectiveState,
	deriveAffectivePosture,
	normalizeAffectiveSettings,
	renderAffectiveExplanation,
	renderAffectiveStatus,
} from "../src/core/affect.js";
import { BUILTIN_SLASH_COMMANDS } from "../src/core/slash-commands.js";

describe("affective state layer", () => {
	test("normalizes to disabled subtle mode by default", () => {
		const settings = normalizeAffectiveSettings(undefined, 1000);

		expect(settings.enabled).toBe(false);
		expect(settings.mode).toBe("subtle");
		expect(settings.state.lastUpdated).toBe(1000);
		expect(settings.state.recentEvents).toHaveLength(0);
	});

	test("appraises warm positive user input", () => {
		const initial = createInitialAffectiveState(1000);
		const next = appraiseUserInput(initial, "tesekkur, bu guzel oldu tatli asistan", 2000);

		expect(next.trust).toBeGreaterThan(initial.trust);
		expect(next.warmth).toBeGreaterThan(initial.warmth);
		expect(next.satisfaction).toBeGreaterThan(initial.satisfaction);
		expect(next.interactionCount).toBe(1);
		expect(next.lastSignal).toContain("positive-feedback");
		expect(next.recentEvents).toHaveLength(1);
		expect(deriveAffectivePosture(next)).toBe("warm");
	});

	test("appraises assistant errors as caution and tension", () => {
		const initial = createInitialAffectiveState(1000);
		const next = appraiseAssistantOutcome(initial, "error", 2000);

		expect(next.caution).toBeGreaterThan(initial.caution);
		expect(next.tension).toBeGreaterThan(initial.tension);
		expect(next.satisfaction).toBeLessThan(initial.satisfaction);
		expect(next.lastSignal).toBe("assistant-error");
		expect(next.recentEvents[0]?.posture).toBe("repair");
	});

	test("builds a truthful system prompt section when enabled", () => {
		const state = appraiseUserInput(createInitialAffectiveState(1000), "neden daha farkli olsun?", 2000);
		const settings = normalizeAffectiveSettings({ enabled: true, mode: "active", state }, 3000);
		const prompt = buildAffectiveSystemPrompt(settings);

		expect(prompt).toContain("Affective State Layer");
		expect(prompt).toContain("not a claim of consciousness");
		expect(prompt).toContain("Mode: active");
		expect(prompt).toContain("Posture:");
		expect(prompt).toContain("Recent affective journal");
		expect(prompt).toContain("Behavior rules");
	});

	test("renders status and registers the slash command", () => {
		const settings = normalizeAffectiveSettings({ enabled: true }, 1000);
		const status = renderAffectiveStatus(settings);
		const _commandNames = BUILTIN_SLASH_COMMANDS.map((command) => command.name);

		expect(status).toContain("/mood status");
		expect(status).toContain("/mood explain");
	});

	test("renders an explanation with the recent affective journal", () => {
		const state = appraiseAssistantOutcome(createInitialAffectiveState(1000), "tool_use", 2000);
		const settings = normalizeAffectiveSettings({ enabled: true, state }, 3000);
		const explanation = renderAffectiveExplanation(settings);

		expect(explanation).toContain("Affective Explanation");
		expect(explanation).toContain("Recent journal");
		expect(explanation).toContain("assistant-tool_use");
	});
});
