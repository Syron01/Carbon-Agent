/**
 * Engine loop that works with EngineMessage throughout.
 * Transforms to Message[] only at the Provider call boundary.
 */

import {
	type AssistantMessage,
	type Context,
	EventStream,
	streamSimple,
	type ToolResultMessage,
	validateToolArguments,
} from "astro-core";
import type {
	EngineContext,
	EngineEvent,
	EngineLoopConfig,
	EngineMessage,
	EngineTool,
	EngineToolCall,
	EngineToolResult,
	StreamFn,
} from "./types.js";

export type EngineEventSink = (event: EngineEvent) => Promise<void> | void;

/**
 * Start an engine loop with a new prompt message.
 * The prompt is added to the context and events are emitted for it.
 */
export function engineLoop(
	prompts: EngineMessage[],
	context: EngineContext,
	config: EngineLoopConfig,
	signal?: AbortSignal,
	streamFn?: StreamFn,
): EventStream<EngineEvent, EngineMessage[]> {
	const stream = createEngineStream();

	void runEngineLoop(
		prompts,
		context,
		config,
		async (event) => {
			stream.push(event);
		},
		signal,
		streamFn,
	)
		.then((messages) => {
			stream.end(messages);
		})
		.catch((err) => {
			console.error("[engine-loop] Fatal error in engineLoop:", err);
			stream.end([]);
		});

	return stream;
}

/**
 * Continue an engine loop from the current context without adding a new message.
 * Used for retries - context already has user message or tool results.
 *
 * **Important:** The last message in context must convert to a `user` or `toolResult` message
 * via `convertToLlm`. If it doesn't, the Provider provider will reject the request.
 * This cannot be validated here since `convertToLlm` is only called once per turn.
 */
export function engineLoopContinue(
	context: EngineContext,
	config: EngineLoopConfig,
	signal?: AbortSignal,
	streamFn?: StreamFn,
): EventStream<EngineEvent, EngineMessage[]> {
	if (context.messages.length === 0) {
		throw new Error("Cannot continue: no messages in context");
	}

	if (context.messages[context.messages.length - 1].role === "assistant") {
		throw new Error("Cannot continue from message role: assistant");
	}

	const stream = createEngineStream();

	void runEngineLoopContinue(
		context,
		config,
		async (event) => {
			stream.push(event);
		},
		signal,
		streamFn,
	)
		.then((messages) => {
			stream.end(messages);
		})
		.catch((err) => {
			console.error("[engine-loop] Fatal error in engineLoopContinue:", err);
			stream.end([]);
		});

	return stream;
}

export async function runEngineLoop(
	prompts: EngineMessage[],
	context: EngineContext,
	config: EngineLoopConfig,
	emit: EngineEventSink,
	signal?: AbortSignal,
	streamFn?: StreamFn,
): Promise<EngineMessage[]> {
	const newMessages: EngineMessage[] = [...prompts];
	const currentContext: EngineContext = {
		...context,
		messages: [...context.messages, ...prompts],
	};

	await emit({ type: "engine_start" });
	await emit({ type: "turn_start" });
	for (const prompt of prompts) {
		await emit({ type: "message_start", message: prompt });
		await emit({ type: "message_end", message: prompt });
	}

	await runLoop(currentContext, newMessages, config, signal, emit, streamFn);
	return newMessages;
}

export async function runEngineLoopContinue(
	context: EngineContext,
	config: EngineLoopConfig,
	emit: EngineEventSink,
	signal?: AbortSignal,
	streamFn?: StreamFn,
): Promise<EngineMessage[]> {
	if (context.messages.length === 0) {
		throw new Error("Cannot continue: no messages in context");
	}

	if (context.messages[context.messages.length - 1].role === "assistant") {
		throw new Error("Cannot continue from message role: assistant");
	}

	const newMessages: EngineMessage[] = [];
	const currentContext: EngineContext = { ...context };

	await emit({ type: "engine_start" });
	await emit({ type: "turn_start" });

	await runLoop(currentContext, newMessages, config, signal, emit, streamFn);
	return newMessages;
}

function createEngineStream(): EventStream<EngineEvent, EngineMessage[]> {
	return new EventStream<EngineEvent, EngineMessage[]>(
		(event: EngineEvent) => event.type === "engine_end",
		(event: EngineEvent) => (event.type === "engine_end" ? event.messages : []),
	);
}

/**
 * Main loop logic shared by engineLoop and engineLoopContinue.
 */
