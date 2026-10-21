import type { Model } from "astro-core";
import { modelsAreEqual } from "astro-core";
import type { ModelRegistry } from "./model-registry.js";
import { selectBestAvailableModel } from "./model-resolver.js";

function scoreModel(candidate: Model<any>, current: Model<any>): number {
	let score = 0;
	// Prefer different provider for redundancy
	if (candidate.provider !== current.provider) score += 5;
	// Prefer reasoning-capable models
	if (candidate.reasoning) score += 2;
	// Match modality (image support)
	if (candidate.input?.includes("image") === current.input?.includes("image")) score += 1;
	// Prefer models with larger context windows
	if (candidate.contextWindow && candidate.contextWindow > 32_000) score += 1;
	return score;
}

/** Maximum fallback attempts before giving up */
const _MAX_FALLBACK_ATTEMPTS = 3;

export async function pickFallbackModel(
	current: Model<any> | undefined,
	modelRegistry: ModelRegistry,
	excludeIds?: Set<string>,
): Promise<Model<any> | undefined> {
	if (!current) return undefined;
	const available = await modelRegistry.getAvailable();
	const candidates = available.filter((m) => {
		if (modelsAreEqual(m, current)) return false;
		if (excludeIds?.has(m.id)) return false;
		return true;
	});
	if (candidates.length === 0) return undefined;
	const preferred = selectBestAvailableModel(candidates);
	if (preferred) return preferred;
	candidates.sort((a, b) => scoreModel(b, current) - scoreModel(a, current));
	return candidates[0];
}
