import type { Api, Model } from "../types.js";

/** Workers Core direct endpoint. */
export const CLOUDFLARE_WORKERS_Core_BASE_URL =
	"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/v1";

/** Core Gateway Unified API. https://developers.cloudflare.com/ai-gateway/usage/unified-api/ */
export const CLOUDFLARE_Core_GATEWAY_COMPAT_BASE_URL =
	"https://gateway.ai.cloudflare.com/v1/{CLOUDFLARE_ACCOUNT_ID}/{CLOUDFLARE_GATEWAY_ID}/compat";

/** Core Gateway → OpenAI passthrough. Used until /compat supports /v1/responses. */
export const CLOUDFLARE_Core_GATEWAY_OpenAI_BASE_URL =
	"https://gateway.ai.cloudflare.com/v1/{CLOUDFLARE_ACCOUNT_ID}/{CLOUDFLARE_GATEWAY_ID}/openai";

/** Core Gateway → Anthropic passthrough. */
export const CLOUDFLARE_Core_GATEWAY_ANTHROPIC_BASE_URL =
	"https://gateway.ai.cloudflare.com/v1/{CLOUDFLARE_ACCOUNT_ID}/{CLOUDFLARE_GATEWAY_ID}/anthropic";

export function isCloudflareProvider(provider: string): boolean {
	return provider === "cloudflare-workers-ai" || provider === "cloudflare-ai-gateway";
}

/** Substitute `{VAR}` placeholders in a Cloudflare baseUrl from process.env. */
export function resolveCloudflareBaseUrl(model: Model<Api>): string {
	const url = model.baseUrl;
	if (!url.includes("{")) return url;
	const baseUrl = url.replace(/\{([A-Z_][A-Z0-9_]*)\}/g, (_match, name: string) => {
		const value = process.env[name];
		if (!value) {
			throw new Error(`${name} is required for provider ${model.provider} but is not set.`);
		}
		return value;
	});
	return baseUrl;
}
