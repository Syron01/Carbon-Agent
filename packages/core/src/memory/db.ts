/**
 * Astro (PRO) — Relational Memory Graph (R-Graph)
 * SQLite WAL-mode high-concurrency fact store.
 *
 * Gracefully degrades if better-sqlite3 native bindings are unavailable
 * (e.g. CI environments without native compilation support).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { simulateGroverSearch } from "./quantum.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Lazy DB initialisation ─────────────────────────────────────────────────

let db: any = null;
let insertEntityStmt: any = null;
let insertRelationStmt: any = null;
let insertEventStmt: any = null;
let fetchRelationsStmt: any = null;

function getDb(): any {
	if (db) return db;

	try {
		// Dynamic import so CI never fails at module load time
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const Database = require("better-sqlite3");

		const memDir = path.join(__dirname, "../../../../.astroagent/memory");
		if (!fs.existsSync(memDir)) {
			fs.mkdirSync(memDir, { recursive: true });
		}

		const dbPath = path.join(memDir, "memory.db");
		db = new Database(dbPath);

		// Enable WAL mode — 640MB cache, normal sync
		db.pragma("journal_mode = WAL");
		db.pragma("synchronous = NORMAL");
		db.pragma("cache_size = -640000"); // 640MB cache

		db.exec(`
      CREATE TABLE IF NOT EXISTS Entities (
        entity_id TEXT PRIMARY KEY,
        type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS Relations (
        source_id TEXT,
        relation_type TEXT,
        target_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(source_id) REFERENCES Entities(entity_id),
        FOREIGN KEY(target_id) REFERENCES Entities(entity_id),
        UNIQUE(source_id, relation_type, target_id)
      );

      CREATE INDEX IF NOT EXISTS idx_relations_source ON Relations(source_id);
      CREATE INDEX IF NOT EXISTS idx_relations_target ON Relations(target_id);

      CREATE TABLE IF NOT EXISTS Events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

		// Pre-compiled statements for O(1) performance
		insertEntityStmt = db.prepare("INSERT OR IGNORE INTO Entities (entity_id, type) VALUES (?, ?)");
		insertRelationStmt = db.prepare(
			"INSERT OR IGNORE INTO Relations (source_id, relation_type, target_id) VALUES (?, ?, ?)",
		);
		insertEventStmt = db.prepare("INSERT INTO Events (event_type, details) VALUES (?, ?)");
		fetchRelationsStmt = db.prepare("SELECT source_id, relation_type, target_id FROM Relations");

		return db;
	} catch (_e) {
		// Native module unavailable — memory features disabled, all functions become no-ops
		return null;
	}
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Saves a new fact (source - relation - target) to the R-Graph.
 */
export function saveFact(source: string, relation: string, target: string): void {
	if (typeof source !== "string" || typeof relation !== "string" || typeof target !== "string") return;
	if (!source || !relation || !target) return;

	const database = getDb();
	if (!database) return; // graceful no-op when native bindings unavailable

	try {
		const s = source.trim().toLowerCase();
		const r = relation.trim().toLowerCase();
		const t = target.trim().toLowerCase();

		database.transaction(() => {
			insertEntityStmt.run(s, "concept");
			insertEntityStmt.run(t, "concept");
			const result = insertRelationStmt.run(s, r, t);

			if (result.changes > 0) {
				insertEventStmt.run("fact_learned", `${s} ${r} ${t}`);
			}
		})();
	} catch (e) {
		console.error("[Memory] Error saving fact:", e);
	}
}

/**
 * Fetches relevant memory facts based on user input, using Grover's quantum search simulation.
 */
export function fetchMemory(text: string): string[] {
	if (!text || typeof text !== "string") return [];

	const database = getDb();
	if (!database) return []; // graceful no-op

	try {
		const rows = fetchRelationsStmt.all();
		if (rows.length === 0) return [];

		// Run Quantum Grover Search simulation to rank facts
		const rankedStates = simulateGroverSearch(rows, text);

		// Get top 6 relevant facts
		return rankedStates.slice(0, 6).map((s) => `${s.source_id} ${s.relation_type} ${s.target_id}`);
	} catch (e) {
		console.error("[Memory] Fetch error:", e);
		return [];
	}
}

export function clearMemory(): void {
	const database = getDb();
	if (!database) return;
	database.exec("DELETE FROM Events; DELETE FROM Relations; DELETE FROM Entities;");
}
