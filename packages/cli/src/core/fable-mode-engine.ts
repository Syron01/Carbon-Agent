/**
 * Fable-Mode Engine for Astro-Agent
 *
 * Integrates fable-mode's staged execution discipline:
 * 1. Stage Map (decompose before acting)
 * 2. Parallel Delegation (route sub-tasks to appropriate models)
 * 3. Failable Verification (check each stage with testable conditions)
 * 4. Self-Critique (skeptical review before delivery)
 *
 * Model tier routing:
 *   fable-opus   → strongest available model
 *   fable-sonnet → balanced mid-range model
 *   fable-haiku  → fast/cheap model
 */

import type { Api, Model } from "astro-core";
import { completeSimple } from "astro-core";
import { modelCache } from "./cache.js";
export type FableModelTier = "opus" | "sonnet" | "haiku";

export interface FableRequest {
	task: string;
	tier?: FableModelTier;
	images?: Array<{ type: string; data: string; mimeType: string }>;
}

export interface FableStage {
	number: number;
	name: string;
	expectedOutput: string;
	failableCheck: string;
}

export interface FablePlan {
	stages: FableStage[];
	strategy: string;
}

// Model tier resolution: maps fable tiers to actual model IDs
const TIER_PATTERNS: Record<FableModelTier, Array<{ provider: string; idPattern: string }>> = {
	opus: [
		{ provider: "openai", idPattern: "o1" },
		{ provider: "openai", idPattern: "o3" },
		{ provider: "anthropic", idPattern: "claude-opus" },
		{ provider: "anthropic", idPattern: "claude-sonnet-4" },
		{ provider: "google", idPattern: "gemini-2.5-pro" },
		{ provider: "google", idPattern: "gemini-2.0-pro" },
	],
	sonnet: [
		{ provider: "anthropic", idPattern: "claude-sonnet" },
		{ provider: "openai", idPattern: "gpt-4o" },
		{ provider: "google", idPattern: "gemini-2.5-flash" },
		{ provider: "google", idPattern: "gemini-2.0-flash" },
	],
	haiku: [
		{ provider: "anthropic", idPattern: "claude-haiku" },
		{ provider: "openai", idPattern: "gpt-4o-mini" },
		{ provider: "google", idPattern: "gemini-2.5-flash" },
		{ provider: "google", idPattern: "gemini-1.5-flash" },
		{ provider: "openai", idPattern: "gpt-4o-mini" },
	],
};

export function resolveModelForTier(
	tier: FableModelTier,
	modelRegistry: {
		find: (provider: string, idPattern: string) => Model<Api> | undefined;
		getAll?: () => Array<Model<Api>>;
	},
): Model<Api> | undefined {
	// Check cache first
	const cacheKey = `fable:tier:${tier}`;
	const cached = modelCache.get(cacheKey);
	if (cached) return cached as Model<Api>;

	const patterns = TIER_PATTERNS[tier];
	if (!patterns) return undefined;

	// First try exact pattern matches
	for (const { provider, idPattern } of patterns) {
		const found = modelRegistry.find(provider, idPattern);
		if (found) {
			modelCache.set(cacheKey, found);
			return found;
		}
	}

	// Fallback: search all available models for tier keywords
	const allModels = modelRegistry.getAll?.() || [];
	const tierKeywords: Record<FableModelTier, string[]> = {
		opus: ["o1", "o3", "opus", "sonnet-4", "2.5-pro", "pro"],
		sonnet: ["sonnet", "gpt-4o", "2.5-flash"],
		haiku: ["haiku", "mini", "flash"],
	};

	const keywords = tierKeywords[tier];
	const found = allModels.find((m) => keywords.some((k) => m.id.toLowerCase().includes(k)));
	if (found) modelCache.set(cacheKey, found);
	return found;
}

