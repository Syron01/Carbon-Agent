// @ts-nocheck
/**
 * Robotics Vision Tools - Astro-Agent tool sistemiyle entegre robotik görüntü araçları.
 * Bot, bu tool'ları otomatik olarak çağırarak vision pipeline'ı kullanır.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { ImageCapture } from "../robotics/image-capture.js";
import { VisionPipeline } from "../robotics/vision-pipeline.js";

// ============================================================================
// Tool: robotics_detect - Nesneleri tespit et
// ============================================================================

export function createRoboticsDetectToolDefinition(options?: {
	visionModel?: string;
	visionBaseUrl?: string;
	drawOverlay?: boolean;
}): ToolDefinition {
	return {
		name: "robotics_detect",
		description:
			"Bir görüntüdeki nesneleri tespit eder ve [y, x] koordinatlarını (0-1000 normalize) döndürür. Robotik manipülasyon görevleri için nesne konumlarını bulmada kullanılır.",
		parameters: Type.Object({
			image_path: Type.String({ description: "Analiz edilecek görüntünün dosya yolu veya URL'si" }),
			queries: Type.Optional(
				Type.Array(Type.String(), {
					description: "Aranacak nesne isimleri. Boş bırakılırsa tüm nesneleri tespit eder.",
				}),
			),
			max_objects: Type.Optional(
				Type.Number({ description: "Maksimum tespit edilecek nesne sayısı. Varsayılan: 10" }),
			),
		}),
		execute: async (_toolCallId, args: { image_path: string; queries?: string[]; max_objects?: number }) => {
			const capture = new ImageCapture();
			const pipeline = new VisionPipeline({
				model: options?.visionModel,
				baseUrl: options?.visionBaseUrl,
				drawOverlay: options?.drawOverlay ?? true,
			});

			let imageBytes: Buffer;
			if (args.image_path.startsWith("http://") || args.image_path.startsWith("https://")) {
				imageBytes = await capture.fromUrl(args.image_path);
			} else {
				imageBytes = capture.fromFile(args.image_path);
			}

			const result = await pipeline.detectObjects(imageBytes, args.queries, args.max_objects ?? 10);

			const summary = result.objects
				.map((obj) => `- ${obj.label}: [y=${obj.point?.[0]}, x=${obj.point?.[1]}]`)
				.join("\n");

			return {
				content: [
					{
						type: "text" as const,
						text: `Tespit edilen nesneler (${result.objects.length} adet, ${result.durationMs}ms):\n${summary}\n\nRaw JSON:\n${JSON.stringify(result.objects, null, 2)}`,
					},
				],
			};
		},
	};
}

// ============================================================================
// Tool: robotics_bbox - Bounding box tespiti
// ============================================================================

export function createRoboticsBboxToolDefinition(options?: {
	visionModel?: string;
	visionBaseUrl?: string;
	drawOverlay?: boolean;
}): ToolDefinition {
	return {
		name: "robotics_bbox",
		description:
			"Görüntüdeki nesneler için sınırlayıcı kutular (bounding box) döndürür. [ymin, xmin, ymax, xmax] formatında 0-1000 normalize koordinatlar.",
		parameters: Type.Object({
			image_path: Type.String({ description: "Görüntü dosya yolu veya URL" }),
			max_objects: Type.Optional(Type.Number({ description: "Maksimum nesne sayısı. Varsayılan: 25" })),
		}),
		execute: async (_toolCallId, args: { image_path: string; max_objects?: number }) => {
			const capture = new ImageCapture();
			const pipeline = new VisionPipeline({
				model: options?.visionModel,
				baseUrl: options?.visionBaseUrl,
				drawOverlay: options?.drawOverlay ?? true,
			});

			let imageBytes: Buffer;
			if (args.image_path.startsWith("http://") || args.image_path.startsWith("https://")) {
				imageBytes = await capture.fromUrl(args.image_path);
			} else {
				imageBytes = capture.fromFile(args.image_path);
			}

			const result = await pipeline.detectBoundingBoxes(imageBytes, args.max_objects ?? 25);

			const summary = result.objects
				.map(
					(obj) =>
						`- ${obj.label}: [ymin=${obj.box_2d?.[0]}, xmin=${obj.box_2d?.[1]}, ymax=${obj.box_2d?.[2]}, xmax=${obj.box_2d?.[3]}]`,
				)
				.join("\n");

			return {
				content: [
					{
						type: "text" as const,
						text: `Bounding box'lar (${result.objects.length} adet, ${result.durationMs}ms):\n${summary}\n\nRaw JSON:\n${JSON.stringify(result.objects, null, 2)}`,
					},
				],
			};
		},
	};
}

// ============================================================================
// Tool: robotics_trajectory - Yörünge planlama
// ============================================================================

export function createRoboticsTrajectoryToolDefinition(options?: {
	visionModel?: string;
	visionBaseUrl?: string;
	drawOverlay?: boolean;
}): ToolDefinition {
	return {
		name: "robotics_trajectory",
		description:
			"Robot hareketi için yörünge noktaları planlar. Başlangıç nesnesinden hedef konuma kadar ardışık [y, x] koordinatları döndürür.",
		parameters: Type.Object({
			image_path: Type.String({ description: "Görüntü dosya yolu" }),
			start_object: Type.String({ description: "Başlangıç nesnesi (ör: 'kırmızı kalem')" }),
			instruction: Type.String({ description: "Hareket talimatı (ör: 'düzenleyicinin üstüne taşı')" }),
			num_points: Type.Optional(Type.Number({ description: "Yörünge nokta sayısı. Varsayılan: 15" })),
		}),
		execute: async (
			_toolCallId,
			args: { image_path: string; start_object: string; instruction: string; num_points?: number },
		) => {
			const capture = new ImageCapture();
			const pipeline = new VisionPipeline({
				model: options?.visionModel,
				baseUrl: options?.visionBaseUrl,
				drawOverlay: options?.drawOverlay ?? true,
			});

			const imageBytes = capture.fromFile(args.image_path);
			const result = await pipeline.planTrajectory(
				imageBytes,
				args.start_object,
				args.instruction,
				args.num_points ?? 15,
			);

			const summary = result.trajectory.map((t) => `  ${t.order}: [y=${t.point[0]}, x=${t.point[1]}]`).join("\n");

			return {
				content: [
					{
						type: "text" as const,
						text: `Yörünge (${result.trajectory.length} nokta, ${result.durationMs}ms):\n${summary}\n\nRaw JSON:\n${JSON.stringify(result.trajectory, null, 2)}`,
					},
				],
			};
		},
	};
}

// ============================================================================
// Tool: robotics_analyze - Sahne analizi
// ============================================================================

export function createRoboticsAnalyzeToolDefinition(options?: {
	visionModel?: string;
	visionBaseUrl?: string;
}): ToolDefinition {
	return {
		name: "robotics_analyze",
		description:
			"Görüntüdeki sahneyi detaylı analiz eder: nesneler, uzamsal ilişkiler, bağlam. Görev planlamadan önce sahneyi anlamak için kullanılır.",
		parameters: Type.Object({
			image_path: Type.String({ description: "Görüntü dosya yolu" }),
			question: Type.Optional(Type.String({ description: "Sahne hakkında serbest soru (opsiyonel)" })),
		}),
		execute: async (_toolCallId, args: { image_path: string; question?: string }) => {
			const capture = new ImageCapture();
			const pipeline = new VisionPipeline({
				model: options?.visionModel,
				baseUrl: options?.visionBaseUrl,
			});

			let imageBytes: Buffer;
			if (args.image_path.startsWith("http://") || args.image_path.startsWith("https://")) {
				imageBytes = await capture.fromUrl(args.image_path);
			} else {
				imageBytes = capture.fromFile(args.image_path);
			}

			if (args.question) {
				const result = await pipeline.freeformAnalyze(imageBytes, args.question);
				return {
					content: [{ type: "text" as const, text: result.response }],
				};
			}

			const result = await pipeline.analyzeScene(imageBytes);
			return {
				content: [
					{
						type: "text" as const,
						text: `Sahne Analizi (${result.durationMs}ms):\n\n${result.description}\n\nNesneler:\n${result.objects.map((o) => `- ${o.label}: ${o.position}`).join("\n")}`,
					},
				],
			};
		},
	};
}

// ============================================================================
// Tool: robotics_plan - Görev planlama (function calling)
// ============================================================================

export function createRoboticsPlanToolDefinition(options?: {
	visionModel?: string;
	visionBaseUrl?: string;
	robotFunctionsPath?: string;
}): ToolDefinition {
	return {
		name: "robotics_plan",
		description:
			"Converts a natural-language robot task into robot API function calls. Define robot functions first.",
		parameters: Type.Object({
			instruction: Type.String({ description: "Robot task (e.g. 'put the blue block into the orange bowl')" }),
			image_path: Type.Optional(Type.String({ description: "Scene image (optional but recommended)" })),
			functions_path: Type.Optional(
				Type.String({ description: "Robot function-definition JSON path (optional; read from settings)" }),
			),
		}),
		execute: async (_toolCallId, args: { instruction: string; image_path?: string; functions_path?: string }) => {
			const { OllamaVision } = await import("../robotics/ollama-vision.js");
			const { TaskPlanner } = await import("../robotics/task-planner.js");

			const vision = new OllamaVision(options?.visionModel, options?.visionBaseUrl);
			const functionsPath = args.functions_path || options?.robotFunctionsPath;

			let functions = TaskPlanner.mockPickAndPlaceFunctions();
			if (functionsPath && existsSync(resolve(functionsPath))) {
				try {
					functions = TaskPlanner.loadFunctions(resolve(functionsPath));
				} catch {
					// fallback to mock
				}
			}

			const planner = new TaskPlanner(vision, functions);

			let imageBase64: string | undefined;
			if (args.image_path) {
				const capture = new ImageCapture();
				const bytes = capture.fromFile(args.image_path);
				imageBase64 = capture.toBase64(bytes);
			}

			const result = await planner.planTask(args.instruction, imageBase64);

			const actionSummary = result.actions
				.map((a, i) => {
					const argsStr = a.args.map((v) => JSON.stringify(v)).join(", ");
					const reasoning = a.reasoning ? ` // ${a.reasoning}` : "";
					return `${i + 1}. ${a.function}(${argsStr})${reasoning}`;
				})
				.join("\n");

			return {
				content: [
					{
						type: "text" as const,
						text: `Task Plan (${result.actions.length} steps, ${result.durationMs}ms):\n\n${actionSummary}\n\nRaw JSON:\n${JSON.stringify(result.actions, null, 2)}`,
					},
				],
			};
		},
	};
}
