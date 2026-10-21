import * as fs from "node:fs";
import * as path from "node:path";
import { type Component, truncateToWidth } from "astro-tui";
import type { EngineSession } from "../../../core/engine-session.js";
import { theme } from "../theme/theme.js";

export class WorkspacePanelComponent implements Component {
	constructor(private session: EngineSession) {}

	setSession(session: EngineSession): void {
		this.session = session;
	}

	invalidate(): void {}
	dispose(): void {}

	private listFiles(cwd: string, max = 12): string[] {
		try {
			return fs
				.readdirSync(cwd, { withFileTypes: true })
				.filter((entry) => !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist")
				.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
				.slice(0, max)
				.map((entry) => `${entry.isDirectory() ? "▸" : "·"} ${entry.name}${entry.isDirectory() ? "/" : ""}`);
		} catch {
			return ["klasör okunamadı"];
		}
	}

	render(width: number): string[] {
		if (width < 20) return [];
		const cwd = this.session.sessionManager.getCwd();
		const activeTools = this.session.getActiveToolNames();
		const spin = ["◜", "◠", "◝", "◞", "◡", "◟"][Math.floor(Date.now() / 140) % 6];
		const inner = Math.max(8, width - 2);
		const line = (text = "") =>
			`${theme.fg("borderMuted", "│")}${truncateToWidth(text, inner, "…").padEnd(inner)}${theme.fg("borderMuted", "│")}`;
		const separator = `${theme.fg("borderMuted", "├")}${theme.fg("borderMuted", "─".repeat(inner))}${theme.fg("borderMuted", "┤")}`;

		const lines = [
			`${theme.fg("borderMuted", "╭")}${theme.fg("borderMuted", "─".repeat(inner))}${theme.fg("borderMuted", "╮")}`,
			line(`${theme.fg("accent", spin)} ${theme.bold("workspace")}`),
			line(theme.fg("dim", path.basename(cwd) || cwd)),
			separator,
			line(theme.fg("muted", "files")),
			...this.listFiles(cwd).map((file) => line(theme.fg(file.startsWith("▸") ? "accent" : "muted", file))),
			separator,
			line(theme.fg("muted", "live tools")),
			line(activeTools.length ? theme.fg("warning", activeTools.join(", ")) : theme.fg("dim", "idle")),
			`${theme.fg("borderMuted", "╰")}${theme.fg("borderMuted", "─".repeat(inner))}${theme.fg("borderMuted", "╯")}`,
		];
		return lines;
	}
}
