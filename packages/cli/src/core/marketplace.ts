// @ts-nocheck
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getEngineDir } from "../config.js";

export interface RegistryEntry {
	name: string;
	description?: string;
	type: "extension" | "skill" | "theme";
	source: string;
	version?: string;
	author?: string;
	tags?: string[];
}

const DEFAULT_REGISTRY_URL =
	process.env.ASTRO_MARKETPLACE_REGISTRY ||
	"https://raw.githubusercontent.com/theayzek01/Astro-Agent-registry/main/registry.json";
const CACHE_TTL_MS = 60 * 60 * 1000;

function cachePath(): string {
	const dir = join(getEngineDir(), "marketplace");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	return join(dir, "registry.json");
}

function normalizeRegistry(value: any): RegistryEntry[] {
	const list = Array.isArray(value) ? value : Array.isArray(value?.entries) ? value.entries : [];
	return list
		.filter((e) => e?.name && e?.source)
		.map((e) => ({
			name: String(e.name),
			description: e.description ? String(e.description) : undefined,
			type: e.type === "skill" || e.type === "theme" ? e.type : "extension",
			source: String(e.source),
			version: e.version ? String(e.version) : undefined,
			author: e.author ? String(e.author) : undefined,
			tags: Array.isArray(e.tags) ? e.tags.map(String) : [],
		}));
}

export async function fetchRegistry(options: { force?: boolean } = {}): Promise<RegistryEntry[]> {
	const file = cachePath();
	if (!options.force && existsSync(file)) {
		try {
			const cached = JSON.parse(readFileSync(file, "utf-8"));
			if (Date.now() - cached.timestamp < CACHE_TTL_MS) return normalizeRegistry(cached.entries);
		} catch {}
	}
	const response = await fetch(DEFAULT_REGISTRY_URL, { headers: { Accept: "application/json" } });
	if (!response.ok) throw new Error(`Could not fetch registry: ${response.status} ${response.statusText}`);
	const entries = normalizeRegistry(await response.json());
	writeFileSync(file, JSON.stringify({ timestamp: Date.now(), entries }, null, 2));
	return entries;
}

export function searchRegistry(entries: RegistryEntry[], query = ""): RegistryEntry[] {
	const q = query.trim().toLowerCase();
	if (!q) return entries;
	return entries.filter((e) =>
		[e.name, e.description, e.author, ...(e.tags ?? [])].filter(Boolean).join(" ").toLowerCase().includes(q),
	);
}

export async function installMarketplaceEntry(
	packageManager: any,
	entry: RegistryEntry,
	options: { local?: boolean } = {},
): Promise<void> {
	if (!packageManager?.installAndPersist) throw new Error("Package manager is not ready.");
	await packageManager.installAndPersist(entry.source, { local: options.local });
}

export function formatRegistryEntries(entries: RegistryEntry[], limit = 20): string {
	if (entries.length === 0) return "No marketplace results.";
	return entries
		.slice(0, limit)
		.map(
			(e) =>
				`${e.name} [${e.type}]${e.version ? `@${e.version}` : ""}\n  ${e.description || "No description"}\n  source: ${e.source}`,
		)
		.join("\n\n");
}
