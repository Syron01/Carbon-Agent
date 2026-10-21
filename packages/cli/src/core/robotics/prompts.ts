/**
 * Robotics-specific prompt templates.
 * Standard formats to be sent to the Ollama VLM.
 */

export const ROBOTICS_PROMPTS = {
	// Detect up to 10 objects, [y, x] normalized 0-1000
	DETECT_OBJECTS: `Point to no more than {maxObjects} items in the image.
The label returned should be an identifying name for the object detected.
The answer should follow the json format: [{{"point": [y, x], "label": "<label>"}}].
The points are in [y, x] format normalized to 0-1000.`,

	// Locate specific objects
	DETECT_SPECIFIC: `Get all points matching the following objects: {queries}.
The label returned should be an identifying name for the object detected.
The answer should follow the json format: [{{"point": [y, x], "label": "<label>"}}].
The points are in [y, x] format normalized to 0-1000.`,

	// Abstract category detection (e.g., fruit, vehicle)
	DETECT_CATEGORY: `Get all points for {category}.
The label returned should be an identifying name for the object detected.
The answer should follow the json format: [{{"point": [y, x], "label": "<label>"}}].
The points are in [y, x] format normalized to 0-1000.`,

	// Bounding box detection
	DETECT_BOUNDING_BOXES: `Return bounding boxes as a JSON array with labels. Never return masks or code fencing.
Limit to {maxObjects} objects. Include as many objects as you can identify.
If an object is present multiple times, name them according to their unique characteristic (colors, size, position, etc.).
The format: [{{"box_2d": [ymin, xmin, ymax, xmax], "label": "<label>"}}] normalized to 0-1000.
The values in box_2d must only be integers.`,

	// Trajectory planning
	PLAN_TRAJECTORY: `Place a point on {startObject}, then {numPoints} points for the trajectory of {instruction}.
The points should be labeled by order of the trajectory, from '0' (start) to '{lastIndex}' (final).
The answer should follow the json format: [{{"point": [y, x], "label": "<order>"}}].
The points are in [y, x] format normalized to 0-1000.`,

	// Scene analysis
	SCENE_UNDERSTANDING: `Describe the scene in detail. Identify all objects, their spatial relationships, and any notable features.
Return as JSON: {{"description": "<text>", "objects": [{{"label": "<name>", "position": "<relative position>", "point": [y, x]}}]}}
The points are in [y, x] format normalized to 0-1000.`,

	// Task planning via function calling
	TASK_PLAN: `You are a robotic arm with six degrees-of-freedom.
You have the following functions available:
{functionDefinitions}

{instruction}

Provide the sequence of function calls as a JSON list:
[{{"function": "<name>", "args": [<arg1>, <arg2>, ...], "reasoning": "<why>"}}]
Include your reasoning for each step.`,

	// Analysis using set-of-mark markers
	SOM_ANALYZE: `The image has numbered markers on detected objects.
{instruction}
Refer to objects by their marker number.
Return as JSON: {{"action": "<what to do>", "target_marks": [<mark_numbers>], "reasoning": "<why>"}}`,

	// Analog reading (clocks, measurement devices, etc.)
	READ_ANALOG: `Tell me what the value is. Please respond in the following JSON format:
{schema}
Zoom in or crop as necessary to confirm.`,
} as const;

// Helper that injects parameters into prompt templates
export function fillPrompt(template: string, params: Record<string, string | number>): string {
	let result = template;
	for (const [key, value] of Object.entries(params)) {
		result = result.replaceAll(`{${key}}`, String(value));
	}
	return result;
}
