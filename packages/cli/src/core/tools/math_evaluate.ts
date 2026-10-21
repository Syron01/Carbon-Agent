import vm from "node:vm";
import type { EngineTool } from "astro-engine";
import type { ToolDefinition } from "../extensions/types.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

export interface MathEvaluateToolInput {
	expression: string;
}

export interface MathEvaluateToolDetails {
	type: "math_evaluate";
	expression: string;
}

const mathSchema = {
	type: "object",
	properties: {
		expression: {
			type: "string",
			description: "The mathematical expression to evaluate (e.g. '100 * (45 / 3)', 'Math.pow(2, 8)').",
		},
	},
	required: ["expression"],
} as const;

export function createMathEvaluateToolDefinition(): ToolDefinition<typeof mathSchema, MathEvaluateToolDetails, any> {
	return {
		name: "math_evaluate",
		label: "Math Evaluator",
		description:
			"Evaluate a mathematical expression. Use this for all numerical calculations, probability, statistics, geometry, or UI/layout pixel math. NEVER guess math. Supported: +, -, *, /, %, **, Math.* methods (e.g. Math.sqrt).",
		parameters: mathSchema,
		execute: async (
			_toolCallId: string,
			input: MathEvaluateToolInput,
			signal?: AbortSignal,
			_onUpdate?: any,
			_ctx?: any,
		) => {
			try {
				if (signal?.aborted) {
					throw new Error("Tool execution aborted by user");
				}

				// Safe evaluation using Node VM module
				const context = vm.createContext({
					Math: Math,
					Number: Number,
					parseInt: parseInt,
					parseFloat: parseFloat,
				});
				const result = vm.runInContext(input.expression, context, { timeout: 2000 });
				return {
					details: { type: "math_evaluate", expression: input.expression },
					content: [{ type: "text", text: String(result) }],
				};
			} catch (err: any) {
				return {
					details: { type: "math_evaluate", expression: input.expression },
					content: [{ type: "text", text: `Error evaluating expression: ${err.message}` }],
					isError: true,
				};
			}
		},
	};
}

export function createMathEvaluateTool(): EngineTool<typeof mathSchema> {
	return wrapToolDefinition(createMathEvaluateToolDefinition());
}
