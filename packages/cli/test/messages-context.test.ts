import { describe, expect, it } from "vitest";
import { convertToLlm } from "../src/core/messages.js";

describe("convertToLlm context stability", () => {
	it("drops historical assistant thinking before sending context to provider", () => {
		const [message] = convertToLlm([
			{
				role: "assistant",
				provider: "test",
				model: "test",
				content: [
					{ type: "thinking", thinking: "private chain of thought" },
					{ type: "text", text: "visible answer" },
				],
				stopReason: "end",
				timestamp: Date.now(),
				usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2 },
			} as any,
		]);

		expect(message.role).toBe("assistant");
		expect(JSON.stringify(message)).not.toContain("private chain of thought");
		expect(JSON.stringify(message)).toContain("visible answer");
	});

	it("caps huge tool result text for provider context without dropping the tail", () => {
		const huge = `${"a".repeat(9000)}TAIL`;
		const [message] = convertToLlm([
			{
				role: "toolResult",
				toolCallId: "call-1",
				content: [{ type: "text", text: huge }],
				timestamp: Date.now(),
			} as any,
		]);

		const text = (message.content as Array<{ type: string; text?: string }>)[0].text ?? "";
		expect(text.length).toBeLessThan(huge.length);
		expect(text).toContain("trimmed for context stability");
		expect(text.endsWith("TAIL")).toBe(true);
	});
});
