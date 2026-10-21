import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { EngineTool } from "astro-engine";
import { Text } from "astro-tui";
import { type Static, Type } from "typebox";
import type { Theme } from "../../modes/interactive/theme/theme.js";
import type { ToolDefinition, ToolRenderResultOptions } from "../extensions/types.js";
import { executePuppeteerAction, executePuppeteerTabs } from "./puppeteer-service.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const browserTabsSchema = Type.Object({
	action: Type.Union([
		Type.Literal("list"),
		Type.Literal("active"),
		Type.Literal("open"),
		Type.Literal("close"),
		Type.Literal("focus"),
		Type.Literal("reload"),
		Type.Literal("navigate"),
	]),
	tabId: Type.Optional(Type.Number({ description: "Chrome tab id for tab-specific actions" })),
	url: Type.Optional(Type.String({ description: "URL for open/navigate actions" })),
	active: Type.Optional(Type.Boolean({ description: "Whether a new tab should be active" })),
});

const browserPageSchema = Type.Object({
	action: Type.Union([
		Type.Literal("read"),
		Type.Literal("read_dom"),
		Type.Literal("click"),
		Type.Literal("type"),
		Type.Literal("hover"),
		Type.Literal("drag"),
		Type.Literal("mouse"),
		Type.Literal("canvas_info"),
		Type.Literal("canvas_draw"),
		Type.Literal("upload_file"),
		Type.Literal("press_key"),
		Type.Literal("get_elements"),
		Type.Literal("evaluate"),
		Type.Literal("scroll"),
		Type.Literal("console_logs"),
		Type.Literal("wait"),
		Type.Literal("clear_ui"),
		Type.Literal("block_code"),
		Type.Literal("canvas_design"),
	]),
	tabId: Type.Optional(Type.Number({ description: "Chrome tab id. Defaults to active tab." })),
	selector: Type.Optional(
		Type.String({ description: "CSS selector for click/type/hover/upload_file/drag source actions" }),
	),
	targetSelector: Type.Optional(Type.String({ description: "CSS selector for drag target" })),
	x: Type.Optional(Type.Number({ description: "Viewport X coordinate for mouse actions" })),
	y: Type.Optional(Type.Number({ description: "Viewport Y coordinate for mouse actions" })),
	toX: Type.Optional(Type.Number({ description: "Target viewport X coordinate for mouse drag/move" })),
	toY: Type.Optional(Type.Number({ description: "Target viewport Y coordinate for mouse drag/move" })),
	button: Type.Optional(Type.String({ description: "Mouse button: left, right, middle, or none" })),
	clickCount: Type.Optional(Type.Number({ description: "Mouse click count" })),
	steps: Type.Optional(Type.Number({ description: "Mouse movement interpolation steps" })),
	points: Type.Optional(
		Type.Array(Type.Array(Type.Number()), {
			description: "Canvas draw points as [x,y] pairs, relative to canvas unless absolute=true",
		}),
	),
	color: Type.Optional(
		Type.String({ description: "Canvas draw color when page supports injected 2D drawing fallback" }),
	),
	width: Type.Optional(Type.Number({ description: "Canvas draw stroke width" })),
	absolute: Type.Optional(Type.Boolean({ description: "Treat canvas_draw points as viewport coordinates" })),
	text: Type.Optional(Type.String({ description: "Text to type" })),
	filePath: Type.Optional(Type.String({ description: "Local file path for upload_file" })),
	filePaths: Type.Optional(Type.Array(Type.String(), { description: "Local file paths for upload_file" })),
	visual: Type.Optional(Type.Boolean({ description: "Show temporary visual overlay/cursor for actions" })),
	showLabels: Type.Optional(
		Type.Boolean({ description: "Show visual labels for get_elements (default false; IDs still work)" }),
	),
	maxElements: Type.Optional(Type.Number({ description: "Maximum elements returned by get_elements" })),
	append: Type.Optional(Type.Boolean({ description: "Append to existing value instead of replacing (type action)" })),
	key: Type.Optional(Type.String({ description: "Key name for press_key action (e.g. Enter, Tab, Escape)" })),
	modifiers: Type.Optional(Type.Array(Type.String(), { description: "Modifier keys: ctrl, shift, alt, meta" })),
	script: Type.Optional(Type.String({ description: "JavaScript expression for evaluate action" })),
	maxChars: Type.Optional(Type.Number({ description: "Maximum characters for read action" })),
	target: Type.Optional(Type.String({ description: "Target for block_code: scratch | turbowarp | overlay" })),
	mode: Type.Optional(Type.String({ description: "Mode for canvas_design: open | clear" })),
	direction: Type.Optional(
		Type.Union(
			[
				Type.Literal("up"),
				Type.Literal("down"),
				Type.Literal("left"),
				Type.Literal("right"),
				Type.Literal("top"),
				Type.Literal("bottom"),
			],
			{ description: "Direction for scroll action" },
		),
	),
	amount: Type.Optional(Type.Number({ description: "Pixels to scroll" })),
	ms: Type.Optional(Type.Number({ description: "Milliseconds to wait (max 15000)" })),
	format: Type.Optional(Type.Union([Type.Literal("png"), Type.Literal("jpeg")], { description: "Screenshot format" })),
	quality: Type.Optional(Type.Number({ description: "JPEG screenshot quality, 1-100" })),
});

