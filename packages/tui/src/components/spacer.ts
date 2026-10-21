import type { Component } from "../tui.js";

/**
 * Spacer component that renders empty lines
 */
export class Spacer implements Component {
	private width: number;
	private lines: number;

	constructor(width: number = 0, lines: number = 1) {
		this.width = width;
		this.lines = lines;
	}

	setLines(lines: number): void {
		this.lines = lines;
	}

	invalidate(): void {
		// No cached state to invalidate currently
	}

	render(_width: number): string[] {
		const line = this.width > 0 ? " ".repeat(Math.min(this.width, Math.max(0, _width))) : "";
		const result: string[] = [];
		for (let i = 0; i < this.lines; i++) {
			result.push(line);
		}
		return result;
	}
}
