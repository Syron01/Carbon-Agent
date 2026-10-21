import type { Transport } from "astro-core";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import lockfile from "proper-lockfile";
import { CONFIG_DIR_NAME, getEngineDir } from "../config.js";
import {
	type AffectiveMode,
	type AffectiveSettings,
	type AffectiveState,
	createInitialAffectiveState,
	type NormalizedAffectiveSettings,
	normalizeAffectiveSettings,
} from "./affect.js";
import type { CodingAgentMode, CodingAgentsSettings, CodingAgentVerbosity } from "./agents.js";

export interface CompactionSettings {
	enabled?: boolean; // default: true
	profile?: "nuclear" | "aggressive" | "balanced" | "off"; // default: balanced
	reserveTokens?: number; // profile default override
	keepRecentTokens?: number; // profile default override
	/** Explicit auto-compaction trigger as a share of the context window (1-99). When unset, the profile ceiling is used. */
	thresholdPercent?: number;
}

export interface BranchSummarySettings {
	reserveTokens?: number; // default: 16384 (tokens reserved for prompt + Provider response)
	skipPrompt?: boolean; // default: false - when true, skips "Summarize branch?" prompt and defaults to no summary
}

export interface ProviderRetrySettings {
	timeoutMs?: number; // SDK/provider request timeout in milliseconds
	maxRetries?: number; // SDK/provider retry attempts
	maxRetryDelayMs?: number; // default: 60000 (max server-requested delay before failing)
}

export interface RetrySettings {
	enabled?: boolean; // default: true
	maxRetries?: number; // default: 3
	baseDelayMs?: number; // default: 2000 (exponential backoff: 2s, 4s, 8s)
	provider?: ProviderRetrySettings;
}

export interface TerminalSettings {
	showImages?: boolean; // default: true (only relevant if terminal supports images)
	imageWidthCells?: number; // default: 60 (preferred inline image width in terminal cells)
	clearOnShrink?: boolean; // default: false (clear empty rows when content shrinks)
	showTerminalProgress?: boolean; // default: false (OSC 9;4 terminal progress indicators)
	logoMode?: "hero" | "compact" | "minimal" | "off" | "auto"; // default: "auto"
}

export interface ImageSettings {
	autoResize?: boolean; // default: true (resize images to 2000x2000 max for better model compatibility)
	blockImages?: boolean; // default: false - when true, prevents all images from being sent to Provider providers
}

export interface ThinkingBudgetsSettings {
	minimal?: number;
	low?: number;
	medium?: number;
	high?: number;
}

export interface MarkdownSettings {
	codeBlockIndent?: string; // default: "  "
}

export interface WarningSettings {
	anthropicExtraUsage?: boolean; // default: true
}

export type CodingAgentSettings = CodingAgentsSettings;

export interface RoboticsSettings {
	enabled?: boolean; // default: false
	visionModel?: string; // default: "qwen2.5-vl:7b"
	visionProvider?: string; // default: "ollama"
	visionBaseUrl?: string; // default: "http://localhost:11434"
	somEnabled?: boolean; // Set-of-Mark pipeline, default: false
	coordinateFormat?: "normalized" | "pixel"; // default: "normalized" (0-1000)
	thinkingBudget?: number; // 0-4096, default: 0
	captureSource?: "file" | "webcam" | "url"; // default: "file"
	webcamDevice?: string; // default: platform-specific
	outputOverlay?: boolean; // terminalde overlay çiz, default: true
	robotApiFunctionsPath?: string; // robot fonksiyon tanım dosyası
	autoCapture?: boolean; // her prompt'ta otomatik kamera çek, default: false
	captureIntervalMs?: number; // auto capture interval ms, default: 2000
	lastImagePath?: string; // son kullanılan görüntü dosyası
}

export type TransportSetting = Transport;

/**
 * Package source for npm/git packages.
 * - String form: load all resources from the package
 * - Object form: filter which resources to load
 */
export type PackageSource =
	| string
	| {
			source: string;
			extensions?: string[];
			skills?: string[];
			prompts?: string[];
			themes?: string[];
	  };

export type DefaultProjectTrust = "ask" | "always" | "never";

export interface Settings {
	lastChangelogVersion?: string;
	defaultProvider?: string;
	defaultModel?: string;
	defaultThinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
	autoThink?: boolean;
	autoEscalateModel?: boolean;
	smartModel?: { provider: string; id: string };
	automation?: { enabled?: boolean; requireConfirmation?: boolean };
	transport?: TransportSetting; // default: "auto"
	steeringMode?: "all" | "one-at-a-time";
	followUpMode?: "all" | "one-at-a-time";
	theme?: string;
	compaction?: CompactionSettings;
	branchSummary?: BranchSummarySettings;
	retry?: RetrySettings;
	hideThinkingBlock?: boolean;
	shellPath?: string; // Custom shell path (e.g., for Cygwin users on Windows)
	quietStartup?: boolean;
	shellCommandPrefix?: string; // Prefix prepended to every bash command (e.g., "shopt -s expand_aliases" for alias support)
	npmCommand?: string[]; // Command used for npm package lookup/install operations, argv-style (e.g., ["mise", "exec", "node@20", "--", "npm"])
	collapseChangelog?: boolean; // Show condensed changelog after update (use /changelog for full)
	enableInstallTelemetry?: boolean; // default: true - anonymous version/update ping after changelog-detected updates
	packages?: PackageSource[]; // Array of npm/git package sources (string or object with filtering)
	extensions?: string[]; // Array of local extension file paths or directories
	skills?: string[]; // Array of local skill file paths or directories
	prompts?: string[]; // Array of local prompt template paths or directories
	themes?: string[]; // Array of local theme file paths or directories
	enableSkillCommands?: boolean; // default: true - register skills as /skill:name commands
	terminal?: TerminalSettings;
	images?: ImageSettings;
	enabledModels?: string[]; // Model patterns for cycling (same format as --models CLI flag)
	doubleEscapeAction?: "fork" | "tree" | "none"; // Action for double-escape with empty editor (default: "tree")
	treeFilterMode?: "default" | "no-tools" | "user-only" | "labeled-only" | "all"; // Default filter when opening /tree
	thinkingBudgets?: ThinkingBudgetsSettings; // Custom token budgets for thinking levels
	editorPaddingX?: number; // Horizontal padding for input editor (default: 0)
	autocompleteMaxVisible?: number; // Max visible items in autocomplete dropdown (default: 5)
	showHardwareCursor?: boolean; // Show terminal cursor while still positioning it for IME
	markdown?: MarkdownSettings;
	warnings?: WarningSettings;
	sessionDir?: string; // Custom session storage directory (same format as --session-dir CLI flag)
	mcpServers?: Record<string, McpServerConfig>; // MCP server configurations
	agents?: CodingAgentSettings; // Company-style coding agent orchestration
	affect?: AffectiveSettings; // Persistent affective control layer
	robotics?: RoboticsSettings; // Robotics mode configuration
	discordToken?: string; // Discord Bot Token
	permissionLevel?: "ask" | "safe" | "full";
	aiName?: string; // AI agent name
	extraInstructions?: string; // Custom extra instructions for the AI
	/** Fusion mode: use two models - one for thinking, one for coding */
	fusionMode?: {
		enabled: boolean;
		thinkModel?: { provider: string; id: string };
		codeModel?: { provider: string; id: string };
	};
	/** Fable mode: stage-planning execution discipline with tier routing */
	fableMode?: {
		enabled: boolean;
		tier?: "opus" | "sonnet" | "haiku";
	};
	outputPad?: 0 | 1; // Additional padding between output sections (default: 0)
	showCacheMissNotices?: boolean; // Show cache miss debug notices in UI (default: false)
	defaultProjectTrust?: DefaultProjectTrust; // Default trust mode for new projects
	httpIdleTimeoutMs?: number; // HTTP idle timeout for dispatcher (default: 300000)
	externalEditorCommand?: string; // External editor command (e.g. "code -w")
	projectTrusted?: boolean; // Whether the current project has been trusted
}

