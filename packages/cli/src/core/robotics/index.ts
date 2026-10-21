/**
 * Robotics module - barrel exports
 */

export { ImageAnnotator } from "./image-annotator.js";
export { ImageCapture } from "./image-capture.js";
export type { OllamaVisionOptions } from "./ollama-vision.js";
export { OllamaVision } from "./ollama-vision.js";
export { fillPrompt, ROBOTICS_PROMPTS } from "./prompts.js";
export type { PlannedAction, RobotFunction, TaskPlanResult } from "./task-planner.js";
export { TaskPlanner } from "./task-planner.js";
export type {
	DetectedObject,
	SceneAnalysis,
	TrajectoryPoint,
	TrajectoryResult,
	VisionPipelineOptions,
	VisionResult,
} from "./vision-pipeline.js";
export { VisionPipeline } from "./vision-pipeline.js";