async function runLoop(
	currentContext: EngineContext,
	newMessages: EngineMessage[],
	config: EngineLoopConfig,
	signal: AbortSignal | undefined,
	emit: EngineEventSink,
	streamFn?: StreamFn,
): Promise<void> {
	let firstTurn = true;
	// Check for steering messages at start (user may have typed while waiting)
	let pendingMessages: EngineMessage[] = (await config.getSteeringMessages?.()) || [];

	let consecutiveRedundantTurns = 0;
	const MAX_REDUNDANT_TURNS = 3;
	let lastToolCallFingerprint: string | null = null;

	// Outer loop: continues when queued follow-up messages arrive after engine would stop
	while (true) {
		let hasMoreToolCalls = true;

		// Inner loop: process tool calls and steering messages
		while (hasMoreToolCalls || pendingMessages.length > 0) {
			if (!firstTurn) {
				await emit({ type: "turn_start" });
			} else {
				firstTurn = false;
			}

			// Process pending messages (inject before next assistant response)
			if (pendingMessages.length > 0) {
				for (const message of pendingMessages) {
					await emit({ type: "message_start", message });
					await emit({ type: "message_end", message });
					currentContext.messages.push(message);
					newMessages.push(message);
				}
				pendingMessages = [];
			}

			// Stream assistant response
			const message = await streamAssistantResponse(currentContext, config, signal, emit, streamFn);
			newMessages.push(message);

			if (message.stopReason === "error" || message.stopReason === "aborted") {
				await emit({ type: "turn_end", message, toolResults: [] });
				await emit({ type: "engine_end", messages: newMessages });
				return;
			}

			// Check for tool calls
			const toolCalls = message.content.filter((c): c is EngineToolCall => c.type === "toolCall");

			// Loop protection: detect if we are repeating the same tool calls
			if (toolCalls.length > 0) {
				const fingerprint = JSON.stringify(toolCalls.map((tc) => ({ name: tc.name, args: tc.arguments })));
				if (fingerprint === lastToolCallFingerprint) {
					consecutiveRedundantTurns++;
					if (consecutiveRedundantTurns >= MAX_REDUNDANT_TURNS) {
						const errorMsg =
							"Loop detected: The agent is repeating the same tool calls without progress. Stopping to save tokens.";
						const errorResult: ToolResultMessage = {
							role: "toolResult",
							toolCallId: toolCalls[0]?.id || "unknown",
							toolName: toolCalls[0]?.name || "unknown",
							isError: true,
							timestamp: Date.now(),
							content: [{ type: "text", text: errorMsg }],
						};
						currentContext.messages.push(errorResult);
						newMessages.push(errorResult);
						await emit({ type: "turn_end", message, toolResults: [errorResult] });
						await emit({ type: "engine_end", messages: newMessages });
						return;
					}
				} else {
					consecutiveRedundantTurns = 0;
					lastToolCallFingerprint = fingerprint;
				}
			}

			const toolResults: ToolResultMessage[] = [];
			hasMoreToolCalls = false;
			if (toolCalls.length > 0) {
				const executedToolBatch = await executeToolCalls(currentContext, message, config, signal, emit);
				toolResults.push(...executedToolBatch.messages);
				hasMoreToolCalls = !executedToolBatch.terminate;

				for (const result of toolResults) {
					currentContext.messages.push(result);
					newMessages.push(result);
				}
			}

			await emit({ type: "turn_end", message, toolResults });

			if (
				await config.shouldStopAfterTurn?.({
					message,
					toolResults,
					context: currentContext,
					newMessages,
				})
			) {
				await emit({ type: "engine_end", messages: newMessages });
				return;
			}

			pendingMessages = (await config.getSteeringMessages?.()) || [];
		}

		// Engine would stop here. Check for follow-up messages.
		const followUpMessages = (await config.getFollowUpMessages?.()) || [];
		if (followUpMessages.length > 0) {
			// Set as pending so inner loop processes them
			pendingMessages = followUpMessages;
			continue;
		}

		// No more messages, exit
		break;
	}

	await emit({ type: "engine_end", messages: newMessages });
}

/**
 * Stream an assistant response from the Provider.
 * This is where EngineMessage[] gets transformed to Message[] for the Provider.
 */
