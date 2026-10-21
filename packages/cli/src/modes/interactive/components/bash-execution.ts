// @ts-nocheck
import { Container, Loader, Text, type TUI } from "astro-tui";
import stripAnsi from "strip-ansi";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	type TruncationResult,
	truncateTail,
} from "../../../core/tools/truncate.js";
import { theme } from "../theme/theme.js";
import { keyHint, keyText } from "./keybinding-hints.js";
import { truncateToVisualLines } from "./visual-truncate.js";

const PREVIEW_LINES = 20;

export class BashExecutionComponent extends Container {
	private command: string;
	private outputLines: string[] = [];
	private status: "running" | "complete" | "cancelled" | "error" = "running";
	private exitCode: number | undefined = undefined;
	private loader: Loader;
	private truncationResult?: TruncationResult;
	private fullOutputPath?: string;
	private expanded = false;
	private contentContainer: Container;

	constructor(command: string, ui: TUI, excludeFromContext = false) {
		super();
		this.command = command;

		const colorKey = excludeFromContext ? "dim" : "bashMode";

		this.contentContainer = new Container();
		this.addChild(this.contentContainer);

		const header = new Text(theme.fg(colorKey, theme.bold(`$ ${command}`)), 0, 0);
		this.contentContainer.addChild(header);

		this.loader = new Loader(
			ui,
			(spinner) => theme.fg(colorKey, spinner),
			(text) => theme.fg("muted", text),
			`Running... (cancel: ${keyText("tui.select.cancel")})`,
		);
		this.contentContainer.addChild(this.loader);
	}

	private cachedWidth?: number;
	private cachedLines?: string[];

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
		this.updateDisplay();
	}

	override invalidate(): void {
		super.invalidate();
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
		this.updateDisplay();
	}

	override render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}
		const lines = super.render(Math.max(1, width - 3));
		const result: string[] = [];
		const borderColor =
			this.status === "running"
				? "accent"
				: this.status === "error"
					? "error"
					: this.status === "cancelled"
						? "warning"
						: "success";

		for (let i = 0; i < lines.length; i++) {
			if (i === 0) {
				result.push(theme.fg(borderColor as any, " ┊ ") + lines[i]);
			} else {
				const clean = lines[i].replace(/\x1b\[[0-9;]*m/g, "").trim();
				if (!clean) {
					result.push(theme.fg("dim", " ┊"));
				} else {
					result.push(theme.fg("dim", " ┊ ") + lines[i]);
				}
			}
		}

		this.cachedWidth = width;
		this.cachedLines = result;
		return result;
	}

	appendOutput(chunk: string): void {
		const clean = stripAnsi(chunk).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
		const newLines = clean.split("\n");
		if (this.outputLines.length > 0 && newLines.length > 0) {
			this.outputLines[this.outputLines.length - 1] += newLines[0];
			this.outputLines.push(...newLines.slice(1));
		} else {
			this.outputLines.push(...newLines);
		}
		this.updateDisplay();
	}

	setComplete(
		exitCode: number | undefined,
		cancelled: boolean,
		truncationResult?: TruncationResult,
		fullOutputPath?: string,
	): void {
		this.exitCode = exitCode;
		this.status = cancelled
			? "cancelled"
			: exitCode !== 0 && exitCode !== undefined && exitCode !== null
				? "error"
				: "complete";
		this.truncationResult = truncationResult;
		this.fullOutputPath = fullOutputPath;
		this.loader.stop();
		this.updateDisplay();
	}

	private updateDisplay(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
		const fullOutput = this.outputLines.join("\n");
		const contextTruncation = truncateTail(fullOutput, {
			maxLines: DEFAULT_MAX_LINES,
			maxBytes: DEFAULT_MAX_BYTES,
		});

		const availableLines = contextTruncation.content ? contextTruncation.content.split("\n") : [];
		const previewLogicalLines = availableLines.slice(-PREVIEW_LINES);
		const hiddenLineCount = availableLines.length - previewLogicalLines.length;

		this.contentContainer.clear();

		const header = new Text(theme.fg("bashMode", theme.bold(`$ ${this.command}`)), 1, 0);
		this.contentContainer.addChild(header);

		if (availableLines.length > 0) {
			if (this.expanded) {
				const displayText = availableLines.map((line) => theme.fg("muted", line)).join("\n");
				this.contentContainer.addChild(new Text(`\n${displayText}`, 1, 0));
			} else {
				const styledOutput = previewLogicalLines.map((line) => theme.fg("muted", line)).join("\n");
				const styledInput = `\n${styledOutput}`;
				let cachedWidth: number | undefined;
				let cachedLines: string[] | undefined;
				this.contentContainer.addChild({
					render: (width: number) => {
						if (cachedLines === undefined || cachedWidth !== width) {
							const result = truncateToVisualLines(styledInput, PREVIEW_LINES, width, 1);
							cachedLines = result.visualLines;
							cachedWidth = width;
						}
						return cachedLines ?? [];
					},
					invalidate: () => {
						cachedWidth = undefined;
						cachedLines = undefined;
					},
				});
			}
		}

		if (this.status === "running") {
			this.contentContainer.addChild(this.loader);
		} else {
			const statusParts: string[] = [];
			if (hiddenLineCount > 0) {
				if (this.expanded) {
					statusParts.push(`(${keyHint("app.tools.expand", "collapse")})`);
				} else {
					statusParts.push(
						`${theme.fg("muted", `... ${hiddenLineCount} more lines`)} (${keyHint("app.tools.expand", "expand")})`,
					);
				}
			}
			if (this.status === "cancelled") {
				statusParts.push(theme.fg("warning", "(cancelled)"));
			} else if (this.status === "error") {
				statusParts.push(theme.fg("error", `(exit ${this.exitCode})`));
			}
			const wasTruncated = this.truncationResult?.truncated || contextTruncation.truncated;
			if (wasTruncated && this.fullOutputPath) {
				statusParts.push(theme.fg("warning", `Output truncated. Full: ${this.fullOutputPath}`));
			}
			if (statusParts.length > 0) {
				this.contentContainer.addChild(new Text(`\n${statusParts.join("\n")}`, 1, 0));
			}
		}
	}

	getOutput(): string {
		return this.outputLines.join("\n");
	}

	getCommand(): string {
		return this.command;
	}
}
