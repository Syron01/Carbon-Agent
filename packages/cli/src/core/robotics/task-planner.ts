/**
 * Task planning - translates natural language commands into robot function calls.
 */

import { existsSync, readFileSync } from "node:fs";
import type { OllamaVision } from "./ollama-vision.js";
import { fillPrompt, ROBOTICS_PROMPTS } from "./prompts.js";

// ============================================================================
// Types
// ============================================================================

export interface RobotFunction {
	name: string;
	description: string;
	parameters: Array<{
		name: string;
		type: "number" | "boolean" | "string";
		description: string;
	}>;
}

export interface PlannedAction {
	function: string;
	args: unknown[];
	reasoning?: string;
}

export interface TaskPlanResult {
	actions: PlannedAction[];
	rawResponse: string;
	durationMs: number;
}

// ============================================================================
// TaskPlanner
// ============================================================================

export class TaskPlanner {
	private vision: OllamaVision;
	private functions: RobotFunction[];

	constructor(vision: OllamaVision, functions: RobotFunction[] = []) {
		this.vision = vision;
		this.functions = functions;
	}

	/**
	 * Translates a natural language command into robot API calls.
	 * imageBase64 is optional - providing a scene image yields better plans.
	 */
	async planTask(instruction: string, imageBase64?: string): Promise<TaskPlanResult> {
		const start = Date.now();

		if (this.functions.length === 0) {
			throw new Error("Robot functions are undefined. Load them via /robotics functions <path>.");
		}

		const functionDefinitions = this.formatFunctionDefs();
		const prompt = fillPrompt(ROBOTICS_PROMPTS.TASK_PLAN, {
			functionDefinitions,
			instruction,
		});

		let rawResponse: string;
		if (imageBase64) {
			rawResponse = await this.vision.generate(prompt, imageBase64, { temperature: 0.3 });
		} else {
			// if no image is provided, send a 1x1 black pixel (Ollama vision model requires an image)
			const blankPixel =
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
			rawResponse = await this.vision.generate(prompt, blankPixel, { temperature: 0.3 });
		}

		const actions = this.parseActionResponse(rawResponse);

		return {
			actions,
			rawResponse,
			durationMs: Date.now() - start,
		};
	}

	/**
	 * Update the function list.
	 */
	setFunctions(functions: RobotFunction[]): void {
		this.functions = functions;
	}

	getFunctions(): RobotFunction[] {
		return this.functions;
	}

	/**
	 * Load function definitions from a JSON file.
	 * Format: { functions: RobotFunction[] }
	 * or directly RobotFunction[]
	 */
	static loadFunctions(filePath: string): RobotFunction[] {
		if (!existsSync(filePath)) {
			throw new Error(`Robot function file not found: ${filePath}`);
		}

		const raw = readFileSync(filePath, "utf-8");
		const parsed = JSON.parse(raw);

		const arr = Array.isArray(parsed) ? parsed : (parsed.functions ?? []);

		if (!Array.isArray(arr) || arr.length === 0) {
			throw new Error("Invalid robot function file format");
		}

		return arr as RobotFunction[];
	}

	/**
	 * Generates sample mock robot API for testing.
	 */
	static mockPickAndPlaceFunctions(): RobotFunction[] {
		return [
			{
				name: "move",
				description: "Moves arm to the specified coordinates",
				parameters: [
					{ name: "x", type: "number", description: "X coordinate (normalized 0-1000)" },
					{ name: "y", type: "number", description: "Y coordinate (normalized 0-1000)" },
					{
						name: "high",
						type: "boolean",
						description: "true = lift arm (overcome obstacle), false = lower to surface",
					},
				],
			},
			{
				name: "setGripperState",
				description: "Sets the gripper state",
				parameters: [{ name: "opened", type: "boolean", description: "true = open, false = close" }],
			},
			{
				name: "returnToOrigin",
				description: "Returns the robot to the origin position",
				parameters: [],
			},
		];
	}

	// ===== Private =====

	private formatFunctionDefs(): string {
		return this.functions
			.map((fn) => {
				const params = fn.parameters.map((p) => `  ${p.name} (${p.type}): ${p.description}`).join("\n");
				return `def ${fn.name}(${fn.parameters.map((p) => p.name).join(", ")}):\n  # ${fn.description}\n${params}`;
			})
			.join("\n\n");
	}

	private parseActionResponse(raw: string): PlannedAction[] {
		let cleaned = raw.trim();

		// Find JSON array
		const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
		if (codeBlockMatch) cleaned = codeBlockMatch[1].trim();

		// Extract [{ ... }] portion
		const startIdx = cleaned.indexOf("[");
		const endIdx = cleaned.lastIndexOf("]");
		if (startIdx === -1 || endIdx === -1) return [];

		try {
			const arr = JSON.parse(cleaned.slice(startIdx, endIdx + 1)) as Array<{
				function?: string;
				args?: unknown[];
				reasoning?: string;
			}>;

			return arr
				.filter((item) => item.function)
				.map((item) => ({
					function: item.function!,
					args: item.args ?? [],
					reasoning: item.reasoning,
				}));
		} catch {
			return [];
		}
	}
}