async function streamAssistantResponse(
	context: EngineContext,
	config: EngineLoopConfig,
	signal: AbortSignal | undefined,
	emit: EngineEventSink,
	streamFn?: StreamFn,
): Promise<AssistantMessage> {
	// Apply context transform if configured (EngineMessage[] → EngineMessage[])
	let messages = context.messages;
	if (config.transformContext) {
		messages = await config.transformContext(messages, signal);
	}

	// Convert to Provider-compatible messages (EngineMessage[] → Message[])
	const llmMessages = await config.convertToLlm(messages);

	// Build Provider context
	const llmContext: Context = {
		systemPrompt: context.systemPrompt,
		messages: llmMessages,
		tools: context.tools,
	};

	const streamFunction = streamFn || streamSimple;

	// Resolve API key (important for expiring tokens)
	const resolvedApiKey =
		(config.getApiKey ? await config.getApiKey(config.model.provider) : undefined) || (config as any).apiKey;

	const response = await streamFunction(config.model, llmContext, {
		...config,
		apiKey: resolvedApiKey,
		signal,
	});

	let partialMessage: AssistantMessage | null = null;
	let addedPartial = false;

	for await (const event of response) {
		switch (event.type) {
			case "start":
				partialMessage = event.partial;
				context.messages.push(partialMessage);
				addedPartial = true;
				await emit({ type: "message_start", message: { ...partialMessage } });
				break;

			case "text_start":
			case "text_delta":
			case "text_end":
			case "thinking_start":
			case "thinking_delta":
			case "thinking_end":
			case "toolcall_start":
			case "toolcall_delta":
			case "toolcall_end":
				if (partialMessage) {
					partialMessage = event.partial;
					context.messages[context.messages.length - 1] = partialMessage;
					await emit({
						type: "message_update",
						assistantMessageEvent: event,
						message: { ...partialMessage },
					});
				}
				break;

			case "done":
			case "error": {
				const finalMessage = await response.result();

				if (addedPartial) {
					context.messages[context.messages.length - 1] = finalMessage;
				} else {
					context.messages.push(finalMessage);
				}
				if (!addedPartial) {
					await emit({ type: "message_start", message: { ...finalMessage } });
				}
				await emit({ type: "message_end", message: finalMessage });
				return finalMessage;
			}
		}
	}

	const finalMessage = await response.result();
	if (addedPartial) {
		context.messages[context.messages.length - 1] = finalMessage;
	} else {
		context.messages.push(finalMessage);
		await emit({ type: "message_start", message: { ...finalMessage } });
	}
	await emit({ type: "message_end", message: finalMessage });
	return finalMessage;
}

/**
 * Execute tool calls from an assistant message.
 */
async function executeToolCalls(
	currentContext: EngineContext,
	assistantMessage: AssistantMessage,
	config: EngineLoopConfig,
	signal: AbortSignal | undefined,
	emit: EngineEventSink,
): Promise<ExecutedToolCallBatch> {
	const toolCalls = assistantMessage.content.filter((c): c is EngineToolCall => c.type === "toolCall");
	const hasSequentialToolCall = toolCalls.some(
		(tc: EngineToolCall) => currentContext.tools?.find((t) => t.name === tc.name)?.executionMode === "sequential",
	);
	if (config.toolExecution === "sequential" || hasSequentialToolCall) {
		return executeToolCallsSequential(currentContext, assistantMessage, toolCalls, config, signal, emit);
	}
	return executeToolCallsParallel(currentContext, assistantMessage, toolCalls, config, signal, emit);
}

type ExecutedToolCallBatch = {
	messages: ToolResultMessage[];
	terminate: boolean;
};

async function executeToolCallsSequential(
	currentContext: EngineContext,
	assistantMessage: AssistantMessage,
	toolCalls: EngineToolCall[],
	config: EngineLoopConfig,
	signal: AbortSignal | undefined,
	emit: EngineEventSink,
): Promise<ExecutedToolCallBatch> {
	const finalizedCalls: FinalizedToolCallOutcome[] = [];
	const messages: ToolResultMessage[] = [];

	for (const toolCall of toolCalls) {
		if (signal?.aborted) {
			break;
		}
		await emit({
			type: "tool_execution_start",
			toolCallId: toolCall.id,
			toolName: toolCall.name,
			args: toolCall.arguments,
		});

		const preparation = await prepareToolCall(currentContext, assistantMessage, toolCall, config, signal);
		let finalized: FinalizedToolCallOutcome;
		if (preparation.kind === "immediate") {
			finalized = {
				toolCall,
				result: preparation.result,
				isError: preparation.isError,
			};
		} else {
			const executed = await executePreparedToolCall(preparation, signal, emit);
			finalized = await finalizeExecutedToolCall(
				currentContext,
				assistantMessage,
				preparation,
				executed,
				config,
				signal,
			);
		}

		await emitToolExecutionEnd(finalized, emit);
		const toolResultMessage = createToolResultMessage(finalized);
		await emitToolResultMessage(toolResultMessage, emit);
		finalizedCalls.push(finalized);
		messages.push(toolResultMessage);
	}

	return {
		messages,
		terminate: shouldTerminateToolBatch(finalizedCalls),
	};
}

