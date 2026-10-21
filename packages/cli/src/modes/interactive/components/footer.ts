import type { Component } from "astro-tui";
import type { EngineSession } from "../../../core/engine-session.js";
import type { ReadonlyFooterDataProvider } from "../../../core/footer-data-provider.js";
import { theme } from "../theme/theme.js";

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function widthOf(value: string): number {
	return value.replace(ANSI_RE, "").replace(/[\uD800-\uDFFF]/g, "  ").length;
}

function fitText(value: string, maxWidth: number): string {
	const plain = value.replace(ANSI_RE, "");
	if (plain.length <= maxWidth) return value;
	if (maxWidth <= 3) return "";
	return `${plain.slice(0, maxWidth - 1)}…`;
}

export class FooterComponent implements Component {
	private getExecutingToolNames?: () => string[];
	private costTotal = 0;
	private lastEntryCount = -1;

	constructor(
		private session: EngineSession,
		_footerData: ReadonlyFooterDataProvider,
		getExecutingToolNames?: () => string[],
	) {
		this.getExecutingToolNames = getExecutingToolNames;
	}

	setSession(session: EngineSession): void {
		this.session = session;
		this.invalidate();
	}

	setAutoCompactEnabled(_enabled: boolean): void {}

	invalidate(): void {
		this.lastEntryCount = -1;
	}

	dispose(): void {}

	render(width: number): string[] {
		const state = this.session.state;
		const entries = this.session.sessionManager?.getEntries() ?? [];

		if (entries.length !== this.lastEntryCount) {
			this.lastEntryCount = entries.length;
			this.costTotal = 0;
			for (const entry of entries) {
				if (entry.type === "message" && entry.message.role === "assistant") {
					const totalCost = entry.message.usage?.cost?.total;
					if (typeof totalCost === "number" && Number.isFinite(totalCost)) {
						this.costTotal += totalCost;
					}
				}
			}
		}

		const provider = state.model?.provider ?? "";
		let model = state.model?.id ?? "no-model";
		if (provider && model.toLowerCase().startsWith(`${provider.toLowerCase()}-`)) {
			model = model.slice(provider.length + 1);
		} else if (provider && model.toLowerCase().startsWith(`${provider.toLowerCase()}/`)) {
			model = model.slice(provider.length + 1);
		}

		const ctxUsage = this.session.getContextUsage?.();
		const ctxPct = ctxUsage?.percent != null ? `${ctxUsage.percent.toFixed(0)}%` : "0%";
		const thinkLevel = state.thinkingLevel ?? "off";
		const compacting = Boolean((this.session as any).isCompacting);
		const streaming = this.session.isStreaming;
		const browserClients = this.session.getBrowserBridgeStatus?.()?.clients ?? 0;
		const activeTools = this.getExecutingToolNames?.() ?? [];
		const toolNames = (this.session as any).getActiveToolNames?.() ?? [];
		const toolCount = activeTools.length || toolNames.length;
		const cwd = this.session.sessionManager?.getCwd() ?? ".";

		const modelShort = fitText(model, 16);

		let left = "";
		left += theme.fg(streaming ? "success" : "dim", streaming ? "●" : "○");
		left += theme.fg("text", ` ${modelShort}`);
		left += theme.fg("muted", ` ${thinkLevel}`);

		let right = "";
		if (width >= 80) {
			const cwdShort = fitText(cwd.replace(/^.*[/\\]/, ""), 14);
			right += theme.fg("dim", `📁${cwdShort}  `);
		}
		right += theme.fg("muted", `◇${ctxPct}`);
		if (compacting) {
			right += theme.fg("warning", " ◎compact");
		} else if (streaming) {
			right += theme.fg("success", " ●run");
		}
		if (toolCount > 0) {
			right += theme.fg("dim", `  ⚡${toolCount}`);
		}
		if (browserClients > 0) {
			right += theme.fg("dim", `  🌐${browserClients}`);
		}
		if (width >= 88 && this.costTotal > 0) {
			right += theme.fg("dim", `  $${this.costTotal.toFixed(3)}`);
		}

		const leftW = widthOf(left);
		const rightW = widthOf(right);
		const gap = Math.max(1, width - leftW - rightW);

		const line = ` ${left}${" ".repeat(gap)}${right} `;

		return [theme.bg("surfaceBg", line)];
	}
}
