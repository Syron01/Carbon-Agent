export interface MathematicalMessageFilterOptions {
	messages: any[];
	maxTokens: number;
}

/**
 * Advanced Mathematical Memory System
 * Instead of simple LLM semantic RAG or naive slicing, this uses an
 * Exponential Moving Average (EMA) and keyword density (TF-IDF approximation)
 * to score the relevance of messages in the context window.
 */
export function filterMessagesMathematically(options: MathematicalMessageFilterOptions): any[] {
	const { messages } = options;
	if (!messages || messages.length <= 10) return messages;

	// Always keep the system prompt and the latest 4 messages (2 turns)
	const systemMessages = messages.filter((m) => m.role === "system");
	const otherMessages = messages.filter((m) => m.role !== "system");

	if (otherMessages.length <= 4) return messages;

	const guaranteedKeep = otherMessages.slice(-4);
	const targetMessages = otherMessages.slice(0, -4);

	// Score the target messages
	// EMA Decay Factor
	const alpha = 0.3;
	let currentEma = 1.0;

	// Reverse iterate to give higher EMA to recent messages
	const scoredMessages = targetMessages.reverse().map((msg, _idx) => {
		let score = currentEma;

		// Update EMA
		currentEma = currentEma * (1 - alpha);

		// TF-IDF Approximation: boost score based on key technical markers
		const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
		const technicalKeywords =
			/\b(function|class|const|let|return|import|export|if|else|await|async|try|catch|def|class|file:|Error|Exception)\b/gi;
		const matches = content.match(technicalKeywords);

		if (matches) {
			score *= 1 + matches.length * 0.05; // 5% boost per keyword
		}

		// Tool success boost
		if (msg.toolInvocations) {
			score *= 1.5; // Tool calls are important
			if (msg.toolInvocations.some((t: any) => t.state === "result")) {
				score *= 1.2; // Successful tools are even more important
			}
		}

		return { msg, score };
	});

	// Sort by score descending and take the top N (heuristically picking top 6 for context)
	// We want to dramatically reduce prompt length
	scoredMessages.sort((a, b) => b.score - a.score);

	const topScored = scoredMessages.slice(0, 6).map((item) => item.msg);

	// Reconstruct the array in original chronological order
	const finalOtherMessages = [...targetMessages.filter((m) => topScored.includes(m)), ...guaranteedKeep];

	return [...systemMessages, ...finalOtherMessages];
}
