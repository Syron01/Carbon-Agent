import { MODELS } from "./models.generated.js";
import type { Api, KnownProvider, Model, ModelThinkingLevel, Usage } from "./types.js";
import { GITLAB_MODELS } from "./utils/oauth/gitlab.js";

const modelRegistry: Map<string, Map<string, Model<Api>>> = new Map();

// Initialize registry from MODELS on module load
for (const [provider, models] of Object.entries(MODELS)) {
	const providerModels = new Map<string, Model<Api>>();
	for (const [id, model] of Object.entries(models)) {
		providerModels.set(id, model as Model<Api>);
	}
	modelRegistry.set(provider, providerModels);
}

async function fetchJSON(url: string, timeoutMs = 2000): Promise<any> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, { signal: controller.signal });
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

async function getLocalOllamaModels(): Promise<string[]> {
	try {
		const data = await fetchJSON("http://localhost:11434/api/tags");
		if (data && Array.isArray(data.models)) {
			return data.models.map((m: any) => m.name);
		}
	} catch {}
	return [];
}

async function getLocalLMStudioModels(): Promise<string[]> {
	try {
		const data = await fetchJSON("http://localhost:1234/v1/models");
		if (data && Array.isArray(data.data)) {
			return data.data.map((m: any) => m.id || m.name).filter(Boolean);
		}
	} catch {}
	return [];
}

// Inject Cloud & Local Ollama + LM Studio models dynamically
// Use top-level await to initialize local models eagerly
const localInitResult = await Promise.allSettled([getLocalOllamaModels(), getLocalLMStudioModels()]);
const [ollamaModels, lmStudioModels] = [
	localInitResult[0].status === "fulfilled" ? localInitResult[0].value : [],
	localInitResult[1].status === "fulfilled" ? localInitResult[1].value : [],
];

// Ollama
const ollamaMap = new Map<string, Model<Api>>();
const allOllamaIds = ["gemma4:31b-cloud", "nemotron-3-super:cloud", "minimax-m3:cloud", ...ollamaModels];
for (const id of new Set(allOllamaIds)) {
	ollamaMap.set(id, {
		id,
		name: id,
		api: "openai-completions",
		provider: "ollama",
		baseUrl: "http://localhost:11434/v1",
		reasoning: id.includes("thinking") || id.includes("coder"),
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 16384,
	} as Model<Api>);
}
modelRegistry.set("ollama", ollamaMap);

// LM Studio — always register provider with at least one entry
const lmStudioMap = new Map<string, Model<Api>>();
if (lmStudioModels.length > 0) {
	for (const id of lmStudioModels) {
		lmStudioMap.set(id, {
			id,
			name: id,
			api: "openai-completions",
			provider: "lmstudio",
			baseUrl: "http://localhost:1234/v1",
			input: ["text"],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128000,
			maxTokens: 16384,
		} as Model<Api>);
	}
} else {
	// Placeholder so provider always shows up
	lmStudioMap.set("lmstudio:default", {
		id: "lmstudio:default",
		name: "Start LM Studio to see models",
		api: "openai-completions",
		provider: "lmstudio",
		baseUrl: "http://localhost:1234/v1",
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 0,
		maxTokens: 0,
	} as Model<Api>);
}
modelRegistry.set("lmstudio", lmStudioMap);

// Inject GitLab Duo models dynamically
const gitlabDuoModelsMap = new Map<string, Model<Api>>();
for (const model of GITLAB_MODELS) {
	gitlabDuoModelsMap.set(model.id, model as Model<Api>);
}
modelRegistry.set("gitlab-duo", gitlabDuoModelsMap);

export function getModel(provider: string, modelId: string): Model<any> | undefined {
	const providerModels = modelRegistry.get(provider);
	return providerModels?.get(modelId);
}

export function getProviders(): KnownProvider[] {
	return Array.from(modelRegistry.keys()) as KnownProvider[];
}

export function getModels(provider: string): Model<any>[] {
	const models = modelRegistry.get(provider);
	return models ? Array.from(models.values()) : [];
}

