import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { getEngineDir } from "../config.js";

export interface MemorySignal {
	timestamp: string;
	text: string;
	tag: "preference" | "workflow";
	weight?: number; // 1-10 importance score, default 5
}

const GLOBAL_MEMORY_FILE = join(getEngineDir(), "memory-signals.json");

function getMemoryFile(cwd?: string): string {
	const baseDir = getEngineDir();
	const historyDir = join(baseDir, "history");
	if (cwd) {
		const hash = createHash("sha256").update(cwd.replace(/\\/g, "/").toLowerCase()).digest("hex").slice(0, 12);
		const folderName = basename(cwd) || "project";
		return join(historyDir, `${folderName}-${hash}-memory.json`);
	}
	return GLOBAL_MEMORY_FILE;
}
const MAX_SIGNALS = 80;
const MIN_TEXT_LEN = 20;
const MAX_TEXT_LEN = 400;

const SIGNAL_PATTERNS = /tercih|preference|always|her zaman|workflow|akis|daima|istiyorum|yapma|kullan|tercih et/i;

export function shouldPersistMemorySignal(text: string): boolean {
	const normalized = text.toLowerCase().trim();
	if (normalized.length < MIN_TEXT_LEN) return false;
	if (normalized.length > 2000) return false;
	return SIGNAL_PATTERNS.test(normalized);
}

export function persistMemorySignal(text: string, cwd?: string): void {
	const memoryFile = getMemoryFile(cwd);
	const tag: MemorySignal["tag"] = /tercih|preference|always|her zaman|daima|istiyorum/i.test(text)
		? "preference"
		: "workflow";

	const trimmedText = text.length > MAX_TEXT_LEN ? `${text.slice(0, MAX_TEXT_LEN)}…` : text;

	const next: MemorySignal = {
		timestamp: new Date().toISOString(),
		text: trimmedText,
		tag,
		weight: 5,
	};

	const all = loadMemorySignals(cwd);
	all.push(next);

	const deduped = dedupeSignals(all);
	const sorted = deduped.sort((a, b) => (b.weight ?? 5) - (a.weight ?? 5));
	const final = sorted.slice(0, MAX_SIGNALS);

	// Atomic write: write to temp file then rename to avoid corrupt reads
	const dir = dirname(memoryFile);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

	const tmp = `${memoryFile}.tmp`;
	try {
		writeFileSync(tmp, `${JSON.stringify(final, null, 2)}\n`, "utf-8");
		renameSync(tmp, memoryFile);
	} catch (_err) {
		// If rename failed, still try direct write as fallback
		try {
			writeFileSync(memoryFile, `${JSON.stringify(final, null, 2)}\n`, "utf-8");
		} catch {
			// Silent: memory signals are non-critical
		}
	}
}

export function loadMemorySignals(cwd?: string): MemorySignal[] {
	const memoryFile = getMemoryFile(cwd);
	if (!existsSync(memoryFile)) return [];
	try {
		const raw = readFileSync(memoryFile, "utf-8");
		const parsed = JSON.parse(raw) as MemorySignal[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function dedupeSignals(signals: MemorySignal[]): MemorySignal[] {
	const seen = new Map<string, MemorySignal>();
	const now = Date.now();
	const DECAY_DAYS = 30; // Signals older than 30 days lose weight

	for (const s of signals) {
		// Age-based decay: reduce weight by 1 for each DECAY_DAYS period
		const ageMs = now - new Date(s.timestamp).getTime();
		const agePeriods = Math.floor(ageMs / (DECAY_DAYS * 24 * 60 * 60 * 1000));
		const decayedWeight = Math.max(1, (s.weight ?? 5) - agePeriods);

		const key = `${s.tag}:${s.text.slice(0, 80).trim().toLowerCase()}`;
		const existing = seen.get(key);
		if (!existing) {
			seen.set(key, { ...s, weight: decayedWeight });
		} else {
			const existingWeight = existing.weight ?? 5;
			seen.set(key, {
				...s,
				timestamp: s.timestamp > existing.timestamp ? s.timestamp : existing.timestamp,
				weight: Math.min(10, existingWeight + 1),
			});
		}
	}
	// Remove signals that decayed below threshold
	return Array.from(seen.values()).filter((s) => (s.weight ?? 5) >= 1);
}

/**
 * Builds memory preface. For local models, `compact` mode produces much shorter output.
 */
export function getMemoryPreface(limit = 8, compact = false, cwd?: string): string {
	const items = loadMemorySignals(cwd)
		.sort((a, b) => (b.weight ?? 5) - (a.weight ?? 5))
		.slice(0, limit);

	if (items.length === 0) return "";

	if (compact) {
		const lines = items.map((s) => `[${s.tag[0].toUpperCase()}] ${s.text}`);
		return `User preferences:\n${lines.join("\n")}\n`;
	}

	const lines = items.map((s) => `- [${s.tag}] ${s.text}`);
	return `User memory signals:\n${lines.join("\n")}\n`;
}
