import { Text } from "astro-tui";
import { theme } from "../theme/theme.js";

export function colorizeUnifiedDiff(diff: string): string {
	return diff
		.split("\n")
		.map((line) => {
			if (line.startsWith("+++") || line.startsWith("---")) return theme.fg("muted", line);
			if (line.startsWith("+")) return theme.fg("success", line);
			if (line.startsWith("-")) return theme.fg("error", line);
			if (line.startsWith("@@")) return theme.fg("accent", line);
			return theme.fg("muted", line);
		})
		.join("\n");
}

export class DiffPreviewComponent extends Text {
	private expanded = false;
	constructor(
		private diff: string,
		private maxLines = 120,
	) {
		super("", 1, 0);
		this.refresh();
	}

	setDiff(diff: string): void {
		this.diff = diff;
		this.refresh();
	}

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
		this.refresh();
	}

	private refresh(): void {
		const lines = this.diff.split("\n");
		const shown = this.expanded ? lines : lines.slice(0, this.maxLines);
		const more =
			!this.expanded && lines.length > shown.length
				? `\n${theme.fg("muted", `... ${lines.length - shown.length} more lines`)}`
				: "";
		this.setText(colorizeUnifiedDiff(shown.join("\n")) + more);
	}
}
