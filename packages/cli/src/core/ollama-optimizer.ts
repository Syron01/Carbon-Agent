import chalk from "chalk";

const DEFAULT_BASE_URL = "http://localhost:11434";
const PROFILE_VALUES = {
	turbo: {
		ASTRO_OLLAMA_MODE: "turbo",
		ASTRO_OLLAMA_NUM_CTX: "8192", // 4K→8K: 4K makes real code analysis impossible
		ASTRO_OLLAMA_NUM_BATCH: "1024", // larger batch = faster prefill
		ASTRO_OLLAMA_LOW_VRAM: "true",
		ASTRO_OLLAMA_KEEP_ALIVE: "1h", // 30m→1h: delayed model reload
	},
	balanced: {
		ASTRO_OLLAMA_MODE: "balanced",
		ASTRO_OLLAMA_NUM_CTX: "16384", // 8K→16K: fits medium-sized files
		ASTRO_OLLAMA_NUM_BATCH: "1024",
		ASTRO_OLLAMA_LOW_VRAM: "false",
		ASTRO_OLLAMA_KEEP_ALIVE: "2h",
	},
	quality: {
		ASTRO_OLLAMA_MODE: "quality",
		ASTRO_OLLAMA_NUM_CTX: "32768", // 12K→32K: large file/codebase analysis
		ASTRO_OLLAMA_NUM_BATCH: "512", // smaller batch more stable at large ctx
		ASTRO_OLLAMA_LOW_VRAM: "false",
		ASTRO_OLLAMA_KEEP_ALIVE: "4h",
	},
} as const;

type Profile = keyof typeof PROFILE_VALUES;

export interface OllamaModelTag {
	name: string;
	size?: number;
	modified_at?: string;
	details?: { parameter_size?: string; quantization_level?: string };
}

interface OllamaTagsResponse {
	models?: OllamaModelTag[];
}

function baseUrl(): string {
	return (process.env.OLLAMA_HOST || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function _psSetCommand(values: Record<string, string>): string {
	return Object.entries(values)
		.map(([key, value]) => `$env:${key}="${value}"`)
		.join("; ");
}

function _bashSetCommand(values: Record<string, string>): string {
	return Object.entries(values)
		.map(([key, value]) => `export ${key}=${JSON.stringify(value)}`)
		.join("; ");
}

function formatBytes(bytes?: number): string {
	if (!bytes || !Number.isFinite(bytes)) return "?";
	const units = ["B", "KB", "MB", "GB", "TB"];
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unit]}`;
}

async function fetchJson<T>(path: string): Promise<T> {
	const response = await fetch(`${baseUrl()}${path}`);
	if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
	return (await response.json()) as T;
}

export async function getLocalModels(): Promise<OllamaModelTag[]> {
	const tags = await fetchJson<OllamaTagsResponse>("/api/tags");
	return tags.models ?? [];
}

export async function checkModelAvailability(modelName: string): Promise<boolean> {
	const normalized = modelName.trim().toLowerCase();
	if (!normalized) return false;
	const models = await getLocalModels();
	return models.some((m) => m.name.toLowerCase() === normalized || m.name.toLowerCase().split(":")[0] === normalized);
}

export async function getRunningModels(): Promise<string[]> {
	try {
		const ps = await fetchJson<{ models?: OllamaModelTag[] }>("/api/ps");
		return (ps.models ?? []).map((m) => m.name);
	} catch {
		return [];
	}
}

export async function pullModel(modelName: string, onProgress?: (event: any) => void): Promise<void> {
	const response = await fetch(`${baseUrl()}/api/pull`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: modelName, stream: true }),
	});
	if (!response.ok || !response.body) throw new Error(`${response.status} ${response.statusText}`);
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			if (!line.trim()) continue;
			try {
				const event = JSON.parse(line);
				onProgress?.(event);
				if (event.error) throw new Error(event.error);
			} catch (parseErr) {
				// Skip malformed NDJSON lines; re-throw only real Ollama errors
				if ((parseErr as Error).message && !(parseErr instanceof SyntaxError)) {
					throw parseErr;
				}
			}
		}
	}
}

export async function suggestModels(): Promise<OllamaModelTag[]> {
	const local = await getLocalModels().catch(() => []);
	const popular = [
		"qwen2.5-coder:7b",
		"qwen2.5-coder:14b",
		"deepseek-coder-v2:16b",
		"codestral:22b",
		"llama3.1:8b",
		"mistral-nemo:12b",
		"minimax-m3:cloud",
	];
	const localNames = new Set(local.map((m) => m.name));
	return [...local, ...popular.filter((name) => !localNames.has(name)).map((name) => ({ name }))];
}

function printUsage(): void {
	console.log(`${chalk.bold("Usage:")}
  astro ollama doctor
  astro ollama models
  astro ollama pull <model>
  astro ollama profile <turbo|balanced|quality>

${chalk.bold("Profile effect:")}
  turbo     Low RAM, fast, ${chalk.cyan("8K")} context  — daily use, small files
  balanced  Balanced, ${chalk.cyan("16K")} context — codebase analysis, medium projects
  quality   High RAM, ${chalk.cyan("32K")} context — large files, deep analysis

${chalk.dim("Tip: If the model is slow, try turbo first. If RAM is not enough, switch to balanced.")}

Run: Ctrl + E`);
}

function printProfile(profile: Profile): void {
	const _values = PROFILE_VALUES[profile];
}

async function printDoctor(): Promise<void> {
	try {
		const tags = await fetchJson<OllamaTagsResponse>("/api/tags");
		const models = tags.models ?? [];
		for (const model of models.slice(0, 12)) {
			const details = [model.details?.parameter_size, model.details?.quantization_level].filter(Boolean).join(" / ");
			console.log(
				`  ${chalk.cyan(model.name)} ${chalk.dim(formatBytes(model.size))}${details ? chalk.dim(` · ${details}`) : ""}`,
			);
		}
		if (models.length > 12) console.log(chalk.dim(`  ... ${models.length - 12} more models`));
	} catch (_error) {}

	const _activeProfile = process.env.ASTRO_OLLAMA_MODE || "balanced";
}

export async function handleOllamaCommand(args: string[]): Promise<boolean> {
	if (args[0] !== "ollama") return false;
	const subcommand = args[1] ?? "doctor";
	if (subcommand === "doctor" || subcommand === "status") {
		await printDoctor();
		return true;
	}
	if (subcommand === "models" || subcommand === "list") {
		const models = await getLocalModels();
		const running = new Set(await getRunningModels());
		if (models.length === 0) console.log(chalk.yellow("No local Ollama models."));
		for (const model of models) {
			const _mark = running.has(model.name) ? chalk.green("●") : chalk.dim("○");
		}
		return true;
	}
	if (subcommand === "pull") {
		const model = args[2];
		if (!model) {
			return true;
		}
		await pullModel(model, (event) => {
			const total = event.total || 0;
			const completed = event.completed || 0;
			const pct = total ? ` ${Math.round((completed / total) * 100)}%` : "";
			if (event.status) process.stdout.write(`\r${event.status}${pct}     `);
		});
		return true;
	}
	if (subcommand === "profile") {
		const profile = args[2] as Profile | undefined;
		if (!profile || !(profile in PROFILE_VALUES)) {
			printUsage();
			return true;
		}
		printProfile(profile);
		return true;
	}
	if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
		printUsage();
		return true;
	}
	return false;
}
