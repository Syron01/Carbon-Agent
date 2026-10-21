/**
 * Vision Pipeline - Main robotic image analysis orchestrator.
 * Sends images to the Ollama VLM, returning object detection, bounding boxes, and trajectories as JSON.
 */

import { ImageAnnotator } from "./image-annotator.js";
import { ImageCapture } from "./image-capture.js";
import { OllamaVision } from "./ollama-vision.js";
import { fillPrompt, ROBOTICS_PROMPTS } from "./prompts.js";

// ============================================================================
// Types
// ============================================================================

export interface DetectedObject {
	label: string;
	point?: [number, number]; // [y, x] normalized 0-1000
	box_2d?: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
	confidence?: number;
}

export interface TrajectoryPoint {
	point: [number, number];
	label: string;
	order: number;
}

export interface VisionResult {
	objects: DetectedObject[];
	annotatedImage?: Buffer;
	rawResponse: string;
	durationMs: number;
}

export interface TrajectoryResult {
	trajectory: TrajectoryPoint[];
	annotatedImage?: Buffer;
	rawResponse: string;
	durationMs: number;
}

export interface SceneAnalysis {
	description: string;
	objects: Array<{ label: string; position: string; point?: [number, number] }>;
	rawResponse: string;
	durationMs: number;
}

export interface VisionPipelineOptions {
	model?: string;
	baseUrl?: string;
	temperature?: number;
	drawOverlay?: boolean;
}

// ============================================================================
// Pipeline
// ============================================================================

export class VisionPipeline {
	private vision: OllamaVision;
	private capture: ImageCapture;
	private annotator: ImageAnnotator;
	private drawOverlay: boolean;

	constructor(options?: VisionPipelineOptions) {
		this.vision = new OllamaVision(options?.model, options?.baseUrl);
		this.capture = new ImageCapture();
		this.annotator = new ImageAnnotator();
		this.drawOverlay = options?.drawOverlay ?? true;
	}

	/**
	 * Nesneleri tespit et ve koordinatlarını döndür.
	 */
	async detectObjects(imageBytes: Buffer, queries?: string[], maxObjects = 10): Promise<VisionResult> {
		const start = Date.now();
		const base64 = this.capture.toBase64(imageBytes);

		let prompt: string;
		if (queries && queries.length > 0) {
			prompt = fillPrompt(ROBOTICS_PROMPTS.DETECT_SPECIFIC, {
				queries: queries.join(", "),
			});
		} else {
			prompt = fillPrompt(ROBOTICS_PROMPTS.DETECT_OBJECTS, {
				maxObjects: maxObjects,
			});
		}

		const rawResponse = await this.vision.generate(prompt, base64, { temperature: 0.1 });
		const objects = this.parseDetectionResponse(rawResponse);

		let annotatedImage: Buffer | undefined;
		if (this.drawOverlay && objects.length > 0) {
			annotatedImage = await this.annotator.drawPoints(imageBytes, objects);
		}

		return {
			objects,
			annotatedImage,
			rawResponse,
			durationMs: Date.now() - start,
		};
	}

	/**
	 * Bounding box'lar döndür.
	 */
	async detectBoundingBoxes(imageBytes: Buffer, maxObjects = 25): Promise<VisionResult> {
		const start = Date.now();
		const base64 = this.capture.toBase64(imageBytes);

		const prompt = fillPrompt(ROBOTICS_PROMPTS.DETECT_BOUNDING_BOXES, {
			maxObjects,
		});

		const rawResponse = await this.vision.generate(prompt, base64, { temperature: 0.1 });
		const objects = this.parseBboxResponse(rawResponse);

		let annotatedImage: Buffer | undefined;
		if (this.drawOverlay && objects.length > 0) {
			annotatedImage = await this.annotator.drawBoundingBoxes(imageBytes, objects);
		}

		return {
			objects,
			annotatedImage,
			rawResponse,
			durationMs: Date.now() - start,
		};
	}

	/**
	 * Yörünge planla.
	 */
	async planTrajectory(
		imageBytes: Buffer,
		startObject: string,
		instruction: string,
		numPoints = 15,
	): Promise<TrajectoryResult> {
		const start = Date.now();
		const base64 = this.capture.toBase64(imageBytes);

		const prompt = fillPrompt(ROBOTICS_PROMPTS.PLAN_TRAJECTORY, {
			startObject,
			instruction,
			numPoints,
			lastIndex: numPoints,
		});

		const rawResponse = await this.vision.generate(prompt, base64, { temperature: 0.5 });
		const trajectory = this.parseTrajectoryResponse(rawResponse);

		let annotatedImage: Buffer | undefined;
		if (this.drawOverlay && trajectory.length > 0) {
			annotatedImage = await this.annotator.drawTrajectory(imageBytes, trajectory);
		}

		return {
			trajectory,
			annotatedImage,
			rawResponse,
			durationMs: Date.now() - start,
		};
	}