async function executeToolCallsParallel(
	currentContext: EngineContext,
	assistantMessage: AssistantMessage,
	toolCalls: EngineToolCall[],
	config: EngineLoopConfig,
	signal: AbortSignal | undefined,
	emit: EngineEventSink,
): Promise<ExecutedToolCallBatch> {
	const finalizedCalls: FinalizedToolCallEntry[] = [];

	for (const toolCall of toolCalls) {
		await emit({
			type: "tool_execution_start",
			toolCallId: toolCall.id,
			toolName: toolCall.name,
			args: toolCall.arguments,
		});

		const preparation = await prepareToolCall(currentContext, assistantMessage, toolCall, config, signal);
		if (preparation.kind === "immediate") {
			const finalized = {
				toolCall,
				result: preparation.result,
				isError: preparation.isError,
			} satisfies FinalizedToolCallOutcome;
			await emitToolExecutionEnd(finalized, emit);
			finalizedCalls.push(finalized);
			continue;
		}

		finalizedCalls.push(async () => {
			if (signal?.aborted) throw new Error("Tool execution aborted");
			const executed = await executePreparedToolCall(preparation, signal, emit);
			const finalized = await finalizeExecutedToolCall(
				currentContext,
				assistantMessage,
				preparation,
				executed,
				config,
				signal,
			);
			await emitToolExecutionEnd(finalized, emit);
			return finalized;
		});
	}

	const orderedFinalizedCalls = await Promise.all(
		finalizedCalls.map((entry) => (typeof entry === "function" ? entry() : Promise.resolve(entry))),
	);
	const messages: ToolResultMessage[] = [];
	for (const finalized of orderedFinalizedCalls) {
		const toolResultMessage = createToolResultMessage(finalized);
		await emitToolResultMessage(toolResultMessage, emit);
		messages.push(toolResultMessage);
	}

	return {
		messages,
		terminate: shouldTerminateToolBatch(orderedFinalizedCalls),
	};
}

type PreparedToolCall = {
	kind: "prepared";
	toolCall: EngineToolCall;
	tool: EngineTool<any>;
	args: unknown;
};

type ImmediateToolCallOutcome = {
	kind: "immediate";
	result: EngineToolResult<any>;
	isError: boolean;
};

type ExecutedToolCallOutcome = {
	result: EngineToolResult<any>;
	isError: boolean;
};

type FinalizedToolCallOutcome = {
	toolCall: EngineToolCall;
	result: EngineToolResult<any>;
	isError: boolean;
};

type FinalizedToolCallEntry = FinalizedToolCallOutcome | (() => Promise<FinalizedToolCallOutcome>);

function shouldTerminateToolBatch(finalizedCalls: FinalizedToolCallOutcome[]): boolean {
	return finalizedCalls.length > 0 && finalizedCalls.every((finalized) => finalized.result.terminate === true);
}

function prepareToolCallArguments(tool: EngineTool<any>, toolCall: EngineToolCall): EngineToolCall {
	if (!tool.prepareArguments) {
		return toolCall;
	}
	const preparedArguments = tool.prepareArguments(toolCall.arguments);
	if (preparedArguments === toolCall.arguments) {
		return toolCall;
	}
	return {
		...toolCall,
		arguments: preparedArguments as Record<string, any>,
	};
}

