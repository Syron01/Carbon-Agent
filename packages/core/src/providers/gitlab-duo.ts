import type { Api, AssistantMessageEventStream, Context, Model } from "../types.js";
import { createAssistantMessageEventStream } from "../utils/event-stream.js";
import { streamSimpleAnthropic } from "./anthropic.js";
import { streamSimpleOpenAIResponses } from "./openai-responses.js";

const GITLAB_COM_URL = "https://gitlab.com";
const DIRECT_ACCESS_TTL = 25 * 60 * 1000;

interface DirectAccessToken {
	token: string;
	headers: Record<string, string>;
	expiresAt: number;
}

let cachedDirectAccess: DirectAccessToken | null = null;

async function getDirectAccessToken(gitlabAccessToken: string): Promise<DirectAccessToken> {
	const now = Date.now();
	if (cachedDirectAccess && cachedDirectAccess.expiresAt > now) {
		return cachedDirectAccess;
	}

	const response = await fetch(`${GITLAB_COM_URL}/api/v4/ai/third_party_engines/direct_access`, {
		method: "POST",
		headers: { Authorization: `Bearer ${gitlabAccessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify({ feature_flags: { DuoEnginePlatformNext: true } }),
	});

	if (!response.ok) {
		const errorText = await response.text();
		if (response.status === 403) {
			throw new Error(
				`GitLab Duo access denied. Ensure GitLab Duo is enabled for your account. Error: ${errorText}`,
			);
		}
		throw new Error(`Failed to get direct access token: ${response.status} ${errorText}`);
	}

	const data = (await response.json()) as { token: string; headers: Record<string, string> };
	cachedDirectAccess = { token: data.token, headers: data.headers, expiresAt: now + DIRECT_ACCESS_TTL };
	return cachedDirectAccess;
}

export function invalidateGitlabDirectAccessToken() {
	cachedDirectAccess = null;
}

export function streamGitLabDuo(model: Model<Api>, context: Context, options?: any): AssistantMessageEventStream {
	const stream = createAssistantMessageEventStream();

	(async () => {
		try {
			const gitlabAccessToken = options?.apiKey;
			if (!gitlabAccessToken) throw new Error("No GitLab access token. Run /login gitlab-duo or set GITLAB_TOKEN");

			const directAccess = await getDirectAccessToken(gitlabAccessToken);
			const headers = { ...directAccess.headers, Authorization: `Bearer ${directAccess.token}` };
			const streamOptions = { ...options, apiKey: "gitlab-duo", headers };

			const innerStream = model.id.includes("claude")
				? streamSimpleAnthropic(model as Model<"anthropic-messages">, context, streamOptions)
				: streamSimpleOpenAIResponses(model as Model<"openai-responses">, context, streamOptions);

			for await (const event of innerStream) stream.push(event);
			stream.end();
		} catch (error) {
			stream.push({
				type: "error",
				reason: "error",
				error: {
					role: "assistant",
					content: [],
					api: model.api,
					provider: model.provider,
					model: model.id,
					usage: {
						input: 0,
						output: 0,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 0,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
					},
					stopReason: "error",
					errorMessage: error instanceof Error ? error.message : String(error),
					timestamp: Date.now(),
				},
			});
			stream.end();
		}
	})();

	return stream;
}