	/**
	 * Sahne analizi - nesneleri, ilişkilerini, bağlamı anlat.
	 */
	async analyzeScene(imageBytes: Buffer): Promise<SceneAnalysis> {
		const start = Date.now();
		const base64 = this.capture.toBase64(imageBytes);

		const rawResponse = await this.vision.generate(ROBOTICS_PROMPTS.SCENE_UNDERSTANDING, base64, {
			temperature: 0.3,
		});

		try {
			const parsed = this.extractJSON<{ description: string; objects: any[] }>(rawResponse);
			return {
				description: parsed.description || rawResponse,
				objects: parsed.objects || [],
				rawResponse,
				durationMs: Date.now() - start,
			};
		} catch {
			return {
				description: rawResponse,
				objects: [],
				rawResponse,
				durationMs: Date.now() - start,
			};
		}
	}

	/**
	 * Serbest prompt ile görüntü analizi.
	 */
	async freeformAnalyze(imageBytes: Buffer, prompt: string): Promise<{ response: string; durationMs: number }> {
		const start = Date.now();
		const base64 = this.capture.toBase64(imageBytes);
		const response = await this.vision.generate(prompt, base64, { temperature: 0.3 });
		return { response, durationMs: Date.now() - start };
	}

	/**
	 * Ollama bağlantısını ve model durumunu kontrol et.
	 */
	async healthCheck(): Promise<{ ok: boolean; model: string; error?: string }> {
		try {
			const ok = await this.vision.healthCheck();
			return { ok, model: this.vision.getModel(), error: ok ? undefined : "Model bulunamadi" };
		} catch (err) {
			return { ok: false, model: this.vision.getModel(), error: String(err) };
		}
	}

	setModel(model: string): void {
		this.vision.setModel(model);
	}

	getModel(): string {
		return this.vision.getModel();
	}

	// ===== Parse yardımcıları =====

	private parseDetectionResponse(raw: string): DetectedObject[] {
		try {
			const arr = this.extractJSON<Array<{ point?: number[]; label?: string }>>(raw);
			if (!Array.isArray(arr)) return [];
			return arr
				.filter((item) => item.point && item.label)
				.map((item) => ({
					label: item.label!,
					point: [item.point![0], item.point![1]] as [number, number],
				}));
		} catch {
			return [];
		}
	}

	private parseBboxResponse(raw: string): DetectedObject[] {
		try {
			const arr = this.extractJSON<Array<{ box_2d?: number[]; label?: string }>>(raw);
			if (!Array.isArray(arr)) return [];
			return arr
				.filter((item) => item.box_2d && item.label && item.box_2d.length === 4)
				.map((item) => ({
					label: item.label!,
					box_2d: item.box_2d as [number, number, number, number],
				}));
		} catch {
			return [];
		}
	}

	private parseTrajectoryResponse(raw: string): TrajectoryPoint[] {
		try {
			const arr = this.extractJSON<Array<{ point?: number[]; label?: string }>>(raw);
			if (!Array.isArray(arr)) return [];
			return arr
				.filter((item) => item.point && item.label)
				.map((item, idx) => ({
					point: [item.point![0], item.point![1]] as [number, number],
					label: item.label!,
					order: parseInt(item.label!, 10) || idx,
				}))
				.sort((a, b) => a.order - b.order);
		} catch {
			return [];
		}
	}

	private extractJSON<T>(raw: string): T {
		let cleaned = raw.trim();
		const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
		if (codeBlockMatch) cleaned = codeBlockMatch[1].trim();

		try {
			return JSON.parse(cleaned) as T;
		} catch {
			const startIdx = Math.min(
				cleaned.indexOf("[") === -1 ? Infinity : cleaned.indexOf("["),
				cleaned.indexOf("{") === -1 ? Infinity : cleaned.indexOf("{"),
			);
			if (startIdx !== Infinity) {
				const bracket = cleaned[startIdx];
				const closeBracket = bracket === "[" ? "]" : "}";
				const endIdx = cleaned.lastIndexOf(closeBracket);
				if (endIdx > startIdx) {
					return JSON.parse(cleaned.slice(startIdx, endIdx + 1)) as T;
				}
			}
			throw new Error(`JSON parse hatasi`);
		}
	}
}
