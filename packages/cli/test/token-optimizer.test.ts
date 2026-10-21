import { describe, expect, test } from "vitest";
import { optimizePromptForIntentCapsule, optimizePromptText } from "../src/core/token-optimizer.js";

describe("optimizePromptText", () => {
	test("strips ansi escapes and compacts json blocks", () => {
		const input = '\u001b[31mred\u001b[0m\n```json\n{\n  "a": 1,\n  "b": [2, 3]\n}\n```';
		const result = optimizePromptText(input);

		expect(result.wasOptimized).toBe(true);
		expect(result.optimizedText).not.toContain("\u001b[");
		expect(result.optimizedText).toContain('{"a":1,"b":[2,3]}');
	});

	test("limits repeated stack frames", () => {
		const frames = Array.from({ length: 20 }, (_, i) => `    at fn${i} (file:///x.ts:${i}:1)`).join("\n");
		const result = optimizePromptText(`Error: boom\n${frames}`);

		expect(result.optimizedText.match(/^\s*at /gm)?.length).toBeLessThanOrEqual(8);
	});

	test("builds an intent capsule for huge noisy prompts", () => {
		const words = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"];
		const repeated = Array.from({ length: 500 }, (_, i) => {
			return `ERROR ${words[i % words.length]}_${words[(i + 3) % words.length]} failed at src/app/module-${i}.ts npm run test expected value_${words[i % words.length]} received value_${words[(i + 1) % words.length]} stack=/workspace/src/app/module-${i}.ts:${i}:1`;
		}).join("\n");
		const code = `\`\`\`ts\n${Array.from({ length: 220 }, (_, i) => `export const value${i} = ${i};`).join("\n")}\n\`\`\``;
		const input = `Fix this and keep going.\n${repeated}\n${code}`;
		const result = optimizePromptForIntentCapsule(input);

		expect(result.capsuleApplied).toBe(true);
		expect(result.optimizedText).toContain("[capsule]");
		expect(result.optimizedText).toContain("src/app/module-");
		expect(result.optimizedText.length).toBeLessThan(input.length / 2);
	});
});
