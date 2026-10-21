import type { EngineTool } from "astro-engine";
import { type Static, Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const askQuestionSchema = Type.Object({
	question: Type.String({ description: "The question to ask the user." }),
	options: Type.Array(Type.String(), { description: "The options to choose from. Must be at least 2 options." }),
});

export type AskQuestionInput = Static<typeof askQuestionSchema>;

export function createAskQuestionToolDefinition(): ToolDefinition<typeof askQuestionSchema, undefined, any> {
	return {
		name: "ask_question",
		label: "ask question",
		description:
			"Ask the user a multiple-choice question and wait for their selection. Use this to resolve ambiguity or solicit design decisions.",
		promptSnippet: "Ask the user a multiple choice question",
		parameters: askQuestionSchema,
		async execute(_toolCallId, { question, options }, signal, _onUpdate, ctx) {
			if (!ctx.hasUI) {
				throw new Error("Cannot ask question: UI is not available in the current context.");
			}

			if (options.length < 2) {
				throw new Error("Must provide at least 2 options to ask_question.");
			}

			// UI is available! Block execution until the user selects an option.
			const selection = await ctx.ui.select(question, options, { signal });

			if (selection === undefined) {
				throw new Error("User cancelled or timeout occurred while waiting for answer.");
			}

			return {
				content: [{ type: "text", text: `User selected: ${selection}` }],
				details: undefined,
			};
		},
	};
}

export function createAskQuestionTool(): EngineTool<typeof askQuestionSchema> {
	return wrapToolDefinition(createAskQuestionToolDefinition());
}
