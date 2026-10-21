import { type ThemeColor, theme } from "../theme/theme.js";

export type ToolFrameState = "running" | "success" | "error" | "cancelled" | "pending";

const STATE_PREFIX: Record<ToolFrameState, string> = {
	running: "◇",
	pending: "◇",
	success: "✓",
	error: "✗",
	cancelled: "△",
};

const STATE_COLOR: Record<ToolFrameState, ThemeColor> = {
	running: "accent",
	pending: "dim",
	success: "success",
	error: "error",
	cancelled: "warning",
};

export function renderToolFrame(
	toolName: string,
	state: ToolFrameState,
	contentLines: string[],
	width: number,
): string[] {
	if (width < 10) return contentLines;

	const prefix = STATE_PREFIX[state];
	const prefixColor = STATE_COLOR[state];

	const header = theme.fg(prefixColor, ` ${prefix} `) + theme.bold(theme.fg("toolTitle", toolName));

	const filteredLines = contentLines.filter((l) => l.trim().length > 0).slice(0, 20);

	const result: string[] = [header];
	for (const line of filteredLines) {
		result.push(theme.fg("dim", `  ${line}`));
	}

	return result;
}
