/**
 * Custom message types and transformers for the coding engine.
 *
 * Extends the base EngineMessage type with cli specific message types,
 * and provides a transformer to convert them to Provider-compatible messages.
 */

import type { ImageContent, Message, TextContent } from "astro-core";
import type { EngineMessage } from "astro-engine";
import { optimizePromptText } from "./token-optimizer.js";

export const COMPACTION_SUMMARY_PREFIX = `Prior context compacted:\n<summary>\n`;

export const COMPACTION_SUMMARY_SUFFIX = `\n</summary>`;

export const BRANCH_SUMMARY_PREFIX = `Branch context:\n<summary>\n`;

export const BRANCH_SUMMARY_SUFFIX = `\n</summary>`;

// ── LLM context limits (applied by convertToLlm before sending to provider) ──
const USER_CONTEXT_MAX_CHARS = 4_000;
const ASSISTANT_CONTEXT_MAX_CHARS = 2_000;
const TOOL_RESULT_CONTEXT_MAX_CHARS = 1_500;
const CUSTOM_CONTEXT_MAX_CHARS = 2_000;

// ── Storage limits (applied at engine state + session persistence level) ──
/** Tool results stored in engine state are capped — prevents unbounded session bloat */
export const MAX_STORED_TOOL_RESULT_CHARS = 2_000;
/** User messages at rest are capped to avoid storing huge prompts */
export const MAX_STORED_USER_CHARS = 3_000;
/** Assistant text (excluding thinking) stored in engine state */
export const MAX_STORED_ASSISTANT_CHARS = 2_000;
/** Bash execution output stored in engine state */
export const MAX_STORED_BASH_OUTPUT_CHARS = 1_500;

/**
 * Truncate a message for persistent storage (engine state + session file).
 * This prevents token explosion from accumulating full tool results, bash output, etc.
 * The display layer still works — it renders whatever is stored.
 */
export function compactMessageForStorage(message: EngineMessage): EngineMessage {
	if (!message || typeof message !== "object") return message;
	try {
		switch (message.role) {
			case "toolResult": {
				return {
					...message,
					content: compactTextContent(message.content, MAX_STORED_TOOL_RESULT_CHARS),
				};
			}
			case "assistant": {
				return {
					...message,
					content: message.content
						.filter((part) => part.type !== "thinking")
						.map((part) => {
							if (part.type === "text") {
								return { ...part, text: compactContextText(part.text, MAX_STORED_ASSISTANT_CHARS) };
							}
							return part;
						}),
				};
			}
			case "user": {
				if (typeof message.content === "string") {
					return { ...message, content: compactContextText(message.content, MAX_STORED_USER_CHARS) };
				}
				return { ...message, content: compactTextContent(message.content, MAX_STORED_USER_CHARS) };
			}
			case "bashExecution": {
				const bashMsg = message as BashExecutionMessage;
				if (bashMsg.output && bashMsg.output.length > MAX_STORED_BASH_OUTPUT_CHARS) {
					const optimized = optimizePromptText(bashMsg.output).optimizedText;
					return {
						...bashMsg,
						output: compactContextText(optimized, MAX_STORED_BASH_OUTPUT_CHARS),
						truncated: true,
					};
				}
				return bashMsg;
			}
			default:
				return message;
		}
	} catch {
		return message;
	}
}

function compactContextText(text: string, maxChars: number): string {
	const optimized = optimizePromptText(text).optimizedText;
	if (optimized.length <= maxChars) return optimized;

	// Keep more tail than head — recent content is most relevant for continuation
	const headChars = Math.floor(maxChars * 0.35);
	const tailChars = maxChars - headChars;
	const skippedChars = optimized.length - maxChars;
	return `${optimized.slice(0, headChars)}\n\n…[${skippedChars}ch trimmed]…\n\n${optimized.slice(-tailChars)}`;
}

function compactTextContent<T extends { type: string; text?: string }>(content: T[], maxChars: number): T[] {
	return content.map((part) =>
		part.type === "text" && typeof part.text === "string"
			? { ...part, text: compactContextText(part.text, maxChars) }
			: part,
	);
}

/**
 * Message type for bash executions via the ! command.
 */
export interface BashExecutionMessage {
	role: "bashExecution";
	command: string;
	output: string;
	exitCode: number | undefined;
	cancelled: boolean;
	truncated: boolean;
	fullOutputPath?: string;
	timestamp: number;
	/** If true, this message is excluded from Provider context (!! prefix) */
	excludeFromContext?: boolean;
}

/**
 * Message type for extension-injected messages via sendMessage().
 * These are custom messages that extensions can inject into the conversation.
 */
export interface CustomMessage<T = unknown> {
	role: "custom";
	customType: string;
	content: string | (TextContent | ImageContent)[];
	display: boolean;
	details?: T;
	timestamp: number;
}

