// @ts-nocheck
/**
 * EngineSession - Core abstraction for engine lifecycle and session management.
 *
 * This class is shared between all run modes (interactive, print, rpc).
 * It encapsulates:
 * - Engine state access
 * - Event subscription with automatic session persistence
 * - Model and thinking level management
 * - Compaction (manual and auto)
 * - Bash execution
 * - Session switching and branching
 *
 * Modes use this class and add their own I/O layer on top.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { AssistantMessage, ImageContent, Message, Model, TextContent } from "astro-core";
import {
	clampThinkingLevel,
	getSupportedThinkingLevels,
	isContextOverflow,
	modelsAreEqual,
	resetApiProviders,
} from "astro-core";
import type { Engine, EngineEvent, EngineMessage, EngineState, EngineTool, ThinkingLevel } from "astro-engine";
import { theme } from "../modes/interactive/theme/theme.js";
import { stripFrontmatter } from "../utils/frontmatter.js";
import { sleep } from "../utils/sleep.js";
import {
	type AffectiveMode,
	appraiseAssistantOutcome,
	appraiseUserInput,
	buildAffectiveSystemPrompt,
	inferAssistantAffectiveOutcome,
	type NormalizedAffectiveSettings,
	renderAffectiveExplanation,
	renderAffectiveStatus,
} from "./affect.js";
import type { CodingAgentMode, CodingAgentVerbosity } from "./agents.js";
import { formatNoApiKeyFoundMessage, formatNoModelSelectedMessage } from "./auth-guidance.js";
import { type BashResult, executeBashWithOperations } from "./bash-executor.js";
import { getBrowserBridgeStatus, startBrowserBridgeServer } from "./browser-bridge-server.js";
import {
	type CompactionResult,
	calculateContextTokens,
	collectEntriesForBranchSummary,
	compact,
	estimateContextTokens,
	generateBranchSummary,
	prepareCompaction,
	shouldCompact,
} from "./compaction/index.js";
import { DEFAULT_THINKING_LEVEL } from "./defaults.js";
import { buildDesignPrompt, shouldInjectDefaultUiDesignPrompt } from "./design-system/index.js";
import { exportSessionToHtml, type ToolHtmlRenderer } from "./export-html/index.js";
import { createToolHtmlRenderer } from "./export-html/tool-renderer.js";
import {
	type ContextUsage,
	type ExtensionCommandContextActions,
	type ExtensionErrorListener,
	ExtensionRunner,
	type ExtensionUIContext,
	type InputSource,
	type MessageEndEvent,
	type MessageStartEvent,
	type MessageUpdateEvent,
	type ReplacedSessionContext,
	type SessionBeforeCompactResult,
	type SessionBeforeTreeResult,
	type SessionStartEvent,
	type ShutdownHandler,
	type ToolDefinition,
	type ToolExecutionEndEvent,
	type ToolExecutionStartEvent,
	type ToolExecutionUpdateEvent,
	type ToolInfo,
	type TreePreparation,
	type TurnEndEvent,
	type TurnStartEvent,
	wrapRegisteredTools,
} from "./extensions/index.js";
import { emitSessionShutdownEvent } from "./extensions/runner.js";
import { HybridMemorySystem } from "./hybrid-memory.js";
import { LearningMemory } from "./learning-memory.js";
import { getMemoryPreface, persistMemorySignal, shouldPersistMemorySignal } from "./memory-policy.js";
import { type BashExecutionMessage, type CustomMessage, compactMessageForStorage } from "./messages.js";
import { pickFallbackModel } from "./model-orchestrator.js";
import type { ModelRegistry } from "./model-registry.js";
import { OmegaKernel } from "./omega-kernel.js";
import { buildMemoryInstructions } from "./prompt-sections/memory-instructions.js";
import { expandPromptTemplate, type PromptTemplate } from "./prompt-templates.js";
import { QuotaManager } from "./quota-manager.js";
import type { ResourceExtensionPaths, ResourceLoader } from "./resource-loader.js";
import { TaskPlanner } from "./robotics/task-planner.js";
import type { BranchSummaryEntry, CompactionEntry, SessionManager } from "./session-manager.js";
import { CURRENT_SESSION_VERSION, getLatestCompactionEntry, type SessionHeader } from "./session-manager.js";
import type { SettingsManager } from "./settings-manager.js";
import type { SlashCommandInfo } from "./slash-commands.js";
import { createSyntheticSourceInfo, type SourceInfo } from "./source-info.js";
import { type BuildSystemPromptOptions, buildSystemPrompt, type RoboticsFunction } from "./system-prompt.js";
import { optimizePromptForIntentCapsule } from "./token-optimizer.js";
import { type BashOperations, createLocalBashOperations } from "./tools/bash.js";
import { getCompactContextTool } from "./tools/compact-context.js";
import { createAllToolDefinitions } from "./tools/index.js";
import {
	createRoboticsAnalyzeToolDefinition,
	createRoboticsBboxToolDefinition,
	createRoboticsDetectToolDefinition,
	createRoboticsPlanToolDefinition,
	createRoboticsTrajectoryToolDefinition,
} from "./tools/robotics-vision.js";
import { createToolDefinitionFromEngineTool } from "./tools/tool-definition-wrapper.js";

function buildAutomationSystemPrompt(requireConfirmation: boolean): string {
	return `## Automation Mode Active
- You may coordinate multi-step app/browser/terminal workflows on behalf of the user.
- Be serious and logical: inspect current state, choose the smartest low-risk path, act, then verify.
- For huge projects, use index/search first, read narrow files only, and compact before context becomes expensive.
- Do not send messages, make purchases, delete data, publish, or impersonate the user in external services without explicit task intent${requireConfirmation ? " and confirmation for high-impact actions" : ""}.
- Keep a concise action log in final output.`;
}

function thinkingRank(level: ThinkingLevel): number {
	switch (level) {
		case "xhigh":
			return 5;
		case "high":
			return 4;
		case "medium":
			return 3;
		case "low":
			return 2;
		case "minimal":
			return 1;
		default:
			return 0;
	}
}

// ============================================================================
// Skill Block Parsing
// ============================================================================

/** Parsed skill block from a user message */
export interface ParsedSkillBlock {
	name: string;
	location: string;
	content: string;
	userMessage: string | undefined;
}

/**
 * Parse a skill block from message text.
 * Returns null if the text doesn't contain a skill block.
 */
export function parseSkillBlock(text: string): ParsedSkillBlock | null {
	const match = text.match(/^<skill name="([^"]+)" location="([^"]+)">\n([\s\S]*?)\n<\/skill>(?:\n\n([\s\S]+))?$/);
	if (!match) return null;
	return {
		name: match[1],
		location: match[2],
		content: match[3],
		userMessage: match[4]?.trim() || undefined,
	};
}

/** Session-specific events that extend the core EngineEvent */
export type EngineSessionEvent =
	| EngineEvent
	| {
			type: "queue_update";
			steering: readonly string[];
			followUp: readonly string[];
	  }
	| { type: "compaction_start"; reason: "manual" | "threshold" | "overflow" }
	| { type: "session_info_changed"; name: string | undefined }
	| { type: "thinking_level_changed"; level: ThinkingLevel }
	| {
			type: "compaction_end";
			reason: "manual" | "threshold" | "overflow";
			result: CompactionResult | undefined;
			aborted: boolean;
			willRetry: boolean;
			errorMessage?: string;
	  }
	| { type: "auto_retry_start"; attempt: number; maxAttempts: number; delayMs: number; errorMessage: string }
	| { type: "auto_retry_end"; success: boolean; attempt: number; finalError?: string };

/** Listener function for engine session events */
export type EngineSessionEventListener = (event: EngineSessionEvent) => void;

// ============================================================================
// Types
// ============================================================================

export interface EngineSessionConfig {
	engine: Engine;
	sessionManager: SessionManager;
	settingsManager: SettingsManager;
	cwd: string;
	/** Models to cycle through with Ctrl+P (from --models flag) */
	scopedModels?: Array<{ model: Model<any>; thinkingLevel?: ThinkingLevel }>;
	/** Resource loader for skills, prompts, themes, context files, system prompt */
	resourceLoader: ResourceLoader;
	/** SDK custom tools registered outside extensions */
	customTools?: ToolDefinition[];
	/** Model registry for API key resolution and model discovery */
	modelRegistry: ModelRegistry;
	/** Initial active built-in tool names. Default: [read, bash, edit, write] */
	initialActiveToolNames?: string[];
	/** Optional allowlist of tool names. When provided, only these tool names are exposed. */
	allowedToolNames?: string[];
	/**
	 * Override base tools (useful for custom runtimes).
	 *
	 * These are synthesized into minimal ToolDefinitions internally so EngineSession can keep
	 * a definition-first registry even when callers provide plain EngineTool instances.
	 */
	baseToolsOverride?: Record<string, EngineTool>;
	/** Mutable ref used by Engine to access the current ExtensionRunner */
	extensionRunnerRef?: { current?: ExtensionRunner };
	/** Session start event metadata emitted when extensions bind to this runtime. */
	sessionStartEvent?: SessionStartEvent;
	/** Optional MCP manager for this session. */
	mcpManager?: import("astro-engine").McpManager;
	/** Disable memory signals and developer profile injection/persistence. */
	noMemory?: boolean;
}

export interface ExtensionBindings {
	uiContext?: ExtensionUIContext;
	commandContextActions?: ExtensionCommandContextActions;
	shutdownHandler?: ShutdownHandler;
	onError?: ExtensionErrorListener;
}

/** Options for EngineSession.prompt() */
export interface PromptOptions {
	/** Whether to expand file-based prompt templates (default: true) */
	expandPromptTemplates?: boolean;
	/** Image attachments */
	images?: ImageContent[];
	/** When streaming, how to queue the message: "steer" (interrupt) or "followUp" (wait). Required if streaming. */
	streamingBehavior?: "steer" | "followUp";
	/** Source of input for extension input event handlers. Defaults to "interactive". */
	source?: InputSource;
	/** Internal hook used by RPC mode to observe prompt preflight acceptance or rejection. */
	preflightResult?: (success: boolean) => void;
}

/** Result from cycleModel() */
export interface ModelCycleResult {
	model: Model<any>;
	thinkingLevel: ThinkingLevel;
	/** Whether cycling through scoped models (--models flag) or all available */
	isScoped: boolean;
}

/** Session statistics for /session command */
export interface SessionStats {
	sessionFile: string | undefined;
	sessionId: string;
	userMessages: number;
	assistantMessages: number;
	toolCalls: number;
	toolResults: number;
	totalMessages: number;
	tokens: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		total: number;
	};
	cost: number;
	contextUsage?: ContextUsage;
}

interface ToolDefinitionEntry {
	definition: ToolDefinition;
	sourceInfo: SourceInfo;
}

// ============================================================================
// Constants
// ============================================================================

/** Standard thinking levels */
const THINKING_LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high"];
const OVERCLOCK_AUTO_ESCALATION_THRESHOLD = 0.82;

function isExecutionRequest(text: string): boolean {
	return /\b(build|test|lint|format|commit|push|publish|write|add|change|update|delete|surum|version|yaz|ekle|degistir|duzelt|sil|rename|fix|repair)\b/i.test(
		text,
	);
}

export function resolveFastAutoThinkingLevel(text: string): ThinkingLevel {
	const normalized = text.toLowerCase();
	const forceDeepPattern = /\b(xhigh|deepthink|ultra\s*think|maximum\s+reasoning|max\s+reasoning)\b/i;
	const detailedPattern =
		/\b(detayli|detayl|kapsamli|kapsaml|mimari|analiz|security|guvenlik|refactor|tasarla|neden|tum proje|apex|swarm|evolve)\b/i;

	if (forceDeepPattern.test(normalized)) {
		return "high";
	}
	if (detailedPattern.test(normalized)) {
		return "medium";
	}
	if (isExecutionRequest(normalized)) {
		return "low";
	}
	return "minimal";
}

// ============================================================================
// EngineSession Class
// ============================================================================

export class EngineSession {
	readonly engine: Engine;
	readonly sessionManager: SessionManager;
	readonly settingsManager: SettingsManager;

	private _scopedModels: Array<{ model: Model<any>; thinkingLevel?: ThinkingLevel }>;

	// Event subscription state
	private _unsubscribeEngine?: () => void;
	private _eventListeners: EngineSessionEventListener[] = [];
	private _engineEventQueue: Promise<void> = Promise.resolve();

	/** Tracks pending steering messages for UI display. Removed when delivered. */
	private _steeringMessages: string[] = [];
	/** Tracks pending follow-up messages for UI display. Removed when delivered. */
	private _followUpMessages: string[] = [];
	/** Messages queued to be included with the next user prompt as context ("asides"). */
	private _pendingNextTurnMessages: CustomMessage[] = [];

	// Compaction state
	private _compactionAbortController: AbortController | undefined = undefined;
	private _autoCompactionAbortController: AbortController | undefined = undefined;
	private _overflowRecoveryAttempted = false;

	// Branch summarization state
	private _branchSummaryAbortController: AbortController | undefined = undefined;

	// Retry state
	private _retryAbortController: AbortController | undefined = undefined;
	private _retryAttempt = 0;
	private _retryPromise: Promise<void> | undefined = undefined;
	private _retryResolve: (() => void) | undefined = undefined;
	private _originalModelBeforeEscalation?: Model<any>;
	private _lastEncounteredError?: string;

	// Bash execution state
	private _bashAbortController: AbortController | undefined = undefined;
	private _pendingBashMessages: BashExecutionMessage[] = [];

	// Extension system
	private _extensionRunner!: ExtensionRunner;
	private _turnIndex = 0;

	private _resourceLoader: ResourceLoader;
	private _customTools: ToolDefinition[];
	private _baseToolDefinitions: Map<string, ToolDefinition> = new Map();
	private _cwd: string;
	private _extensionRunnerRef?: { current?: ExtensionRunner };
	private _initialActiveToolNames?: string[];
	private _allowedToolNames?: Set<string>;
	private _baseToolsOverride?: Record<string, EngineTool>;
	private _sessionStartEvent: SessionStartEvent;
	private _extensionUIContext?: ExtensionUIContext;
	private _extensionCommandContextActions?: ExtensionCommandContextActions;
	private _extensionShutdownHandler?: ShutdownHandler;
	private _extensionErrorListener?: ExtensionErrorListener;
	private _extensionErrorUnsubscriber?: () => void;

	private _mcpManager?: import("astro-engine").McpManager;
	public get mcpManager() {
		return this._mcpManager;
	}

	// Model registry for API key resolution
	private _modelRegistry: ModelRegistry;

	// Tool registry for extension getTools/setTools
	private _toolRegistry: Map<string, EngineTool> = new Map();
	private _toolDefinitions: Map<string, ToolDefinitionEntry> = new Map();
	private _toolPromptSnippets: Map<string, string> = new Map();
	private _toolPromptGuidelines: Map<string, string[]> = new Map();

	// Anti-loop: track consecutive identical tool calls
	private _lastToolSignature: string = "";
	private _consecutiveIdenticalToolCalls: number = 0;
	private static readonly MAX_CONSECUTIVE_IDENTICAL_TOOL_CALLS = 5;

	// Base system prompt (without extension appends) - used to apply fresh appends each turn
	private _baseSystemPrompt = "";
	private _baseSystemPromptOptions!: BuildSystemPromptOptions;
	private _lastToolSetKey = "";

	private _noMemory = true;
	// Astro Fractal Context Engine
	private _hybridMemory: HybridMemorySystem = new HybridMemorySystem();

	constructor(config: EngineSessionConfig) {
		this.engine = config.engine;
		this.sessionManager = config.sessionManager;
		this.settingsManager = config.settingsManager;
		this._scopedModels = config.scopedModels ?? [];
		this._resourceLoader = config.resourceLoader;
		this._customTools = config.customTools ?? [];
		this._cwd = config.cwd;
		this._modelRegistry = config.modelRegistry;
		this._extensionRunnerRef = config.extensionRunnerRef;
		this._initialActiveToolNames = config.initialActiveToolNames;
		this._allowedToolNames = config.allowedToolNames ? new Set(config.allowedToolNames) : undefined;
		this._baseToolsOverride = config.baseToolsOverride;
		this._sessionStartEvent = config.sessionStartEvent ?? { type: "session_start", reason: "startup" };
		this._mcpManager = config.mcpManager;
		this._noMemory = config.noMemory ?? true;
		startBrowserBridgeServer();

		// Always subscribe to engine events for internal handling
		// (session persistence, extensions, auto-compaction, retry logic)
		this._unsubscribeEngine = this.engine.subscribe(this._handleEngineEvent);
		this._installEngineToolHooks();

		this._buildRuntime({
			activeToolNames: this._initialActiveToolNames,
			includeAllExtensionTools: true,
		});

		// Astro Sentinel Probes — Start file watcher for pre-cognition error detection
		try {
			OmegaKernel.getInstance().watchSentinelProbes(this._cwd);
		} catch {
			// Non-critical — ignore if watch fails
		}
	}

