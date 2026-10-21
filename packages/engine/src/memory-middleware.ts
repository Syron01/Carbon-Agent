import { compressMessages, fetchMemory, saveFact } from "astro-core";
import type { EngineMessage } from "./types.js";

export interface MemStats {
	durationMs: number;
	originalCount: number;
	compressedCount: number;
	reduction: string;
	factsInjected: number;
}

const OPT_SYSTEM_PROMPT =
	"You are a high-performance AI assistant with access to a deterministic relational memory graph. When memory context is provided in [MEMORY] blocks, use it to answer accurately. Be concise, direct, and DO NOT narrate your thought process (e.g., do not say 'The user is asking...' or 'I will reply with...'). Just give the answer.";

/**
 * Memory Middleware:
 * 1. Takes all current messages and current query.
 * 2. Uses RFF to compress context.
 * 3. Uses Grover Oracle + SQLite to fetch facts.
 * 4. Injects facts into the prompt dynamically.
 */
export async function memoryMiddleware(
	messages: EngineMessage[],
): Promise<{ messages: EngineMessage[]; memStats: MemStats }> {
	if (messages.length === 0) {
		return {
			messages,
			memStats: { durationMs: 0, originalCount: 0, compressedCount: 0, reduction: "0%", factsInjected: 0 },
		};
	}

	const startMs = Date.now();

	const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
	const queryText = lastUserMsg && typeof lastUserMsg.content === "string" ? lastUserMsg.content : "";

	// 1. RFF Compression
	const compression = compressMessages(messages as any, queryText);
	const processedMessages = compression.messages;

	// 2. Fetch Facts
	let memoryFacts: string[] = [];
	if (queryText) {
		memoryFacts = fetchMemory(queryText);
	}

	// 3. Inject Facts into System Prompt or Last User Message
	const finalMessages = [...processedMessages];

	// Append the OPT system prompt to preserve existing personality
	const systemIndex = finalMessages.findIndex((m) => (m.role as string) === "system");
	if (systemIndex !== -1) {
		const existing = finalMessages[systemIndex];
		const currentText = typeof existing.content === "string" ? existing.content : "";
		finalMessages[systemIndex] = {
			...existing,
			content: `${currentText}\n\n${OPT_SYSTEM_PROMPT}`,
		} as any;
	} else {
		finalMessages.unshift({ role: "system", content: OPT_SYSTEM_PROMPT } as any);
	}

	// Inject facts
	if (memoryFacts.length > 0) {
		const lastUserIdx = finalMessages.map((m) => m.role).lastIndexOf("user");
		if (lastUserIdx !== -1) {
			const memBlock = `[MEMORY]\n${memoryFacts.map((f) => `• ${f}`).join("\n")}\n[/MEMORY]\n\n`;
			const msg = finalMessages[lastUserIdx] as any;

			let newContent = memBlock;
			if (typeof msg.content === "string") {
				newContent += msg.content;
			} else if (Array.isArray(msg.content)) {
				const textParts = msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text);
				newContent += textParts.join("\n");
			}

			finalMessages[lastUserIdx] = {
				...msg,
				content: newContent,
			} as any;
		}
	}

	const durationMs = Date.now() - startMs;

	return {
		messages: finalMessages,
		memStats: {
			durationMs,
			originalCount: compression.stats?.originalCount || messages.length,
			compressedCount: compression.stats?.compressedCount || processedMessages.length,
			reduction: compression.stats?.reduction || "0%",
			factsInjected: memoryFacts.length,
		},
	};
}

/**
 * Fact extraction: Parses LLM responses and user inputs to save relations to R-Graph.
 */
export function extractAndSaveFacts(userMsg: string, assistantReply: string): void {
	// To prevent regex catastrophic backtracking on huge code blocks, we limit the string length
	// We only care about conversational facts, which usually appear early in the prompt.
	const safeUser = userMsg.slice(0, 500);
	const safeAssistant = assistantReply.slice(0, 500);
	const combined = `${safeUser} ${safeAssistant}`.toLowerCase();

	try {
		const nameMatch =
			combined.match(/(?:benim\s+)?ad[ıi]m\s+([a-zğüşıöç]+)/i) || combined.match(/my\s+name\s+is\s+([a-z]+)/i);
		if (nameMatch) {
			saveFact("user", "has_name", nameMatch[1].toLowerCase());
		}

		const isMatch = combined.match(/([a-z0-9ğüşıöç]{3,})\s+is\s+([a-z0-9ğüşıöç]{3,})/i);
		if (isMatch) {
			saveFact(isMatch[1].toLowerCase(), "is", isMatch[2].toLowerCase());
		}

		const eqMatch = combined.match(/([a-z0-9ğüşıöç]{3,})\s*=\s*([a-z0-9ğüşıöç]{3,})/i);
		if (eqMatch) {
			saveFact(eqMatch[1].toLowerCase(), "equals", eqMatch[2].toLowerCase());
		}
	} catch (e) {
		console.error("[Memory] Fact extraction error:", e);
	}
}