/**
 * Re-check for local Ollama and LM Studio models.
 * Updates the registry in place if new models are found.
 * Returns true if models were updated.
 */
export async function refreshLocalModels(): Promise<boolean> {
	const [ollamaNew, lmStudioNew] = await Promise.all([getLocalOllamaModels(), getLocalLMStudioModels()]);

	let changed = false;

	// Update Ollama
	const existingOllama = modelRegistry.get("ollama");
	if (existingOllama) {
		for (const id of ollamaNew) {
			if (!existingOllama.has(id)) {
				existingOllama.set(id, {
					id,
					name: id,
					api: "openai-completions",
					provider: "ollama",
					baseUrl: "http://localhost:11434/v1",
					reasoning: id.includes("thinking") || id.includes("coder"),
					input: ["text"],
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
					contextWindow: 128000,
					maxTokens: 16384,
				} as Model<Api>);
				changed = true;
			}
		}
	}

	// Update LM Studio
	const existingLMStudio = modelRegistry.get("lmstudio");
	if (existingLMStudio) {
		// Remove placeholder if real models found
		if (lmStudioNew.length > 0 && existingLMStudio.has("lmstudio:default")) {
			existingLMStudio.delete("lmstudio:default");
			changed = true;
		}
		for (const id of lmStudioNew) {
			if (!existingLMStudio.has(id)) {
				existingLMStudio.set(id, {
					id,
					name: id,
					api: "openai-completions",
					provider: "lmstudio",
					baseUrl: "http://localhost:1234/v1",
					input: ["text"],
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
					contextWindow: 128000,
					maxTokens: 16384,
				} as Model<Api>);
				changed = true;
			}
		}
	}

	return changed;
}

export function calculateCost<TApi extends Api>(model: Model<TApi>, usage: Usage): Usage["cost"] {
	usage.cost.input = (model.cost.input / 1000000) * usage.input;
	usage.cost.output = (model.cost.output / 1000000) * usage.output;
	usage.cost.cacheRead = (model.cost.cacheRead / 1000000) * usage.cacheRead;
	usage.cost.cacheWrite = (model.cost.cacheWrite / 1000000) * usage.cacheWrite;
	usage.cost.total = usage.cost.input + usage.cost.output + usage.cost.cacheRead + usage.cost.cacheWrite;
	return usage.cost;
}

const EXTENDED_THINKING_LEVELS: ModelThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh"];

export function getSupportedThinkingLevels<TApi extends Api>(model: Model<TApi>): ModelThinkingLevel[] {
	if (!model.reasoning) return ["off"];

	return EXTENDED_THINKING_LEVELS.filter((level) => {
		const mapped = model.thinkingLevelMap?.[level];
		if (mapped === null) return false;
		if (level === "xhigh") return mapped !== undefined;
		return true;
	});
}

export function clampThinkingLevel<TApi extends Api>(
	model: Model<TApi>,
	level: ModelThinkingLevel,
): ModelThinkingLevel {
	const availableLevels = getSupportedThinkingLevels(model);
	if (availableLevels.includes(level)) return level;

	const requestedIndex = EXTENDED_THINKING_LEVELS.indexOf(level);
	if (requestedIndex === -1) return availableLevels[0] ?? "off";

	for (let i = requestedIndex; i < EXTENDED_THINKING_LEVELS.length; i++) {
		const candidate = EXTENDED_THINKING_LEVELS[i];
		if (availableLevels.includes(candidate)) return candidate;
	}
	for (let i = requestedIndex - 1; i >= 0; i--) {
		const candidate = EXTENDED_THINKING_LEVELS[i];
		if (availableLevels.includes(candidate)) return candidate;
	}
	return availableLevels[0] ?? "off";
}

/**
 * Check if two models are equal by comparing both their id and provider.
 * Returns false if either model is null or undefined.
 */
export function modelsAreEqual<TApi extends Api>(
	a: Model<TApi> | null | undefined,
	b: Model<TApi> | null | undefined,
): boolean {
	if (!a || !b) return false;
	return a.id === b.id && a.provider === b.provider;
}
