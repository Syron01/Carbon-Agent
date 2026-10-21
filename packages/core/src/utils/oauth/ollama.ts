import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Api, Model } from "../../types.js";
import type { OAuthCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from "./types.js";

const _execPromise = promisify(exec);

/**
 * Ollama "OAuth" Provider (Discovery & Auto-start)
 */
export async function loginOllama(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
	const { onProgress, onInfo } = callbacks;

	onProgress?.("Ollama durumu kontrol ediliyor...");

	const isRunning = async () => {
		try {
			const res = await fetch("http://localhost:11434/api/tags");
			return res.ok;
		} catch {
			return false;
		}
	};

	if (!(await isRunning())) {
		onProgress?.("Ollama calismiyor. Baslatiliyor...");
		try {
			if (process.platform === "win32") {
				exec("start ollama");
			} else if (process.platform === "darwin") {
				exec("open -a Ollama");
			} else {
				exec("ollama serve &");
			}

			for (let i = 0; i < 10; i++) {
				await new Promise((r) => setTimeout(r, 1000));
				if (await isRunning()) break;
				onProgress?.(`Ollama bekleniyor... (${i + 1}s)`);
			}
		} catch (err) {
			throw new Error(`Ollama baslatilamadi: ${err}`);
		}
	}

	if (!(await isRunning())) {
		throw new Error("Ollama baslatilamadi. Lutfen manuel olarak acin.");
	}

	onProgress?.("Ollama aktif. Modeller cekiliyor...");

	let modelNames: string[] = [];
	try {
		const res = await fetch("http://localhost:11434/api/tags");
		const data = (await res.json()) as { models: any[] };
		modelNames = data.models.map((m: any) => m.name);

		if (onInfo) {
			onInfo([
				"Ollama baglantisi basarili!",
				"",
				"Bulunan modeller:",
				...modelNames.map((name) => ` - ${name}`),
				"",
				"Bu modeller artik AstroAgent icinde kullanilabilir.",
			]);
		}
	} catch (_err) {
		onProgress?.("Model listesi cekilemedi ama Ollama calisiyor.");
	}

	return {
		access: "ollama",
		refresh: "ollama",
		expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
		models: modelNames, // Store discovered models in credentials
	};
}

export const ollamaOAuthProvider: OAuthProviderInterface = {
	id: "ollama",
	name: "Ollama (Local Provider)",
	usesCallbackServer: false,

	async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
		return loginOllama(callbacks);
	},

	async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
		return credentials;
	},

	getApiKey(_credentials: OAuthCredentials): string {
		return "ollama";
	},

	modifyModels(models: Model<Api>[], credentials: OAuthCredentials): Model<Api>[] {
		const discoveredNames = credentials.models as string[] | undefined;
		if (!discoveredNames || discoveredNames.length === 0) {
			return models;
		}

		const ollamaModels: Model<Api>[] = discoveredNames.map((name) => ({
			id: name,
			name: name,
			api: "openai-completions",
			provider: "ollama",
			baseUrl: "http://localhost:11434/v1",
			reasoning: name.includes("thinking") || name.includes("coder"), // simple heuristic
			input: ["text"],
			cost: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
			},
			contextWindow: 32000,
			maxTokens: 4096,
		}));

		// Filter out existing ollama models and add the newly discovered ones
		const otherModels = models.filter((m) => m.provider !== "ollama");
		return [...otherModels, ...ollamaModels];
	},
};
