import { invalidateGitlabDirectAccessToken } from "../../providers/gitlab-duo.js";
import type { Model } from "../../types.js";
import type { OAuthCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from "./types.js";

const GITLAB_COM_URL = "https://gitlab.com";
const Core_GATEWAY_URL = "https://cloud.gitlab.com";
const ANTHROPIC_PROXY_URL = `${Core_GATEWAY_URL}/ai/v1/proxy/anthropic/`;
const OpenAI_PROXY_URL = `${Core_GATEWAY_URL}/ai/v1/proxy/openai/v1`;

const BUNDLED_CLIENT_ID = "da4edff2e6ebd2bc3208611e2768bc1c1dd7be791dc5ff26ca34ca9ee44f7d4b";
const OAUTH_SCOPES = ["api"];
const REDIRECT_URI = "http://127.0.0.1:8080/callback";

export const GITLAB_MODELS: Model<any>[] = [
	{
		id: "claude-opus-4-5-20251101",
		name: "Claude Opus 4.5",
		provider: "gitlab-duo",
		api: "gitlab-duo-api",
		baseUrl: ANTHROPIC_PROXY_URL,
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
		contextWindow: 200000,
		maxTokens: 32000,
	},
	{
		id: "claude-sonnet-4-5-20250929",
		name: "Claude Sonnet 4.5",
		provider: "gitlab-duo",
		api: "gitlab-duo-api",
		baseUrl: ANTHROPIC_PROXY_URL,
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
		contextWindow: 200000,
		maxTokens: 16384,
	},
	{
		id: "claude-haiku-4-5-20251001",
		name: "Claude Haiku 4.5",
		provider: "gitlab-duo",
		api: "gitlab-duo-api",
		baseUrl: ANTHROPIC_PROXY_URL,
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
		contextWindow: 200000,
		maxTokens: 8192,
	},
	{
		id: "gpt-5.1-2025-11-13",
		name: "GPT-5.1",
		provider: "gitlab-duo",
		api: "gitlab-duo-api",
		baseUrl: OpenAI_PROXY_URL,
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 2.5, output: 10, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 16384,
	},
	{
		id: "gpt-5-mini-2025-08-07",
		name: "GPT-5 Mini",
		provider: "gitlab-duo",
		api: "gitlab-duo-api",
		baseUrl: OpenAI_PROXY_URL,
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 0.15, output: 0.6, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 16384,
	},
	{
		id: "gpt-5-codex",
		name: "GPT-5 Codex",
		provider: "gitlab-duo",
		api: "gitlab-duo-api",
		baseUrl: OpenAI_PROXY_URL,
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 2.5, output: 10, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 16384,
	},
];

async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	const verifier = btoa(String.fromCharCode(...array))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
	const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
	const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
	return { verifier, challenge };
}

export async function loginGitLab(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
	const { verifier, challenge } = await generatePKCE();
	const authParams = new URLSearchParams({
		client_id: BUNDLED_CLIENT_ID,
		redirect_uri: REDIRECT_URI,
		response_type: "code",
		scope: OAUTH_SCOPES.join(" "),
		code_challenge: challenge,
		code_challenge_method: "S256",
		state: crypto.randomUUID(),
	});

	callbacks.onAuth({ url: `${GITLAB_COM_URL}/oauth/authorize?${authParams.toString()}` });
	const code = await new Promise<string>((resolve, reject) => {
		const httpName = "node:http";
		const http = require(httpName);
		const server = http.createServer((req: any, res: any) => {
			try {
				const url = new URL(req.url || "", REDIRECT_URI);
				if (url.pathname === "/callback") {
					const code = url.searchParams.get("code");
					if (code) {
						res.writeHead(200, { "Content-Type": "text/html" });
						res.end(
							"<html><body><h1 style='font-family:sans-serif'>Authentication successful!</h1><p style='font-family:sans-serif'>You can close this tab and return to Astro-Agent.</p><script>setTimeout(() => window.close(), 1000)</script></body></html>",
						);
						server.close();
						resolve(code);
					} else {
						res.writeHead(400, { "Content-Type": "text/plain" });
						res.end("Missing authorization code.");
						server.close();
						reject(new Error("Missing authorization code in callback URL."));
					}
				} else {
					res.writeHead(404);
					res.end();
				}
			} catch (_err) {
				// ignore
			}
		});

		server.listen(8080, "127.0.0.1", () => {});

		// Timeout after 5 minutes
		setTimeout(
			() => {
				server.close();
				reject(new Error("Authentication timed out."));
			},
			5 * 60 * 1000,
		);
	});

	const tokenResponse = await fetch(`${GITLAB_COM_URL}/oauth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: BUNDLED_CLIENT_ID,
			grant_type: "authorization_code",
			code,
			code_verifier: verifier,
			redirect_uri: REDIRECT_URI,
		}).toString(),
	});

	if (!tokenResponse.ok) throw new Error(`Token exchange failed: ${await tokenResponse.text()}`);
	const data = (await tokenResponse.json()) as {
		access_token: string;
		refresh_token: string;
		expires_in: number;
		created_at: number;
	};

	invalidateGitlabDirectAccessToken();
	return {
		refresh: data.refresh_token,
		access: data.access_token,
		expires: (data.created_at + data.expires_in) * 1000 - 5 * 60 * 1000,
	};
}

export async function refreshGitLabToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
	const response = await fetch(`${GITLAB_COM_URL}/oauth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: BUNDLED_CLIENT_ID,
			grant_type: "refresh_token",
			refresh_token: credentials.refresh,
		}).toString(),
	});
	if (!response.ok) throw new Error(`Token refresh failed: ${await response.text()}`);
	const data = (await response.json()) as {
		access_token: string;
		refresh_token: string;
		expires_in: number;
		created_at: number;
	};

	invalidateGitlabDirectAccessToken();
	return {
		refresh: data.refresh_token,
		access: data.access_token,
		expires: (data.created_at + data.expires_in) * 1000 - 5 * 60 * 1000,
	};
}

export const gitlabOAuthProvider: OAuthProviderInterface = {
	id: "gitlab-duo",
	name: "GitLab Duo",
	usesCallbackServer: false,
	async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
		return loginGitLab(callbacks);
	},
	async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
		return refreshGitLabToken(credentials);
	},
	getApiKey(credentials: OAuthCredentials): string {
		return credentials.access;
	},
};