export interface McpServerConfig {
	command: string;
	args?: string[];
	env?: Record<string, string>;
	cwd?: string;
	autoStart?: boolean;
}

/** Deep merge settings: project/overrides take precedence, nested objects merge recursively */
function deepMergeSettings(base: Settings, overrides: Settings): Settings {
	const result: Settings = { ...base };

	for (const key of Object.keys(overrides) as (keyof Settings)[]) {
		const overrideValue = overrides[key];
		const baseValue = base[key];

		if (overrideValue === undefined) {
			continue;
		}

		// For nested objects, merge recursively
		if (
			typeof overrideValue === "object" &&
			overrideValue !== null &&
			!Array.isArray(overrideValue) &&
			typeof baseValue === "object" &&
			baseValue !== null &&
			!Array.isArray(baseValue)
		) {
			(result as Record<string, unknown>)[key] = { ...baseValue, ...overrideValue };
		} else {
			// For primitives and arrays, override value wins
			(result as Record<string, unknown>)[key] = overrideValue;
		}
	}

	return result;
}

export type SettingsScope = "global" | "project";

export interface SettingsStorage {
	withLock(scope: SettingsScope, fn: (current: string | undefined) => string | undefined): void;
}

export interface SettingsError {
	scope: SettingsScope;
	error: Error;
}

export class FileSettingsStorage implements SettingsStorage {
	private globalSettingsPath: string;
	private projectSettingsPath: string;

	constructor(cwd: string, engineDir: string) {
		this.globalSettingsPath = join(engineDir, "settings.json");
		this.projectSettingsPath = join(cwd, CONFIG_DIR_NAME, "settings.json");
	}

	private acquireLockSyncWithRetry(path: string): () => void {
		const maxAttempts = 10;
		const delayMs = 20;
		let lastError: unknown;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				return lockfile.lockSync(path, { realpath: false });
			} catch (error) {
				const code =
					typeof error === "object" && error !== null && "code" in error
						? String((error as { code?: unknown }).code)
						: undefined;
				if (code !== "ELOCKED" || attempt === maxAttempts) {
					throw error;
				}
				lastError = error;
				const start = Date.now();
				while (Date.now() - start < delayMs) {
					// Sleep synchronously to avoid changing callers to async.
				}
			}
		}

		throw (lastError as Error) ?? new Error("Failed to acquire settings lock");
	}

	withLock(scope: SettingsScope, fn: (current: string | undefined) => string | undefined): void {
		const path = scope === "global" ? this.globalSettingsPath : this.projectSettingsPath;
		const dir = dirname(path);

		let release: (() => void) | undefined;
		try {
			// Only create directory and lock if file exists or we need to write
			const fileExists = existsSync(path);
			if (fileExists) {
				release = this.acquireLockSyncWithRetry(path);
			}
			const current = fileExists ? readFileSync(path, "utf-8") : undefined;
			const next = fn(current);
			if (next !== undefined) {
				// Only create directory when we actually need to write
				if (!existsSync(dir)) {
					mkdirSync(dir, { recursive: true });
				}
				if (!release) {
					release = this.acquireLockSyncWithRetry(path);
				}
				writeFileSync(path, next, "utf-8");
			}
		} finally {
			if (release) {
				release();
			}
		}
	}
}

export class InMemorySettingsStorage implements SettingsStorage {
	private global: string | undefined;
	private project: string | undefined;

	withLock(scope: SettingsScope, fn: (current: string | undefined) => string | undefined): void {
		const current = scope === "global" ? this.global : this.project;
		const next = fn(current);
		if (next !== undefined) {
			if (scope === "global") {
				this.global = next;
			} else {
				this.project = next;
			}
		}
	}
}

export class SettingsManager {
	private storage: SettingsStorage;
	private globalSettings: Settings;
	private projectSettings: Settings;
	private settings: Settings;
	private modifiedFields = new Set<keyof Settings>(); // Track global fields modified during session
	private modifiedNestedFields = new Map<keyof Settings, Set<string>>(); // Track global nested field modifications
	private modifiedProjectFields = new Set<keyof Settings>(); // Track project fields modified during session
	private modifiedProjectNestedFields = new Map<keyof Settings, Set<string>>(); // Track project nested field modifications
	private globalSettingsLoadError: Error | null = null; // Track if global settings file had parse errors
	private projectSettingsLoadError: Error | null = null; // Track if project settings file had parse errors
	private writeQueue: Promise<void> = Promise.resolve();
	private errors: SettingsError[];

	private constructor(
		storage: SettingsStorage,
		initialGlobal: Settings,
		initialProject: Settings,
		globalLoadError: Error | null = null,
		projectLoadError: Error | null = null,
		initialErrors: SettingsError[] = [],
	) {
		this.storage = storage;
		this.globalSettings = initialGlobal;
		this.projectSettings = initialProject;
		this.globalSettingsLoadError = globalLoadError;
		this.projectSettingsLoadError = projectLoadError;
		this.errors = [...initialErrors];
		this.settings = deepMergeSettings(this.globalSettings, this.projectSettings);
	}

	/** Create a SettingsManager that loads from files */
	static create(cwd: string, engineDir: string = getEngineDir()): SettingsManager {
		const storage = new FileSettingsStorage(cwd, engineDir);
		return SettingsManager.fromStorage(storage);
	}

