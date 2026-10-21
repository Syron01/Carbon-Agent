import type { Engine } from "./engine.js";

/**
 * Auto-Healer Module
 * Automatically analyzes failed terminal commands or code errors
 * and attempts to fix them by providing contextual prompts to the LLM.
 */
export class AutoHealer {
	private retryCount = 0;
	private lastErrorFingerprint: string | null = null;
	private readonly MAX_RETRIES = 3;

	constructor(private session: Engine) {}

	/**
	 * Run the auto-healer loop.
	 * @param contextText Optional error output or stack trace. If not provided, it analyzes recent history.
	 */
	public async run(contextText?: string): Promise<void> {
		if (this.retryCount >= this.MAX_RETRIES) {
			console.warn("[AutoHealer] Maximum retry limit reached for this session. Stopping to avoid loops.");
			this.retryCount = 0; // Reset for next manual trigger
			return;
		}

		if (!contextText) {
			// Find the last terminal output or assistant error
			const history = this.session.state.messages.slice(-5);
			const lastError = history.find(
				(m: any) =>
					(m.role === "assistant" && m.stopReason === "error") ||
					(m.role === "user" && /stderr|error|failed/i.test(JSON.stringify(m.content))),
			);

			if (lastError) {
				contextText = JSON.stringify((lastError as any).content || lastError);
			} else {
				contextText = "Projede son yapılan değişiklikleri analiz et ve stabiliteyi kontrol et.";
			}
		}

		const currentFingerprint = contextText.slice(0, 500);
		if (currentFingerprint === this.lastErrorFingerprint) {
			this.retryCount++;
		} else {
			this.retryCount = 1;
			this.lastErrorFingerprint = currentFingerprint;
		}

		const prompt = `[AUTO-HEALER TRIGGERED - Deneme ${this.retryCount}/${this.MAX_RETRIES}]\nBir sorun algılandı. Lütfen analizi yap ve düzeltmeleri uygula:\n\n${contextText}`;

		if (this.session.state.isStreaming) {
			this.session.steer({ role: "user", content: [{ type: "text", text: prompt }], timestamp: Date.now() });
		} else {
			await this.session.prompt(prompt);
		}
	}
}
