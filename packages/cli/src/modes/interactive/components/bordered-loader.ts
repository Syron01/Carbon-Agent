import { Container, Text, type TUI } from "astro-tui";
import type { Theme } from "../theme/theme.js";

/** Minimal, static loader replacement (no animations, no borders) */
export class BorderedLoader extends Container {
	private cancellable: boolean;
	private signalController?: AbortController;
	private abortFn?: () => void;

	constructor(_tui: TUI, theme: Theme, message: string, options?: { cancellable?: boolean }) {
		super();
		this.cancellable = options?.cancellable ?? true;

		if (!this.cancellable) {
			this.signalController = new AbortController();
		}

		// Static text instead of animated loader
		this.addChild(new Text(theme.fg("accent", `· ${message}`), 0, 0));
	}

	get signal(): AbortSignal {
		if (this.cancellable) {
			// Provide a dummy signal or implement properly if needed
			this.signalController = this.signalController ?? new AbortController();
			return this.signalController.signal;
		}
		return this.signalController?.signal ?? new AbortController().signal;
	}

	set onAbort(fn: (() => void) | undefined) {
		this.abortFn = fn;
	}

	handleInput(data: string): void {
		if (this.cancellable && (data === "\x03" || data === "\x1b" || data === "q")) {
			this.signalController?.abort();
			this.abortFn?.();
		}
	}

	dispose(): void {
		// No intervals to clear
	}
}
