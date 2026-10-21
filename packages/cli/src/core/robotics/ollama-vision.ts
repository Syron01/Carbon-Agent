/**
 * Ollama Vision API wrapper.
 * Sends image + prompt via the /api/generate endpoint.
 */

export interface OllamaVisionOptions {
	temperature?: number;
	num_predict?: number;
	top_p?: number;
	format?: "json";
}

export interface OllamaGenerateResponse {
	model: string;
	response: string;
	done: boolean;
	total_duration?: number;
	eval_count?: number;
}

export class OllamaVision {
	private model: string;
	private baseUrl: string;

	constructor(model = "qwen2.5-vl:7b", baseUrl = "http://localhost:11434") {
		this.model = model;
		this.baseUrl = baseUrl.replace(/\/$/, "");
	}

	/**
	 * Send an image + prompt to Ollama and return the raw response text.
	 * Waits for the stream to complete (until done: true).
	 */
	async generate(prompt: string, imageBase64: string, options?: OllamaVisionOptions): Promise<string> {
		const body: Record<string, unknown> = {
			model: this.model,
			prompt,
			images: [imageBase64],
			stream: false,
			options: {
				temperature: options?.temperature ?? 0.1,
				num_predict: options?.num_predict ?? 4096,
				top_p: options?.top_p ?? 0.9,
			},
		};

		if (options?.format) {
			body.format = options.format;
		}

		const response = await fetch(`${this.baseUrl}/api/generate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "unknown error");
			throw new Error(`Ollama API error (${response.status}): ${errorText}`);
		}

		const data = (await response.json()) as OllamaGenerateResponse;
		return data.response;
	}

	/**
	 * Retrieve output in JSON format and parse it.
	 * Handles cases where Ollama wraps the JSON in a markdown code block.
	 */
	async generateJSON<T = unknown>(
		prompt: string,
		imageBase64: string,
		options?: Omit<OllamaVisionOptions, "format">,
	): Promise<T> {
		const raw = await this.generate(prompt, imageBase64, { ...options, format: "json" });
		return this.parseJSON<T>(raw);
	}

	/**
	 * Checks whether the model is running and available.
	 */
	async healthCheck(): Promise<boolean> {
		try {
			const res = await fetch(`${this.baseUrl}/api/tags`);
			if (!res.ok) return false;
			const data = (await res.json()) as { models?: Array<{ name: string }> };
			const models = data.models ?? [];
			return models.some((m) => m.name.startsWith(this.model.split(":")[0]));
		} catch {
			return false;
		}
	}

	/**
	 * Replaces the current active model.
	 */
	setModel(model: string): void {
		this.model = model;
	}

	getModel(): string {
		return this.model;
	}

	// JSON parse — the model sometimes wraps output in ```json ... ``` fences
	private parseJSON<T>(raw: string): T {
		let cleaned = raw.trim();

		// Strip the markdown code block wrapper
		const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
		if (codeBlockMatch) {
			cleaned = codeBlockMatch[1].trim();
		}

		try {
			return JSON.parse(cleaned) as T;
		} catch {
			// Last resort: find the first occurrence of [ or {
			const startIdx = Math.min(
				cleaned.indexOf("[") === -1 ? Infinity : cleaned.indexOf("["),
				cleaned.indexOf("{") === -1 ? Infinity : cleaned.indexOf("{"),
			);
			if (startIdx !== Infinity) {
				const bracket = cleaned[startIdx];
				const closeBracket = bracket === "[" ? "]" : "}";
				const endIdx = cleaned.lastIndexOf(closeBracket);
				if (endIdx > startIdx) {
					return JSON.parse(cleaned.slice(startIdx, endIdx + 1)) as T;
				}
			}
			throw new Error(`Ollama output could not be parsed as JSON: ${raw.slice(0, 200)}`);
		}
	}
}