// Fable system prompt builder
export function buildFableSystemPrompt(plan?: FablePlan): string {
	const stageMap = plan?.stages
		? plan.stages
				.map(
					(s) =>
						`Stage ${s.number}: ${s.name}
  Expected: ${s.expectedOutput}
  Verify: ${s.failableCheck}`,
				)
				.join("\n")
		: "";

	return `<fable-mode>
You are operating in FABLE MODE — a disciplined execution framework.

## Core Protocol

### 1. Stage Map
Before acting, write numbered stages. Each stage produces exactly ONE verifiable artifact.
${stageMap ? `\nPre-planned stages:\n${stageMap}\n` : "\nPlan stages before starting work."}

### 2. Delegate Independent Work
Route sub-tasks to appropriate tools. Use invoke_subagent for work that can run in parallel.

### 3. Failable Verification
Each stage MUST pass a check that can actually fail:
- A test that runs and passes
- A file that exists with expected content
- An output diffed against spec
"I reviewed it and it looks right" is NOT a check.

### 4. Self-Critique Before Delivery
Before presenting final output, review as a skeptical peer. 
Hunt for real weaknesses. Fix or flag them.

## Operational Rules
1. Never flag a problem you haven't confirmed exists
2. Batch minor concerns; surface at threshold
3. Anchor all edits on word boundaries
</fable-mode>`;
}

// Generate a stage plan for a given task
export async function generateFablePlan(
	task: string,
	opts: {
		modelRegistry: {
			find: (provider: string, id: string) => Model<Api> | undefined;
			authStorage: { get: (provider: string) => { key: string } | undefined };
		};
		onStatus?: (msg: string) => void;
	},
): Promise<FablePlan | null> {
	const plannerModel =
		resolveModelForTier("opus", opts.modelRegistry) || resolveModelForTier("sonnet", opts.modelRegistry);
	if (!plannerModel) {
		opts.onStatus?.("⚠️ Fable: No suitable model found for planning");
		return null;
	}

	const apiKey = opts.modelRegistry.authStorage.get(plannerModel.provider)?.key;
	if (!apiKey) {
		opts.onStatus?.("⚠️ Fable: No API key for planning model");
		return null;
	}

	opts.onStatus?.("📋 Fable: Generating stage plan...");

	try {
		const response = await completeSimple(
			plannerModel,
			{
				systemPrompt: `You are a disciplined software architect. Given a task, produce a numbered stage plan.

Each stage must:
1. Have a clear name
2. Produce ONE verifiable artifact
3. Define a FAILABLE check (a command, file read, or test that proves it works)

Output ONLY valid JSON:
{
  "strategy": "one-paragraph approach summary",
  "stages": [
    { "number": 1, "name": "Stage name", "expectedOutput": "What this stage produces", "failableCheck": "exact command or check to verify" }
  ]
}`,
				messages: [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: `Create a fable-mode execution plan for:\n\n${task}`,
							},
						],
						timestamp: Date.now(),
					},
				],
			},
			{
				apiKey,
				maxTokens: 2000,
			},
		);

		const text =
			(response.content as Array<{ type: string; text: string }>).find((c) => c.type === "text")?.text || "";
		if (!text) return null;

		// Extract JSON from response
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (!jsonMatch) return null;

		const plan = JSON.parse(jsonMatch[0]) as FablePlan;
		opts.onStatus?.(`📋 Fable: ${plan.stages.length} stages planned`);
		return plan;
	} catch (e) {
		opts.onStatus?.(`⚠️ Fable: Plan generation failed: ${(e as Error).message}`);
		return null;
	}
}

// Full fable execution: plan → execute → verify
export async function runFable(
	request: FableRequest,
	opts: {
		modelRegistry: {
			find: (provider: string, id: string) => Model<Api> | undefined;
			authStorage: { get: (provider: string) => { key: string } | undefined };
		};
		onStatus?: (msg: string) => void;
		onPlan?: (plan: FablePlan) => void;
	},
): Promise<{ prompt: string; plan?: FablePlan }> {
	const tier = request.tier || "sonnet";

	// Step 1: Generate plan
	const plan = await generateFablePlan(request.task, opts);
	if (plan) {
		opts.onPlan?.(plan);
	}

	// Step 2: Build enhanced prompt with fable context
	const fablePrompt = buildFableSystemPrompt(plan ?? undefined);
	const codeModel = resolveModelForTier(tier, opts.modelRegistry);
	const codeModelHint = codeModel ? `\n\nExecution model: ${codeModel.provider}/${codeModel.id}` : "";

	const enhancedPrompt = `${fablePrompt}${codeModelHint}

## Task

${request.task}

${plan ? `\n---\nApproved plan with ${plan.stages.length} stages. Execute each stage and verify.` : ""}`;

	return {
		prompt: enhancedPrompt,
		plan: plan ?? undefined,
	};
}