export type BrowserTabsToolInput = Static<typeof browserTabsSchema>;
export type BrowserPageToolInput = Static<typeof browserPageSchema>;

export interface BrowserToolDetails {
	action: string;
	connected: boolean;
	hasScreenshot?: boolean;
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

const ACTION_ICON: Record<string, string> = {
	read: "👁",
	read_dom: "🌲",
	click: "🖱",
	type: "⌨",
	hover: "↗",
	drag: "↔",
	mouse: "🖱",
	canvas_info: "🖼",
	canvas_draw: "✏",
	upload_file: "📤",
	press_key: "⌨",
	get_elements: "🔍",
	evaluate: "⚡",
	scroll: "⤵",
	console_logs: "📋",
	screenshot: "📸",
	wait: "⏳",
	clear_ui: "🧹",
	list: "📋",
	active: "✅",
	open: "🔗",
	close: "✕",
	focus: "🎯",
	reload: "🔄",
	navigate: "🧭",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getIcon(action: string | undefined): string {
	return ACTION_ICON[action ?? ""] ?? "⬡";
}

function renderCall(toolName: string, action: string | undefined, theme: Theme): string {
	const icon = getIcon(action);
	return `${icon}  ${theme.bold(theme.fg("toolTitle", toolName))} ${theme.fg("accent", action ?? "<missing>")}`;
}

function truncateJson(value: unknown, maxChars = 6000): string {
	const raw =
		JSON.stringify(
			value,
			(_k, v) => {
				if (typeof v === "string") {
					if (v.startsWith("data:image/")) return `[image data: ${v.length} chars]`;
					if (v.length > 3000) return `${v.slice(0, 3000)}\n… [${v.length - 3000} chars truncated]`;
				}
				return v;
			},
			2,
		) ?? "null";
	return raw.length > maxChars ? `${raw.slice(0, maxChars)}\n… [${raw.length - maxChars} chars truncated]` : raw;
}

/**
 * Parse browser command result.
 * If it contains a screenshot, returns both text (with omitted data note) and image block.
 */
function parseCommandResult(
	value: unknown,
): Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> {
	const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
	const ss = rec?.screenshot as Record<string, unknown> | undefined;

	if (ss && typeof ss.data === "string" && typeof ss.mimeType === "string") {
		const sanitized = {
			...rec,
			screenshot: { ...ss, data: `[screenshot: ${ss.data.length} chars of base64]` },
		};
		return [
			{ type: "text", text: truncateJson(sanitized) },
			{ type: "image", data: ss.data, mimeType: ss.mimeType },
		];
	}

	return [{ type: "text", text: truncateJson(value) }];
}

function renderResult(
	result: { content: Array<{ type: string; text?: string }>; details?: BrowserToolDetails },
	_options: ToolRenderResultOptions,
	theme: Theme,
): string {
	const text = result.content.find((p) => p.type === "text")?.text ?? "";
	const hasImg = result.details?.hasScreenshot;
	const imgNote = hasImg ? theme.fg("accent", "\n📸 Screenshot captured → sent to model") : "";
	return text
		? `\n${theme.fg("toolOutput", text.slice(0, 1200))}${text.length > 1200 ? theme.fg("dim", `\n… ${text.length - 1200} chars hidden`) : ""}${imgNote}`
		: theme.fg("muted", "\nNo browser output.") + imgNote;
}

// ─── Validation ────────────────────────────────────────────────────────────────

function validateTabs(p: BrowserTabsToolInput): void {
	if ((p.action === "open" || p.action === "navigate") && !p.url)
		throw new Error(`browser_tabs ${p.action} requires url`);
	if (["close", "focus"].includes(p.action) && p.tabId === undefined)
		throw new Error(`browser_tabs ${p.action} requires tabId`);
}

function validatePage(p: BrowserPageToolInput): void {
	if (["click", "type", "hover", "upload_file"].includes(p.action) && !p.selector)
		throw new Error(`browser_page ${p.action} requires selector`);
	if (p.action === "type" && p.text === undefined) throw new Error("browser_page type requires text");
	if (p.action === "press_key" && !p.key) throw new Error("browser_page press_key requires key");
	if (p.action === "evaluate" && !p.script) throw new Error("browser_page evaluate requires script");
	if (p.action === "drag" && (!p.selector || !p.targetSelector))
		throw new Error("browser_page drag requires selector and targetSelector");
	if (p.action === "mouse" && (p.x === undefined || p.y === undefined))
		throw new Error("browser_page mouse requires x and y");
	if (p.action === "canvas_draw" && (!p.points || p.points.length < 2))
		throw new Error("browser_page canvas_draw requires at least 2 points");
	if (p.action === "upload_file" && !p.filePath && (!p.filePaths || p.filePaths.length === 0))
		throw new Error("browser_page upload_file requires filePath or filePaths");
}

function normalizePageParams(p: BrowserPageToolInput): Record<string, unknown> {
	if (p.action !== "upload_file") return p as Record<string, unknown>;
	const rawPaths = p.filePaths?.length ? p.filePaths : p.filePath ? [p.filePath] : [];
	const filePaths = rawPaths.map((fp) => resolve(fp));
	const missing = filePaths.filter((fp) => !existsSync(fp));
	if (missing.length > 0) throw new Error(`browser_page upload_file: file not found: ${missing.join(", ")}`);
	return { ...(p as Record<string, unknown>), filePaths, filePath: filePaths[0] };
}

// ─── Tool definitions ──────────────────────────────────────────────────────────

export function createBrowserTabsToolDefinition(): ToolDefinition<typeof browserTabsSchema, BrowserToolDetails> {
	return {
		name: "browser_tabs",
		label: "browser_tabs",
		description:
			"Control Chrome tabs through the Astro-Agent Chrome extension. Actions: list, active, open, close, focus, reload, navigate.",
		promptSnippet: "Control connected Chrome tabs",
		promptGuidelines: [
			"Use browser_tabs to inspect or change Chrome tabs when the user asks for browser control.",
			"Use browser_page read before interacting with an unfamiliar page unless the user gave an exact target.",
		],
		parameters: browserTabsSchema,
		executionMode: "sequential",

		async execute(_id, params, signal) {
			if (signal?.aborted) throw new Error("Operation aborted");
			validateTabs(params);
			const result = await executePuppeteerTabs(params.action as string, params);
			return {
				content: [{ type: "text", text: truncateJson(result) }],
				details: { action: params.action, connected: true },
			};
		},

		renderCall(args, theme, context) {
			const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			text.setText(renderCall("browser_tabs", args?.action, theme));
			return text;
		},

		renderResult(result, options, theme, context) {
			const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			text.setText(renderResult(result, options, theme));
			return text;
		},
	};
}

export function createBrowserPageToolDefinition(
	_getModelVisionSupport?: () => boolean,
): ToolDefinition<typeof browserPageSchema, BrowserToolDetails> {
	return {
		name: "browser_page",
		label: "browser_page",
		description:
			"Read or operate the current Chrome page through the Astro-Agent Chrome extension. Actions: read, read_dom, click, type, hover, drag, mouse, canvas_info, canvas_draw, upload_file, press_key, get_elements, evaluate, scroll, console_logs, screenshot, wait, clear_ui.",
		promptSnippet: "Read or operate the connected Chrome page",
		promptGuidelines: [
			"Use browser_page read to get page title, URL, selection, and visible text.",
			"Use browser_page read_dom for a structured view of interactive page elements.",
			"Use browser_page get_elements to get numbered interactive elements.",
			"Use browser_page screenshot when visual state matters — it sends a real image to the model, not just text. Always use this before clicking unfamiliar UI.",
			"Use browser_page click with selector or x/y coordinates. Prefer selector when possible.",
			"Use browser_page mouse with x/y for canvas, games, drawing apps, and rich editors where DOM selectors don't work.",
			"Use browser_page drag with selector+targetSelector for DOM drag/drop; use mouse for pixel-level drag.",
			"Use browser_page canvas_info then canvas_draw for canvas design work.",
			"Use browser_page type to type into focused/selected input. Set append:true to add to existing value.",
			"Use browser_page press_key with key=Enter/Tab/Escape and optional modifiers=[ctrl,shift,alt,meta].",
			"Use browser_page scroll to navigate long pages. direction: up/down/left/right/top/bottom.",
			"Use browser_page upload_file with a local absolute filePath when a site needs a file picker/input.",
			"Use browser_page evaluate for short JavaScript expressions. Return serializable data.",
			"Use browser_page console_logs to debug JavaScript errors or see page logs.",
			"Use browser_page wait to pause between actions (ms, max 15000).",
			"Use browser_page clear_ui to dismiss any Astro-Agent visual overlays/labels on the page.",
			"Prefer small maxChars/maxElements to reduce token usage; only request more when needed.",
		],
		parameters: browserPageSchema,
		executionMode: "sequential",

		async execute(_id, params, signal) {
			if (signal?.aborted) throw new Error("Operation aborted");

			validatePage(params);
			const cmdParams = normalizePageParams(params);
			const result = await executePuppeteerAction(params.action as string, cmdParams);
			const content = parseCommandResult(result);
			const hasScreenshot = content.some((c) => c.type === "image");
			return {
				content,
				details: { action: params.action, connected: true, hasScreenshot },
			};
		},

		renderCall(args, theme, context) {
			const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			text.setText(renderCall("browser_page", args?.action, theme));
			return text;
		},

		renderResult(result, options, theme, context) {
			const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
			text.setText(renderResult(result, options, theme));
			return text;
		},
	};
}

export function createBrowserTabsTool(): EngineTool<typeof browserTabsSchema, BrowserToolDetails> {
	return wrapToolDefinition(createBrowserTabsToolDefinition());
}

export function createBrowserPageTool(
	getModelVisionSupport?: () => boolean,
): EngineTool<typeof browserPageSchema, BrowserToolDetails> {
	return wrapToolDefinition(createBrowserPageToolDefinition(getModelVisionSupport));
}