	/** Create a SettingsManager from an arbitrary storage backend */
	static fromStorage(storage: SettingsStorage): SettingsManager {
		const globalLoad = SettingsManager.tryLoadFromStorage(storage, "global");
		const projectLoad = SettingsManager.tryLoadFromStorage(storage, "project");
		const initialErrors: SettingsError[] = [];
		if (globalLoad.error) {
			initialErrors.push({ scope: "global", error: globalLoad.error });
		}
		if (projectLoad.error) {
			initialErrors.push({ scope: "project", error: projectLoad.error });
		}

		return new SettingsManager(
			storage,
			globalLoad.settings,
			projectLoad.settings,
			globalLoad.error,
			projectLoad.error,
			initialErrors,
		);
	}

	/** Create an in-memory SettingsManager (no file I/O) */
	static inMemory(settings: Partial<Settings> = {}): SettingsManager {
		const storage = new InMemorySettingsStorage();
		const initialSettings = SettingsManager.migrateSettings(structuredClone(settings) as Record<string, unknown>);
		storage.withLock("global", () => JSON.stringify(initialSettings, null, 2));
		return SettingsManager.fromStorage(storage);
	}

	private static loadFromStorage(storage: SettingsStorage, scope: SettingsScope): Settings {
		let content: string | undefined;
		storage.withLock(scope, (current) => {
			content = current;
			return undefined;
		});

		if (!content) {
			return {};
		}
		const settings = JSON.parse(content);
		return SettingsManager.migrateSettings(settings);
	}

	private static tryLoadFromStorage(
		storage: SettingsStorage,
		scope: SettingsScope,
	): { settings: Settings; error: Error | null } {
		try {
			return { settings: SettingsManager.loadFromStorage(storage, scope), error: null };
		} catch (error) {
			return { settings: {}, error: error as Error };
		}
	}

	/** Migrate old settings format to new format */
	private static migrateSettings(settings: Record<string, unknown>): Settings {
		// Migrate queueMode -> steeringMode
		if ("queueMode" in settings && !("steeringMode" in settings)) {
			settings.steeringMode = settings.queueMode;
			delete settings.queueMode;
		}

		// Migrate legacy websockets boolean -> transport enum
		if (!("transport" in settings) && typeof settings.websockets === "boolean") {
			settings.transport = settings.websockets ? "websocket" : "sse";
			delete settings.websockets;
		}

		// Migrate old skills object format to new array format
		if (
			"skills" in settings &&
			typeof settings.skills === "object" &&
			settings.skills !== null &&
			!Array.isArray(settings.skills)
		) {
			const skillsSettings = settings.skills as {
				enableSkillCommands?: boolean;
				customDirectories?: unknown;
			};
			if (skillsSettings.enableSkillCommands !== undefined && settings.enableSkillCommands === undefined) {
				settings.enableSkillCommands = skillsSettings.enableSkillCommands;
			}
			if (Array.isArray(skillsSettings.customDirectories) && skillsSettings.customDirectories.length > 0) {
				settings.skills = skillsSettings.customDirectories;
			} else {
				delete settings.skills;
			}
		}

		// Migrate retry.maxDelayMs -> retry.provider.maxRetryDelayMs
		if (
			"retry" in settings &&
			typeof settings.retry === "object" &&
			settings.retry !== null &&
			!Array.isArray(settings.retry)
		) {
			const retrySettings = settings.retry as Record<string, unknown>;
			const providerSettings =
				typeof retrySettings.provider === "object" && retrySettings.provider !== null
					? (retrySettings.provider as Record<string, unknown>)
					: undefined;
			if (
				typeof retrySettings.maxDelayMs === "number" &&
				(providerSettings?.maxRetryDelayMs === undefined || providerSettings?.maxRetryDelayMs === null)
			) {
				retrySettings.provider = {
					...(providerSettings ?? {}),
					maxRetryDelayMs: retrySettings.maxDelayMs,
				};
			}
			delete retrySettings.maxDelayMs;
		}

		return settings as Settings;
	}

	getGlobalSettings(): Settings {
		return structuredClone(this.globalSettings);
	}

	getProjectSettings(): Settings {
		return structuredClone(this.projectSettings);
	}

	async reload(): Promise<void> {
		await this.writeQueue;
		const globalLoad = SettingsManager.tryLoadFromStorage(this.storage, "global");
		if (!globalLoad.error) {
			this.globalSettings = globalLoad.settings;
			this.globalSettingsLoadError = null;
		} else {
			this.globalSettingsLoadError = globalLoad.error;
			this.recordError("global", globalLoad.error);
		}

		this.modifiedFields.clear();
		this.modifiedNestedFields.clear();
		this.modifiedProjectFields.clear();
		this.modifiedProjectNestedFields.clear();

		const projectLoad = SettingsManager.tryLoadFromStorage(this.storage, "project");
		if (!projectLoad.error) {
			this.projectSettings = projectLoad.settings;
			this.projectSettingsLoadError = null;
		} else {
			this.projectSettingsLoadError = projectLoad.error;
			this.recordError("project", projectLoad.error);
		}

		this.settings = deepMergeSettings(this.globalSettings, this.projectSettings);
	}

	/** Apply additional overrides on top of current settings */
	applyOverrides(overrides: Partial<Settings>): void {
		this.settings = deepMergeSettings(this.settings, overrides);
	}

	/** Mark a global field as modified during this session */
	private markModified(field: keyof Settings, nestedKey?: string): void {
		this.modifiedFields.add(field);
		if (nestedKey) {
			if (!this.modifiedNestedFields.has(field)) {
				this.modifiedNestedFields.set(field, new Set());
			}
			this.modifiedNestedFields.get(field)!.add(nestedKey);
		}
	}

	/** Mark a project field as modified during this session */
	private markProjectModified(field: keyof Settings, nestedKey?: string): void {
		this.modifiedProjectFields.add(field);
		if (nestedKey) {
			if (!this.modifiedProjectNestedFields.has(field)) {
				this.modifiedProjectNestedFields.set(field, new Set());
			}
			this.modifiedProjectNestedFields.get(field)!.add(nestedKey);
		}
	}

	private recordError(scope: SettingsScope, error: unknown): void {
		const normalizedError = error instanceof Error ? error : new Error(String(error));
		this.errors.push({ scope, error: normalizedError });
	}

	private clearModifiedScope(scope: SettingsScope): void {
		if (scope === "global") {
			this.modifiedFields.clear();
			this.modifiedNestedFields.clear();
			return;
		}

		this.modifiedProjectFields.clear();
		this.modifiedProjectNestedFields.clear();
	}

	private enqueueWrite(scope: SettingsScope, task: () => void): void {
		this.writeQueue = this.writeQueue
			.then(() => {
				task();
				this.clearModifiedScope(scope);
			})
			.catch((error) => {
				this.recordError(scope, error);
			});
	}

