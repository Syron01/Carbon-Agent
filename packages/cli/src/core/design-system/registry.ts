/**
 * Design system registry.
 *
 * Scans a directory for DESIGN.md files (per-brand design specs).
 * Extracts title, category, summary, and color swatches.
 * Compatible with Open Design's design-systems/ format.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface DesignSystemSummary {
	id: string;
	title: string;
	category: string;
	summary: string;
	swatches: string[];
	body: string;
}

/**
 * List all design systems found under `root/`.
 * Each subdirectory must contain a DESIGN.md file.
 */
export function listDesignSystems(root: string): DesignSystemSummary[] {
	const out: DesignSystemSummary[] = [];
	if (!existsSync(root)) return out;

	let entries: string[];
	try {
		entries = readdirSync(root);
	} catch {
		return out;
	}

	for (const name of entries) {
		const dirPath = join(root, name);
		try {
			if (!statSync(dirPath).isDirectory()) continue;
		} catch {
			continue;
		}
		const designPath = join(dirPath, "DESIGN.md");
		if (!existsSync(designPath)) continue;

		try {
			const raw = readFileSync(designPath, "utf8");
			const titleMatch = /^#\s+(.+?)\s*$/m.exec(raw);
			const title = cleanTitle(titleMatch?.[1] ?? name);
			out.push({
				id: name,
				title,
				category: extractCategory(raw) ?? "Uncategorized",
				summary: extractSummary(raw),
				swatches: extractSwatches(raw),
				body: raw,
			});
		} catch {
			// Skip unreadable files
		}
	}

	return out;
}

/**
 * Read a single design system by ID.
 */
export function readDesignSystem(root: string, id: string): string | null {
	// Prevent path traversal
	if (id.includes("..") || id.includes("/") || id.includes("\\")) {
		return null;
	}
	const file = join(root, id, "DESIGN.md");
	try {
		return readFileSync(file, "utf8");
	} catch {
		return null;
	}
}

// -- Helpers --

function cleanTitle(raw: string): string {
	return raw.replace(/\*\*/g, "").replace(/`/g, "").trim();
}

function extractCategory(markdown: string): string | null {
	const match = /^>\s*Category:\s*(.+)/m.exec(markdown);
	return match ? match[1].trim() : null;
}

function extractSummary(markdown: string): string {
	// First paragraph after the H1 (skip category line)
	const lines = markdown.split("\n");
	let pastH1 = false;
	const paragraphLines: string[] = [];

	for (const line of lines) {
		if (!pastH1) {
			if (/^#\s/.test(line)) pastH1 = true;
			continue;
		}
		// Skip category blockquote
		if (/^>\s*Category:/i.test(line)) continue;
		if (/^>\s/.test(line)) continue;

		const trimmed = line.trim();
		if (trimmed === "" && paragraphLines.length > 0) break;
		if (trimmed === "") continue;
		if (/^#{1,3}\s/.test(trimmed)) break;

		paragraphLines.push(trimmed);
	}

	const summary = paragraphLines.join(" ");
	return summary.length > 200 ? `${summary.slice(0, 200)}…` : summary;
}

function extractSwatches(markdown: string): string[] {
	const hexes: string[] = [];
	const hexRegex = /#[0-9a-fA-F]{6}\b/g;
	let match = hexRegex.exec(markdown);
	while (match !== null && hexes.length < 8) {
		if (!hexes.includes(match[0])) {
			hexes.push(match[0]);
		}
		match = hexRegex.exec(markdown);
	}
	return hexes;
}