async function prepareToolCall(
	currentContext: EngineContext,
	assistantMessage: AssistantMessage,
	toolCall: EngineToolCall,
	config: EngineLoopConfig,
	signal: AbortSignal | undefined,
): Promise<PreparedToolCall | ImmediateToolCallOutcome> {
	const tool = currentContext.tools?.find((t) => t.name === toolCall.name);
	if (!tool) {
		return {
			kind: "immediate",
			result: createErrorToolResult(`Tool ${toolCall.name} not found`),
			isError: true,
		};
	}

	try {
		const preparedToolCall = prepareToolCallArguments(tool, toolCall);
		const validatedArgs = validateToolArguments(tool, preparedToolCall);
		if (config.beforeToolCall) {
			const beforeResult = await config.beforeToolCall(
				{
					assistantMessage,
					toolCall,
					args: validatedArgs,
					context: currentContext,
				},
				signal,
			);
			if (beforeResult?.block) {
				return {
					kind: "immediate",
					result: createErrorToolResult(beforeResult.reason || "Tool execution was blocked"),
					isError: true,
				};
			}
		}
		return {
			kind: "prepared",
			toolCall,
			tool,
			args: validatedArgs,
		};
	} catch (error) {
		return {
			kind: "immediate",
			result: createErrorToolResult(error instanceof Error ? error.message : String(error)),
			isError: true,
		};
	}
}

async function executePreparedToolCall(
	prepared: PreparedToolCall,
	signal: AbortSignal | undefined,
	emit: EngineEventSink,
): Promise<ExecutedToolCallOutcome> {
	const updateEvents: Promise<void>[] = [];

	try {
		let executionPromise = prepared.tool.execute(
			prepared.toolCall.id,
			prepared.args as never,
			signal,
			(partialResult) => {
				updateEvents.push(
					Promise.resolve(
						emit({
							type: "tool_execution_update",
							toolCallId: prepared.toolCall.id,
							toolName: prepared.toolCall.name,
							args: prepared.toolCall.arguments,
							partialResult,
						}),
					),
				);
			},
		);

		if (signal) {
			const abortPromise = new Promise<never>((_, reject) => {
				if (signal.aborted) {
					reject(new Error("Tool execution aborted by user"));
				} else {
					signal.addEventListener("abort", () => reject(new Error("Tool execution aborted by user")), {
						once: true,
					});
				}
			});
			executionPromise = Promise.race([executionPromise, abortPromise]);
		}

		const result = await executionPromise;
		await Promise.all(updateEvents);
		return { result, isError: false };
	} catch (error) {
		await Promise.all(updateEvents);
		return {
			result: createErrorToolResult(error instanceof Error ? error.message : String(error)),
			isError: true,
		};
	}
}

async function finalizeExecutedToolCall(
	currentContext: EngineContext,
	assistantMessage: AssistantMessage,
	prepared: PreparedToolCall,
	executed: ExecutedToolCallOutcome,
	config: EngineLoopConfig,
	signal: AbortSignal | undefined,
): Promise<FinalizedToolCallOutcome> {
	let result = executed.result;
	let isError = executed.isError;

	if (config.afterToolCall) {
		try {
			const afterResult = await config.afterToolCall(
				{
					assistantMessage,
					toolCall: prepared.toolCall,
					args: prepared.args,
					result,
					isError,
					context: currentContext,
				},
				signal,
			);
			if (afterResult) {
				result = {
					content: afterResult.content ?? result.content,
					details: afterResult.details ?? result.details,
					terminate: afterResult.terminate ?? result.terminate,
				};
				isError = afterResult.isError ?? isError;
			}
		} catch (error) {
			result = createErrorToolResult(error instanceof Error ? error.message : String(error));
			isError = true;
		}
	}

	return {
		toolCall: prepared.toolCall,
		result,
		isError,
	};
}

function createErrorToolResult(message: string): EngineToolResult<any> {
	return {
		content: [{ type: "text", text: message }],
		details: {},
	};
}

async function emitToolExecutionEnd(finalized: FinalizedToolCallOutcome, emit: EngineEventSink): Promise<void> {
	await emit({
		type: "tool_execution_end",
		toolCallId: finalized.toolCall.id,
		toolName: finalized.toolCall.name,
		result: finalized.result,
		isError: finalized.isError,
	});
}

function createToolResultMessage(finalized: FinalizedToolCallOutcome): ToolResultMessage {
	return {
		role: "toolResult",
		toolCallId: finalized.toolCall.id,
		toolName: finalized.toolCall.name,
		content: finalized.result.content,
		details: finalized.result.details,
		isError: finalized.isError,
		timestamp: Date.now(),
	};
}

async function emitToolResultMessage(toolResultMessage: ToolResultMessage, emit: EngineEventSink): Promise<void> {
	await emit({ type: "message_start", message: toolResultMessage });
	await emit({ type: "message_end", message: toolResultMessage });
}
