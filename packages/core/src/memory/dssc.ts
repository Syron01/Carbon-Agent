import fs from "fs";
import path from "path";

/**
 * SuperLLama Deep Semantic Semantic Compression (DSSC) Indexer
 *
 * Indexes the entire codebase by stripping out comments, white spaces,
 * and semantic noise, preparing it for RFF/LLM digestion.
 */

const EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".astroagent", "coverage"]);
const EXCLUDED_EXTS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".svg",
	".ico",
	".woff",
	".woff2",
	".ttf",
	".eot",
	".mp4",
	".mp3",
	".wav",
	".zip",
	".tar",
	".gz",
	".pdf",
	".db",
	".sqlite",
]);

export function ingestDirectory(dirPath: string, rootDir: string): void {
	try {
		const entries = fs.readdirSync(dirPath, { withFileTypes: true });

		for (const entry of entries) {
			if (EXCLUDED_DIRS.has(entry.name)) continue;

			const fullPath = path.join(dirPath, entry.name);

			if (entry.isDirectory()) {
				ingestDirectory(fullPath, rootDir);
			} else if (entry.isFile()) {
				const ext = path.extname(entry.name).toLowerCase();
				if (EXCLUDED_EXTS.has(ext)) continue;

				try {
					const content = fs.readFileSync(fullPath, "utf-8");
					// Extremely basic AST/semantic compression (strip comments, condense whitespace)
					const compressed = compressCode(content, ext);
					if (compressed.length > 50) {
						// Usually we'd save this to Vector DB or SQLite R-Graph.
						// For now, it's just a pass-through structural check.
					}
				} catch (_e) {
					// Binary or unreadable
				}
			}
		}
	} catch (e) {
		console.error(`[DSSC] Error indexing ${dirPath}:`, e);
	}
}

function compressCode(code: string, ext: string): string {
	if (ext === ".ts" || ext === ".js" || ext === ".tsx" || ext === ".jsx") {
		// Remove single line comments
		let stripped = code.replace(/\/\/.*$/gm, "");
		// Remove multi line comments
		stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, "");
		// Condense whitespace
		return stripped.replace(/\s+/g, " ").trim();
	}
	return code.substring(0, 1000); // Truncate non-code to first 1000 chars to avoid explosion
}
