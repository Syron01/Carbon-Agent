import type { EngineTool } from "astro-engine";
import { Type } from "typebox";
import type { EngineSession } from "../engine-session.js";
import type { ToolDefinition } from "../extensions/types.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const compactSchema = Type.Object({
	instructions: Type.Optional(
		Type.String({
			description: "Optional custom instructions to preserve during compaction.",
		}),
	),
});

export function getCompactContextToolDefinition(
	session: EngineSession,
): ToolDefinition<typeof compactSchema, any, any> {
	return {
		name: "compact_context",
		label: "Compact",
		description:
			"Context compaction tool. Reduces token usage by condensing older messages into a single summary when the context has grown too large. Only invoke when there is noticeable token pressure.",
		promptSnippet: "Compact session context to save tokens",
		parameters: compactSchema,
		async execute(
			_toolCallId: string,
			params: { instructions?: string },
			signal?: AbortSignal,
			_onUpdate?: any,
			_ctx?: any,
		) {
			if (!signal) {
				return {
					content: [{ type: "text", text: "Error: Abort signal (signal) is missing." }],
					details: { error: true },
					isError: true,
				};
			}
			try {
				const result = await session.compact(params.instructions);
				return {
					content: [
						{
							type: "text",
							text: `Compaction complete. Original token count: ${result.tokensBefore}. New summary appended:\n${result.summary}`,
						},
					],
					details: result,
				};
			} catch (err: any) {
				return {
					content: [{ type: "text", text: `Compaction failed: ${err.message}` }],
					details: { error: err.message },
					isError: true,
				};
			}
		},
		renderCall(_args, theme) {
			return {
				render: () => [theme.fg("toolTitle", "Token Compaction Running 🧹")],
				invalidate: () => {},
			};
		},
	};
}

export function getCompactContextTool(session: EngineSession): EngineTool<typeof compactSchema> {
	return wrapToolDefinition(getCompactContextToolDefinition(session));
}
