/**
 * Structured logger for Astro-Agent.
 *
 * Levels: debug, info, warn, error
 * Categories: system, session, mcp, bridge, tool, engine, fable, fusion
 *
 * Use: `log.info('system', 'Server started on port 3135')`
 *      `log.error('session', 'Failed to send message', err)`
 */

import { realtimeBus } from "./realtime-bus.js";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogCategory = "system" | "session" | "mcp" | "bridge" | "tool" | "engine" | "fable" | "fusion";

const LEVEL_NUM: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

const LEVEL_COLOR: Record<LogLevel, string> = {
	debug: "\x1b[36m", // cyan
	info: "\x1b[32m", // green
	warn: "\x1b[33m", // yellow
	error: "\x1b[31m", // red
};

const CAT_COLOR: Record<string, string> = {
	system: "\x1b[35m",
	session: "\x1b[34m",
	mcp: "\x1b[33m",
	bridge: "\x1b[36m",
	tool: "\x1b[32m",
	engine: "\x1b[37m",
	fable: "\x1b[38;2;180;140;255m",
	fusion: "\x1b[38;2;255;160;210m",
};

interface LogEntry {
	ts: string;
	level: LogLevel;
	category: LogCategory;
	message: string;
	error?: string;
}

export class Logger {
	private minLevel: number;
	private logHistory: LogEntry[] = [];
	private maxHistory = 500;
	private sendToBus = false;

	constructor(minLevel: LogLevel = "info", sendToBus = false) {
		this.minLevel = LEVEL_NUM[minLevel];
		this.sendToBus = sendToBus;
	}

	setLevel(level: LogLevel): void {
		this.minLevel = LEVEL_NUM[level];
	}

	private formatTime(): string {
		const d = new Date();
		return d.toISOString().slice(11, 23);
	}

	emit(level: LogLevel, category: LogCategory, message: string, err?: unknown): void {
		if (LEVEL_NUM[level] < this.minLevel) return;

		const ts = this.formatTime();
		const errorStr = err
			? err instanceof Error
				? `${err.message}\n${err.stack?.slice(0, 200) ?? ""}`
				: String(err)
			: undefined;

		// Console output with color
		const levelStr = `${LEVEL_COLOR[level]}${level.toUpperCase().padEnd(5)}\x1b[0m`;
		const catStr = `${CAT_COLOR[category] ?? ""}${category.padEnd(8)}\x1b[0m`;
		const msg = errorStr ? `${message} — ${errorStr}` : message;
		const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
		consoleFn(`${ts} ${levelStr} ${catStr} ${msg}`);

		// History
		const entry: LogEntry = { ts, level, category, message, error: errorStr };
		this.logHistory.push(entry);
		if (this.logHistory.length > this.maxHistory) {
			this.logHistory = this.logHistory.slice(-this.maxHistory);
		}

		// Push to realtime bus for frontend visibility
		if (this.sendToBus) {
			try {
				realtimeBus.broadcast({
					type: "terminal_log",
					data: `[${level.toUpperCase()}] [${category}] ${msg}\n`,
				});
			} catch {
				// bus not ready
			}
		}
	}

	debug(category: LogCategory, message: string, err?: unknown): void {
		this.emit("debug", category, message, err);
	}
	info(category: LogCategory, message: string, err?: unknown): void {
		this.emit("info", category, message, err);
	}
	warn(category: LogCategory, message: string, err?: unknown): void {
		this.emit("warn", category, message, err);
	}
	error(category: LogCategory, message: string, err?: unknown): void {
		this.emit("error", category, message, err);
	}

	getHistory(): LogEntry[] {
		return [...this.logHistory];
	}

	getRecent(count = 20): LogEntry[] {
		return this.logHistory.slice(-count);
	}

	clearHistory(): void {
		this.logHistory = [];
	}
}

/** Singleton instance for app-wide use */
export const log = new Logger("info", true);

/** Module-specific child logger that fixes the category */
export class CategoryLogger extends Logger {
	private fixedCategory: LogCategory;
	constructor(category: LogCategory, minLevel?: LogLevel) {
		super(minLevel ?? "info", true);
		this.fixedCategory = category;
	}
	debug(message: string, err?: unknown): void {
		super.emit("debug", this.fixedCategory, message, err);
	}
	info(message: string, err?: unknown): void {
		super.emit("info", this.fixedCategory, message, err);
	}
	warn(message: string, err?: unknown): void {
		super.emit("warn", this.fixedCategory, message, err);
	}
	error(message: string, err?: unknown): void {
		super.emit("error", this.fixedCategory, message, err);
	}
}

/** Create a module-specific child logger */
export function childLogger(category: LogCategory, minLevel?: LogLevel): CategoryLogger {
	return new CategoryLogger(category, minLevel);
}