	private cloneModifiedNestedFields(source: Map<keyof Settings, Set<string>>): Map<keyof Settings, Set<string>> {
		const snapshot = new Map<keyof Settings, Set<string>>();
		for (const [key, value] of source.entries()) {
			snapshot.set(key, new Set(value));
		}
		return snapshot;
	}

	private persistScopedSettings(
		scope: SettingsScope,
		snapshotSettings: Settings,
		modifiedFields: Set<keyof Settings>,
		modifiedNestedFields: Map<keyof Settings, Set<string>>,
	): void {
		this.storage.withLock(scope, (current) => {
			const currentFileSettings = current
				? SettingsManager.migrateSettings(JSON.parse(current) as Record<string, unknown>)
				: {};
			const mergedSettings: Settings = { ...currentFileSettings };
			for (const field of modifiedFields) {
				const value = snapshotSettings[field];
				if (modifiedNestedFields.has(field) && typeof value === "object" && value !== null) {
					const nestedModified = modifiedNestedFields.get(field)!;
					const baseNested = (currentFileSettings[field] as Record<string, unknown>) ?? {};
					const inMemoryNested = value as Record<string, unknown>;
					const mergedNested = { ...baseNested };
					for (const nestedKey of nestedModified) {
						mergedNested[nestedKey] = inMemoryNested[nestedKey];
					}
					(mergedSettings as Record<string, unknown>)[field] = mergedNested;
				} else {
					(mergedSettings as Record<string, unknown>)[field] = value;
				}
			}

			return JSON.stringify(mergedSettings, null, 2);
		});
	}

	private save(): void {
		this.settings = deepMergeSettings(this.globalSettings, this.projectSettings);

		if (this.globalSettingsLoadError) {
			return;
		}

		const snapshotGlobalSettings = structuredClone(this.globalSettings);
		const modifiedFields = new Set(this.modifiedFields);
		const modifiedNestedFields = this.cloneModifiedNestedFields(this.modifiedNestedFields);

		this.enqueueWrite("global", () => {
			this.persistScopedSettings("global", snapshotGlobalSettings, modifiedFields, modifiedNestedFields);
		});
	}

	private saveProjectSettings(settings: Settings): void {
		this.projectSettings = structuredClone(settings);
		this.settings = deepMergeSettings(this.globalSettings, this.projectSettings);

		if (this.projectSettingsLoadError) {
			return;
		}

		const snapshotProjectSettings = structuredClone(this.projectSettings);
		const modifiedFields = new Set(this.modifiedProjectFields);
		const modifiedNestedFields = this.cloneModifiedNestedFields(this.modifiedProjectNestedFields);
		this.enqueueWrite("project", () => {
			this.persistScopedSettings("project", snapshotProjectSettings, modifiedFields, modifiedNestedFields);
		});
	}

	async flush(): Promise<void> {
		await this.writeQueue;
	}

	drainErrors(): SettingsError[] {
		const drained = [...this.errors];
		this.errors = [];
		return drained;
	}

	getLastChangelogVersion(): string | undefined {
		return this.settings.lastChangelogVersion;
	}

	setLastChangelogVersion(version: string): void {
		this.globalSettings.lastChangelogVersion = version;
		this.markModified("lastChangelogVersion");
		this.save();
	}

	getSessionDir(): string | undefined {
		const sessionDir = this.settings.sessionDir;
		if (!sessionDir) {
			return sessionDir;
		}
		if (sessionDir === "~") {
			return homedir();
		}
		if (sessionDir.startsWith("~/")) {
			return join(homedir(), sessionDir.slice(2));
		}
		return sessionDir;
	}

	getDefaultProvider(): string | undefined {
		return this.settings.defaultProvider;
	}

	getDefaultModel(): string | undefined {
		return this.settings.defaultModel;
	}

	setDefaultProvider(provider: string): void {
		this.globalSettings.defaultProvider = provider;
		this.markModified("defaultProvider");
		this.save();
	}

	setDefaultModel(modelId: string): void {
		this.globalSettings.defaultModel = modelId;
		this.markModified("defaultModel");
		this.save();
	}

	setDefaultModelAndProvider(provider: string, modelId: string): void {
		this.globalSettings.defaultProvider = provider;
		this.globalSettings.defaultModel = modelId;
		this.markModified("defaultProvider");
		this.markModified("defaultModel");
		this.save();
	}

	getSteeringMode(): "all" | "one-at-a-time" {
		return this.settings.steeringMode || "one-at-a-time";
	}

	setSteeringMode(mode: "all" | "one-at-a-time"): void {
		this.globalSettings.steeringMode = mode;
		this.markModified("steeringMode");
		this.save();
	}

	getFollowUpMode(): "all" | "one-at-a-time" {
		return this.settings.followUpMode || "one-at-a-time";
	}

	setFollowUpMode(mode: "all" | "one-at-a-time"): void {
		this.globalSettings.followUpMode = mode;
		this.markModified("followUpMode");
		this.save();
	}

	getTheme(): string | undefined {
		return this.settings.theme;
	}

	setTheme(theme: string): void {
		this.globalSettings.theme = theme;
		this.markModified("theme");
		this.save();
	}

	getAiName(): string {
		return this.settings.aiName || "Astro";
	}

	setAiName(name: string): void {
		this.globalSettings.aiName = name || "Astro";
		this.markModified("aiName");
		this.save();
	}

	getExtraInstructions(): string {
		return this.settings.extraInstructions || "";
	}

	setExtraInstructions(instructions: string): void {
		this.globalSettings.extraInstructions = instructions || "";
		this.markModified("extraInstructions");
		this.save();
	}

	getPermissionLevel(): "ask" | "safe" | "full" {
		return this.settings.permissionLevel || "ask";
	}

	setPermissionLevel(level: "ask" | "safe" | "full"): void {
		this.globalSettings.permissionLevel = level;
		this.markModified("permissionLevel");
		if (level === "full") {
			this.setAutomationRequireConfirmation(false);
		} else {
			this.setAutomationRequireConfirmation(true);
		}
		this.save();
	}

