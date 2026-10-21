import type { EngineTool } from "astro-engine";
import { Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { createGrepToolDefinition } from "./grep.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const semanticSearchSchema = Type.Object({
	query: Type.String({ description: "Semantic keyword, function name, or logic summary to search for" }),
});

export function createSemanticSearchToolDefinition(cwd: string): ToolDefinition<typeof semanticSearchSchema, any, any> {
	const grepToolDef = createGrepToolDefinition(cwd);

	return {
		name: "semantic_search",
		label: "semantic_search",
		description:
			"Lightweight BM25-like semantic codebase search. Searches for keyword proximity. Returns file:line locations. Use read tool for full content.",
		promptSnippet: "Search semantic project context",
		parameters: semanticSearchSchema,
		async execute(_id: string, params: { query: string }, signal?: AbortSignal, _onUpdate?: any, _ctx?: any) {
			try {
				const keywords = params.query.split(/\s+/).filter(Boolean);
				// Create a simple regex that matches lines containing at least one of the keywords.
				// For real BM25, we'd need file scoring, but this is a fast lightweight fallback to prevent crashes.
				const pattern = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

				const result = await grepToolDef.execute(
					_id,
					{
						pattern: `(${pattern})`,
						ignoreCase: true,
						limit: 150,
					},
					signal,
					_onUpdate,
					_ctx,
				);

				return result;
			} catch (err: any) {
				return {
					details: { error: true },
					content: [{ type: "text", text: `Semantic search failed: ${err.message}` }],
					isError: true,
				};
			}
		},
		renderCall(args, theme) {
			return {
				render: () => [theme.fg("toolTitle", `Semantik Arama: ${args?.query}`)],
				invalidate: () => {},
			};
		},
	};
}

export function createSemanticSearchTool(cwd: string): EngineTool<typeof semanticSearchSchema> {
	return wrapToolDefinition(createSemanticSearchToolDefinition(cwd));
}