export interface BranchSummaryMessage {
	role: "branchSummary";
	summary: string;
	fromId: string;
	timestamp: number;
}

export interface CompactionSummaryMessage {
	role: "compactionSummary";
	summary: string;
	tokensBefore: number;
	timestamp: number;
}

// Extend CustomEngineMessages via declaration merging
declare module "astro-engine" {
	interface CustomEngineMessages {
		bashExecution: BashExecutionMessage;
		custom: CustomMessage;
		branchSummary: BranchSummaryMessage;
		compactionSummary: CompactionSummaryMessage;
	}
}

/**
 * Convert a BashExecutionMessage to user message text for Provider context.
 */
export function bashExecutionToText(msg: BashExecutionMessage): string {
	let text = `$ ${msg.command}\n`;
	if (msg.output) {
		const optimizedOutput = optimizePromptText(msg.output).optimizedText;
		text += `\`\`\`\n${optimizedOutput}\n\`\`\``;
	} else {
		text += "(no output)";
	}
	if (msg.cancelled) {
		text += "\n(cancelled)";
	} else if (msg.exitCode !== null && msg.exitCode !== undefined && msg.exitCode !== 0) {
		text += `\n→ ${msg.exitCode}`;
	}
	if (msg.truncated && msg.fullOutputPath) {
		text += `\n[truncated: ${msg.fullOutputPath}]`;
	}
	return text;
}

export function createBranchSummaryMessage(summary: string, fromId: string, timestamp: string): BranchSummaryMessage {
	return {
		role: "branchSummary",
		summary,
		fromId,
		timestamp: new Date(timestamp).getTime(),
	};
}

export function createCompactionSummaryMessage(
	summary: string,
	tokensBefore: number,
	timestamp: string,
): CompactionSummaryMessage {
	return {
		role: "compactionSummary",
		summary: summary,
		tokensBefore,
		timestamp: new Date(timestamp).getTime(),
	};
}

/** Convert CustomMessageEntry to EngineMessage format */
export function createCustomMessage(
	customType: string,
	content: string | (TextContent | ImageContent)[],
	display: boolean,
	details: unknown | undefined,
	timestamp: string,
): CustomMessage {
	return {
		role: "custom",
		customType,
		content,
		display,
		details,
		timestamp: new Date(timestamp).getTime(),
	};
}

/**
 * Transform EngineMessages (including custom types) to Provider-compatible Messages.
 *
 * This is used by:
 * - Engine's transormToLlm option (for prompt calls and queued messages)
 * - Compaction's generateSummary (for summarization)
 * - Custom extensions and tools
 */
export function convertToLlm(messages: EngineMessage[]): Message[] {
	return messages
		.map((m): Message | undefined => {
			switch (m.role) {
				case "bashExecution":
					// Skip messages excluded from context (!! prefix)
					if (m.excludeFromContext) {
						return undefined;
					}
					return {
						role: "user",
						content: [
							{ type: "text", text: compactContextText(bashExecutionToText(m), TOOL_RESULT_CONTEXT_MAX_CHARS) },
						],
						timestamp: m.timestamp,
					};
				case "custom": {
					const content =
						typeof m.content === "string"
							? [{ type: "text" as const, text: compactContextText(m.content, CUSTOM_CONTEXT_MAX_CHARS) }]
							: m.content.map((part) =>
									part.type === "text"
										? { ...part, text: compactContextText(part.text, CUSTOM_CONTEXT_MAX_CHARS) }
										: part,
								);
					return {
						role: "user",
						content,
						timestamp: m.timestamp,
					};
				}
				case "branchSummary":
					return {
						role: "user",
						content: [{ type: "text" as const, text: BRANCH_SUMMARY_PREFIX + m.summary + BRANCH_SUMMARY_SUFFIX }],
						timestamp: m.timestamp,
					};
				case "compactionSummary":
					return {
						role: "user",
						content: [
							{ type: "text" as const, text: COMPACTION_SUMMARY_PREFIX + m.summary + COMPACTION_SUMMARY_SUFFIX },
						],
						timestamp: m.timestamp,
					};
				case "user":
					return {
						...m,
						content:
							typeof m.content === "string"
								? compactContextText(m.content, USER_CONTEXT_MAX_CHARS)
								: compactTextContent(m.content, USER_CONTEXT_MAX_CHARS),
					};
				case "assistant":
					return {
						...m,
						content: compactTextContent(
							m.content.filter((part) => part.type !== "thinking"),
							ASSISTANT_CONTEXT_MAX_CHARS,
						),
					};
				case "toolResult":
					return {
						...m,
						content: compactTextContent(m.content, TOOL_RESULT_CONTEXT_MAX_CHARS),
					};
				default:
					// biome-ignore lint/correctness/noSwitchDeclarations: fine
					const _exhaustiveCheck: never = m;
					return undefined;
			}
		})
		.filter((m) => m !== undefined);
}
