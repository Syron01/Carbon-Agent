import { Container } from "astro-tui";
import { theme } from "../theme/theme.js";
import type { ToolExecutionComponent } from "./tool-execution.js";

export class ToolBatchComponent extends Container {
	private toolComponents: ToolExecutionComponent[] = [];
	private collapsed = true;

	addTool(component: ToolExecutionComponent): void {
		this.toolComponents.push(component);
		this.invalidateCache();
	}

	get count(): number {
		return this.toolComponents.length;
	}

	getTools(): ToolExecutionComponent[] {
		return this.toolComponents;
	}

	hasToolCallId(id: string): boolean {
		return this.toolComponents.some((t) => (t as any).toolCallId === id);
	}

	getToolByCallId(id: string): ToolExecutionComponent | undefined {
		return this.toolComponents.find((t) => (t as any).toolCallId === id);
	}

	toggle(): void {
		this.collapsed = !this.collapsed;
		this.invalidateCache();
	}

	setCollapsed(collapsed: boolean): void {
		this.collapsed = collapsed;
		this.invalidateCache();
	}

	isCollapsed(): boolean {
		return this.collapsed;
	}

	private invalidateCache(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

	override invalidate(): void {
		super.invalidate();
		this.invalidateCache();
	}

	override render(width: number): string[] {
		if (this.toolComponents.length === 0) return [];
		if (this.toolComponents.length === 1) {
			return this.toolComponents[0].render(width);
		}

		this.invalidateCache();

		const toolNames = this.toolComponents.map((t) => t.getToolName());
		const uniqueNames = [...new Set(toolNames)];
		const nameCounts = uniqueNames.map((name) => {
			const count = toolNames.filter((n) => n === name).length;
			return count > 1 ? `${name}×${count}` : name;
		});

		const allDone = this.toolComponents.every((t) => !(t as any).isPartial);
		const hasError = this.toolComponents.some((t) => (t as any).result?.isError);
		const _running = this.toolComponents.some((t) => (t as any).isPartial && (t as any).executionStarted);

		let statusColor: string;
		if (hasError) {
			statusColor = "error";
		} else if (allDone) {
			statusColor = "success";
		} else {
			statusColor = "accent";
		}

		const arrow = this.collapsed ? "▸" : "▾";
		const summary = nameCounts.join(", ");
		const countLabel = `${this.toolComponents.length} tools`;

		const headerLine =
			theme.fg(statusColor as any, ` ${arrow} `) + theme.fg("dim", `${countLabel}: `) + theme.fg("muted", summary);

		if (this.collapsed) {
			return [headerLine];
		}

		const lines: string[] = [headerLine];
		for (const tool of this.toolComponents) {
			const toolLines = tool.render(width);
			lines.push(...toolLines);
		}
		return lines;
	}
}
