import { Container } from "astro-tui";

export type TaskStatus = "pending" | "active" | "done";

export interface TaskItem {
	id: string;
	label: string;
	status: TaskStatus;
}

const ANSI_RE = /\x1b\[[0-9;]*m/g;
const rgb = (r: number, g: number, b: number, s: string) => `\x1b[38;2;${r};${g};${b}m${s}\x1b[39m`;
const dim = (s: string) => rgb(65, 65, 65, s);
const muted = (s: string) => rgb(120, 120, 120, s);
const active = (s: string) => rgb(220, 160, 60, s); // amber — matches screenshot
const done = (s: string) => rgb(80, 140, 80, s);
const head = (s: string) => rgb(160, 160, 160, s);
const bg = (s: string) => `\x1b[48;2;10;10;14m${s}\x1b[49m`;

function truncate(s: string, max: number): string {
	const plain = s.replace(ANSI_RE, "");
	return plain.length <= max ? s : `${plain.slice(0, Math.max(0, max - 1))}~`;
}

function pad(s: string, width: number): string {
	const plain = s.replace(ANSI_RE, "");
	const gap = Math.max(0, width - plain.length);
	return s + " ".repeat(gap);
}

export class TaskPanelComponent extends Container {
	private tasks: TaskItem[] = [];
	private panelWidth = 32;
	private _invalidate?: () => void;

	constructor(invalidateFn?: () => void) {
		super();
		this._invalidate = invalidateFn;
		this.setStyle({ width: this.panelWidth, minWidth: this.panelWidth, border: "left" });
	}

	setTasks(tasks: TaskItem[]): void {
		this.tasks = tasks;
		this._invalidate?.();
		this.requestRender();
	}

	updateTask(id: string, status: TaskStatus): void {
		const t = this.tasks.find((x) => x.id === id);
		if (t) {
			t.status = status;
			this._invalidate?.();
			this.requestRender();
		}
	}

	addTask(task: TaskItem): void {
		const existing = this.tasks.find((t) => t.id === task.id);
		if (existing) {
			existing.status = task.status;
			existing.label = task.label;
		} else {
			this.tasks.push(task);
		}
		this._invalidate?.();
		this.requestRender();
	}

	clearTasks(): void {
		this.tasks = [];
		this._invalidate?.();
		this.requestRender();
	}

	getTasks(): TaskItem[] {
		return this.tasks;
	}

	private requestRender(): void {
		// Children are Text nodes we rebuild on render
	}

	override render(width: number): string[] {
		const w = Math.max(16, width);
		const inner = w - 1; // account for left border drawn by parent

		const lines: string[] = [];

		// Header
		lines.push(bg(pad(head(" ▼ Todo"), inner)));
		lines.push(bg(dim(" ".repeat(inner))));

		if (this.tasks.length === 0) {
			lines.push(bg(muted("  no tasks")));
		} else {
			for (const task of this.tasks) {
				const marker = task.status === "done" ? done("[✓]") : task.status === "active" ? active("[·]") : dim("[ ]");

				const labelColor = task.status === "done" ? done : task.status === "active" ? active : muted;

				const maxLabel = Math.max(4, inner - 5);
				const label = labelColor(truncate(task.label, maxLabel));
				lines.push(bg(` ${marker} ${label}`));
			}
		}

		lines.push(bg(""));
		return lines.map((l) => bg(l));
	}

	invalidate(): void {}
	dispose(): void {}
}