	/** Model registry for API key resolution and model discovery */
	get modelRegistry(): ModelRegistry {
		return this._modelRegistry;
	}

	private async _getRequiredRequestAuth(model: Model<any>): Promise<{
		apiKey: string;
		headers?: Record<string, string>;
	}> {
		const result = await this._modelRegistry.getApiKeyAndHeaders(model);
		if (!result.ok) {
			if (result.error.startsWith("No API key found")) {
				throw new Error(formatNoApiKeyFoundMessage(model.provider));
			}
			throw new Error(result.error);
		}
		if (result.apiKey) {
			return { apiKey: result.apiKey, headers: result.headers };
		}

		const isOAuth = this._modelRegistry.isUsingOAuth(model);
		if (isOAuth) {
			throw new Error(
				`Authentication failed for "${model.provider}". ` +
					`Credentials may have expired or network is unavailable. ` +
					`Run '/login ${model.provider}' to re-authenticate.`,
			);
		}
		throw new Error(formatNoApiKeyFoundMessage(model.provider));
	}

	/**
	 * Install tool hooks once on the Engine instance.
	 *
	 * The callbacks read `this._extensionRunner` at execution time, so extension reload swaps in the
	 * new runner without reinstalling hooks. Extension-specific tool wrappers are still used to adapt
	 * registered tool execution to the extension context. Tool call and tool result interception now
	 * happens here instead of in wrappers.
	 */
	private _installEngineToolHooks(): void {
		this.engine.beforeToolCall = async ({ toolCall, args }) => {
			const runner = this._extensionRunner;
			if (!runner.hasHandlers("tool_call")) {
				return undefined;
			}

			await this._engineEventQueue;

			try {
				return await runner.emitToolCall({
					type: "tool_call",
					toolName: toolCall.name,
					toolCallId: toolCall.id,
					input: args as Record<string, unknown>,
				});
			} catch (err) {
				if (err instanceof Error) {
					throw err;
				}
				throw new Error(`Extension failed, blocking execution: ${String(err)}`);
			}
		};

		this.engine.afterToolCall = async ({ toolCall, args, result, isError }) => {
			const runner = this._extensionRunner;
			if (!runner.hasHandlers("tool_result")) {
				return undefined;
			}

			const hookResult = await runner.emitToolResult({
				type: "tool_result",
				toolName: toolCall.name,
				toolCallId: toolCall.id,
				input: args as Record<string, unknown>,
				content: result.content,
				details: result.details,
				isError,
			});

			if (!hookResult) {
				return undefined;
			}

			return {
				content: hookResult.content,
				details: hookResult.details,
				isError: hookResult.isError ?? isError,
			};
		};
	}

	// =========================================================================
	// Event Subscription
	// =========================================================================

	/** Emit an event to all listeners */
	private _emit(event: EngineSessionEvent): void {
		for (const l of this._eventListeners) {
			l(event);
		}
	}

	private _emitQueueUpdate(): void {
		this._emit({
			type: "queue_update",
			steering: [...this._steeringMessages],
			followUp: [...this._followUpMessages],
		});
	}

	// Track last assistant message for auto-compaction check
	private _lastAssistantMessage: AssistantMessage | undefined = undefined;

	/** Internal handler for engine events - shared by subscribe and reconnect */
	private _handleEngineEvent = (event: EngineEvent): void => {
		// Create retry promise synchronously before queueing async processing.
		// Engine.emit() calls this handler synchronously, and prompt() calls waitForRetry()
		// as soon as engine.prompt() resolves. If _retryPromise is created only inside
		// _processEngineEvent, slow earlier queued events can delay engine_end processing
		// and waitForRetry() can miss the in-flight retry.
		this._createRetryPromiseForEngineEnd(event);

		this._engineEventQueue = this._engineEventQueue.then(
			() => this._processEngineEvent(event),
			() => this._processEngineEvent(event),
		);

		// Keep queue alive if an event handler fails
		this._engineEventQueue.catch(() => {});
	};

	private _createRetryPromiseForEngineEnd(event: EngineEvent): void {
		if (event.type !== "engine_end" || this._retryPromise) {
			return;
		}

		const settings = this.settingsManager.getRetrySettings();
		if (!settings.enabled) {
			return;
		}

		const lastAssistant = this._findLastAssistantInMessages(event.messages);
		if (!lastAssistant || !this._isRetryableError(lastAssistant)) {
			return;
		}

		this._retryPromise = new Promise((resolve) => {
			this._retryResolve = resolve;
		});
	}

	private _findLastAssistantInMessages(messages: EngineMessage[]): AssistantMessage | undefined {
		for (let i = messages.length - 1; i >= 0; i--) {
			const message = messages[i];
			if (message.role === "assistant") {
				return message as AssistantMessage;
			}
		}
		return undefined;
	}

	private async _processEngineEvent(event: EngineEvent): Promise<void> {
		// When a user message starts, check if it's from either queue and remove it BEFORE emitting
		// This ensures the UI sees the updated queue state
		if (event.type === "message_start" && event.message.role === "user") {
			this._overflowRecoveryAttempted = false;
			// Reset anti-loop counter on new user message
			this._lastToolSignature = "";
			this._consecutiveIdenticalToolCalls = 0;
			const messageText = this._getUserMessageText(event.message);
			if (messageText) {
				// Check steering queue first
				const steeringIndex = this._steeringMessages.indexOf(messageText);
				if (steeringIndex !== -1) {
					this._steeringMessages.splice(steeringIndex, 1);
					this._emitQueueUpdate();
				} else {
					// Check follow-up queue
					const followUpIndex = this._followUpMessages.indexOf(messageText);
					if (followUpIndex !== -1) {
						this._followUpMessages.splice(followUpIndex, 1);
						this._emitQueueUpdate();
					}
				}
			}
		}

		// Emit to extensions first
		await this._emitExtensionEvent(event);

		// Notify all listeners
		this._emit(event);

		// Handle session persistence
		if (event.type === "message_end") {
			if (event.message.role === "assistant") {
				const cost = event.message.usage?.cost?.total;
				if (typeof cost === "number" && cost > 0) {
					QuotaManager.getInstance().addCost(cost);
				}
			}

			// ★ Storage-level truncation: cap tool results, assistant thinking/text, user messages,
			// and bash execution output at sensible limits BEFORE they hit engine state + session.
			// This is the primary defense against unbounded token explosion.
			if (
				event.message.role === "toolResult" ||
				event.message.role === "assistant" ||
				event.message.role === "user" ||
				event.message.role === "bashExecution"
			) {
				const compacted = compactMessageForStorage(event.message);
				Object.assign(event.message, compacted);
			}

			// Check if this is a custom message from extensions
			if (event.message.role === "custom") {
				// Persist as CustomMessageEntry
				this.sessionManager.appendCustomMessageEntry(
					event.message.customType,
					event.message.content,
					event.message.display,
					event.message.details,
				);
			} else if (
				event.message.role === "user" ||
				event.message.role === "assistant" ||
				event.message.role === "toolResult"
			) {
				// Regular Provider message - persist as SessionMessageEntry
				this.sessionManager.appendMessage(event.message);

				// Capture failed tool results or bash execution failures for learning experience
				if (event.message.role === "toolResult") {
					const contentStr = JSON.stringify(event.message.content);
					if (event.message.isError || /failed|error|stderr/i.test(contentStr)) {
						this._lastEncounteredError = contentStr.slice(0, 500);
					}
				}
			}
			// Other message types (bashExecution, compactionSummary, branchSummary) are persisted elsewhere

			// Track assistant message for auto-compaction (checked on engine_end)
			if (event.message.role === "assistant") {
				this._lastAssistantMessage = event.message;

				const assistantMsg = event.message as AssistantMessage;
				if (assistantMsg.stopReason !== "error") {
					this._overflowRecoveryAttempted = false;
				} else {
					this._lastEncounteredError = assistantMsg.errorMessage || "Unknown assistant error";
				}

				this._recordAffectiveAssistantOutcome(assistantMsg);

				// Reset retry counter immediately on successful assistant response
				// This prevents accumulation across multiple Provider calls within a turn
				if (assistantMsg.stopReason !== "error" && this._retryAttempt > 0) {
					this._emit({
						type: "auto_retry_end",
						success: true,
						attempt: this._retryAttempt,
					});
					this._retryAttempt = 0;
				}

				if (!this._noMemory && assistantMsg.stopReason !== "error" && this._lastEncounteredError) {
					const fixText = assistantMsg.content
						.filter((c) => c.type === "text")
						.map((c) => c.text)
						.join("\n");
					if (fixText) {
						try {
							const memory = LearningMemory.getInstance();
							memory.recordExperience(
								this._lastEncounteredError,
								fixText,
								"success",
								`Successfully resolved error in current session using ${this.model?.name || "active model"}`,
							);
						} catch {}
					}
					this._lastEncounteredError = undefined;
				}
			}
		}

		// Check auto-retry and auto-compaction after engine completes
		if (event.type === "engine_end") {
			// Restore original model if escalated
			if (this._originalModelBeforeEscalation) {
				const targetModel = this._originalModelBeforeEscalation;
				this._originalModelBeforeEscalation = undefined;

				const previousModel = this.model;
				this.engine.state.model = targetModel;
				this.sessionManager.appendModelChange(targetModel.provider, targetModel.id);
				this.settingsManager.setDefaultModelAndProvider(targetModel.provider, targetModel.id);

				const thinkingLevel = this._getThinkingLevelForModelSwitch();
				this.setThinkingLevel(thinkingLevel);

				await this._emitModelSelect(targetModel, previousModel, "set");

				this.sessionManager.appendCustomMessageEntry(
					"system_announcement",
					[
						{
							type: "text",
							text: `✦ Astro-Agent dynamic router restored original model: **${targetModel.name}**.`,
						},
					],
					true,
				);
			}

			if (this._lastAssistantMessage) {
				const msg = this._lastAssistantMessage;
				this._lastAssistantMessage = undefined;

				// Check for retryable errors first (overloaded, rate limit, server errors)
				if (this._isRetryableError(msg)) {
					const didRetry = await this._handleRetryableError(msg);
					if (didRetry) return; // Retry was initiated, don't proceed to compaction
				}

				this._resolveRetry();
				await this._checkCompaction(msg);
			}
		}
	}

	/** Resolve the pending retry promise */
	private _resolveRetry(): void {
		if (this._retryResolve) {
			this._retryResolve();
			this._retryResolve = undefined;
			this._retryPromise = undefined;
		}
	}

	/** Extract text content from a message */
	private _getUserMessageText(message: Message): string {
		if (message.role !== "user") return "";
		const content = message.content;
		if (typeof content === "string") return content;
		const textBlocks = content.filter((c) => c.type === "text");
		return textBlocks.map((c) => (c as TextContent).text).join("");
	}

