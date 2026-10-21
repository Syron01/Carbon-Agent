// @ts-nocheck
import type { AssistantMessage } from "astro-core";
import { Container, Markdown, type MarkdownTheme, Spacer, Text } from "astro-tui";
import { getMarkdownTheme, theme } from "../theme/theme.js";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

class ThinkingBlock extends Container {
	public isThinking = true;
	constructor(text: string, markdownTheme: MarkdownTheme) {
		super();
		const md = new Markdown(text, 0, 0, markdownTheme, {
			color: (t: string) => theme.fg("thinkingText", t),
			italic: true,
		});
		this.addChild(md);
	}

	override render(width: number): string[] {
		if (width < 6) return super.render(width);
		const lines = super.render(width - 6);
		if (lines.length === 0) return [];
		const accent = theme.fg("dim", "┊");
		return [
			theme.fg("dim", " ┊") + theme.italic(theme.fg("thinkingText", " thinking")),
			...lines.map((line) => `${accent} ${line}`),
			accent,
		];
	}

	setText(text: string) {
		(this.children[0] as Markdown).setText(text);
	}
}

export class AssistantMessageComponent extends Container {
	private contentContainer: Container;
	private hideThinkingBlock: boolean;
	private markdownTheme: MarkdownTheme;
	private hiddenThinkingLabel: string;
	private lastMessage?: AssistantMessage;
	private hasToolCalls = false;

	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(
		message?: AssistantMessage,
		hideThinkingBlock = false,
		markdownTheme: MarkdownTheme = getMarkdownTheme(),
		hiddenThinkingLabel = "Thinking.",
		isFusionMode = false,
	) {
		super();

		this.hideThinkingBlock = hideThinkingBlock;
		this.markdownTheme = markdownTheme;
		this.hiddenThinkingLabel = hiddenThinkingLabel;
		(this as any).isFusionMode = isFusionMode;

		this.contentContainer = new Container();
		this.addChild(this.contentContainer);

		if (message) {
			this.updateContent(message);
		}
	}

	override invalidate(): void {
		super.invalidate();
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
		if (this.lastMessage) {
			this.updateContent(this.lastMessage);
		}
	}

	setHideThinkingBlock(hide: boolean): void {
		this.hideThinkingBlock = hide;
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
		if (this.lastMessage) {
			this.updateContent(this.lastMessage);
		}
	}

	setHiddenThinkingLabel(label: string): void {
		this.hiddenThinkingLabel = label;
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
		if (this.lastMessage) {
			this.updateContent(this.lastMessage);
		}
	}

	override render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		const lines = super.render(Math.max(1, width - 1));
		if (this.hasToolCalls || lines.length === 0) {
			this.cachedWidth = width;
			this.cachedLines = lines;
			return lines;
		}

		const accentBar = theme.fg("accent", "┃");
		const result = lines.map((line, _i) => {
			const isEmpty = line.replace(/\x1b\[[0-9;]*m/g, "").trim() === "";
			if (isEmpty) return `${accentBar}`;
			return `${accentBar}${line}`;
		});
		result[0] = OSC133_ZONE_START + result[0];
		result[result.length - 1] = OSC133_ZONE_END + OSC133_ZONE_FINAL + result[result.length - 1];
		this.cachedWidth = width;
		this.cachedLines = result;
		return result;
	}

	updateContent(message: AssistantMessage): void {
		this.lastMessage = message;
		this.cachedWidth = undefined;
		this.cachedLines = undefined;

		let childIndex = 0;

		for (let i = 0; i < message.content.length; i++) {
			const content = message.content[i];

			if (content.type === "text" && content.text.trim()) {
				let text = content.text.trim();
				text = text.replace(/§\[(.*?)\]§/g, "");
				text = text.replace(/∄asistan, ∃AGI\./g, "");

				let component = this.contentContainer.children[childIndex] as Markdown | undefined;

				if (!(component instanceof Markdown) || (component as any).isThinking) {
					component = new Markdown(text, 0, 0, this.markdownTheme);
					this.contentContainer.children[childIndex] = component;
				} else {
					component.setText(text);
				}
				childIndex++;
			} else if (content.type === "thinking" && content.thinking.trim()) {
				const thinking = content.thinking.trim();

				if (this.hideThinkingBlock) {
					let component = this.contentContainer.children[childIndex] as Text | undefined;
					if (!(component instanceof Text)) {
						component = new Text(theme.italic(theme.fg("thinkingText", this.hiddenThinkingLabel)), 0, 0);
						this.contentContainer.children[childIndex] = component;
					}
					childIndex++;
				} else {
					let component = this.contentContainer.children[childIndex] as ThinkingBlock | undefined;
					if (!(component instanceof ThinkingBlock)) {
						component = new ThinkingBlock(thinking, this.markdownTheme);
						this.contentContainer.children[childIndex] = component;
					} else {
						component.setText(thinking);
					}
					childIndex++;
				}
			}
		}

		if (this.contentContainer.children.length > childIndex) {
			this.contentContainer.children.splice(childIndex);
		}

		const hasToolCalls = message.content.some((c) => c.type === "toolCall");
		this.hasToolCalls = hasToolCalls;
		if (!hasToolCalls) {
			if (message.stopReason === "aborted") {
				const abortMessage =
					message.errorMessage && message.errorMessage !== "Request was aborted"
						? message.errorMessage
						: "Operation cancelled";
				this.contentContainer.addChild(new Spacer(1));
				this.contentContainer.addChild(new Text(theme.fg("error", abortMessage), 0, 0));
			} else if (message.stopReason === "error") {
				const errorMsg = message.errorMessage || "Bilinmeyen hata";
				this.contentContainer.addChild(new Spacer(1));
				this.contentContainer.addChild(new Text(theme.fg("error", `Error: ${errorMsg}`), 0, 0));
			}
		}
	}
}
