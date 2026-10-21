// @ts-nocheck
import { Container, Markdown, type MarkdownTheme, Text } from "astro-tui";
import { getMarkdownTheme, theme } from "../theme/theme.js";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

export class UserMessageComponent extends Container {
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(text: string, markdownTheme: MarkdownTheme = getMarkdownTheme()) {
		super();
		this.addChild(new Text("", 0, 0));
		this.addChild(
			new Markdown(text, 0, 0, markdownTheme, {
				color: (content: string) => theme.fg("text", content),
			}),
		);
	}

	override invalidate(): void {
		super.invalidate();
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

	override render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		const child = this.children[1] || this.children[0];
		const childLines = child ? child.render(width - 8) : [];
		const accentLine = theme.fg("accent", "┃");
		const _resetCode = "\x1b[0m";

		const lines: string[] = [];

		for (let i = 0; i < childLines.length; i++) {
			const cleanLine = childLines[i].replace(/\x1b\[[0-9;]*m/g, "");
			const painter = i === 0 ? (s: string) => theme.bold(s) : (s: string) => s;
			const content = painter(theme.fg("text", ` ${cleanLine}`));
			lines.push(`${accentLine}${content}`);
		}

		const result = [...lines];
		result[0] = OSC133_ZONE_START + result[0];
		result[result.length - 1] = OSC133_ZONE_END + OSC133_ZONE_FINAL + result[result.length - 1];
		this.cachedWidth = width;
		this.cachedLines = result;
		return result;
	}
}
