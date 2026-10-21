import { Container, Text } from "astro-tui";

const bg = (s: string) => `\x1b[48;2;15;30;45m${s}\x1b[49m`;
const fg = (s: string) => `\x1b[38;2;80;200;180m${s}\x1b[39m`;
const muted = (s: string) => `\x1b[38;2;120;120;120m${s}\x1b[39m`;

export class SubagentStatusComponent extends Container {
	private label = new Text("");
	private isActive = false;
	private taskName = "";

	constructor(private onOpenFn: () => void) {
		super();
		this.setStyle({});
		this.addChild(this.label);
	}

	handleInput(data: string): void {
		if (data === "\x0f" || data === "\x16") {
			// Ctrl+O or Ctrl+V, let's use Ctrl+O for open overlay maybe?
			if (this.isActive) {
				this.onOpenFn();
			}
		}
	}

	setStatus(active: boolean, taskName?: string) {
		this.isActive = active;
		this.taskName = taskName ?? "";

		if (this.isActive) {
			const text = bg(` 🤖 Sub-agent: ${fg(this.taskName)} `) + muted(" (Press Ctrl+O to view) ");
			this.label.setText(text);
		} else {
			this.label.setText("");
		}
	}

	public get active() {
		return this.isActive;
	}
}
