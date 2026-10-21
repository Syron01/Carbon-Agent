import type { Model, SimpleStreamOptions, StreamFunction } from "../types.js";
import {
	type OpenAICompletionsOptions,
	streamOpenAICompletions,
	streamSimpleOpenAICompletions,
} from "./openai-completions.js";

const OLLAMA_BASE_URL = "http://localhost:11434/v1";
const DEFAULT_KEEP_ALIVE = "30m";

type OllamaMode = "turbo" | "balanced" | "quality";

type OllamaPayload = Record<string, unknown> & {
	max_tokens?: number;
	max_completion_tokens?: number;
	stream_options?: unknown;
	options?: Record<string, unknown>;
	keep_alive?: string;
};

function env(name: string): string | undefined {
	return typeof process === "undefined" ? undefined : process.env[name];
}

function envNumber(name: string): number | undefined {
	const value = env(name);
	if (!value) return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function envBoolean(name: string): boolean | undefined {
	const value = env(name)?.toLowerCase();
	if (!value) return undefined;
	if (["1", "true", "yes", "on"].includes(value)) return true;
	if (["0", "false", "no", "off"].includes(value)) return false;
	return undefined;
}

function resolveMode(): OllamaMode {
	const mode = env("ASTRO_OLLAMA_MODE")?.toLowerCase();
	return mode === "turbo" || mode === "quality" || mode === "balanced" ? mode : "balanced";
}

function compactModel(model: Model<"openai-completions">): Model<"openai-completions"> {
	return {
		...model,
		baseUrl: model.baseUrl || OLLAMA_BASE_URL,
		compat: {
			...model.compat,
			supportsStore: false,
			supportsDeveloperRole: false,
			supportsReasoningEffort: false,
			supportsUsageInStreaming: false,
			maxTokensField: "max_tokens",
			supportsStrictMode: false,
			supportsLongCacheRetention: false,
		},
	};
}

function buildOllamaOptions(maxTokens?: number): Record<string, unknown> {
	const mode = resolveMode();
	const threads = envNumber("ASTRO_OLLAMA_THREADS");
	const profile: Record<OllamaMode, Record<string, unknown>> = {
		turbo: {
			num_ctx: 4096,
			num_predict: maxTokens ?? 2048,
			num_batch: 512,
			low_vram: false,
			top_k: 30,
			top_p: 0.9,
			repeat_penalty: 1.08,
			...(threads !== undefined ? { num_thread: threads } : {}),
		},
		balanced: {
			num_ctx: 8192,
			num_predict: maxTokens ?? 4096,
			num_batch: 512,
			low_vram: false,
			top_k: 40,
			top_p: 0.92,
			repeat_penalty: 1.1,
			...(threads !== undefined ? { num_thread: threads } : {}),
		},
		quality: {
			num_ctx: 12288,
			num_predict: maxTokens ?? 8192,
			num_batch: 256,
			low_vram: false,
			top_k: 50,
			top_p: 0.95,
			repeat_penalty: 1.08,
			...(threads !== undefined ? { num_thread: threads } : {}),
		},
	};

	return {
		...profile[mode],
		...(envNumber("ASTRO_OLLAMA_NUM_CTX") ? { num_ctx: envNumber("ASTRO_OLLAMA_NUM_CTX") } : {}),
		...(envNumber("ASTRO_OLLAMA_NUM_PREDICT") ? { num_predict: envNumber("ASTRO_OLLAMA_NUM_PREDICT") } : {}),
		...(envNumber("ASTRO_OLLAMA_NUM_BATCH") ? { num_batch: envNumber("ASTRO_OLLAMA_NUM_BATCH") } : {}),
		...(envNumber("ASTRO_OLLAMA_NUM_THREAD") ? { num_thread: envNumber("ASTRO_OLLAMA_NUM_THREAD") } : {}),
		...(envNumber("ASTRO_OLLAMA_NUM_GPU") ? { num_gpu: envNumber("ASTRO_OLLAMA_NUM_GPU") } : {}),
		...(envBoolean("ASTRO_OLLAMA_LOW_VRAM") !== undefined ? { low_vram: envBoolean("ASTRO_OLLAMA_LOW_VRAM") } : {}),
	};
}

function optimizePayload(payload: unknown, maxTokens?: number): OllamaPayload {
	if (!payload || typeof payload !== "object") return payload as OllamaPayload;
	const next = { ...(payload as OllamaPayload) };
	delete next.stream_options;

	const desiredMaxTokens =
		envNumber("ASTRO_OLLAMA_NUM_PREDICT") ?? maxTokens ?? next.max_tokens ?? next.max_completion_tokens;
	if (typeof desiredMaxTokens === "number") {
		next.max_tokens = desiredMaxTokens;
		delete next.max_completion_tokens;
	}

	next.options = {
		...buildOllamaOptions(typeof desiredMaxTokens === "number" ? desiredMaxTokens : undefined),
		...(next.options ?? {}),
	};
	next.keep_alive = env("ASTRO_OLLAMA_KEEP_ALIVE") ?? next.keep_alive ?? DEFAULT_KEEP_ALIVE;
	return next;
}

function withOllamaPayloadTuning<T extends OpenAICompletionsOptions | SimpleStreamOptions>(options?: T): T | undefined {
	return {
		...options,
		onPayload: async (payload: unknown, model: Model<any>) => {
			const tuned = optimizePayload(payload, options?.maxTokens);
			const nextPayload = await options?.onPayload?.(tuned, model);
			return nextPayload ?? tuned;
		},
	} as T;
}

/**
 * Ollama provider.
 * Uses the local OpenAI-compatible endpoint plus Ollama-native knobs for lower RAM,
 * warmer model residency and higher sustained token throughput.
 */
export const streamOllama: StreamFunction<"openai-completions", OpenAICompletionsOptions> = (
	model,
	context,
	options,
) => {
	return streamOpenAICompletions(compactModel(model), context, withOllamaPayloadTuning(options));
};

export const streamSimpleOllama: StreamFunction<"openai-completions", SimpleStreamOptions> = (
	model,
	context,
	options,
) => {
	return streamSimpleOpenAICompletions(compactModel(model), context, withOllamaPayloadTuning(options));
};
