import type { Engine } from "astro-engine";
import { Container, Text } from "astro-tui";

const bg = (s: string) => `\x1b[48;2;20;25;35m${s}\x1b[49m`;
const fg = (s: string) => `\x1b[38;2;200;220;255m${s}\x1b[39m`;
const muted = (s: string) => `\x1b[38;2;120;120;120m${s}\x1b[39m`;
const roleColors: Record<string, (s: string) => string> = {
	user: (s: string) => `\x1b[38;2;80;200;180m${s}\x1b[39m`,
	assistant: (s: string) => `\x1b[38;2;200;160;80m${s}\x1b[39m`,
	system: muted,
};

export class SubagentOverlayComponent extends Container {
	private logs: Text[] = [];
	private header: Text;

	constructor(
		taskName: string,
		private engine: Engine,
		private onDone: () => void,
	) {
		super();
		this.setStyle({ flexDirection: "column" });

		this.header = new Text(bg(fg(` 🤖 Sub-agent View: ${taskName} `)) + muted("  [Press ESC to return] \n\n"));
		this.addChild(this.header);

		// Auto-refresh when engine updates
		this.engine.subscribe((_event) => {
			this.refresh();
			// Since we don't have direct access to UI here, we rely on the main loop's requestRender
		});

		this.refresh();
	}

	handleInput(data: string): void {
		if (data === "\x03" || data === "\x1b") {
			// Ctrl+C or Escape
			this.onDone();
		}
	}

	refresh() {
		// Clear old logs
		for (const log of this.logs) {
			this.removeChild(log);
		}
		this.logs = [];

		const messages = this.engine.state.messages;
		for (const msg of messages) {
			let contentStr = "";

			if ("content" in msg) {
				if (typeof msg.content === "string") {
					contentStr = msg.content;
				} else if (Array.isArray(msg.content)) {
					contentStr = msg.content
						.map((c: any) => {
							if (c.type === "text") return c.text;
							if (c.type === "tool_call") return `[Tool Call: ${c.toolName}]`;
							if (c.type === "tool_result") return `[Tool Result: ${c.toolName}]`;
							return `[${c.type}]`;
						})
						.join("\n");
				}
			} else {
				contentStr = `[${msg.role} message]`;
			}

			const roleLabel = (roleColors[msg.role] || fg)(`[${msg.role.toUpperCase()}]`);
			const t = new Text(`${roleLabel}\n${muted(contentStr)}\n`);
			this.logs.push(t);
			this.addChild(t);
		}
	}
}
