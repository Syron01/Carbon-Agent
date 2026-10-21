import { type Api, completeSimple, type Model } from "astro-core";

export interface FusionState {
	enabled: boolean;
	thinkModel: { provider: string; id: string } | null;
	codeModel: { provider: string; id: string } | null;
}

const THINK_TIMEOUT_MS = 30_000;
const THINK_MAX_TOKENS = 4000;

export interface FusionThinkResult {
	plan: string;
	aborted: boolean;
}

export async function runFusionThink(
	fusion: FusionState,
	userPrompt: string,
	opts: {
		modelRegistry: {
			find: (provider: string, id: string) => Model<Api> | undefined;
			authStorage: { get: (provider: string) => { key: string } | undefined };
		};
		onStatus?: (msg: string) => void;
		signal?: AbortSignal;
	},
): Promise<FusionThinkResult | null> {
	if (!fusion.enabled || !fusion.thinkModel || !fusion.codeModel) return null;

	const modelObj = opts.modelRegistry.find(fusion.thinkModel.provider, fusion.thinkModel.id);
	if (!modelObj) {
		opts.onStatus?.(`⚠️ Think model '${fusion.thinkModel.id}' bulunamadı, fusion atlanıyor.`);
		return null;
	}

	const apiKey = opts.modelRegistry.authStorage.get(fusion.thinkModel.provider)?.key;
	if (!apiKey) {
		opts.onStatus?.(`⚠️ Think model API anahtarı bulunamadı, fusion atlanıyor.`);
		return null;
	}

	opts.onStatus?.(`🧠 Fusion: ${fusion.thinkModel.id} planlıyor...`);

	const ac = new AbortController();
	const timeout = setTimeout(() => {
		ac.abort();
		opts.onStatus?.("⚠️ Fusion think zaman aşımına uğradı (30s), normal moda devam ediliyor.");
	}, THINK_TIMEOUT_MS);

	if (opts.signal) {
		opts.signal.addEventListener(
			"abort",
			() => {
				ac.abort();
			},
			{ once: true },
		);
	}

	try {
		const response = await completeSimple(
			modelObj,
			{
				systemPrompt: `You are a world-class senior architect. Your ONLY job is to produce a concise, actionable plan.
You NEVER write code. You NEVER produce any output outside the <plan> tags.

Output format — exactly this, nothing else:
<plan>
[Step 1: ...
 Step 2: ...
 ...]
Key considerations:
- ...
Risks:
- ...
</plan>

The plan must be:
- Specific file paths and function names (never vague)
- Ordered dependencies (step N depends on step N-1)
- Framework/lib choices consistent with existing codebase patterns`,
				messages: [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: `Plan the implementation for this task. Output ONLY valid <plan> tags:\n\n${userPrompt}`,
							},
						],
						timestamp: Date.now(),
					},
				],
			},
			{
				apiKey,
				maxTokens: THINK_MAX_TOKENS,
				signal: ac.signal,
			},
		);

		if (response.stopReason === "error" || response.stopReason === "aborted") {
			opts.onStatus?.("⚠️ Fusion think başarısız oldu, normal moda devam ediliyor.");
			return null;
		}

		const text =
			(response.content as Array<{ type: string; text: string }>).find((c) => c.type === "text")?.text || "";
		if (!text) {
			opts.onStatus?.("⚠️ Fusion think boş döndü, normal moda devam ediliyor.");
			return null;
		}

		const planMatch = text.match(/<plan>([\s\S]*?)<\/plan>/);
		const plan = planMatch ? planMatch[1].trim() : text.trim();

		opts.onStatus?.(`✅ Fusion: ${fusion.codeModel.id} kodluyor...`);
		return { plan, aborted: false };
	} catch (e: unknown) {
		const msg = (e as Error).message || String(e);
		if (msg.includes("abort") || msg.includes("timeout")) {
			opts.onStatus?.("⚠️ Fusion think iptal edildi, normal moda devam ediliyor.");
		} else {
			opts.onStatus?.(`⚠️ Fusion think hatası: ${msg}`);
		}
		return null;
	} finally {
		clearTimeout(timeout);
	}
}
