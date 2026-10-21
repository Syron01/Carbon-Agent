import { type AssistantMessage, type AssistantMessageEvent, EventStream, getModel } from "astro-core";
import { describe, expect, it } from "vitest";
import { Engine } from "../src/index.js";

// Mock stream that mimics AssistantMessageEventStream
class MockAssistantStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
	constructor() {
		super(
			(event) => event.type === "done" || event.type === "error",
			(event) => {
				if (event.type === "done") return event.message;
				if (event.type === "error") return event.error;
				throw new Error("Unexpected event type");
			},
		);
	}
}

function createAssistantMessage(text: string): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "openai-responses",
		provider: "openai",
		model: "mock",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

function createDeferred(): {
	promise: Promise<void>;
	resolve: () => void;
} {
	let resolve = () => {};
	const promise = new Promise<void>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

describe("Engine", () => {
	it("should create an engine instance with default state", () => {
		const engine = new Engine();

		expect(engine.state).toBeDefined();
		expect(engine.state.systemPrompt).toBe("");
		expect(engine.state.model).toBeDefined();
		expect(engine.state.thinkingLevel).toBe("off");
		expect(engine.state.tools).toEqual([]);
		expect(engine.state.messages).toEqual([]);
		expect(engine.state.isStreaming).toBe(false);
		expect(engine.state.streamingMessage).toBe(undefined);
		expect(engine.state.pendingToolCalls).toEqual(new Set());
		expect(engine.state.errorMessage).toBeUndefined();
	});

	it("should create an engine instance with custom initial state", () => {
		const customModel = getModel("openai", "gpt-4o-mini")!;
		const engine = new Engine({
			initialState: {
				systemPrompt: "You are a helpful assistant.",
				model: customModel,
				thinkingLevel: "low",
			},
		});

		expect(engine.state.systemPrompt).toBe("You are a helpful assistant.");
		expect(engine.state.model).toBe(customModel);
		expect(engine.state.thinkingLevel).toBe("low");
	});

	it("should subscribe to events", () => {
		const engine = new Engine();

		let eventCount = 0;
		const unsubscribe = engine.subscribe((_event) => {
			eventCount++;
		});

		// No initial event on subscribe
		expect(eventCount).toBe(0);

		// State mutators don't emit events
		engine.state.systemPrompt = "Test prompt";
		expect(eventCount).toBe(0);
		expect(engine.state.systemPrompt).toBe("Test prompt");

		// Unsubscribe should work
		unsubscribe();
		engine.state.systemPrompt = "Another prompt";
		expect(eventCount).toBe(0); // Should not increase
	});

	it("should await async subscribers before prompt resolves", async () => {
		const barrier = createDeferred();
		const engine = new Engine({
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("ok") });
				});
				return stream;
			},
		});

		let listenerFinished = false;
		engine.subscribe(async (event) => {
			if (event.type === "engine_end") {
				await barrier.promise;
				listenerFinished = true;
			}
		});

		let promptResolved = false;
		const promptPromise = engine.prompt("hello").then(() => {
			promptResolved = true;
		});

		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(promptResolved).toBe(false);
		expect(listenerFinished).toBe(false);
		expect(engine.state.isStreaming).toBe(true);

		barrier.resolve();
		await promptPromise;

		expect(listenerFinished).toBe(true);
		expect(promptResolved).toBe(true);
		expect(engine.state.isStreaming).toBe(false);
	});

	it("waitForIdle should wait for async subscribers", async () => {
		const barrier = createDeferred();
		const engine = new Engine({
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("ok") });
				});
				return stream;
			},
		});

		engine.subscribe(async (event) => {
			if (event.type === "message_end" && event.message.role === "assistant") {
				await barrier.promise;
			}
		});

		const promptPromise = engine.prompt("hello");
		let idleResolved = false;
		const idlePromise = engine.waitForIdle().then(() => {
			idleResolved = true;
		});

		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(idleResolved).toBe(false);
		expect(engine.state.isStreaming).toBe(true);

		barrier.resolve();
		await Promise.all([promptPromise, idlePromise]);

		expect(idleResolved).toBe(true);
		expect(engine.state.isStreaming).toBe(false);
	});

	it("should pass the active abort signal to subscribers", async () => {
		let receivedSignal: AbortSignal | undefined;
		const engine = new Engine({
			streamFn: (_model, _context, options) => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "start", partial: createAssistantMessage("") });
					const checkAbort = () => {
						if (options?.signal?.aborted) {
							stream.push({ type: "error", reason: "aborted", error: createAssistantMessage("Aborted") });
						} else {
							setTimeout(checkAbort, 5);
						}
					};
					checkAbort();
				});
				return stream;
			},
		});

		engine.subscribe((event, signal) => {
			if (event.type === "engine_start") {
				receivedSignal = signal;
			}
		});

		const promptPromise = engine.prompt("hello");
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(receivedSignal).toBeDefined();
		expect(receivedSignal?.aborted).toBe(false);

		engine.abort();
		await promptPromise;

		expect(receivedSignal?.aborted).toBe(true);
	});

	it("should update state with mutators", () => {
		const engine = new Engine();

		// Test setSystemPrompt
		engine.state.systemPrompt = "Custom prompt";
		expect(engine.state.systemPrompt).toBe("Custom prompt");

		// Test setModel
		const newModel = getModel("google", "gemini-2.5-flash")!;
		engine.state.model = newModel;
		expect(engine.state.model).toBe(newModel);

		// Test setThinkingLevel
		engine.state.thinkingLevel = "high";
		expect(engine.state.thinkingLevel).toBe("high");

		// Test setTools
		const tools = [{ name: "test", description: "test tool" } as any];
		engine.state.tools = tools;
		expect(engine.state.tools).toEqual(tools);
		expect(engine.state.tools).not.toBe(tools); // Should be a copy

		// Test replaceMessages
		const messages = [{ role: "user" as const, content: "Hello", timestamp: Date.now() }];
		engine.state.messages = messages;
		expect(engine.state.messages).toEqual(messages);
		expect(engine.state.messages).not.toBe(messages); // Should be a copy

		// Test appendMessage
		const newMessage = { role: "assistant" as const, content: [{ type: "text" as const, text: "Hi" }] };
		engine.state.messages.push(newMessage as any);
		expect(engine.state.messages).toHaveLength(2);
		expect(engine.state.messages[1]).toBe(newMessage);

		// Test clearMessages
		engine.state.messages = [];
		expect(engine.state.messages).toEqual([]);
	});

	it("should support steering message queue", async () => {
		const engine = new Engine();

		const message = { role: "user" as const, content: "Steering message", timestamp: Date.now() };
		engine.steer(message);

		// The message is queued but not yet in state.messages
		expect(engine.state.messages).not.toContainEqual(message);
	});

	it("should support follow-up message queue", async () => {
		const engine = new Engine();

		const message = { role: "user" as const, content: "Follow-up message", timestamp: Date.now() };
		engine.followUp(message);

		// The message is queued but not yet in state.messages
		expect(engine.state.messages).not.toContainEqual(message);
	});

	it("should handle abort controller", () => {
		const engine = new Engine();

		// Should not throw even if nothing is running
		expect(() => engine.abort()).not.toThrow();
	});

	it("should throw when prompt() called while streaming", async () => {
		let abortSignal: AbortSignal | undefined;
		const engine = new Engine({
			// Use a stream function that responds to abort
			streamFn: (_model, _context, options) => {
				abortSignal = options?.signal;
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "start", partial: createAssistantMessage("") });
					// Check abort signal periodically
					const checkAbort = () => {
						if (abortSignal?.aborted) {
							stream.push({ type: "error", reason: "aborted", error: createAssistantMessage("Aborted") });
						} else {
							setTimeout(checkAbort, 5);
						}
					};
					checkAbort();
				});
				return stream;
			},
		});

		// Start first prompt (don't await, it will block until abort)
		const firstPrompt = engine.prompt("First message");

		// Wait a tick for isStreaming to be set
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(engine.state.isStreaming).toBe(true);

		// Second prompt should reject
		await expect(engine.prompt("Second message")).rejects.toThrow(
			"Engine is already processing a prompt. Use steer() or followUp() to queue messages, or wait for completion.",
		);

		// Cleanup - abort to stop the stream
		engine.abort();
		await firstPrompt.catch(() => {}); // Ignore abort error
	});

	it("should throw when continue() called while streaming", async () => {
		let abortSignal: AbortSignal | undefined;
		const engine = new Engine({
			streamFn: (_model, _context, options) => {
				abortSignal = options?.signal;
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "start", partial: createAssistantMessage("") });
					const checkAbort = () => {
						if (abortSignal?.aborted) {
							stream.push({ type: "error", reason: "aborted", error: createAssistantMessage("Aborted") });
						} else {
							setTimeout(checkAbort, 5);
						}
					};
					checkAbort();
				});
				return stream;
			},
		});

		// Start first prompt
		const firstPrompt = engine.prompt("First message");
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(engine.state.isStreaming).toBe(true);

		// continue() should reject
		await expect(engine.continue()).rejects.toThrow(
			"Engine is already processing. Wait for completion before continuing.",
		);

		// Cleanup
		engine.abort();
		await firstPrompt.catch(() => {});
	});

	it("continue() should process queued follow-up messages after an assistant turn", async () => {
		const engine = new Engine({
			streamFn: () => {
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					stream.push({ type: "done", reason: "stop", message: createAssistantMessage("Processed") });
				});
				return stream;
			},
		});

		engine.state.messages = [
			{
				role: "user",
				content: [{ type: "text", text: "Initial" }],
				timestamp: Date.now() - 10,
			},
			createAssistantMessage("Initial response"),
		];

		engine.followUp({
			role: "user",
			content: [{ type: "text", text: "Queued follow-up" }],
			timestamp: Date.now(),
		});

		await expect(engine.continue()).resolves.toBeUndefined();

		const hasQueuedFollowUp = engine.state.messages.some((message) => {
			if (message.role !== "user") return false;
			if (typeof message.content === "string") return message.content === "Queued follow-up";
			return message.content.some((part) => part.type === "text" && part.text === "Queued follow-up");
		});

		expect(hasQueuedFollowUp).toBe(true);
		expect(engine.state.messages[engine.state.messages.length - 1].role).toBe("assistant");
	});

	it("continue() should keep one-at-a-time steering semantics from assistant tail", async () => {
		let responseCount = 0;
		const engine = new Engine({
			streamFn: () => {
				const stream = new MockAssistantStream();
				responseCount++;
				queueMicrotask(() => {
					stream.push({
						type: "done",
						reason: "stop",
						message: createAssistantMessage(`Processed ${responseCount}`),
					});
				});
				return stream;
			},
		});

		engine.state.messages = [
			{
				role: "user",
				content: [{ type: "text", text: "Initial" }],
				timestamp: Date.now() - 10,
			},
			createAssistantMessage("Initial response"),
		];

		engine.steer({
			role: "user",
			content: [{ type: "text", text: "Steering 1" }],
			timestamp: Date.now(),
		});
		engine.steer({
			role: "user",
			content: [{ type: "text", text: "Steering 2" }],
			timestamp: Date.now() + 1,
		});

		await expect(engine.continue()).resolves.toBeUndefined();

		const recentMessages = engine.state.messages.slice(-4);
		expect(recentMessages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
		expect(responseCount).toBe(2);
	});

	it("forwards sessionId to streamFn options", async () => {
		let receivedSessionId: string | undefined;
		const engine = new Engine({
			sessionId: "session-abc",
			streamFn: (_model, _context, options) => {
				receivedSessionId = options?.sessionId;
				const stream = new MockAssistantStream();
				queueMicrotask(() => {
					const message = createAssistantMessage("ok");
					stream.push({ type: "done", reason: "stop", message });
				});
				return stream;
			},
		});

		await engine.prompt("hello");
		expect(receivedSessionId).toBe("session-abc");

		// Test setter
		engine.sessionId = "session-def";
		expect(engine.sessionId).toBe("session-def");

		await engine.prompt("hello again");
		expect(receivedSessionId).toBe("session-def");
	});
});