	getDefaultThinkingLevel(): "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | undefined {
		return this.settings.defaultThinkingLevel;
	}

	setDefaultThinkingLevel(level: "off" | "minimal" | "low" | "medium" | "high" | "xhigh"): void {
		this.globalSettings.defaultThinkingLevel = level;
		this.markModified("defaultThinkingLevel");
		this.save();
	}

	getAutoThinkEnabled(): boolean {
		return this.settings.autoThink ?? false;
	}

	setAutoThinkEnabled(enabled: boolean): void {
		this.globalSettings.autoThink = enabled;
		this.markModified("autoThink");
		this.save();
	}

	getAutoEscalateModel(): boolean {
		return this.settings.autoEscalateModel ?? false;
	}

	setAutoEscalateModel(enabled: boolean): void {
		this.globalSettings.autoEscalateModel = enabled;
		this.markModified("autoEscalateModel");
		this.save();
	}

	getSmartModel(): { provider: string; id: string } | undefined {
		if (this.settings.smartModel) {
			return this.settings.smartModel;
		}
		// Default smart model: prefer Claude 3.5 Sonnet if available
		return { provider: "anthropic", id: "claude-3-5-sonnet-latest" };
	}

	setSmartModel(provider: string, id: string): void {
		this.globalSettings.smartModel = { provider, id };
		this.markModified("smartModel");
		this.save();
	}

	getAutomationEnabled(): boolean {
		return this.settings.automation?.enabled ?? false;
	}

	setAutomationEnabled(enabled: boolean): void {
		if (!this.globalSettings.automation) this.globalSettings.automation = {};
		this.globalSettings.automation.enabled = enabled;
		this.markModified("automation", "enabled");
		this.save();
	}

	getAutomationRequireConfirmation(): boolean {
		return this.settings.automation?.requireConfirmation ?? true;
	}

	setAutomationRequireConfirmation(enabled: boolean): void {
		if (!this.globalSettings.automation) this.globalSettings.automation = {};
		this.globalSettings.automation.requireConfirmation = enabled;
		this.markModified("automation", "requireConfirmation");
		this.save();
	}

	getTransport(): TransportSetting {
		return this.settings.transport ?? "auto";
	}

	setTransport(transport: TransportSetting): void {
		this.globalSettings.transport = transport;
		this.markModified("transport");
		this.save();
	}

	getCompactionProfile(): "nuclear" | "aggressive" | "balanced" | "off" {
		// Auto-optimize: use aggressive by default for best token efficiency
		return this.settings.compaction?.profile ?? "aggressive";
	}

	setCompactionProfile(profile: "nuclear" | "aggressive" | "balanced" | "off"): void {
		if (!this.globalSettings.compaction) {
			this.globalSettings.compaction = {};
		}
		this.globalSettings.compaction.profile = profile;
		this.markModified("compaction", "profile");
		this.save();
	}

	getCompactionEnabled(): boolean {
		if (this.getCompactionProfile() === "off") return false;
		return this.settings.compaction?.enabled ?? true;
	}

	setCompactionEnabled(enabled: boolean): void {
		if (!this.globalSettings.compaction) {
			this.globalSettings.compaction = {};
		}
		this.globalSettings.compaction.enabled = enabled;
		this.markModified("compaction", "enabled");
		this.save();
	}

	setCompactionReserveTokens(tokens: number | undefined): void {
		if (!this.globalSettings.compaction) {
			this.globalSettings.compaction = {};
		}
		this.globalSettings.compaction.reserveTokens = tokens;
		this.markModified("compaction", "reserveTokens");
		this.save();
	}

	setCompactionKeepRecentTokens(tokens: number | undefined): void {
		if (!this.globalSettings.compaction) {
			this.globalSettings.compaction = {};
		}
		this.globalSettings.compaction.keepRecentTokens = tokens;
		this.markModified("compaction", "keepRecentTokens");
		this.save();
	}

	getCompactionReserveTokens(): number {
		const explicit = this.settings.compaction?.reserveTokens;
		if (typeof explicit === "number") return explicit;
		const profile = this.getCompactionProfile();
		if (profile === "nuclear") return 1024;
		return profile === "aggressive" ? 4096 : 8192;
	}

	getCompactionKeepRecentTokens(): number {
		const explicit = this.settings.compaction?.keepRecentTokens;
		if (typeof explicit === "number") return explicit;
		const profile = this.getCompactionProfile();
		if (profile === "nuclear") return 1024;
		return profile === "aggressive" ? 3000 : 8000;
	}

	getCompactionThresholdPercent(): number | undefined {
		const pct = this.settings.compaction?.thresholdPercent;
		return typeof pct === "number" && pct > 0 && pct < 100 ? pct : undefined;
	}

	setCompactionThresholdPercent(percent: number | undefined): void {
		if (!this.globalSettings.compaction) {
			this.globalSettings.compaction = {};
		}
		if (percent === undefined || Number.isNaN(percent)) {
			this.globalSettings.compaction.thresholdPercent = undefined;
		} else {
			this.globalSettings.compaction.thresholdPercent = Math.max(1, Math.min(99, Math.round(percent)));
		}
		this.markModified("compaction", "thresholdPercent");
		this.save();
	}

	getCompactionSettings(): {
		enabled: boolean;
		profile: "nuclear" | "aggressive" | "balanced" | "off";
		reserveTokens: number;
		keepRecentTokens: number;
		thresholdPercent?: number;
	} {
		return {
			enabled: this.getCompactionEnabled(),
			profile: this.getCompactionProfile(),
			reserveTokens: this.getCompactionReserveTokens(),
			keepRecentTokens: this.getCompactionKeepRecentTokens(),
			thresholdPercent: this.getCompactionThresholdPercent(),
		};
	}

	getBranchSummarySettings(): { reserveTokens: number; skipPrompt: boolean } {
		return {
			reserveTokens: this.settings.branchSummary?.reserveTokens ?? 16384,
			skipPrompt: this.settings.branchSummary?.skipPrompt ?? false,
		};
	}

	getBranchSummarySkipPrompt(): boolean {
		return this.settings.branchSummary?.skipPrompt ?? false;
	}

	// ── Fusion Mode ──
	getFusionMode(): {
		enabled: boolean;
		thinkModel?: { provider: string; id: string };
		codeModel?: { provider: string; id: string };
	} {
		return this.settings.fusionMode ?? { enabled: false };
	}

	setFusionModeEnabled(enabled: boolean): void {
		if (!this.globalSettings.fusionMode) {
			this.globalSettings.fusionMode = { enabled };
		} else {
			this.globalSettings.fusionMode.enabled = enabled;
		}
		this.markModified("fusionMode", "enabled");
		this.save();
	}

	setFusionThinkModel(provider: string, id: string): void {
		if (!this.globalSettings.fusionMode) {
			this.globalSettings.fusionMode = { enabled: true, thinkModel: { provider, id } };
		} else {
			this.globalSettings.fusionMode.thinkModel = { provider, id };
		}
		this.markModified("fusionMode", "thinkModel");
		this.save();
	}

	setFusionCodeModel(provider: string, id: string): void {
		if (!this.globalSettings.fusionMode) {
			this.globalSettings.fusionMode = { enabled: true, codeModel: { provider, id } };
		} else {
			this.globalSettings.fusionMode.codeModel = { provider, id };
		}
		this.markModified("fusionMode", "codeModel");
		this.save();
	}

	isFusionModeEnabled(): boolean {
		return this.settings.fusionMode?.enabled ?? false;
	}

	// ── Fable Mode ──
	getFableMode(): { enabled: boolean; tier?: "opus" | "sonnet" | "haiku" } {
		return this.settings.fableMode ?? { enabled: false, tier: "sonnet" };
	}

	setFableModeEnabled(enabled: boolean): void {
		if (!this.globalSettings.fableMode) {
			this.globalSettings.fableMode = { enabled, tier: "sonnet" };
		} else {
			this.globalSettings.fableMode.enabled = enabled;
		}
		this.markModified("fableMode", "enabled");
		this.save();
	}

	setFableTier(tier: "opus" | "sonnet" | "haiku"): void {
		if (!this.globalSettings.fableMode) {
			this.globalSettings.fableMode = { enabled: true, tier };
		} else {
			this.globalSettings.fableMode.tier = tier;
		}
		this.markModified("fableMode", "tier");
		this.save();
	}

	isFableModeEnabled(): boolean {
		return this.settings.fableMode?.enabled ?? false;
	}

	getRetryEnabled(): boolean {
		return this.settings.retry?.enabled ?? true;
	}

	setRetryEnabled(enabled: boolean): void {
		if (!this.globalSettings.retry) {
			this.globalSettings.retry = {};
		}
		this.globalSettings.retry.enabled = enabled;
		this.markModified("retry", "enabled");
		this.save();
	}

	getRetrySettings(): { enabled: boolean; maxRetries: number; baseDelayMs: number } {
		return {
			enabled: this.getRetryEnabled(),
			maxRetries: this.settings.retry?.maxRetries ?? 3,
			baseDelayMs: this.settings.retry?.baseDelayMs ?? 2000,
		};
	}

	getProviderRetrySettings(): { timeoutMs?: number; maxRetries?: number; maxRetryDelayMs: number } {
		return {
			timeoutMs: this.settings.retry?.provider?.timeoutMs,
			maxRetries: this.settings.retry?.provider?.maxRetries,
			maxRetryDelayMs: this.settings.retry?.provider?.maxRetryDelayMs ?? 60000,
		};
	}

	getHideThinkingBlock(): boolean {
		return this.settings.hideThinkingBlock ?? true;
	}

	setHideThinkingBlock(hide: boolean): void {
		this.globalSettings.hideThinkingBlock = hide;
		this.markModified("hideThinkingBlock");
		this.save();
	}

	getShellPath(): string | undefined {
		return this.settings.shellPath;
	}

	setShellPath(path: string | undefined): void {
		this.globalSettings.shellPath = path;
		this.markModified("shellPath");
		this.save();
	}

	getQuietStartup(): boolean {
		return this.settings.quietStartup ?? true;
	}

	setQuietStartup(quiet: boolean): void {
		this.globalSettings.quietStartup = quiet;
		this.markModified("quietStartup");
		this.save();
	}

	getShellCommandPrefix(): string | undefined {
		return this.settings.shellCommandPrefix;
	}

	setShellCommandPrefix(prefix: string | undefined): void {
		this.globalSettings.shellCommandPrefix = prefix;
		this.markModified("shellCommandPrefix");
		this.save();
	}

	getNpmCommand(): string[] | undefined {
		return this.settings.npmCommand ? [...this.settings.npmCommand] : undefined;
	}

	setNpmCommand(command: string[] | undefined): void {
		this.globalSettings.npmCommand = command ? [...command] : undefined;
		this.markModified("npmCommand");
		this.save();
	}

	getCollapseChangelog(): boolean {
		return this.settings.collapseChangelog ?? true;
	}

	setCollapseChangelog(collapse: boolean): void {
		this.globalSettings.collapseChangelog = collapse;
		this.markModified("collapseChangelog");
		this.save();
	}

	getEnableInstallTelemetry(): boolean {
		return this.settings.enableInstallTelemetry ?? true;
	}

	getMcpServers(): Record<string, McpServerConfig> {
		return this.globalSettings.mcpServers || {};
	}

	setMcpServer(name: string, config: McpServerConfig): void {
		this.globalSettings.mcpServers = {
			...(this.globalSettings.mcpServers ?? {}),
			[name]: structuredClone(config),
		};
		this.markModified("mcpServers");
		this.save();
	}

	removeMcpServer(name: string): void {
		if (!this.globalSettings.mcpServers?.[name]) {
			return;
		}
		const nextServers = { ...this.globalSettings.mcpServers };
		delete nextServers[name];
		this.globalSettings.mcpServers = Object.keys(nextServers).length > 0 ? nextServers : undefined;
		this.markModified("mcpServers");
		this.save();
	}

	setEnableInstallTelemetry(enabled: boolean): void {
		this.globalSettings.enableInstallTelemetry = enabled;
		this.markModified("enableInstallTelemetry");
		this.save();
	}

	getPackages(): PackageSource[] {
		return [...(this.settings.packages ?? [])];
	}

	setPackages(packages: PackageSource[]): void {
		this.globalSettings.packages = packages;
		this.markModified("packages");
		this.save();
	}

	setProjectPackages(packages: PackageSource[]): void {
		const projectSettings = structuredClone(this.projectSettings);
		projectSettings.packages = packages;
		this.markProjectModified("packages");
		this.saveProjectSettings(projectSettings);
	}

	getExtensionPaths(): string[] {
		return [...(this.settings.extensions ?? [])];
	}

	setExtensionPaths(paths: string[]): void {
		this.globalSettings.extensions = paths;
		this.markModified("extensions");
		this.save();
	}

	setProjectExtensionPaths(paths: string[]): void {
		const projectSettings = structuredClone(this.projectSettings);
		projectSettings.extensions = paths;
		this.markProjectModified("extensions");
		this.saveProjectSettings(projectSettings);
	}

	getSkillPaths(): string[] {
		return [...(this.settings.skills ?? [])];
	}

	setSkillPaths(paths: string[]): void {
		this.globalSettings.skills = paths;
		this.markModified("skills");
		this.save();
	}

	setProjectSkillPaths(paths: string[]): void {
		const projectSettings = structuredClone(this.projectSettings);
		projectSettings.skills = paths;
		this.markProjectModified("skills");
		this.saveProjectSettings(projectSettings);
	}

	getPromptTemplatePaths(): string[] {
		return [...(this.settings.prompts ?? [])];
	}

	setPromptTemplatePaths(paths: string[]): void {
		this.globalSettings.prompts = paths;
		this.markModified("prompts");
		this.save();
	}

	setProjectPromptTemplatePaths(paths: string[]): void {
		const projectSettings = structuredClone(this.projectSettings);
		projectSettings.prompts = paths;
		this.markProjectModified("prompts");
		this.saveProjectSettings(projectSettings);
	}

	getThemePaths(): string[] {
		return [...(this.settings.themes ?? [])];
	}

	setThemePaths(paths: string[]): void {
		this.globalSettings.themes = paths;
		this.markModified("themes");
		this.save();
	}

	setProjectThemePaths(paths: string[]): void {
		const projectSettings = structuredClone(this.projectSettings);
		projectSettings.themes = paths;
		this.markProjectModified("themes");
		this.saveProjectSettings(projectSettings);
	}

	getEnableSkillCommands(): boolean {
		return this.settings.enableSkillCommands ?? true;
	}

	setEnableSkillCommands(enabled: boolean): void {
		this.globalSettings.enableSkillCommands = enabled;
		this.markModified("enableSkillCommands");
		this.save();
	}

	getThinkingBudgets(): ThinkingBudgetsSettings | undefined {
		return this.settings.thinkingBudgets;
	}

	getShowImages(): boolean {
		return this.settings.terminal?.showImages ?? true;
	}

	setShowImages(show: boolean): void {
		if (!this.globalSettings.terminal) {
			this.globalSettings.terminal = {};
		}
		this.globalSettings.terminal.showImages = show;
		this.markModified("terminal", "showImages");
		this.save();
	}

	getImageWidthCells(): number {
		const width = this.settings.terminal?.imageWidthCells;
		if (typeof width !== "number" || !Number.isFinite(width)) {
			return 60;
		}
		return Math.max(1, Math.floor(width));
	}

	setImageWidthCells(width: number): void {
		if (!this.globalSettings.terminal) {
			this.globalSettings.terminal = {};
		}
		this.globalSettings.terminal.imageWidthCells = Math.max(1, Math.floor(width));
		this.markModified("terminal", "imageWidthCells");
		this.save();
	}

	getClearOnShrink(): boolean {
		// Settings takes precedence, then env var, then default false
		if (this.settings.terminal?.clearOnShrink !== undefined) {
			return this.settings.terminal.clearOnShrink;
		}
		return process.env.PI_CLEAR_ON_SHRINK === "1";
	}

	setClearOnShrink(enabled: boolean): void {
		if (!this.globalSettings.terminal) {
			this.globalSettings.terminal = {};
		}
		this.globalSettings.terminal.clearOnShrink = enabled;
		this.markModified("terminal", "clearOnShrink");
		this.save();
	}

	getShowTerminalProgress(): boolean {
		return this.settings.terminal?.showTerminalProgress ?? false;
	}

	setShowTerminalProgress(enabled: boolean): void {
		if (!this.globalSettings.terminal) {
			this.globalSettings.terminal = {};
		}
		this.globalSettings.terminal.showTerminalProgress = enabled;
		this.markModified("terminal", "showTerminalProgress");
		this.save();
	}

	getLogoMode(): "hero" | "compact" | "minimal" | "off" | "auto" {
		return this.settings.terminal?.logoMode ?? "auto";
	}

	setLogoMode(mode: "hero" | "compact" | "minimal" | "off" | "auto"): void {
		if (!this.globalSettings.terminal) {
			this.globalSettings.terminal = {};
		}
		this.globalSettings.terminal.logoMode = mode;
		this.markModified("terminal", "logoMode");
		this.save();
	}

	getImageAutoResize(): boolean {
		return this.settings.images?.autoResize ?? true;
	}

	setImageAutoResize(enabled: boolean): void {
		if (!this.globalSettings.images) {
			this.globalSettings.images = {};
		}
		this.globalSettings.images.autoResize = enabled;
		this.markModified("images", "autoResize");
		this.save();
	}

	getBlockImages(): boolean {
		return this.settings.images?.blockImages ?? false;
	}

	setBlockImages(blocked: boolean): void {
		if (!this.globalSettings.images) {
			this.globalSettings.images = {};
		}
		this.globalSettings.images.blockImages = blocked;
		this.markModified("images", "blockImages");
		this.save();
	}

	getEnabledModels(): string[] | undefined {
		return this.settings.enabledModels;
	}

	setEnabledModels(patterns: string[] | undefined): void {
		this.globalSettings.enabledModels = patterns;
		this.markModified("enabledModels");
		this.save();
	}

	getDoubleEscapeAction(): "fork" | "tree" | "none" {
		return this.settings.doubleEscapeAction ?? "tree";
	}

	setDoubleEscapeAction(action: "fork" | "tree" | "none"): void {
		this.globalSettings.doubleEscapeAction = action;
		this.markModified("doubleEscapeAction");
		this.save();
	}

	getTreeFilterMode(): "default" | "no-tools" | "user-only" | "labeled-only" | "all" {
		const mode = this.settings.treeFilterMode;
		const valid = ["default", "no-tools", "user-only", "labeled-only", "all"];
		return mode && valid.includes(mode) ? mode : "default";
	}

	setTreeFilterMode(mode: "default" | "no-tools" | "user-only" | "labeled-only" | "all"): void {
		this.globalSettings.treeFilterMode = mode;
		this.markModified("treeFilterMode");
		this.save();
	}

	getShowHardwareCursor(): boolean {
		return this.settings.showHardwareCursor ?? process.env.PI_HARDWARE_CURSOR === "1";
	}

	setShowHardwareCursor(enabled: boolean): void {
		this.globalSettings.showHardwareCursor = enabled;
		this.markModified("showHardwareCursor");
		this.save();
	}

	getEditorPaddingX(): number {
		return this.settings.editorPaddingX ?? 0;
	}

	setEditorPaddingX(padding: number): void {
		this.globalSettings.editorPaddingX = Math.max(0, Math.min(3, Math.floor(padding)));
		this.markModified("editorPaddingX");
		this.save();
	}

	getAutocompleteMaxVisible(): number {
		return this.settings.autocompleteMaxVisible ?? 12;
	}

	setAutocompleteMaxVisible(maxVisible: number): void {
		this.globalSettings.autocompleteMaxVisible = Math.max(3, Math.min(30, Math.floor(maxVisible)));
		this.markModified("autocompleteMaxVisible");
		this.save();
	}

	getCodeBlockIndent(): string {
		return this.settings.markdown?.codeBlockIndent ?? "  ";
	}

	getWarnings(): WarningSettings {
		return { ...(this.settings.warnings ?? {}) };
	}

	setWarnings(warnings: WarningSettings): void {
		this.globalSettings.warnings = { ...warnings };
		this.markModified("warnings");
		this.save();
	}

	// =========================================================================
	// Output Padding
	// =========================================================================

	getOutputPad(): 0 | 1 {
		return this.settings.outputPad ?? 0;
	}

	setOutputPad(padding: 0 | 1): void {
		this.globalSettings.outputPad = padding;
		this.markModified("outputPad");
		this.save();
	}

	// =========================================================================
	// Cache Miss Notices
	// =========================================================================

	getShowCacheMissNotices(): boolean {
		return this.settings.showCacheMissNotices ?? false;
	}

	setShowCacheMissNotices(show: boolean): void {
		this.globalSettings.showCacheMissNotices = show;
		this.markModified("showCacheMissNotices");
		this.save();
	}

	// =========================================================================
	// Default Project Trust
	// =========================================================================

	getDefaultProjectTrust(): DefaultProjectTrust {
		return this.settings.defaultProjectTrust ?? "ask";
	}

	setDefaultProjectTrust(defaultProjectTrust: DefaultProjectTrust): void {
		this.globalSettings.defaultProjectTrust = defaultProjectTrust;
		this.markModified("defaultProjectTrust");
		this.save();
	}

	// =========================================================================
	// HTTP Idle Timeout
	// =========================================================================

	getHttpIdleTimeoutMs(): number {
		return this.settings.httpIdleTimeoutMs ?? 300000;
	}

	setHttpIdleTimeoutMs(timeoutMs: number): void {
		this.globalSettings.httpIdleTimeoutMs = timeoutMs;
		this.markModified("httpIdleTimeoutMs");
		this.save();
	}

	// =========================================================================
	// External Editor Command
	// =========================================================================

	getExternalEditorCommand(): string | undefined {
		return this.settings.externalEditorCommand;
	}

	// =========================================================================
	// Project Trust
	// =========================================================================

	isProjectTrusted(): boolean {
		return this.settings.projectTrusted ?? false;
	}

	setProjectTrusted(trusted: boolean): void {
		this.globalSettings.projectTrusted = trusted;
		this.markModified("projectTrusted");
		this.save();
	}

	// =========================================================================
	// Theme Setting (alias for getTheme)
	// =========================================================================

	getThemeSetting(): string | undefined {
		return this.settings.theme;
	}

	// =========================================================================
	// Affective State Settings
	// =========================================================================

	getAffectiveSettings(): NormalizedAffectiveSettings {
		return normalizeAffectiveSettings(this.settings.affect);
	}

	setAffectiveEnabled(enabled: boolean): void {
		if (!this.globalSettings.affect) this.globalSettings.affect = {};
		this.globalSettings.affect.enabled = enabled;
		if (!this.globalSettings.affect.state) {
			this.globalSettings.affect.state = this.getAffectiveSettings().state;
		}
		this.markModified("affect", "enabled");
		this.markModified("affect", "state");
		this.save();
	}

	setAffectiveMode(mode: AffectiveMode): void {
		if (!this.globalSettings.affect) this.globalSettings.affect = {};
		this.globalSettings.affect.mode = mode;
		this.markModified("affect", "mode");
		this.save();
	}

	setAffectiveState(state: AffectiveState): void {
		if (!this.globalSettings.affect) this.globalSettings.affect = {};
		this.globalSettings.affect.state = { ...state };
		this.markModified("affect", "state");
		this.save();
	}

	resetAffectiveState(): void {
		if (!this.globalSettings.affect) this.globalSettings.affect = {};
		this.globalSettings.affect.state = createInitialAffectiveState();
		this.markModified("affect", "state");
		this.save();
	}

	// =========================================================================
	// Agent Settings
	// =========================================================================

	getAgentsSettings(): CodingAgentSettings {
		const configured = this.settings.agents ?? {};
		const mode = configured.mode ?? (configured.enabled ? "auto" : "off");
		return {
			...configured,
			enabled: configured.enabled ?? false,
			mode,
			verbosity: configured.verbosity ?? "quiet",
		};
	}

	getAgentsEnabled(): boolean {
		const settings = this.getAgentsSettings();
		return settings.enabled !== false && settings.mode !== "off";
	}

	setAgentsEnabled(enabled: boolean): void {
		if (!this.globalSettings.agents) this.globalSettings.agents = {};
		this.globalSettings.agents.enabled = enabled;
		this.globalSettings.agents.mode = enabled
			? this.globalSettings.agents.mode === "off"
				? "auto"
				: (this.globalSettings.agents.mode ?? "auto")
			: "off";
		this.markModified("agents", "enabled");
		this.markModified("agents", "mode");
		this.save();
	}

	setAgentsMode(mode: CodingAgentMode): void {
		if (!this.globalSettings.agents) this.globalSettings.agents = {};
		this.globalSettings.agents.mode = mode;
		this.globalSettings.agents.enabled = mode !== "off";
		this.markModified("agents", "mode");
		this.markModified("agents", "enabled");
		this.save();
	}

	setAgentsVerbosity(verbosity: CodingAgentVerbosity): void {
		if (!this.globalSettings.agents) this.globalSettings.agents = {};
		this.globalSettings.agents.verbosity = verbosity;
		this.markModified("agents", "verbosity");
		this.save();
	}

	// =========================================================================
	// Robotics Settings
	// =========================================================================

	getRoboticsEnabled(): boolean {
		return this.settings.robotics?.enabled ?? false;
	}

	setRoboticsEnabled(enabled: boolean): void {
		if (!this.globalSettings.robotics) this.globalSettings.robotics = {};
		this.globalSettings.robotics.enabled = enabled;
		this.markModified("robotics", "enabled");
		this.save();
	}

	getRoboticsSettings(): RoboticsSettings {
		return { ...(this.settings.robotics ?? {}) };
	}

	setRoboticsSetting<K extends keyof RoboticsSettings>(key: K, value: RoboticsSettings[K]): void {
		if (!this.globalSettings.robotics) this.globalSettings.robotics = {};
		this.globalSettings.robotics[key] = value;
		this.markModified("robotics", key as string);
		this.save();
	}

	getRoboticsVisionModel(): string {
		return this.settings.robotics?.visionModel ?? "qwen2.5-vl:7b";
	}

	getRoboticsVisionBaseUrl(): string {
		return this.settings.robotics?.visionBaseUrl ?? "http://localhost:11434";
	}

	getRoboticsOutputOverlay(): boolean {
		return this.settings.robotics?.outputOverlay ?? true;
	}

	getRoboticsLastImagePath(): string | undefined {
		return this.settings.robotics?.lastImagePath;
	}

	setRoboticsLastImagePath(path: string): void {
		if (!this.globalSettings.robotics) this.globalSettings.robotics = {};
		this.globalSettings.robotics.lastImagePath = path;
		this.markModified("robotics", "lastImagePath");
		this.save();
	}

	getDiscordToken(): string | undefined {
		return this.settings.discordToken;
	}

	setDiscordToken(token: string | undefined): void {
		this.globalSettings.discordToken = token;
		this.markModified("discordToken");
		this.save();
	}
}
