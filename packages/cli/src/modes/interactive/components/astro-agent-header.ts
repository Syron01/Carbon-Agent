import type { Component } from "astro-tui";
import { VERSION } from "../../../config.js";
import type { EngineSession } from "../../../core/engine-session.js";
import type { ReadonlyFooterDataProvider } from "../../../core/footer-data-provider.js";
import { theme } from "../theme/theme.js";

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function widthOf(value: string): number {
	return value.replace(ANSI_RE, "").length;
}

function fitText(value: string, maxWidth: number): string {
	const plain = value.replace(ANSI_RE, "");
	if (plain.length <= maxWidth) return value;
	if (maxWidth <= 3) return "";
	return `${plain.slice(0, maxWidth - 1)}…`;
}

function shortenPath(value: string): string {
	if (!value) return ".";
	const parts = value.split(/[/\\]/).filter(Boolean);
	if (parts.length <= 2) return value;
	return `…/${parts.slice(-2).join("/")}`;
}

export class AstroAgentHeaderComponent implements Component {
	private unsubscribeBranch?: () => void;

	constructor(
		private session: EngineSession,
		private footerData: ReadonlyFooterDataProvider,
	) {
		this.unsubscribeBranch = footerData.onBranchChange?.(() => this.invalidate());
	}

	setSession(session: EngineSession): void {
		this.session = session;
		this.invalidate();
	}

	invalidate(): void {}

	dispose(): void {
		this.unsubscribeBranch?.();
		this.unsubscribeBranch = undefined;
	}

	render(width: number): string[] {
		const safeWidth = Math.max(40, width);
		const cwd = shortenPath(this.session.sessionManager?.getCwd?.() ?? process.cwd());
		const branch = this.footerData.getGitBranch?.();
		const model = this.session.state.model?.id ?? "no-model";
		const modelProvider = this.session.state.model?.provider ?? "";
		const shortModel = modelProvider
			? model.replace(`${modelProvider}/`, "").replace(`${modelProvider}-`, "")
			: model;
		const thinking = this.session.state.thinkingLevel ?? "off";
		const ctx = this.session.getContextUsage?.();
		const ctxPct = ctx?.percent != null ? `${ctx.percent.toFixed(0)}%` : "0%";
		const isStreaming = this.session.isStreaming;

		const bullet = isStreaming ? theme.fg("success", "●") : theme.fg("muted", "○");

		let left = "";
		left += theme.fg("accent", " ◆");
		left += theme.fg("text", " Carbon-Agent");
		left += theme.fg("dim", ` v${VERSION}`);
		left += ` ${bullet}`;

		let center = "";
		center += theme.fg("muted", `  📁${fitText(cwd, 16)}`);
		if (branch) {
			center += theme.fg("dim", "  ") + theme.fg("muted", `⎇${fitText(branch, 12)}`);
		}

		let right = "";
		right += theme.fg("dim", "  ");
		right += theme.fg("dim", "🧠") + theme.fg("text", fitText(shortModel, 14));
		right += theme.fg("muted", ` ${thinking}`);
		right += theme.fg("dim", "  ");
		right += theme.fg("muted", `◇${ctxPct}`);

		const providerCount = this.footerData.getAvailableProviderCount?.() ?? 0;
		const browserClients = this.session.getBrowserBridgeStatus?.()?.clients ?? 0;
		const mcpClients = this.session.mcpManager?.getClients?.().size ?? 0;
		if (providerCount > 0 || browserClients > 0 || mcpClients > 0) {
			const extras: string[] = [];
			if (providerCount > 1) extras.push(`${providerCount}agents`);
			if (browserClients > 0) extras.push(`🌐${browserClients}`);
			if (mcpClients > 0) extras.push(`🔌${mcpClients}`);
			if (extras.length > 0) {
				right += theme.fg("dim", "  ") + theme.fg("dim", extras.join(" "));
			}
		}

		const leftW = widthOf(left);
		const centerW = widthOf(center);
		const rightW = widthOf(right);
		const available = safeWidth - leftW - centerW - rightW;
		const gapL = Math.max(0, Math.floor((available - 4) / 2));
		const gapR = Math.max(0, available - 4 - gapL);

		const line = left + " ".repeat(gapL + 2) + center + " ".repeat(gapR + 2) + right;

		return [theme.bg("surfaceBg", line)];
	}
}
