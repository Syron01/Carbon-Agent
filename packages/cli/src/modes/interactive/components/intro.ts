import type { Component } from "astro-tui";
import { VERSION } from "../../../config.js";
import { theme } from "../theme/theme.js";

export function buildIntroLines(width: number): string[] {
	if (width < 30) return [theme.fg("dim", "carbon-agent")];

	const indent = Math.max(0, Math.floor((width - 40) / 2));
	const pad = " ".repeat(indent);

	const logo = theme.fg("accent", "  ◆  Carbon-Agent");
	const version = theme.fg("dim", ` v${VERSION}`);

	const line1 = pad + logo + version;

	const line2 = pad + theme.fg("muted", "  type /help for commands · / to begin");

	const line3 = pad + theme.fg("dim", "  ─".repeat(Math.min(15, Math.floor((width - indent - 4) / 2))));

	return ["", line1, line3, line2, ""];
}

export class CarbonAgentIntroComponent implements Component {
	invalidate(): void {}
	dispose(): void {}
	render(width: number): string[] {
		return buildIntroLines(width);
	}
}

export const AstroAgentIntroComponent = CarbonAgentIntroComponent;
