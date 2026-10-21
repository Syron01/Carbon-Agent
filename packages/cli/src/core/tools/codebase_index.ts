// @ts-nocheck

import type { EngineTool } from "astro-engine";
import { Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const codebaseIndexSchema = Type.Object({
	force: Type.Optional(Type.Boolean({ description: "Yeniden dizin oluşturmaya zorla (Force re-indexing)" })),
});

export function createCodebaseIndexToolDefinition(_cwd: string): ToolDefinition<typeof codebaseIndexSchema, any, any> {
	return {
		name: "codebase_index",
		label: "codebase_index",
		description:
			"Indexes the codebase for semantic search / RAG. Call this tool when codebase files have changed significantly and you want to refresh the index.",
		promptSnippet: "Index the codebase to update search capabilities",
		parameters: codebaseIndexSchema,
		async execute(_id, _params, _signal) {
			return {
				content: [
					{
						type: "text",
						text: "This tool is disabled because codebase indexing is disabled to prevent system freezes/crashes. Please use other search tools like grep, find, and ls to inspect the codebase.",
					},
				],
			};
		},
		renderCall(args, theme) {
			return {
				render: () => [theme.fg("toolTitle", `Codebase Indexing (force=${!!args?.force})`)],
				invalidate: () => {},
			};
		},
	};
}

export function createCodebaseIndexTool(cwd: string): EngineTool<typeof codebaseIndexSchema> {
	return wrapToolDefinition(createCodebaseIndexToolDefinition(cwd));
}