	/** Find the last assistant message in engine state (including aborted ones) */
	private _findLastAssistantMessage(): AssistantMessage | undefined {
		const messages = this.engine.state.messages;
		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i];
			if (msg.role === "assistant") {
				return msg as AssistantMessage;
			}
		}
		return undefined;
	}

	private _replaceMessageInPlace(target: EngineMessage, replacement: EngineMessage): void {
		// Engine-core stores the finalized message object in its state before emitting message_end.
		// SessionManager persistence happens later in _processEngineEvent() with event.message.
		// Mutating this object in place keeps engine state, later turn/engine events, listeners,
		// and the eventual SessionManager.appendMessage(event.message) persistence in sync.
		if (target === replacement) {
			return;
		}

		const targetRecord = target as unknown as Record<string, unknown>;
		for (const key of Object.keys(targetRecord)) {
			delete targetRecord[key];
		}
		Object.assign(targetRecord, replacement);
	}

	/** Emit extension events based on engine events */
	private async _emitExtensionEvent(event: EngineEvent): Promise<void> {
		if (event.type === "engine_start") {
			this._turnIndex = 0;
			await this._extensionRunner.emit({ type: "engine_start" });
		} else if (event.type === "engine_end") {
			await this._extensionRunner.emit({ type: "engine_end", messages: event.messages });
		} else if (event.type === "turn_start") {
			const extensionEvent: TurnStartEvent = {
				type: "turn_start",
				turnIndex: this._turnIndex,
				timestamp: Date.now(),
			};
			await this._extensionRunner.emit(extensionEvent);
		} else if (event.type === "turn_end") {
			const extensionEvent: TurnEndEvent = {
				type: "turn_end",
				turnIndex: this._turnIndex,
				message: event.message,
				toolResults: event.toolResults,
			};
			await this._extensionRunner.emit(extensionEvent);
			this._turnIndex++;
		} else if (event.type === "message_start") {
			const extensionEvent: MessageStartEvent = {
				type: "message_start",
				message: event.message,
			};
			await this._extensionRunner.emit(extensionEvent);
		} else if (event.type === "message_update") {
			const extensionEvent: MessageUpdateEvent = {
				type: "message_update",
				message: event.message,
				assistantMessageEvent: event.assistantMessageEvent,
			};
			await this._extensionRunner.emit(extensionEvent);
		} else if (event.type === "message_end") {
			const extensionEvent: MessageEndEvent = {
				type: "message_end",
				message: event.message,
			};
			const replacement = await this._extensionRunner.emitMessageEnd(extensionEvent);
			if (replacement) {
				this._replaceMessageInPlace(event.message, replacement);
			}
		} else if (event.type === "tool_execution_start") {
			// Anti-loop: detect consecutive identical tool calls
			const sig = `${event.toolName}:${JSON.stringify(event.args ?? {})}`;
			if (sig === this._lastToolSignature) {
				this._consecutiveIdenticalToolCalls++;
				if (this._consecutiveIdenticalToolCalls >= EngineSession.MAX_CONSECUTIVE_IDENTICAL_TOOL_CALLS) {
					// Emit warning and break the loop
					const warnMsg = `[Loop detected] Same tool call repeated ${this._consecutiveIdenticalToolCalls} times: ${event.toolName}. Breaking loop.`;
					this._consecutiveIdenticalToolCalls = 0;
					this._lastToolSignature = "";
					for (const listener of this._eventListeners) {
						await listener({ type: "engine_end", reason: "error", error: new Error(warnMsg) });
					}
					if (this.engine.state.isStreaming) {
						this.engine.cancel();
					}
					return;
				}
			} else {
				this._lastToolSignature = sig;
				this._consecutiveIdenticalToolCalls = 1;
			}

			const extensionEvent: ToolExecutionStartEvent = {
				type: "tool_execution_start",
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				args: event.args,
			};
			await this._extensionRunner.emit(extensionEvent);
		} else if (event.type === "tool_execution_update") {
			const extensionEvent: ToolExecutionUpdateEvent = {
				type: "tool_execution_update",
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				args: event.args,
				partialResult: event.partialResult,
			};
			await this._extensionRunner.emit(extensionEvent);
		} else if (event.type === "tool_execution_end") {
			const extensionEvent: ToolExecutionEndEvent = {
				type: "tool_execution_end",
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				result: event.result,
				isError: event.isError,
			};
			await this._extensionRunner.emit(extensionEvent);
		}
	}

	/**
	 * Subscribe to engine events.
	 * Session persistence is handled internally (saves messages on message_end).
	 * Multiple listeners can be added. Returns unsubscribe function for this listener.
	 */
	subscribe(listener: EngineSessionEventListener): () => void {
		this._eventListeners.push(listener);

		// Return unsubscribe function for this specific listener
		return () => {
			const index = this._eventListeners.indexOf(listener);
			if (index !== -1) {
				this._eventListeners.splice(index, 1);
			}
		};
	}

	/**
	 * Temporarily disconnect from engine events.
	 * User listeners are preserved and will receive events again after resubscribe().
	 * Used internally during operations that need to pause event processing.
	 */
	private _disconnectFromEngine(): void {
		if (this._unsubscribeEngine) {
			this._unsubscribeEngine();
			this._unsubscribeEngine = undefined;
		}
	}

	/**
	 * Reconnect to engine events after _disconnectFromEngine().
	 * Preserves all existing listeners.
	 */
	private _reconnectToEngine(): void {
		if (this._unsubscribeEngine) return; // Already connected
		this._unsubscribeEngine = this.engine.subscribe(this._handleEngineEvent);
	}

	/**
	 * Remove all listeners and disconnect from engine.
	 * Call this when completely done with the session.
	 */
	dispose(): void {
		this._extensionRunner.invalidate(
			"This extension ctx is stale after session replacement or reload. Do not use a captured Astro-Agent or command ctx after ctx.newSession(), ctx.fork(), ctx.switchSession(), or ctx.reload(). For newSession, fork, and switchSession, move post-replacement work into withSession and use the ctx passed to withSession. For reload, do not use the old ctx after await ctx.reload().",
		);
		this._disconnectFromEngine();
		this._mcpManager?.dispose();
		this._eventListeners = [];
	}

	// =========================================================================
	// Read-only State Access
	// =========================================================================

	/** Full engine state */
	get state(): EngineState {
		return this.engine.state;
	}

	/** Current model (may be undefined if not yet selected) */
	get model(): Model<any> | undefined {
		return this.engine.state.model;
	}

	/** Current thinking level */
	get thinkingLevel(): ThinkingLevel {
		return this.engine.state.thinkingLevel;
	}

	/** Whether engine is currently streaming a response */
	get isStreaming(): boolean {
		return this.engine.state.isStreaming;
	}

	/** Current effective system prompt (includes any per-turn extension modifications) */
	get systemPrompt(): string {
		return this.engine.state.systemPrompt;
	}

	/** Current retry attempt (0 if not retrying) */
	get retryAttempt(): number {
		return this._retryAttempt;
	}

	/**
	 * Get the names of currently active tools.
	 * Returns the names of tools currently set on the engine.
	 */
	getActiveToolNames(): string[] {
		return this.engine.state.tools.map((t) => t.name);
	}

	getBrowserBridgeStatus() {
		return getBrowserBridgeStatus();
	}

	/**
	 * Check if design mode is auto-detected and active.
	 */
	isDesignModeActive(): boolean {
		return this._baseSystemPromptOptions?.designMode === true;
	}

	/**
	 * Get all configured tools with name, description, parameter schema, and source metadata.
	 */
	getAllTools(): ToolInfo[] {
		return Array.from(this._toolDefinitions.values()).map(({ definition, sourceInfo }) => ({
			name: definition.name,
			description: definition.description,
			parameters: definition.parameters,
			sourceInfo,
		}));
	}

	getToolDefinition(name: string): ToolDefinition | undefined {
		return this._toolDefinitions.get(name)?.definition;
	}

	/**
	 * Set active tools by name.
	 * Only tools in the registry can be enabled. Unknown tool names are ignored.
	 * Also rebuilds the system prompt to reflect the new tool set.
	 * Changes take effect on the next engine turn.
	 */
	setActiveToolsByName(toolNames: string[]): void {
		const tools: EngineTool[] = [];
		const validToolNames: string[] = [];
		for (const name of toolNames) {
			const tool = this._toolRegistry.get(name);
			if (tool) {
				tools.push(tool);
				validToolNames.push(name);
			}
		}
		this.engine.state.tools = tools;

		// Skip rebuild if the tool set hasn't changed (saves fractal tree + file I/O each turn)
		const toolKey = [...validToolNames].sort().join(",");
		if (toolKey === this._lastToolSetKey && this._baseSystemPrompt) {
			this.engine.state.systemPrompt = this._baseSystemPrompt;
			return;
		}
		this._lastToolSetKey = toolKey;

		// Rebuild base system prompt with new tool set
		this._baseSystemPrompt = this._rebuildSystemPrompt(validToolNames);
		this.engine.state.systemPrompt = this._baseSystemPrompt;
	}

	private _forceConnectedMcpServers = new Set<string>();

	async connectConfiguredMcpServers(forceConnectName?: string): Promise<string[]> {
		if (forceConnectName) {
			this._forceConnectedMcpServers.add(forceConnectName);
		}

		const mcpConfigs = this.settingsManager.getMcpServers();
		const mcpServerConfigs = Object.entries(mcpConfigs)
			.filter(([name, config]) => {
				if (this._forceConnectedMcpServers.has(name)) return true;
				if (name === "blender" || name === "godot" || name === "scratch") {
					return config.autoStart === true;
				}
				return config.autoStart !== false;
			})
			.map(([name, config]) => ({
				name,
				config,
			}));

		if (this._mcpManager) {
			await this._mcpManager.dispose();
			this._mcpManager = undefined;
		}

		for (const name of Array.from(this._toolRegistry.keys())) {
			if (name.includes("_")) {
				const serverName = name.slice(0, name.indexOf("_"));
				if (mcpConfigs[serverName]) {
					this._toolRegistry.delete(name);
					this._toolDefinitions.delete(name);
				}
			}
		}

		if (mcpServerConfigs.length === 0) {
			this.setActiveToolsByName(this.getActiveToolNames());
			return [];
		}

		const { McpManager } = await import("astro-engine");
		this._mcpManager = new McpManager(mcpServerConfigs);
		await this._mcpManager.initialize();

		const mcpTools = await this._mcpManager.getAllTools();
		for (const tool of mcpTools) {
			const definition = createToolDefinitionFromEngineTool(tool);
			this._toolRegistry.set(tool.name, tool as any);
			this._toolDefinitions.set(tool.name, {
				definition,
				sourceInfo: createSyntheticSourceInfo(`<mcp:${tool.name}>`, { source: "mcp" }),
			});
			const snippet = this._normalizePromptSnippet(tool.description) || tool.description || `MCP tool ${tool.name}`;
			this._toolPromptSnippets.set(tool.name, snippet);
		}

		this.setActiveToolsByName([...new Set([...this.getActiveToolNames(), ...mcpTools.map((tool) => tool.name)])]);
		return mcpTools.map((tool) => tool.name);
	}

	/** Whether compaction or branch summarization is currently running */
	get isCompacting(): boolean {
		return (
			this._autoCompactionAbortController !== undefined ||
			this._compactionAbortController !== undefined ||
			this._branchSummaryAbortController !== undefined
		);
	}

	/** All messages including custom types like BashExecutionMessage */
	get messages(): EngineMessage[] {
		return this.engine.state.messages;
	}

	/** Current steering mode */
	get steeringMode(): "all" | "one-at-a-time" {
		return this.engine.steeringMode;
	}

	/** Current follow-up mode */
	get followUpMode(): "all" | "one-at-a-time" {
		return this.engine.followUpMode;
	}

	/** Current session file path, or undefined if sessions are disabled */
	get sessionFile(): string | undefined {
		return this.sessionManager.getSessionFile();
	}

	/** Current session ID */
	get sessionId(): string {
		return this.sessionManager.getSessionId();
	}

	/** Current session display name, if set */
	get sessionName(): string | undefined {
		return this.sessionManager.getSessionName();
	}

	/** Scoped models for cycling (from --models flag) */
	get scopedModels(): ReadonlyArray<{ model: Model<any>; thinkingLevel?: ThinkingLevel }> {
		return this._scopedModels;
	}

	/** Update scoped models for cycling */
	setScopedModels(scopedModels: Array<{ model: Model<any>; thinkingLevel?: ThinkingLevel }>): void {
		this._scopedModels = scopedModels;
	}

	/** File-based prompt templates */
	get promptTemplates(): ReadonlyArray<PromptTemplate> {
		return this._resourceLoader.getPrompts().prompts;
	}

	private _normalizePromptSnippet(text: string | undefined): string | undefined {
		if (!text) return undefined;
		const oneLine = text
			.replace(/[\r\n]+/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		return oneLine.length > 0 ? oneLine : undefined;
	}

	private _normalizePromptGuidelines(guidelines: string[] | undefined): string[] {
		if (!guidelines || guidelines.length === 0) {
			return [];
		}

		const unique = new Set<string>();
		for (const guideline of guidelines) {
			const normalized = guideline.trim();
			if (normalized.length > 0) {
				unique.add(normalized);
			}
		}
		return Array.from(unique);
	}

	private _rebuildSystemPrompt(toolNames: string[]): string {
		const validToolNames = toolNames.filter((name) => this._toolRegistry.has(name));
		const toolSnippets: Record<string, string> = {};
		const promptGuidelines: string[] = [];
		for (const name of validToolNames) {
			const snippet = this._toolPromptSnippets.get(name);
			if (snippet) {
				toolSnippets[name] = snippet;
			}

			const toolGuidelines = this._toolPromptGuidelines.get(name);
			if (toolGuidelines) {
				promptGuidelines.push(...toolGuidelines);
			}
		}

		// Keep small/local models stable with shorter prompts and fewer assumptions.
		const currentModel = this.engine.state.model;
		const isCheapModel =
			currentModel &&
			(currentModel.provider === "google" ||
				currentModel.provider === "ollama" ||
				currentModel.id.includes("flash") ||
				currentModel.id.includes("mini") ||
				currentModel.id.includes("3.2") ||
				currentModel.id.includes("llama"));

		if (isCheapModel) {
			promptGuidelines.push(
				"For local or small models: keep reasoning private, inspect less, edit less, and verify with one focused check.",
				"Do not emulate another model, add planning boilerplate, or write placeholder code.",
			);
		}

		if (!this._noMemory) {
			try {
				const memory = LearningMemory.getInstance();
				const lessons = memory.getLessonsForPrompt(3);
				if (lessons.length > 0) {
					promptGuidelines.push("Learned error patterns:", ...lessons);
				}
			} catch {
				// ignore memory load errors
			}
		}

		const loaderSystemPrompt = this._resourceLoader.getSystemPrompt();
		const loaderAppendSystemPrompt = this._resourceLoader.getAppendSystemPrompt();
		const appendSystemPrompt =
			loaderAppendSystemPrompt.length > 0 ? loaderAppendSystemPrompt.join("\n\n") : undefined;
		const loadedSkills = this._resourceLoader.getSkills().skills;
		const loadedContextFiles = this._resourceLoader.getEnginesFiles().enginesFiles;

		const agents = this.settingsManager.getAgentsSettings();
		const affectiveSettings = this.settingsManager.getAffectiveSettings();
		const affectivePrompt = affectiveSettings.enabled ? buildAffectiveSystemPrompt(affectiveSettings) : undefined;
		const automationPrompt = this.settingsManager.getAutomationEnabled()
			? buildAutomationSystemPrompt(this.settingsManager.getAutomationRequireConfirmation())
			: undefined;

		// Robotics settings inject
		const roboticsEnabled = this.settingsManager.getRoboticsEnabled();
		let roboticsFunctions: RoboticsFunction[] | undefined;
		if (roboticsEnabled) {
			const fnPath = this.settingsManager.getRoboticsSettings().robotApiFunctionsPath;
			if (fnPath) {
				try {
					roboticsFunctions = TaskPlanner.loadFunctions(fnPath) as RoboticsFunction[];
				} catch {
					// if path exists but file is corrupt, skip silently
				}
			}
		}

		// Fusion Mode instructions inject
		const fusionState = this.settingsManager.getFusionMode();
		if (fusionState.enabled && fusionState.thinkModel && fusionState.codeModel) {
			promptGuidelines.push(
				`FUSION MODE: A senior architect AI (${fusionState.thinkModel.id}) has already produced a <plan> above.`,
				`Your role (${fusionState.codeModel.id}): implement that plan faithfully using your tools.`,
				`Do NOT re-plan, re-architect, or question the plan. Read each step and execute it.`,
				`If a step is ambiguous, use your best judgment to complete it — do not ask for clarification.`,
			);
		}

		// Default to the compact prompt for speed and token efficiency.
		// Set ASTRO_FULL_PROMPT=true only when debugging the long prompt itself.
		const compactPrompt = process.env.ASTRO_FULL_PROMPT !== "true";

		// Design mode: auto-detect based on project context
		// Checks for design-systems/ dir or DESIGN.md in project
		const designMode = this._detectDesignMode();

		// Memory system instructions (Claude Fable 5 inspired)
		const memoryInstructions = this._noMemory ? "" : buildMemoryInstructions();

		// Astro Fractal Context Engine: Build compact Merkle Tree codebase skeleton
		let fractalContextSummary: string | undefined;
		try {
			const treeSummary = this._hybridMemory.getFractalTreeSummary(this._cwd);
			if (treeSummary && treeSummary.length > 0) {
				fractalContextSummary = `\n\n## Fractal Codebase Map (Holographic Index)\nThis is the AST Merkle Tree skeleton of the workspace. Use hashes to detect file changes.\n\`\`\`\n${treeSummary.slice(0, 2000)}\n\`\`\``;
			}
		} catch {
			// Gracefully fail if tree build fails
		}

		const totalAppend = [appendSystemPrompt, fractalContextSummary, memoryInstructions].filter(Boolean).join("\n\n");
		const MAX_APPEND_CHARS = 8000;
		const cappedAppend =
			totalAppend.length > MAX_APPEND_CHARS
				? `${totalAppend.slice(0, MAX_APPEND_CHARS)}\n…[${totalAppend.length - MAX_APPEND_CHARS}ch trimmed]…`
				: totalAppend;

		this._baseSystemPromptOptions = {
			cwd: this._cwd,
			skills: loadedSkills,
			contextFiles: loadedContextFiles,
			customPrompt: loaderSystemPrompt,
			appendSystemPrompt: cappedAppend || undefined,
			selectedTools: validToolNames,
			toolSnippets,
			promptGuidelines,
			agents,
			affectivePrompt: [affectivePrompt, automationPrompt].filter(Boolean).join("\n\n") || undefined,
			roboticsEnabled,
			roboticsFunctions,
			compactMode: compactPrompt,
			designMode,
		};
		return buildSystemPrompt(this._baseSystemPromptOptions);
	}

	/**
	 * Auto-detect design mode by checking if project has design-systems/
	 * directory or DESIGN.md file.
	 */
	private _detectDesignMode(): boolean {
		try {
			if (existsSync(join(this._cwd, "design-systems"))) return true;
			if (existsSync(join(this._cwd, "DESIGN.md"))) return true;
			return false;
		} catch {
			return false;
		}
	}

	private _buildTurnSystemPrompt(userText: string): string {
		if (this._baseSystemPromptOptions?.designMode) {
			return this._baseSystemPrompt;
		}
		if (!shouldInjectDefaultUiDesignPrompt(userText)) {
			return this._baseSystemPrompt;
		}
		return `${this._baseSystemPrompt}${buildDesignPrompt({ projectRoot: this._cwd, userContext: userText })}`;
	}

	private _determineActiveToolsForPrompt(_text: string): string[] {
		const defaultTools = this._baseToolsOverride
			? Object.keys(this._baseToolsOverride)
			: ["read", "bash", "edit", "write", "digest", "todo", "git_ship"];

		return [...new Set([...defaultTools, ...this.getActiveToolNames()])];
	}

	// =========================================================================
	// Agent System
	// =========================================================================

	private _refreshBaseSystemPrompt(): void {
		this._baseSystemPrompt = this._rebuildSystemPrompt(this.getActiveToolNames());
		this.engine.state.systemPrompt = this._baseSystemPrompt;
	}

	getAgentsSettings() {
		return this.settingsManager.getAgentsSettings();
	}

	enableAgentsMode(): void {
		this.settingsManager.setAgentsEnabled(true);
		this._refreshBaseSystemPrompt();
	}

	disableAgentsMode(): void {
		this.settingsManager.setAgentsEnabled(false);
		this._refreshBaseSystemPrompt();
	}

	setAgentsMode(mode: CodingAgentMode): void {
		this.settingsManager.setAgentsMode(mode);
		this._refreshBaseSystemPrompt();
	}

	setAgentsVerbosity(verbosity: CodingAgentVerbosity): void {
		this.settingsManager.setAgentsVerbosity(verbosity);
		this._refreshBaseSystemPrompt();
	}

	// =========================================================================
	// Robotics Mode
	// =========================================================================

	/**
	 * Activate robotics mode: add tools, update system prompt, save to settings.
	 */
	enableRoboticsMode(): void {
		const settings = this.settingsManager.getRoboticsSettings();
		const visionModel = settings.visionModel;
		const visionBaseUrl = settings.visionBaseUrl;
		const drawOverlay = settings.outputOverlay ?? true;
		const fnPath = settings.robotApiFunctionsPath;

		const roboticsToolDefs = [
			createRoboticsDetectToolDefinition({ visionModel, visionBaseUrl, drawOverlay }),
			createRoboticsBboxToolDefinition({ visionModel, visionBaseUrl, drawOverlay }),
			createRoboticsTrajectoryToolDefinition({ visionModel, visionBaseUrl, drawOverlay }),
			createRoboticsAnalyzeToolDefinition({ visionModel, visionBaseUrl }),
			createRoboticsPlanToolDefinition({ visionModel, visionBaseUrl, robotFunctionsPath: fnPath }),
		];

		// tool registry'ye ekle
		for (const toolDef of roboticsToolDefs) {
			const engineTool = { name: toolDef.name, execute: toolDef.execute };
			this._toolRegistry.set(toolDef.name, engineTool as any);
			this._toolDefinitions.set(toolDef.name, {
				definition: toolDef,
				sourceInfo: createSyntheticSourceInfo(toolDef.name, { source: "auto" }),
			});
		}

		// aktif tool listesine ekle
		const currentToolNames = this.getActiveToolNames();
		const newToolNames = [...new Set([...currentToolNames, ...roboticsToolDefs.map((t) => t.name)])];
		this.setActiveToolsByName(newToolNames);

		// settings'e kaydet
		this.settingsManager.setRoboticsEnabled(true);
	}

	/**
	 * Deactivate robotics mode.
	 */
	disableRoboticsMode(): void {
		const roboticsToolNames = [
			"robotics_detect",
			"robotics_bbox",
			"robotics_trajectory",
			"robotics_analyze",
			"robotics_plan",
		];

		// remove from tool registry
		for (const name of roboticsToolNames) {
			this._toolRegistry.delete(name);
			this._toolDefinitions.delete(name);
		}

		// remove from active tool list
		const currentToolNames = this.getActiveToolNames().filter((n) => !roboticsToolNames.includes(n));
		this.setActiveToolsByName(currentToolNames);

		// settings'e kaydet
		this.settingsManager.setRoboticsEnabled(false);
	}

	/** Robotics mode aktif mi? */
	getRoboticsMode(): boolean {
		return this.settingsManager.getRoboticsEnabled();
	}

	// =========================================================================
	// Affective State Layer
	// =========================================================================

	getAffectiveSettings(): NormalizedAffectiveSettings {
		return this.settingsManager.getAffectiveSettings();
	}

	getAffectiveStatus(): string {
		return renderAffectiveStatus(this.settingsManager.getAffectiveSettings());
	}

	getAffectiveExplanation(): string {
		return renderAffectiveExplanation(this.settingsManager.getAffectiveSettings());
	}

	enableAffectiveMode(): void {
		this.settingsManager.setAffectiveEnabled(true);
		this._refreshBaseSystemPrompt();
	}

	disableAffectiveMode(): void {
		this.settingsManager.setAffectiveEnabled(false);
		this._refreshBaseSystemPrompt();
	}

	setAffectiveMode(mode: AffectiveMode): void {
		this.settingsManager.setAffectiveMode(mode);
		this._refreshBaseSystemPrompt();
	}

	resetAffectiveState(): void {
		this.settingsManager.resetAffectiveState();
		this._refreshBaseSystemPrompt();
	}

	private _recordAffectiveUserInput(text: string): void {
		const settings = this.settingsManager.getAffectiveSettings();
		if (!settings.enabled) return;
		this.settingsManager.setAffectiveState(appraiseUserInput(settings.state, text));
		this._refreshBaseSystemPrompt();
	}

	private _recordAffectiveAssistantOutcome(message: AssistantMessage): void {
		const settings = this.settingsManager.getAffectiveSettings();
		if (!settings.enabled) return;
		const outcome = inferAssistantAffectiveOutcome(message);
		this.settingsManager.setAffectiveState(appraiseAssistantOutcome(settings.state, outcome));
		this._refreshBaseSystemPrompt();
	}

	// =========================================================================
	// Prompting
	// =========================================================================

	/**
	 * Send a prompt to the engine.
	 * - Handles extension commands (registered via Astro-Agent.registerCommand) immediately, even during streaming
	 * - Expands file-based prompt templates by default
	 * - During streaming, queues via steer() or followUp() based on streamingBehavior option
	 * - Validates model and API key before sending (when not streaming)
	 * @throws Error if streaming and no streamingBehavior specified
	 * @throws Error if no model selected or no API key available (when not streaming)
	 */
	async prompt(text: string, options?: PromptOptions): Promise<void> {
		// Check for automatic model escalation for complex tasks
		if (this.settingsManager.getAutoEscalateModel() && this.model && !this.isStreaming) {
			const kernel = OmegaKernel.getInstance();
			const contract = kernel.classifyRequestToContract(text);
			const router = kernel.calculateEntropy(contract, this._cwd);

			const isCheapModel =
				!this.model.reasoning &&
				(this.model.provider === "google" ||
					this.model.provider === "ollama" ||
					this.model.id.includes("flash") ||
					this.model.id.includes("mini") ||
					this.model.id.includes("3.2"));
			const explicitDeepRequest = resolveFastAutoThinkingLevel(text) === "high";
			const requiresHighIntelligence =
				!isExecutionRequest(text) &&
				(router.entropy > OVERCLOCK_AUTO_ESCALATION_THRESHOLD ||
					contract.effortMode === "S3" ||
					contract.effortMode === "S4" ||
					explicitDeepRequest);

			if (isCheapModel && requiresHighIntelligence) {
				const smartConfig = this.settingsManager.getSmartModel();
				if (smartConfig) {
					const available = await this._modelRegistry.getAvailable();
					const smartModel = available.find((m) => m.provider === smartConfig.provider && m.id === smartConfig.id);
					if (smartModel && this._modelRegistry.hasConfiguredAuth(smartModel)) {
						this._originalModelBeforeEscalation = this.model;
						const previousModel = this.model;
						this.engine.state.model = smartModel;
						this.sessionManager.appendModelChange(smartModel.provider, smartModel.id);
						this.setThinkingLevel(explicitDeepRequest ? "medium" : "low", { persistDefault: false });

						await this._emitModelSelect(smartModel, previousModel, "set");

						this._pendingNextTurnMessages.push({
							role: "custom",
							customType: "system_announcement",
							content: [
								{
									type: "text",
									text: `Astro-Agent switched to ${smartModel.name} for this task.`,
								},
							],
							display: true,
							timestamp: Date.now(),
						});
					}
				}
			}
		}

		const optimized = optimizePromptForIntentCapsule(text);
		if (optimized.wasOptimized) {
			text = optimized.optimizedText;
		}
		if (!this._noMemory && shouldPersistMemorySignal(text)) {
			persistMemorySignal(text, this._cwd);
		}
		const expandPromptTemplates = options?.expandPromptTemplates ?? true;
		const preflightResult = options?.preflightResult;
		let messages: EngineMessage[] | undefined;

		try {
			// Handle extension commands first (execute immediately, even during streaming)
			// Extension commands manage their own Provider interaction via Astro-Agent.sendMessage()
			if (expandPromptTemplates && text.startsWith("/")) {
				const handled = await this._tryExecuteExtensionCommand(text);
				if (handled) {
					// Extension command executed, no prompt to send
					preflightResult?.(true);
					return;
				}
			}

			// Emit input event for extension interception (before skill/template expansion)
			let currentText = text;
			let currentImages = options?.images;
			if (this._extensionRunner.hasHandlers("input")) {
				const inputResult = await this._extensionRunner.emitInput(
					currentText,
					currentImages,
					options?.source ?? "interactive",
				);
				if (inputResult.action === "handled") {
					preflightResult?.(true);
					return;
				}
				if (inputResult.action === "transform") {
					currentText = inputResult.text;
					currentImages = inputResult.images ?? currentImages;
				}
			}

			// Expand skill commands (/skill:name args) and prompt templates (/template args)
			let expandedText = currentText;
			if (expandPromptTemplates) {
				expandedText = this._expandSkillCommand(expandedText);
				expandedText = expandPromptTemplate(expandedText, [...this.promptTemplates]);
			}
			expandedText = optimizePromptForIntentCapsule(expandedText).optimizedText;
			this._applyFastThinkingGuard(expandedText);
			this._applyAutoThinkingLevel(expandedText);

			// Astro Sentinel Probes — Pre-Cognition: inject known compilation errors
			try {
				const kernel = OmegaKernel.getInstance();
				if (kernel.sentinelIssues.length > 0) {
					const issueReport = kernel.sentinelIssues
						.map((i) => `File: ${i.file}\n  Errors:\n${i.errors.map((e) => `    - ${e}`).join("\n")}`)
						.join("\n\n");
					const sentinelContext = `\n\n[Astro Sentinel Pre-Cognition]: The following TypeScript/build errors were detected in the background:\n${issueReport}\n\nPlease fix these errors as part of your response.`;
					expandedText = expandedText + sentinelContext;
					console.log(
						`[Astro Sentinel] 🔮 Pre-cognition hatalar prompt'a eklendi. (${kernel.sentinelIssues.length} sorun)`,
					);
					kernel.sentinelIssues = [];
				}
			} catch {
				// Non-critical
			}

			// If streaming, queue via steer() or followUp() based on option
			if (this.isStreaming) {
				if (!options?.streamingBehavior) {
					throw new Error(
						"Engine is already processing. Specify streamingBehavior ('steer' or 'followUp') to queue the message.",
					);
				}
				if (options.streamingBehavior === "followUp") {
					await this._queueFollowUp(expandedText, currentImages);
				} else {
					await this._queueSteer(expandedText, currentImages);
				}
				preflightResult?.(true);
				return;
			}

			// Flush any pending bash messages before the new prompt
			this._flushPendingBashMessages();

			// Validate model
			if (!this.model) {
				throw new Error(formatNoModelSelectedMessage());
			}

			if (!this._modelRegistry.hasConfiguredAuth(this.model)) {
				const isOAuth = this._modelRegistry.isUsingOAuth(this.model);
				if (isOAuth) {
					throw new Error(
						`Authentication failed for "${this.model.provider}". ` +
							`Credentials may have expired or network is unavailable. ` +
							`Run '/login ${this.model.provider}' to re-authenticate.`,
					);
				}
				throw new Error(formatNoApiKeyFoundMessage(this.model.provider));
			}

			// Check if we need to compact before sending (catches aborted responses)
			const lastAssistant = this._findLastAssistantMessage();
			if (lastAssistant) {
				await this._checkCompaction(lastAssistant, false);
			}
			await this._checkPrePromptCompaction(expandedText, currentImages);

			this._recordAffectiveUserInput(expandedText);

			// ──────────────────────────────────────────────────────────────────────
			// Astro Dynamic Neural Resonance — Emotion-Driven Temperature
			// ──────────────────────────────────────────────────────────────────────
			try {
				const affectState = this.settingsManager.getAffectiveSettings();
				if (affectState.enabled) {
					const { ofke, korku, merak } = affectState.state.E;
					const stressLevel = Math.max(ofke / 5.0, korku / 5.0);
					const creativityLevel = merak / 5.0;
					let dynamicTemp: number;
					if (stressLevel > 0.7) {
						// High stress → Hyper-logical, zero hallucination mode
						dynamicTemp = 0.01;
						console.log(
							`[Astro Neural Resonance] 🧊 Stress high (${stressLevel.toFixed(2)}). Hyper-logic mode active. Temperature → ${dynamicTemp}`,
						);
					} else if (creativityLevel > 0.8) {
						// High curiosity → Creative Tony Stark mode
						dynamicTemp = 0.8;
						console.log(
							`[Astro Neural Resonance] ⚡ Curiosity high (${creativityLevel.toFixed(2)}). Creative mode active. Temperature → ${dynamicTemp}`,
						);
					} else {
						// Interpolate: low curiosity → 0.1, high curiosity → 0.6
						dynamicTemp = 0.1 + creativityLevel * 0.5;
					}
					this.engine.state.temperature = dynamicTemp;
				}
			} catch {
				// Silently ignore if affect is not available
			}

			// Build messages array (custom message if any, then user message)
			messages = [];

			// Add user message
			const userContent: (TextContent | ImageContent)[] = [{ type: "text", text: expandedText }];
			if (currentImages) {
				userContent.push(...currentImages);
			}
			messages.push({
				role: "user",
				content: userContent,
				timestamp: Date.now(),
			});

			// Inject any pending "nextTurn" messages as context alongside the user message
			for (const msg of this._pendingNextTurnMessages) {
				messages.push(msg);
			}
			this._pendingNextTurnMessages = [];

			const dynamicTools = this._determineActiveToolsForPrompt(expandedText);
			this.setActiveToolsByName(dynamicTools);

			const turnSystemPrompt = this._buildTurnSystemPrompt(expandedText);

			// Emit before_engine_start extension event
			const result = await this._extensionRunner.emitBeforeEngineStart(
				expandedText,
				currentImages,
				turnSystemPrompt,
				this._baseSystemPromptOptions,
			);
			// Add all custom messages from extensions
			if (result?.messages) {
				for (const msg of result.messages) {
					messages.push({
						role: "custom",
						customType: msg.customType,
						content: msg.content,
						display: msg.display,
						details: msg.details,
						timestamp: Date.now(),
					});
				}
			}
			const memoryPreface = this._noMemory ? "" : getMemoryPreface(3, true, this._cwd);
			// Apply extension-modified system prompt, or reset to base
			if (result?.systemPrompt) {
				this.engine.state.systemPrompt = memoryPreface
					? `${memoryPreface}\n${result.systemPrompt}`
					: result.systemPrompt;
			} else {
				// Ensure we're using this turn's prompt (in case previous turn had modifications)
				this.engine.state.systemPrompt = memoryPreface ? `${memoryPreface}\n${turnSystemPrompt}` : turnSystemPrompt;
			}
		} catch (error) {
			preflightResult?.(false);
			throw error;
		}

		if (!messages) {
			return;
		}

		preflightResult?.(true);
		try {
			await this.engine.prompt(messages);
		} catch (error) {
			const fallback = await pickFallbackModel(this.model, this._modelRegistry);
			if (fallback) {
				this.engine.state.model = fallback;
				await this.engine.prompt(messages);
			} else {
				throw error;
			}
		}
		await this.waitForRetry();
	}

	/**
	 * Try to execute an extension command. Returns true if command was found and executed.
	 */
	private async _tryExecuteExtensionCommand(text: string): Promise<boolean> {
		// Parse command name and args
		const spaceIndex = text.indexOf(" ");
		const commandName = spaceIndex === -1 ? text.slice(1) : text.slice(1, spaceIndex);
		const args = spaceIndex === -1 ? "" : text.slice(spaceIndex + 1);

		const command = this._extensionRunner.getCommand(commandName);
		if (!command) return false;

		// Get command context from extension runner (includes session control methods)
		const ctx = this._extensionRunner.createCommandContext();

		try {
			await command.handler(args, ctx);
			return true;
		} catch (err) {
			// Emit error via extension runner
			this._extensionRunner.emitError({
				extensionPath: `command:${commandName}`,
				event: "command",
				error: err instanceof Error ? err.message : String(err),
			});
			return true;
		}
	}

	/**
	 * Expand skill commands (/skill:name args) to their full content.
	 * Returns the expanded text, or the original text if not a skill command or skill not found.
	 * Emits errors via extension runner if file read fails.
	 */
	private _expandSkillCommand(text: string): string {
		if (!text.startsWith("/skill:")) return text;

		const spaceIndex = text.indexOf(" ");
		const skillName = spaceIndex === -1 ? text.slice(7) : text.slice(7, spaceIndex);
		const args = spaceIndex === -1 ? "" : text.slice(spaceIndex + 1).trim();

		const skill = this.resourceLoader.getSkills().skills.find((s) => s.name === skillName);
		if (!skill) return text; // Unknown skill, pass through

		try {
			const content = readFileSync(skill.filePath, "utf-8");
			const body = stripFrontmatter(content).trim();
			const skillBlock = `<skill name="${skill.name}" location="${skill.filePath}">\nReferences are relative to ${skill.baseDir}.\n\n${body}\n</skill>`;
			return args ? `${skillBlock}\n\n${args}` : skillBlock;
		} catch (err) {
			// Emit error like extension commands do
			this._extensionRunner.emitError({
				extensionPath: skill.filePath,
				event: "skill_expansion",
				error: err instanceof Error ? err.message : String(err),
			});
			return text; // Return original on error
		}
	}

	/**
	 * Queue a steering message while the engine is running.
	 * Delivered after the current assistant turn finishes executing its tool calls,
	 * before the next Provider call.
	 * Expands skill commands and prompt templates. Errors on extension commands.
	 * @param images Optional image attachments to include with the message
	 * @throws Error if text is an extension command
	 */
	async steer(text: string, images?: ImageContent[]): Promise<void> {
		// Check for extension commands (cannot be queued)
		if (text.startsWith("/")) {
			this._throwIfExtensionCommand(text);
		}

		// Expand skill commands and prompt templates
		let expandedText = this._expandSkillCommand(text);
		expandedText = expandPromptTemplate(expandedText, [...this.promptTemplates]);

		await this._queueSteer(expandedText, images);
	}

	/**
	 * Queue a follow-up message to be processed after the engine finishes.
	 * Delivered only when engine has no more tool calls or steering messages.
	 * Expands skill commands and prompt templates. Errors on extension commands.
	 * @param images Optional image attachments to include with the message
	 * @throws Error if text is an extension command
	 */
	async followUp(text: string, images?: ImageContent[]): Promise<void> {
		// Check for extension commands (cannot be queued)
		if (text.startsWith("/")) {
			this._throwIfExtensionCommand(text);
		}

		// Expand skill commands and prompt templates
		let expandedText = this._expandSkillCommand(text);
		expandedText = expandPromptTemplate(expandedText, [...this.promptTemplates]);

		await this._queueFollowUp(expandedText, images);
	}

	/**
	 * Internal: Queue a steering message (already expanded, no extension command check).
	 */
	private async _queueSteer(text: string, images?: ImageContent[]): Promise<void> {
		this._steeringMessages.push(text);
		this._emitQueueUpdate();
		const content: (TextContent | ImageContent)[] = [{ type: "text", text }];
		if (images) {
			content.push(...images);
		}
		this.engine.steer({
			role: "user",
			content,
			timestamp: Date.now(),
		});
	}

	/**
	 * Internal: Queue a follow-up message (already expanded, no extension command check).
	 */
	private async _queueFollowUp(text: string, images?: ImageContent[]): Promise<void> {
		this._followUpMessages.push(text);
		this._emitQueueUpdate();
		const content: (TextContent | ImageContent)[] = [{ type: "text", text }];
		if (images) {
			content.push(...images);
		}
		this.engine.followUp({
			role: "user",
			content,
			timestamp: Date.now(),
		});
	}

	/**
	 * Throw an error if the text is an extension command.
	 */
	private _throwIfExtensionCommand(text: string): void {
		const spaceIndex = text.indexOf(" ");
		const commandName = spaceIndex === -1 ? text.slice(1) : text.slice(1, spaceIndex);
		const command = this._extensionRunner.getCommand(commandName);

		if (command) {
			throw new Error(
				`Extension command "/${commandName}" cannot be queued. Use prompt() or execute the command when not streaming.`,
			);
		}
	}

	/**
	 * Send a custom message to the session. Creates a CustomMessageEntry.
	 *
	 * Handles three cases:
	 * - Streaming: queues message, processed when loop pulls from queue
	 * - Not streaming + triggerTurn: appends to state/session, starts new turn
	 * - Not streaming + no trigger: appends to state/session, no turn
	 *
	 * @param message Custom message with customType, content, display, details
	 * @param options.triggerTurn If true and not streaming, triggers a new Provider turn
	 * @param options.deliverAs Delivery mode: "steer", "followUp", or "nextTurn"
	 */
	async sendCustomMessage<T = unknown>(
		message: Pick<CustomMessage<T>, "customType" | "content" | "display" | "details">,
		options?: { triggerTurn?: boolean; deliverAs?: "steer" | "followUp" | "nextTurn" },
	): Promise<void> {
		const appMessage = {
			role: "custom" as const,
			customType: message.customType,
			content: message.content,
			display: message.display,
			details: message.details,
			timestamp: Date.now(),
		} satisfies CustomMessage<T>;
		if (options?.deliverAs === "nextTurn") {
			this._pendingNextTurnMessages.push(appMessage);
		} else if (this.isStreaming) {
			if (options?.deliverAs === "followUp") {
				this.engine.followUp(appMessage);
			} else {
				this.engine.steer(appMessage);
			}
		} else if (options?.triggerTurn) {
			await this.engine.prompt(appMessage);
		} else {
			this.engine.state.messages.push(appMessage);
			this.sessionManager.appendCustomMessageEntry(
				message.customType,
				message.content,
				message.display,
				message.details,
			);
			this._emit({ type: "message_start", message: appMessage });
			this._emit({ type: "message_end", message: appMessage });
		}
	}

	/**
	 * Send a user message to the engine. Always triggers a turn.
	 * When the engine is streaming, use deliverAs to specify how to queue the message.
	 *
	 * @param content User message content (string or content array)
	 * @param options.deliverAs Delivery mode when streaming: "steer" or "followUp"
	 */
	async sendUserMessage(
		content: string | (TextContent | ImageContent)[],
		options?: { deliverAs?: "steer" | "followUp" },
	): Promise<void> {
		// Normalize content to text string + optional images
		let text: string;
		let images: ImageContent[] | undefined;

		if (typeof content === "string") {
			text = content;
		} else {
			const textParts: string[] = [];
			images = [];
			for (const part of content) {
				if (part.type === "text") {
					textParts.push(part.text);
				} else {
					images.push(part);
				}
			}
			text = textParts.join("\n");
			if (images.length === 0) images = undefined;
		}

		// Use prompt() with expandPromptTemplates: false to skip command handling and template expansion
		await this.prompt(text, {
			expandPromptTemplates: false,
			streamingBehavior: options?.deliverAs,
			images,
			source: "extension",
		});
	}

	/**
	 * Clear all queued messages and return them.
	 * Useful for restoring to editor when user aborts.
	 * @returns Object with steering and followUp arrays
	 */
	clearQueue(): { steering: string[]; followUp: string[] } {
		const steering = [...this._steeringMessages];
		const followUp = [...this._followUpMessages];
		this._steeringMessages = [];
		this._followUpMessages = [];
		this.engine.clearAllQueues();
		this._emitQueueUpdate();
		return { steering, followUp };
	}

	/** Number of pending messages (includes both steering and follow-up) */
	get pendingMessageCount(): number {
		return this._steeringMessages.length + this._followUpMessages.length;
	}

	/** Get pending steering messages (read-only) */
	getSteeringMessages(): readonly string[] {
		return this._steeringMessages;
	}

	/** Get pending follow-up messages (read-only) */
	getFollowUpMessages(): readonly string[] {
		return this._followUpMessages;
	}

	get resourceLoader(): ResourceLoader {
		return this._resourceLoader;
	}

	/**
	 * Abort current operation and wait for engine to become idle.
	 */
	async abort(): Promise<void> {
		this.abortRetry();
		this.engine.abort();
		await this.engine.waitForIdle();
	}

	// =========================================================================
	// Model Management
	// =========================================================================

	private async _emitModelSelect(
		nextModel: Model<any>,
		previousModel: Model<any> | undefined,
		source: "set" | "cycle" | "restore",
	): Promise<void> {
		if (modelsAreEqual(previousModel, nextModel)) return;
		await this._extensionRunner.emit({
			type: "model_select",
			model: nextModel,
			previousModel,
			source,
		});
	}

	/**
	 * Set model directly.
	 * Validates that auth is configured, saves to session and settings.
	 * @throws Error if no auth is configured for the model
	 */
	async setModel(model: Model<any>): Promise<void> {
		if (!this._modelRegistry.hasConfiguredAuth(model)) {
			throw new Error(`No API key for ${model.provider}/${model.id}`);
		}

		const previousModel = this.model;
		const thinkingLevel = this._getThinkingLevelForModelSwitch();
		this.engine.state.model = model;
		this.sessionManager.appendModelChange(model.provider, model.id);
		this.settingsManager.setDefaultModelAndProvider(model.provider, model.id);

		// Re-clamp thinking level for new model's capabilities
		this.setThinkingLevel(thinkingLevel);

		await this._emitModelSelect(model, previousModel, "set");
	}

	/**
	 * Cycle to next/previous model.
	 * Uses scoped models (from --models flag) if available, otherwise all available models.
	 * @param direction - "forward" (default) or "backward"
	 * @returns The new model info, or undefined if only one model available
	 */
	async cycleModel(direction: "forward" | "backward" = "forward"): Promise<ModelCycleResult | undefined> {
		if (this._scopedModels.length > 0) {
			return this._cycleScopedModel(direction);
		}
		return this._cycleAvailableModel(direction);
	}

	private async _cycleScopedModel(direction: "forward" | "backward"): Promise<ModelCycleResult | undefined> {
		const scopedModels = this._scopedModels.filter((scoped) => this._modelRegistry.hasConfiguredAuth(scoped.model));
		if (scopedModels.length <= 1) return undefined;

		const currentModel = this.model;
		let currentIndex = scopedModels.findIndex((sm) => modelsAreEqual(sm.model, currentModel));

		if (currentIndex === -1) currentIndex = 0;
		const len = scopedModels.length;
		const nextIndex = direction === "forward" ? (currentIndex + 1) % len : (currentIndex - 1 + len) % len;
		const next = scopedModels[nextIndex];
		const thinkingLevel = this._getThinkingLevelForModelSwitch(next.thinkingLevel);

		// Apply model
		this.engine.state.model = next.model;
		this.sessionManager.appendModelChange(next.model.provider, next.model.id);
		this.settingsManager.setDefaultModelAndProvider(next.model.provider, next.model.id);

		// Apply thinking level.
		// - Explicit scoped model thinking level overrides current session level
		// - Undefined scoped model thinking level inherits the current session preference
		// setThinkingLevel clamps to model capabilities.
		this.setThinkingLevel(thinkingLevel);

		await this._emitModelSelect(next.model, currentModel, "cycle");

		return { model: next.model, thinkingLevel: this.thinkingLevel, isScoped: true };
	}

	private async _cycleAvailableModel(direction: "forward" | "backward"): Promise<ModelCycleResult | undefined> {
		const availableModels = await this._modelRegistry.getAvailable();
		if (availableModels.length <= 1) return undefined;

		const currentModel = this.model;
		let currentIndex = availableModels.findIndex((m) => modelsAreEqual(m, currentModel));

		if (currentIndex === -1) currentIndex = 0;
		const len = availableModels.length;
		const nextIndex = direction === "forward" ? (currentIndex + 1) % len : (currentIndex - 1 + len) % len;
		const nextModel = availableModels[nextIndex];

		const thinkingLevel = this._getThinkingLevelForModelSwitch();
		this.engine.state.model = nextModel;
		this.sessionManager.appendModelChange(nextModel.provider, nextModel.id);
		this.settingsManager.setDefaultModelAndProvider(nextModel.provider, nextModel.id);

		// Re-clamp thinking level for new model's capabilities
		this.setThinkingLevel(thinkingLevel);

		await this._emitModelSelect(nextModel, currentModel, "cycle");

		return { model: nextModel, thinkingLevel: this.thinkingLevel, isScoped: false };
	}

	// =========================================================================
	// Thinking Level Management
	// =========================================================================

	/**
	 * Set thinking level.
	 * Clamps to model capabilities based on available thinking levels.
	 * Saves to session and settings only if the level actually changes.
	 */
	setThinkingLevel(level: ThinkingLevel, options: { persistDefault?: boolean } = {}): void {
		const availableLevels = this.getAvailableThinkingLevels();
		const effectiveLevel = availableLevels.includes(level) ? level : this._clampThinkingLevel(level, availableLevels);
		const persistDefault = options.persistDefault ?? true;

		// Only persist if actually changing
		const previousLevel = this.engine.state.thinkingLevel;
		const isChanging = effectiveLevel !== previousLevel;

		this.engine.state.thinkingLevel = effectiveLevel;

		if (isChanging) {
			this.sessionManager.appendThinkingLevelChange(effectiveLevel);
			if (persistDefault && (this.supportsThinking() || effectiveLevel !== "off")) {
				this.settingsManager.setDefaultThinkingLevel(effectiveLevel);
			}
			this._emit({ type: "thinking_level_changed", level: effectiveLevel });
			void this._extensionRunner.emit({
				type: "thinking_level_select",
				level: effectiveLevel,
				previousLevel,
			});
		}
	}

	/**
	 * Cycle to next thinking level.
	 * @returns New level, or undefined if model doesn't support thinking
	 */
	cycleThinkingLevel(): ThinkingLevel | undefined {
		if (!this.supportsThinking()) return undefined;

		const levels = this.getAvailableThinkingLevels();
		const currentIndex = levels.indexOf(this.thinkingLevel);
		const nextIndex = (currentIndex + 1) % levels.length;
		const nextLevel = levels[nextIndex];

		this.setThinkingLevel(nextLevel);
		return nextLevel;
	}

	/**
	 * Get available thinking levels for current model.
	 * The provider will clamp to what the specific model supports internally.
	 */
	getAvailableThinkingLevels(): ThinkingLevel[] {
		if (!this.model) return THINKING_LEVELS;
		return getSupportedThinkingLevels(this.model) as ThinkingLevel[];
	}

	getAutoThinkEnabled(): boolean {
		return this.settingsManager.getAutoThinkEnabled();
	}

	setAutoThinkEnabled(enabled: boolean): void {
		this.settingsManager.setAutoThinkEnabled(enabled);
	}

	getAutoEscalateModel(): boolean {
		return this.settingsManager.getAutoEscalateModel();
	}

	setAutoEscalateModel(enabled: boolean): void {
		this.settingsManager.setAutoEscalateModel(enabled);
	}

	getAutomationEnabled(): boolean {
		return this.settingsManager.getAutomationEnabled();
	}

	setAutomationEnabled(enabled: boolean): void {
		this.settingsManager.setAutomationEnabled(enabled);
		this._refreshBaseSystemPrompt();
	}

	getAutomationRequireConfirmation(): boolean {
		return this.settingsManager.getAutomationRequireConfirmation();
	}

	setAutomationRequireConfirmation(enabled: boolean): void {
		this.settingsManager.setAutomationRequireConfirmation(enabled);
		this._refreshBaseSystemPrompt();
	}

	private _resolveAutoThinkingLevel(text: string): ThinkingLevel | undefined {
		if (!this.settingsManager.getAutoThinkEnabled() || !this.supportsThinking()) {
			return undefined;
		}

		return resolveFastAutoThinkingLevel(text);
	}

	private _applyAutoThinkingLevel(text: string): void {
		const level = this._resolveAutoThinkingLevel(text);
		if (!level || level === this.thinkingLevel) {
			return;
		}
		this.setThinkingLevel(level, { persistDefault: false });
	}

	private _applyFastThinkingGuard(text: string): void {
		if (!this.supportsThinking()) {
			return;
		}
		const fastLevel = resolveFastAutoThinkingLevel(text);
		if (thinkingRank(this.thinkingLevel) > thinkingRank(fastLevel)) {
			this.setThinkingLevel(fastLevel, { persistDefault: false });
		}
	}

	/**
	 * Check if current model supports thinking/reasoning.
	 */
	supportsThinking(): boolean {
		return !!this.model?.reasoning;
	}

	private _getThinkingLevelForModelSwitch(explicitLevel?: ThinkingLevel): ThinkingLevel {
		if (explicitLevel !== undefined) {
			return explicitLevel;
		}
		if (!this.supportsThinking()) {
			return this.settingsManager.getDefaultThinkingLevel() ?? DEFAULT_THINKING_LEVEL;
		}
		return this.thinkingLevel;
	}

	private _clampThinkingLevel(level: ThinkingLevel, _availableLevels: ThinkingLevel[]): ThinkingLevel {
		return this.model ? (clampThinkingLevel(this.model, level) as ThinkingLevel) : "off";
	}

	// =========================================================================
	// Queue Mode Management
	// =========================================================================

	/**
	 * Set steering message mode.
	 * Saves to settings.
	 */
	setSteeringMode(mode: "all" | "one-at-a-time"): void {
		this.engine.steeringMode = mode;
		this.settingsManager.setSteeringMode(mode);
	}

	/**
	 * Set follow-up message mode.
	 * Saves to settings.
	 */
	setFollowUpMode(mode: "all" | "one-at-a-time"): void {
		this.engine.followUpMode = mode;
		this.settingsManager.setFollowUpMode(mode);
	}

	// =========================================================================
	// Compaction
	// =========================================================================

	/**
	 * Manually compact the session context.
	 * Aborts current engine operation first.
	 * @param customInstructions Optional instructions for the compaction summary
	 */
	async compact(customInstructions?: string): Promise<CompactionResult> {
		this._disconnectFromEngine();
		await this.abort();
		this._compactionAbortController = new AbortController();
		this._emit({ type: "compaction_start", reason: "manual" });

		try {
			if (!this.model) {
				throw new Error(formatNoModelSelectedMessage());
			}

			const { apiKey, headers } = await this._getRequiredRequestAuth(this.model);

			const pathEntries = this.sessionManager.getBranch();
			const settings = this.settingsManager.getCompactionSettings();

			const preparation = prepareCompaction(pathEntries, settings);
			if (!preparation) {
				// Check why we can't compact
				const lastEntry = pathEntries[pathEntries.length - 1];
				if (lastEntry?.type === "compaction") {
					throw new Error("Already compacted");
				}
				throw new Error("Nothing to compact (session too small)");
			}

			let extensionCompaction: CompactionResult | undefined;
			let fromExtension = false;

			if (this._extensionRunner.hasHandlers("session_before_compact")) {
				const result = (await this._extensionRunner.emit({
					type: "session_before_compact",
					preparation,
					branchEntries: pathEntries,
					customInstructions,
					signal: this._compactionAbortController.signal,
				})) as SessionBeforeCompactResult | undefined;

				if (result?.cancel) {
					throw new Error("Compaction cancelled");
				}

				if (result?.compaction) {
					extensionCompaction = result.compaction;
					fromExtension = true;
				}
			}

			let summary: string;
			let firstKeptEntryId: string;
			let tokensBefore: number;
			let details: unknown;

			if (extensionCompaction) {
				// Extension provided compaction content
				summary = extensionCompaction.summary;
				firstKeptEntryId = extensionCompaction.firstKeptEntryId;
				tokensBefore = extensionCompaction.tokensBefore;
				details = extensionCompaction.details;
			} else {
				// Generate compaction result
				const result = await compact(
					preparation,
					this.model!,
					apiKey,
					headers,
					customInstructions,
					this._compactionAbortController.signal,
					this.settingsManager.getDefaultThinkingLevel(),
				);
				summary = result.summary;
				firstKeptEntryId = result.firstKeptEntryId;
				tokensBefore = result.tokensBefore;
				details = result.details;
			}

			if (this._compactionAbortController.signal.aborted) {
				throw new Error("Compaction cancelled");
			}

			this.sessionManager.appendCompaction(summary, firstKeptEntryId, tokensBefore, details, fromExtension);
			const newEntries = this.sessionManager.getEntries();
			const sessionContext = this.sessionManager.buildSessionContext();
			this.engine.state.messages = sessionContext.messages;

			// Get the saved compaction entry for the extension event
			const savedCompactionEntry = newEntries.find((e) => e.type === "compaction" && e.summary === summary) as
				| CompactionEntry
				| undefined;

			if (this._extensionRunner && savedCompactionEntry) {
				await this._extensionRunner.emit({
					type: "session_compact",
					compactionEntry: savedCompactionEntry,
					fromExtension,
				});
			}

			const compactionResult = {
				summary,
				firstKeptEntryId,
				tokensBefore,
				details,
			};
			this._emit({
				type: "compaction_end",
				reason: "manual",
				result: compactionResult,
				aborted: false,
				willRetry: false,
			});
			return compactionResult;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const aborted = message === "Compaction cancelled" || (error instanceof Error && error.name === "AbortError");
			this._emit({
				type: "compaction_end",
				reason: "manual",
				result: undefined,
				aborted,
				willRetry: false,
				errorMessage: aborted ? undefined : `Compaction failed: ${message}`,
			});
			throw error;
		} finally {
			this._compactionAbortController = undefined;
			this._reconnectToEngine();
		}
	}

	/**
	 * Cancel in-progress compaction (manual or auto).
	 */
	abortCompaction(): void {
		this._compactionAbortController?.abort();
		this._autoCompactionAbortController?.abort();
	}

	/**
	 * Cancel in-progress branch summarization.
	 */
	abortBranchSummary(): void {
		this._branchSummaryAbortController?.abort();
	}

	/**
	 * Check if compaction is needed and run it.
	 * Called after engine_end and before prompt submission.
	 *
	 * Two cases:
	 * 1. Overflow: Provider returned context overflow error, remove error message from engine state, compact, auto-retry
	 * 2. Threshold: Context over threshold, compact, NO auto-retry (user continues manually)
	 *
	 * @param assistantMessage The assistant message to check
	 * @param skipAbortedCheck If false, include aborted messages (for pre-prompt check). Default: true
	 */
	private async _checkCompaction(assistantMessage: AssistantMessage, skipAbortedCheck = true): Promise<void> {
		const settings = this.settingsManager.getCompactionSettings();
		if (!settings.enabled) return;

		// Skip if message was aborted (user cancelled) - unless skipAbortedCheck is false
		if (skipAbortedCheck && assistantMessage.stopReason === "aborted") return;

		const contextWindow = this.model?.contextWindow ?? 0;

		// Skip overflow check if the message came from a different model.
		// This handles the case where user switched from a smaller-context model (e.g. opus)
		// to a larger-context model (e.g. codex) - the overflow error from the old model
		// shouldn't trigger compaction for the new model.
		const sameModel =
			this.model && assistantMessage.provider === this.model.provider && assistantMessage.model === this.model.id;

		// Skip compaction checks if this assistant message is older than the latest
		// compaction boundary. This prevents a stale pre-compaction usage/error
		// from retriggering compaction on the first prompt after compaction.
		const compactionEntry = getLatestCompactionEntry(this.sessionManager.getBranch());
		const assistantIsFromBeforeCompaction =
			compactionEntry !== null && assistantMessage.timestamp <= new Date(compactionEntry.timestamp).getTime();
		if (assistantIsFromBeforeCompaction) {
			return;
		}

		// Case 1: Overflow - Provider returned context overflow error
		if (sameModel && isContextOverflow(assistantMessage, contextWindow)) {
			if (this._overflowRecoveryAttempted) {
				this._emit({
					type: "compaction_end",
					reason: "overflow",
					result: undefined,
					aborted: false,
					willRetry: false,
					errorMessage:
						"Context overflow recovery failed after one compact-and-retry attempt. Try reducing context or switching to a larger-context model.",
				});
				return;
			}

			this._overflowRecoveryAttempted = true;
			// Remove the error message from engine state (it IS saved to session for history,
			// but we don't want it in context for the retry)
			const messages = this.engine.state.messages;
			if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
				this.engine.state.messages = messages.slice(0, -1);
			}
			await this._runAutoCompaction("overflow", true);
			return;
		}

		// Case 2: Threshold - context is getting large
		// For error messages (no usage data), estimate from last successful response.
		// This ensures sessions that hit persistent API errors (e.g. 529) can still compact.
		let contextTokens: number;
		if (assistantMessage.stopReason === "error") {
			const messages = this.engine.state.messages;
			const estimate = estimateContextTokens(messages);
			if (estimate.lastUsageIndex === null) return; // No usage data at all
			// Verify the usage source is post-compaction. Kept pre-compaction messages
			// have stale usage reflecting the old (larger) context and would falsely
			// trigger compaction right after one just finished.
			const usageMsg = messages[estimate.lastUsageIndex];
			if (
				compactionEntry &&
				usageMsg.role === "assistant" &&
				(usageMsg as AssistantMessage).timestamp <= new Date(compactionEntry.timestamp).getTime()
			) {
				return;
			}
			contextTokens = estimate.tokens;
		} else if (assistantMessage.usage) {
			contextTokens = calculateContextTokens(assistantMessage.usage);
		} else {
			const messages = this.engine.state.messages;
			const estimate = estimateContextTokens(messages);
			if (estimate.lastUsageIndex === null) {
				// No usage data at all — estimate from message count as fallback
				contextTokens = messages.length * 500;
			} else {
				contextTokens = estimate.tokens;
			}
		}
		if (shouldCompact(contextTokens, contextWindow, settings)) {
			await this._runAutoCompaction("threshold", false);
		}
	}

	/**
	 * Pre-prompt guard: estimates the next request before sending it.
	 * This catches long sessions with no reliable fresh usage yet and prevents
	 * the model from degrading or hard-failing on the next user message.
	 */
	private async _checkPrePromptCompaction(text: string, images?: ImageContent[]): Promise<void> {
		const settings = this.settingsManager.getCompactionSettings();
		if (!settings.enabled || this.isCompacting) return;

		const provisionalUserMessage: EngineMessage = {
			role: "user",
			content: [{ type: "text", text }, ...(images ?? [])],
			timestamp: Date.now(),
		};
		const estimate = estimateContextTokens([...this.engine.state.messages, provisionalUserMessage]);
		const contextWindow = this.model?.contextWindow ?? 0;
		if (shouldCompact(estimate.tokens, contextWindow, settings)) {
			await this._runAutoCompaction("threshold", false);
		}
	}

	/**
	 * Internal: Run auto-compaction with events.
	 */
	private async _runAutoCompaction(reason: "overflow" | "threshold", willRetry: boolean): Promise<void> {
		const settings = this.settingsManager.getCompactionSettings();

		this._emit({ type: "compaction_start", reason });
		this._autoCompactionAbortController = new AbortController();

		try {
			if (!this.model) {
				this._emit({
					type: "compaction_end",
					reason,
					result: undefined,
					aborted: false,
					willRetry: false,
				});
				return;
			}

			const authResult = await this._modelRegistry.getApiKeyAndHeaders(this.model);
			if (!authResult.ok || !authResult.apiKey) {
				this._emit({
					type: "compaction_end",
					reason,
					result: undefined,
					aborted: false,
					willRetry: false,
				});
				return;
			}
			const { apiKey, headers } = authResult;

			const pathEntries = this.sessionManager.getBranch();

			const preparation = prepareCompaction(pathEntries, settings);
			if (!preparation) {
				this._emit({
					type: "compaction_end",
					reason,
					result: undefined,
					aborted: false,
					willRetry: false,
				});
				return;
			}

			let extensionCompaction: CompactionResult | undefined;
			let fromExtension = false;

			if (this._extensionRunner.hasHandlers("session_before_compact")) {
				const extensionResult = (await this._extensionRunner.emit({
					type: "session_before_compact",
					preparation,
					branchEntries: pathEntries,
					customInstructions: undefined,
					signal: this._autoCompactionAbortController.signal,
				})) as SessionBeforeCompactResult | undefined;

				if (extensionResult?.cancel) {
					this._emit({
						type: "compaction_end",
						reason,
						result: undefined,
						aborted: true,
						willRetry: false,
					});
					return;
				}

				if (extensionResult?.compaction) {
					extensionCompaction = extensionResult.compaction;
					fromExtension = true;
				}
			}

			let summary: string;
			let firstKeptEntryId: string;
			let tokensBefore: number;
			let details: unknown;

			if (extensionCompaction) {
				// Extension provided compaction content
				summary = extensionCompaction.summary;
				firstKeptEntryId = extensionCompaction.firstKeptEntryId;
				tokensBefore = extensionCompaction.tokensBefore;
				details = extensionCompaction.details;
			} else {
				// Generate compaction result
				const result = await compact(
					preparation,
					this.model!,
					apiKey,
					headers,
					undefined,
					this._autoCompactionAbortController.signal,
					this.settingsManager.getSettings().thinkingLevel,
				);
				summary = result.summary;
				firstKeptEntryId = result.firstKeptEntryId;
				tokensBefore = result.tokensBefore;
				details = result.details;
			}

			if (this._autoCompactionAbortController.signal.aborted) {
				this._emit({
					type: "compaction_end",
					reason,
					result: undefined,
					aborted: true,
					willRetry: false,
				});
				return;
			}

			this.sessionManager.appendCompaction(summary, firstKeptEntryId, tokensBefore, details, fromExtension);
			const newEntries = this.sessionManager.getEntries();
			const sessionContext = this.sessionManager.buildSessionContext();
			this.engine.state.messages = sessionContext.messages;

			// Get the saved compaction entry for the extension event
			const savedCompactionEntry = newEntries.find((e) => e.type === "compaction" && e.summary === summary) as
				| CompactionEntry
				| undefined;

			if (this._extensionRunner && savedCompactionEntry) {
				await this._extensionRunner.emit({
					type: "session_compact",
					compactionEntry: savedCompactionEntry,
					fromExtension,
				});
			}

			const result: CompactionResult = {
				summary,
				firstKeptEntryId,
				tokensBefore,
				details,
			};
			this._emit({ type: "compaction_end", reason, result, aborted: false, willRetry });

			if (willRetry) {
				const messages = this.engine.state.messages;
				const lastMsg = messages[messages.length - 1];
				if (lastMsg?.role === "assistant" && (lastMsg as AssistantMessage).stopReason === "error") {
					this.engine.state.messages = messages.slice(0, -1);
				}

				setTimeout(() => {
					this.engine.continue().catch(() => {});
				}, 100);
			} else if (this.engine.hasQueuedMessages()) {
				// Auto-compaction can complete while follow-up/steering/custom messages are waiting.
				// Kick the loop so queued messages are actually delivered.
				setTimeout(() => {
					this.engine.continue().catch(() => {});
				}, 100);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "compaction failed";
			this._emit({
				type: "compaction_end",
				reason,
				result: undefined,
				aborted: false,
				willRetry: false,
				errorMessage:
					reason === "overflow"
						? `Context overflow recovery failed: ${errorMessage}`
						: `Auto-compaction failed: ${errorMessage}`,
			});
		} finally {
			this._autoCompactionAbortController = undefined;
		}
	}

	/**
	 * Toggle auto-compaction setting.
	 */
	setAutoCompactionEnabled(enabled: boolean): void {
		this.settingsManager.setCompactionEnabled(enabled);
	}

	/** Whether auto-compaction is enabled */
	get autoCompactionEnabled(): boolean {
		return this.settingsManager.getCompactionEnabled();
	}

	async bindExtensions(bindings: ExtensionBindings): Promise<void> {
		if (bindings.uiContext !== undefined) {
			this._extensionUIContext = bindings.uiContext;
		}
		if (bindings.commandContextActions !== undefined) {
			this._extensionCommandContextActions = bindings.commandContextActions;
		}
		if (bindings.shutdownHandler !== undefined) {
			this._extensionShutdownHandler = bindings.shutdownHandler;
		}
		if (bindings.onError !== undefined) {
			this._extensionErrorListener = bindings.onError;
		}

		this._applyExtensionBindings(this._extensionRunner);
		await this._extensionRunner.emit(this._sessionStartEvent);
		await this.extendResourcesFromExtensions(this._sessionStartEvent.reason === "reload" ? "reload" : "startup");
	}

	private async extendResourcesFromExtensions(reason: "startup" | "reload"): Promise<void> {
		if (!this._extensionRunner.hasHandlers("resources_discover")) {
			return;
		}

		const { skillPaths, promptPaths, themePaths } = await this._extensionRunner.emitResourcesDiscover(
			this._cwd,
			reason,
		);

		if (skillPaths.length === 0 && promptPaths.length === 0 && themePaths.length === 0) {
			return;
		}

		const extensionPaths: ResourceExtensionPaths = {
			skillPaths: this.buildExtensionResourcePaths(skillPaths),
			promptPaths: this.buildExtensionResourcePaths(promptPaths),
			themePaths: this.buildExtensionResourcePaths(themePaths),
		};

		this._resourceLoader.extendResources(extensionPaths);
		this._baseSystemPrompt = this._rebuildSystemPrompt(this.getActiveToolNames());
		this.engine.state.systemPrompt = this._baseSystemPrompt;
	}

	private buildExtensionResourcePaths(entries: Array<{ path: string; extensionPath: string }>): Array<{
		path: string;
		metadata: { source: string; scope: "temporary"; origin: "top-level"; baseDir?: string };
	}> {
		return entries.map((entry) => {
			const source = this.getExtensionSourceLabel(entry.extensionPath);
			const baseDir = entry.extensionPath.startsWith("<") ? undefined : dirname(entry.extensionPath);
			return {
				path: entry.path,
				metadata: {
					source,
					scope: "temporary",
					origin: "top-level",
					baseDir,
				},
			};
		});
	}

	private getExtensionSourceLabel(extensionPath: string): string {
		if (extensionPath.startsWith("<")) {
			return `extension:${extensionPath.replace(/[<>]/g, "")}`;
		}
		const base = basename(extensionPath);
		const name = base.replace(/\.(ts|js)$/, "");
		return `extension:${name}`;
	}

	private _applyExtensionBindings(runner: ExtensionRunner): void {
		runner.setUIContext(this._extensionUIContext);
		runner.bindCommandContext(this._extensionCommandContextActions);

		this._extensionErrorUnsubscriber?.();
		this._extensionErrorUnsubscriber = this._extensionErrorListener
			? runner.onError(this._extensionErrorListener)
			: undefined;
	}

	private _refreshCurrentModelFromRegistry(): void {
		const currentModel = this.model;
		if (!currentModel) {
			return;
		}

		const refreshedModel = this._modelRegistry.find(currentModel.provider, currentModel.id);
		if (!refreshedModel || refreshedModel === currentModel) {
			return;
		}

		this.engine.state.model = refreshedModel;
	}

	private _bindExtensionCore(runner: ExtensionRunner): void {
		const getCommands = (): SlashCommandInfo[] => {
			const extensionCommands: SlashCommandInfo[] = runner.getRegisteredCommands().map((command) => ({
				name: command.invocationName,
				description: command.description,
				source: "extension",
				sourceInfo: command.sourceInfo,
			}));

			const templates: SlashCommandInfo[] = this.promptTemplates.map((template) => ({
				name: template.name,
				description: template.description,
				source: "prompt",
				sourceInfo: template.sourceInfo,
			}));

			const skills: SlashCommandInfo[] = this._resourceLoader.getSkills().skills.map((skill) => ({
				name: `skill:${skill.name}`,
				description: skill.description,
				source: "skill",
				sourceInfo: skill.sourceInfo,
			}));

			return [...extensionCommands, ...templates, ...skills];
		};

		runner.bindCore(
			{
				sendMessage: (message, options) => {
					this.sendCustomMessage(message, options).catch((err) => {
						runner.emitError({
							extensionPath: "<runtime>",
							event: "send_message",
							error: err instanceof Error ? err.message : String(err),
						});
					});
				},
				sendUserMessage: (content, options) => {
					this.sendUserMessage(content, options).catch((err) => {
						runner.emitError({
							extensionPath: "<runtime>",
							event: "send_user_message",
							error: err instanceof Error ? err.message : String(err),
						});
					});
				},
				appendEntry: (customType, data) => {
					this.sessionManager.appendCustomEntry(customType, data);
				},
				setSessionName: (name) => {
					this.setSessionName(name);
				},
				getSessionName: () => {
					return this.sessionManager.getSessionName();
				},
				setLabel: (entryId, label) => {
					this.sessionManager.appendLabelChange(entryId, label);
				},
				getActiveTools: () => this.getActiveToolNames(),
				getAllTools: () => this.getAllTools(),
				setActiveTools: (toolNames) => this.setActiveToolsByName(toolNames),
				refreshTools: () => this._refreshToolRegistry(),
				getCommands,
				setModel: async (model) => {
					if (!this.modelRegistry.hasConfiguredAuth(model)) return false;
					await this.setModel(model);
					return true;
				},
				getThinkingLevel: () => this.thinkingLevel,
				setThinkingLevel: (level) => this.setThinkingLevel(level),
			},
			{
				getModel: () => this.model,
				isIdle: () => !this.isStreaming,
				getSignal: () => this.engine.signal,
				abort: () => this.abort(),
				hasPendingMessages: () => this.pendingMessageCount > 0,
				shutdown: () => {
					this._extensionShutdownHandler?.();
				},
				getContextUsage: () => this.getContextUsage(),
				compact: (options) => {
					void (async () => {
						try {
							const result = await this.compact(options?.customInstructions);
							options?.onComplete?.(result);
						} catch (error) {
							const err = error instanceof Error ? error : new Error(String(error));
							options?.onError?.(err);
						}
					})();
				},
				getSystemPrompt: () => this.systemPrompt,
			},
			{
				registerProvider: (name, config) => {
					this._modelRegistry.registerProvider(name, config);
					this._refreshCurrentModelFromRegistry();
				},
				unregisterProvider: (name) => {
					this._modelRegistry.unregisterProvider(name);
					this._refreshCurrentModelFromRegistry();
				},
			},
		);
	}

	private _refreshToolRegistry(options?: { activeToolNames?: string[]; includeAllExtensionTools?: boolean }): void {
		const previousRegistryNames = new Set(this._toolRegistry.keys());
		const previousActiveToolNames = this.getActiveToolNames();
		const allowedToolNames = this._allowedToolNames;
		const isAllowedTool = (name: string): boolean => !allowedToolNames || allowedToolNames.has(name);

		const registeredTools = this._extensionRunner.getAllRegisteredTools();
		const allCustomTools = [
			...registeredTools,
			...this._customTools.map((definition) => ({
				definition,
				sourceInfo: createSyntheticSourceInfo(`<sdk:${definition.name}>`, { source: "sdk" }),
			})),
		].filter((tool) => isAllowedTool(tool.definition.name));
		const definitionRegistry = new Map<string, ToolDefinitionEntry>(
			Array.from(this._baseToolDefinitions.entries())
				.filter(([name]) => isAllowedTool(name))
				.map(([name, definition]) => [
					name,
					{
						definition,
						sourceInfo: createSyntheticSourceInfo(`<builtin:${name}>`, { source: "builtin" }),
					},
				]),
		);
		for (const tool of allCustomTools) {
			definitionRegistry.set(tool.definition.name, {
				definition: tool.definition,
				sourceInfo: tool.sourceInfo,
			});
		}
		this._toolDefinitions = definitionRegistry;
		this._toolPromptSnippets = new Map(
			Array.from(definitionRegistry.values())
				.map(({ definition }) => {
					const snippet = this._normalizePromptSnippet(definition.promptSnippet);
					return snippet ? ([definition.name, snippet] as const) : undefined;
				})
				.filter((entry): entry is readonly [string, string] => entry !== undefined),
		);
		this._toolPromptGuidelines = new Map(
			Array.from(definitionRegistry.values())
				.map(({ definition }) => {
					const guidelines = this._normalizePromptGuidelines(definition.promptGuidelines);
					return guidelines.length > 0 ? ([definition.name, guidelines] as const) : undefined;
				})
				.filter((entry): entry is readonly [string, string[]] => entry !== undefined),
		);
		const runner = this._extensionRunner;
		const wrappedExtensionTools = wrapRegisteredTools(allCustomTools, runner);
		const wrappedBuiltInTools = wrapRegisteredTools(
			Array.from(this._baseToolDefinitions.values())
				.filter((definition) => isAllowedTool(definition.name))
				.map((definition) => ({
					definition,
					sourceInfo: createSyntheticSourceInfo(`<builtin:${definition.name}>`, { source: "builtin" }),
				})),
			runner,
		);

		const toolRegistry = new Map(wrappedBuiltInTools.map((tool) => [tool.name, tool]));
		for (const tool of wrappedExtensionTools as EngineTool[]) {
			toolRegistry.set(tool.name, tool);
		}
		this._toolRegistry = toolRegistry;

		const nextActiveToolNames = (
			options?.activeToolNames ? [...options.activeToolNames] : [...previousActiveToolNames]
		).filter((name) => isAllowedTool(name));

		if (allowedToolNames) {
			for (const toolName of this._toolRegistry.keys()) {
				if (allowedToolNames.has(toolName)) {
					nextActiveToolNames.push(toolName);
				}
			}
		} else if (options?.includeAllExtensionTools) {
			for (const tool of wrappedExtensionTools) {
				nextActiveToolNames.push(tool.name);
			}
		} else if (!options?.activeToolNames) {
			for (const toolName of this._toolRegistry.keys()) {
				if (!previousRegistryNames.has(toolName)) {
					nextActiveToolNames.push(toolName);
				}
			}
		}

		this.setActiveToolsByName([...new Set(nextActiveToolNames)]);
	}

	private _buildRuntime(options: {
		activeToolNames?: string[];
		flagValues?: Map<string, boolean | string>;
		includeAllExtensionTools?: boolean;
	}): void {
		const autoResizeImages = this.settingsManager.getImageAutoResize();
		const shellCommandPrefix = this.settingsManager.getShellCommandPrefix();
		const shellPath = this.settingsManager.getShellPath();
		const discordToken = this.settingsManager.getDiscordToken();
		const baseToolDefinitions = this._baseToolsOverride
			? Object.fromEntries(
					Object.entries(this._baseToolsOverride).map(([name, tool]) => [
						name,
						createToolDefinitionFromEngineTool(tool),
					]),
				)
			: createAllToolDefinitions(this._cwd, {
					read: { autoResizeImages },
					bash: { commandPrefix: shellCommandPrefix, shellPath },
					discord: { token: discordToken },
					getModelVisionSupport: () => {
						const m = this.model;
						if (!m) return true; // bilinmiyorsa izin ver
						return Array.isArray(m.input) && m.input.includes("image");
					},
				});

		this._baseToolDefinitions = new Map(
			Object.entries(baseToolDefinitions).map(([name, tool]) => [name, tool as ToolDefinition]),
		);

		const compactTool = getCompactContextTool(this);
		this._baseToolDefinitions.set(compactTool.name, compactTool as unknown as ToolDefinition);

		const extensionsResult = this._resourceLoader.getExtensions();
		if (options.flagValues) {
			for (const [name, value] of options.flagValues) {
				extensionsResult.runtime.flagValues.set(name, value);
			}
		}

		this._extensionRunner = new ExtensionRunner(
			extensionsResult.extensions,
			extensionsResult.runtime,
			this._cwd,
			this.sessionManager,
			this._modelRegistry,
		);
		if (this._extensionRunnerRef) {
			this._extensionRunnerRef.current = this._extensionRunner;
		}
		this._bindExtensionCore(this._extensionRunner);
		this._applyExtensionBindings(this._extensionRunner);

		const defaultActiveToolNames = this._baseToolsOverride
			? Object.keys(this._baseToolsOverride)
			: [
					"read",
					"ls",
					"grep",
					"find",
					"bash",
					"edit",
					"write",
					"digest",
					"todo",
					"git_ship",
					...(discordToken
						? ["discord_list_guilds", "discord_get_channels", "discord_send_message", "discord_manage_channel"]
						: []),
				];
		const baseActiveToolNames = options.activeToolNames ?? defaultActiveToolNames;
		this._refreshToolRegistry({
			activeToolNames: baseActiveToolNames,
			includeAllExtensionTools: options.includeAllExtensionTools,
		});
	}

	async reload(): Promise<void> {
		const previousFlagValues = this._extensionRunner.getFlagValues();
		await emitSessionShutdownEvent(this._extensionRunner, { type: "session_shutdown", reason: "reload" });
		await this.settingsManager.reload();
		resetApiProviders();
		await this._resourceLoader.reload();
		const activeToolNames = this.getActiveToolNames();
		const discordToken = this.settingsManager.getDiscordToken();
		const nextActiveToolNames = discordToken
			? [
					...activeToolNames,
					"discord_list_guilds",
					"discord_get_channels",
					"discord_send_message",
					"discord_manage_channel",
				]
			: activeToolNames;
		this._buildRuntime({
			activeToolNames: nextActiveToolNames,
			flagValues: previousFlagValues,
			includeAllExtensionTools: true,
		});

		const hasBindings =
			this._extensionUIContext ||
			this._extensionCommandContextActions ||
			this._extensionShutdownHandler ||
			this._extensionErrorListener;
		if (hasBindings) {
			await this._extensionRunner.emit({ type: "session_start", reason: "reload" });
			await this.extendResourcesFromExtensions("reload");
		}
	}

	// =========================================================================
	// Auto-Retry
	// =========================================================================

	/**
	 * Check if an error is retryable (overloaded, rate limit, server errors).
	 * Context overflow errors are NOT retryable (handled by compaction instead).
	 */
	private _isRetryableError(message: AssistantMessage): boolean {
		if (message.stopReason !== "error" || !message.errorMessage) return false;

		// Context overflow is handled by compaction, not retry
		const contextWindow = this.model?.contextWindow ?? 0;
		if (isContextOverflow(message, contextWindow)) return false;

		const err = message.errorMessage;
		// Match: overloaded_error, provider returned error, rate limit, 429, 500, 502, 503, 504, service unavailable, network/connection errors (including connection lost), fetch failed, request ended without sending chunks, HTTP/2 closed before response, terminated, retry delay exceeded
		return /overloaded|provider.?returned.?error|rate.?limit|too many requests|429|500|502|503|504|service.?unavailable|server.?error|internal.?error|network.?error|connection.?error|connection.?refused|connection.?lost|other side closed|fetch failed|upstream.?connect|reset before headers|socket hang up|ended without|http2 request did not get a response|timed? out|timeout|terminated|retry delay/i.test(
			err,
		);
	}

	/**
	 * Handle retryable errors with exponential backoff.
	 * @returns true if retry was initiated, false if max retries exceeded or disabled
	 */
	private async _handleRetryableError(message: AssistantMessage): Promise<boolean> {
		const settings = this.settingsManager.getRetrySettings();
		if (!settings.enabled) {
			this._resolveRetry();
			return false;
		}

		// Retry promise is created synchronously in _handleEngineEvent for engine_end.
		// Keep a defensive fallback here in case a future refactor bypasses that path.
		if (!this._retryPromise) {
			this._retryPromise = new Promise((resolve) => {
				this._retryResolve = resolve;
			});
		}

		this._retryAttempt++;

		if (this._retryAttempt > settings.maxRetries) {
			if (!this._noMemory && this._lastEncounteredError) {
				const lastAttemptText = message.content
					.filter((c) => c.type === "text")
					.map((c) => c.text)
					.join("\n");
				try {
					const memory = LearningMemory.getInstance();
					memory.recordExperience(
						this._lastEncounteredError,
						lastAttemptText,
						"failure",
						`Attempted fix failed to resolve error after maximum retries. Do not try this exact approach again.`,
					);
				} catch {}
				this._lastEncounteredError = undefined;
			}

			// Max retries exceeded, emit final failure and reset
			this._emit({
				type: "auto_retry_end",
				success: false,
				attempt: this._retryAttempt - 1,
				finalError: message.errorMessage,
			});
			this._retryAttempt = 0;
			this._resolveRetry(); // Resolve so waitForRetry() completes
			return false;
		}

		const delayMs = settings.baseDelayMs * 2 ** (this._retryAttempt - 1);

		this._emit({
			type: "auto_retry_start",
			attempt: this._retryAttempt,
			maxAttempts: settings.maxRetries,
			delayMs,
			errorMessage: message.errorMessage || "Unknown error",
		});

		// Remove error message from engine state (keep in session for history)
		const messages = this.engine.state.messages;
		if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
			this.engine.state.messages = messages.slice(0, -1);
		}

		// Wait with exponential backoff (abortable)
		this._retryAbortController = new AbortController();
		try {
			await sleep(delayMs, this._retryAbortController.signal);
		} catch {
			// Aborted during sleep - emit end event so UI can clean up
			const attempt = this._retryAttempt;
			this._retryAttempt = 0;
			this._retryAbortController = undefined;
			this._emit({
				type: "auto_retry_end",
				success: false,
				attempt,
				finalError: "Retry cancelled",
			});
			this._resolveRetry();
			return false;
		}
		this._retryAbortController = undefined;

		// Retry via continue() - use setTimeout to break out of event handler chain
		setTimeout(() => {
			this.engine.continue().catch(() => {
				// Retry failed - will be caught by next engine_end
			});
		}, 0);

		return true;
	}

	/**
	 * Cancel in-progress retry.
	 */
	abortRetry(): void {
		this._retryAbortController?.abort();
		// Note: _retryAttempt is reset in the catch block of _autoRetry
		this._resolveRetry();
	}

	/**
	 * Wait for any in-progress retry to complete.
	 * Returns immediately if no retry is in progress.
	 */
	private async waitForRetry(): Promise<void> {
		if (!this._retryPromise) {
			return;
		}

		await this._retryPromise;
		await this.engine.waitForIdle();
	}

	/** Whether auto-retry is currently in progress */
	get isRetrying(): boolean {
		return this._retryPromise !== undefined;
	}

	/** Whether auto-retry is enabled */
	get autoRetryEnabled(): boolean {
		return this.settingsManager.getRetryEnabled();
	}

	/**
	 * Toggle auto-retry setting.
	 */
	setAutoRetryEnabled(enabled: boolean): void {
		this.settingsManager.setRetryEnabled(enabled);
	}

	// =========================================================================
	// Bash Execution
	// =========================================================================

	/**
	 * Execute a bash command.
	 * Adds result to engine context and session.
	 * @param command The bash command to execute
	 * @param onChunk Optional streaming callback for output
	 * @param options.excludeFromContext If true, command output won't be sent to Provider (!! prefix)
	 * @param options.operations Custom BashOperations for remote execution
	 */
	async executeBash(
		command: string,
		onChunk?: (chunk: string) => void,
		options?: { excludeFromContext?: boolean; operations?: BashOperations },
	): Promise<BashResult> {
		this._bashAbortController = new AbortController();

		// Apply command prefix if configured (e.g., "shopt -s expand_aliases" for alias support)
		const prefix = this.settingsManager.getShellCommandPrefix();
		const shellPath = this.settingsManager.getShellPath();
		const resolvedCommand = prefix ? `${prefix}\n${command}` : command;

		try {
			const result = await executeBashWithOperations(
				resolvedCommand,
				this.sessionManager.getCwd(),
				options?.operations ?? createLocalBashOperations({ shellPath }),
				{
					onChunk,
					signal: this._bashAbortController.signal,
				},
			);

			this.recordBashResult(command, result, options);
			return result;
		} finally {
			this._bashAbortController = undefined;
		}
	}

	/**
	 * Record a bash execution result in session history.
	 * Used by executeBash and by extensions that handle bash execution themselves.
	 */
	recordBashResult(command: string, result: BashResult, options?: { excludeFromContext?: boolean }): void {
		const bashMessage: BashExecutionMessage = {
			role: "bashExecution",
			command,
			output: result.output,
			exitCode: result.exitCode,
			cancelled: result.cancelled,
			truncated: result.truncated,
			fullOutputPath: result.fullOutputPath,
			timestamp: Date.now(),
			excludeFromContext: options?.excludeFromContext,
		};

		// If engine is streaming, defer adding to avoid breaking tool_use/tool_result ordering
		if (this.isStreaming) {
			// Queue for later - will be flushed on engine_end
			this._pendingBashMessages.push(bashMessage);
		} else {
			// Add to engine state immediately
			this.engine.state.messages.push(bashMessage);

			// Save to session
			this.sessionManager.appendMessage(bashMessage);
		}
	}

	/**
	 * Cancel running bash command.
	 */
	abortBash(): void {
		this._bashAbortController?.abort();
	}

	/** Whether a bash command is currently running */
	get isBashRunning(): boolean {
		return this._bashAbortController !== undefined;
	}

	/** Whether there are pending bash messages waiting to be flushed */
	get hasPendingBashMessages(): boolean {
		return this._pendingBashMessages.length > 0;
	}

	/**
	 * Flush pending bash messages to engine state and session.
	 * Called after engine turn completes to maintain proper message ordering.
	 */
	private _flushPendingBashMessages(): void {
		if (this._pendingBashMessages.length === 0) return;

		for (const bashMessage of this._pendingBashMessages) {
			// Add to engine state
			this.engine.state.messages.push(bashMessage);

			// Save to session
			this.sessionManager.appendMessage(bashMessage);
		}

		this._pendingBashMessages = [];
	}

	// =========================================================================
	// Session Management
	// =========================================================================

	/**
	 * Set a display name for the current session.
	 */
	setSessionName(name: string): void {
		this.sessionManager.appendSessionInfo(name);
		this._emit({ type: "session_info_changed", name: this.sessionManager.getSessionName() });
	}

	// =========================================================================
	// Tree Navigation
	// =========================================================================

	/**
	 * Navigate to a different node in the session tree.
	 * Unlike fork() which creates a new session file, this stays in the same file.
	 *
	 * @param targetId The entry ID to navigate to
	 * @param options.summarize Whether user wants to summarize abandoned branch
	 * @param options.customInstructions Custom instructions for summarizer
	 * @param options.replaceInstructions If true, customInstructions replaces the default prompt
	 * @param options.label Label to attach to the branch summary entry
	 * @returns Result with editorText (if user message) and cancelled status
	 */
	async navigateTree(
		targetId: string,
		options: { summarize?: boolean; customInstructions?: string; replaceInstructions?: boolean; label?: string } = {},
	): Promise<{ editorText?: string; cancelled: boolean; aborted?: boolean; summaryEntry?: BranchSummaryEntry }> {
		const oldLeafId = this.sessionManager.getLeafId();

		// No-op if already at target
		if (targetId === oldLeafId) {
			return { cancelled: false };
		}

		// Model required for summarization
		if (options.summarize && !this.model) {
			throw new Error("No model available for summarization");
		}

		const targetEntry = this.sessionManager.getEntry(targetId);
		if (!targetEntry) {
			throw new Error(`Entry ${targetId} not found`);
		}

		// Collect entries to summarize (from old leaf to common ancestor)
		const { entries: entriesToSummarize, commonAncestorId } = collectEntriesForBranchSummary(
			this.sessionManager,
			oldLeafId,
			targetId,
		);

		// Prepare event data - mutable so extensions can override
		let customInstructions = options.customInstructions;
		let replaceInstructions = options.replaceInstructions;
		let label = options.label;

		const preparation: TreePreparation = {
			targetId,
			oldLeafId,
			commonAncestorId,
			entriesToSummarize,
			userWantsSummary: options.summarize ?? false,
			customInstructions,
			replaceInstructions,
			label,
		};

		// Set up abort controller for summarization
		this._branchSummaryAbortController = new AbortController();

		try {
			let extensionSummary: { summary: string; details?: unknown } | undefined;
			let fromExtension = false;

			// Emit session_before_tree event
			if (this._extensionRunner.hasHandlers("session_before_tree")) {
				const result = (await this._extensionRunner.emit({
					type: "session_before_tree",
					preparation,
					signal: this._branchSummaryAbortController.signal,
				})) as SessionBeforeTreeResult | undefined;

				if (result?.cancel) {
					return { cancelled: true };
				}

				if (result?.summary && options.summarize) {
					extensionSummary = result.summary;
					fromExtension = true;
				}

				// Allow extensions to override instructions and label
				if (result?.customInstructions !== undefined) {
					customInstructions = result.customInstructions;
				}
				if (result?.replaceInstructions !== undefined) {
					replaceInstructions = result.replaceInstructions;
				}
				if (result?.label !== undefined) {
					label = result.label;
				}
			}

			// Run default summarizer if needed
			let summaryText: string | undefined;
			let summaryDetails: unknown;
			if (options.summarize && entriesToSummarize.length > 0 && !extensionSummary) {
				const model = this.model!;
				const { apiKey, headers } = await this._getRequiredRequestAuth(model);
				const branchSummarySettings = this.settingsManager.getBranchSummarySettings();
				const result = await generateBranchSummary(entriesToSummarize, {
					model,
					apiKey,
					headers,
					signal: this._branchSummaryAbortController.signal,
					customInstructions,
					replaceInstructions,
					reserveTokens: branchSummarySettings.reserveTokens,
				});
				if (result.aborted) {
					return { cancelled: true, aborted: true };
				}
				if (result.error) {
					throw new Error(result.error);
				}
				summaryText = result.summary;
				summaryDetails = {
					readFiles: result.readFiles || [],
					modifiedFiles: result.modifiedFiles || [],
				};
			} else if (extensionSummary) {
				summaryText = extensionSummary.summary;
				summaryDetails = extensionSummary.details;
			}

			// Determine the new leaf position based on target type
			let newLeafId: string | null;
			let editorText: string | undefined;

			if (targetEntry.type === "message" && targetEntry.message.role === "user") {
				// User message: leaf = parent (null if root), text goes to editor
				newLeafId = targetEntry.parentId;
				editorText = this._extractUserMessageText(targetEntry.message.content);
			} else if (targetEntry.type === "custom_message") {
				// Custom message: leaf = parent (null if root), text goes to editor
				newLeafId = targetEntry.parentId;
				editorText =
					typeof targetEntry.content === "string"
						? targetEntry.content
						: targetEntry.content
								.filter((c): c is { type: "text"; text: string } => c.type === "text")
								.map((c) => c.text)
								.join("");
			} else {
				// Non-user message: leaf = selected node
				newLeafId = targetId;
			}

			// Switch leaf (with or without summary)
			// Summary is attached at the navigation target position (newLeafId), not the old branch
			let summaryEntry: BranchSummaryEntry | undefined;
			if (summaryText) {
				// Create summary at target position (can be null for root)
				const summaryId = this.sessionManager.branchWithSummary(
					newLeafId,
					summaryText,
					summaryDetails,
					fromExtension,
				);
				summaryEntry = this.sessionManager.getEntry(summaryId) as BranchSummaryEntry;

				// Attach label to the summary entry
				if (label) {
					this.sessionManager.appendLabelChange(summaryId, label);
				}
			} else if (newLeafId === null) {
				// No summary, navigating to root - reset leaf
				this.sessionManager.resetLeaf();
			} else {
				// No summary, navigating to non-root
				this.sessionManager.branch(newLeafId);
			}

			// Attach label to target entry when not summarizing (no summary entry to label)
			if (label && !summaryText) {
				this.sessionManager.appendLabelChange(targetId, label);
			}

			// Update engine state
			const sessionContext = this.sessionManager.buildSessionContext();
			this.engine.state.messages = sessionContext.messages;

			// Emit session_tree event
			await this._extensionRunner.emit({
				type: "session_tree",
				newLeafId: this.sessionManager.getLeafId(),
				oldLeafId,
				summaryEntry,
				fromExtension: summaryText ? fromExtension : undefined,
			});

			// Emit to custom tools

			return { editorText, cancelled: false, summaryEntry };
		} finally {
			this._branchSummaryAbortController = undefined;
		}
	}

	/**
	 * Get all user messages from session for fork selector.
	 */
	getUserMessagesForForking(): Array<{ entryId: string; text: string }> {
		const entries = this.sessionManager.getEntries();
		const result: Array<{ entryId: string; text: string }> = [];

		for (const entry of entries) {
			if (entry.type !== "message") continue;
			if (entry.message.role !== "user") continue;

			const text = this._extractUserMessageText(entry.message.content);
			if (text) {
				result.push({ entryId: entry.id, text });
			}
		}

		return result;
	}

	private _extractUserMessageText(content: string | Array<{ type: string; text?: string }>): string {
		if (typeof content === "string") return content;
		if (Array.isArray(content)) {
			return content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("");
		}
		return "";
	}

	/**
	 * Get session statistics.
	 */
	getSessionStats(): SessionStats {
		const state = this.state;
		const userMessages = state.messages.filter((m) => m.role === "user").length;
		const assistantMessages = state.messages.filter((m) => m.role === "assistant").length;
		const toolResults = state.messages.filter((m) => m.role === "toolResult").length;

		let toolCalls = 0;
		let totalInput = 0;
		let totalOutput = 0;
		let totalCacheRead = 0;
		let totalCacheWrite = 0;
		let totalCost = 0;

		for (const message of state.messages) {
			if (message.role === "assistant") {
				const assistantMsg = message as AssistantMessage;
				toolCalls += assistantMsg.content.filter((c) => c.type === "toolCall").length;
				totalInput += assistantMsg.usage.input;
				totalOutput += assistantMsg.usage.output;
				totalCacheRead += assistantMsg.usage.cacheRead;
				totalCacheWrite += assistantMsg.usage.cacheWrite;
				totalCost += assistantMsg.usage.cost.total;
			}
		}

		return {
			sessionFile: this.sessionFile,
			sessionId: this.sessionId,
			userMessages,
			assistantMessages,
			toolCalls,
			toolResults,
			totalMessages: state.messages.length,
			tokens: {
				input: totalInput,
				output: totalOutput,
				cacheRead: totalCacheRead,
				cacheWrite: totalCacheWrite,
				total: totalInput + totalOutput + totalCacheRead + totalCacheWrite,
			},
			cost: totalCost,
			contextUsage: this.getContextUsage(),
		};
	}

	getContextUsage(): ContextUsage | undefined {
		const model = this.model;
		if (!model) return undefined;

		const contextWindow = model.contextWindow ?? 0;
		if (contextWindow <= 0) return undefined;

		// After compaction, the last assistant usage reflects pre-compaction context size.
		// We can only trust usage from an assistant that responded after the latest compaction.
		// If no such assistant exists, context token count is unknown until the next Provider response.
		const branchEntries = this.sessionManager.getBranch();
		const latestCompaction = getLatestCompactionEntry(branchEntries);

		if (latestCompaction) {
			// Check if there's a valid assistant usage after the compaction boundary
			const compactionIndex = branchEntries.lastIndexOf(latestCompaction);
			let hasPostCompactionUsage = false;
			for (let i = branchEntries.length - 1; i > compactionIndex; i--) {
				const entry = branchEntries[i];
				if (entry.type === "message" && entry.message.role === "assistant") {
					const assistant = entry.message;
					if (assistant.stopReason !== "aborted" && assistant.stopReason !== "error") {
						const contextTokens = calculateContextTokens(assistant.usage);
						if (contextTokens > 0) {
							hasPostCompactionUsage = true;
						}
						break;
					}
				}
			}

			if (!hasPostCompactionUsage) {
				return { tokens: null, contextWindow, percent: null };
			}
		}

		const estimate = estimateContextTokens(this.messages);

		// Cross-check: provider-reported totalTokens can be inflated by prompt caching
		// (cacheRead + cacheWrite counted each turn). Compute a simple char-based ceiling
		// so the displayed % doesn't falsely explode from cache accounting.
		let charEstimate = 0;
		for (const msg of this.messages) {
			if (typeof msg.content === "string") {
				charEstimate += msg.content.length;
			} else if (Array.isArray(msg.content)) {
				for (const part of msg.content) {
					if (part.type === "text" && typeof part.text === "string") {
						charEstimate += part.text.length;
					}
				}
			}
		}
		// Bash execution messages store output separately
		for (const msg of this.messages) {
			if ((msg as any).role === "bashExecution") {
				charEstimate += (msg as any).output?.length ?? 0;
			}
		}
		const systemPromptLen = this.engine.state.systemPrompt?.length ?? 0;
		charEstimate += systemPromptLen;
		// Conservative estimate: 1 token ≈ 4 chars. Add history overhead margin (2x).
		const contentBasedEstimate = Math.ceil(charEstimate / 2);
		const clampedTokens = Math.min(estimate.tokens, contentBasedEstimate);

		const percent = (clampedTokens / contextWindow) * 100;

		return {
			tokens: clampedTokens,
			contextWindow,
			percent,
		};
	}

	/**
	 * Export session to HTML.
	 * @param outputPath Optional output path (defaults to session directory)
	 * @returns Path to exported file
	 */
	async exportToHtml(outputPath?: string): Promise<string> {
		const themeName = this.settingsManager.getTheme();

		// Create tool renderer if we have an extension runner (for custom tool HTML rendering)
		const toolRenderer: ToolHtmlRenderer = createToolHtmlRenderer({
			getToolDefinition: (name) => this.getToolDefinition(name),
			theme,
			cwd: this.sessionManager.getCwd(),
		});

		return await exportSessionToHtml(this.sessionManager, this.state, {
			outputPath,
			themeName,
			toolRenderer,
		});
	}

	/**
	 * Export the current session branch to a JSONL file.
	 * Writes the session header followed by all entries on the current branch path.
	 * @param outputPath Target file path. If omitted, generates a timestamped file in cwd.
	 * @returns The resolved output file path.
	 */
	exportToJsonl(outputPath?: string): string {
		const filePath = resolve(outputPath ?? `session-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
		const dir = dirname(filePath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}

		const header: SessionHeader = {
			type: "session",
			version: CURRENT_SESSION_VERSION,
			id: this.sessionManager.getSessionId(),
			timestamp: new Date().toISOString(),
			cwd: this.sessionManager.getCwd(),
		};

		const branchEntries = this.sessionManager.getBranch();
		const lines = [JSON.stringify(header)];

		// Re-chain parentIds to form a linear sequence
		let prevId: string | null = null;
		for (const entry of branchEntries) {
			const linear = { ...entry, parentId: prevId };
			lines.push(JSON.stringify(linear));
			prevId = entry.id;
		}

		writeFileSync(filePath, `${lines.join("\n")}\n`);
		return filePath;
	}

	// =========================================================================
	// Utilities
	// =========================================================================

	/**
	 * Get text content of last assistant message.
	 * Useful for /copy command.
	 * @returns Text content, or undefined if no assistant message exists
	 */
	getLastAssistantText(): string | undefined {
		const lastAssistant = this.messages
			.slice()
			.reverse()
			.find((m) => {
				if (m.role !== "assistant") return false;
				const msg = m as AssistantMessage;
				// Skip aborted messages with no content
				if (msg.stopReason === "aborted" && msg.content.length === 0) return false;
				return true;
			});

		if (!lastAssistant) return undefined;

		let text = "";
		for (const content of (lastAssistant as AssistantMessage).content) {
			if (content.type === "text") {
				text += content.text;
			}
		}

		return text.trim() || undefined;
	}

	// =========================================================================
	// Extension System
	// =========================================================================

	createReplacedSessionContext(): ReplacedSessionContext {
		const context = Object.defineProperties(
			{},
			Object.getOwnPropertyDescriptors(this._extensionRunner.createCommandContext()),
		) as ReplacedSessionContext;
		context.sendMessage = (message, options) => this.sendCustomMessage(message, options);
		context.sendUserMessage = (content, options) => this.sendUserMessage(content, options);
		return context;
	}

	/**
	 * Check if extensions have handlers for a specific event type.
	 */
	hasExtensionHandlers(eventType: string): boolean {
		return this._extensionRunner.hasHandlers(eventType);
	}

	/**
	 * Get the extension runner (for setting UI context and error handlers).
	 */
	get extensionRunner(): ExtensionRunner {
		return this._extensionRunner;
	}
}
