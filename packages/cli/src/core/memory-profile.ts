import { VectorDB, type VectorDocument } from "astro-core";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { CONFIG_DIR_NAME } from "../config.js";

export interface DeveloperProfile {
	syntaxPreferences: string[];
	forbiddenPatterns: string[];
	architecturalStyle: string;
	customRules: string[];
}

/**
 * Optional local profile storage for explicit coding preferences.
 * Disabled by default at the session layer; kept only for callers that opt in.
 */
export class MemoryProfile {
	private profilePath: string;
	private profile: DeveloperProfile;
	private vectorDb: VectorDB;

	constructor(engineDir: string, cwd?: string) {
		if (cwd) {
			this.profilePath = join(cwd, CONFIG_DIR_NAME, "developer-profile.json");
		} else {
			this.profilePath = join(engineDir, "developer-profile.json");
		}
		this.profile = this.loadProfile();
		this.vectorDb = new VectorDB();
	}

	private loadProfile(): DeveloperProfile {
		if (!existsSync(this.profilePath)) {
			return {
				syntaxPreferences: [],
				forbiddenPatterns: [],
				architecturalStyle: "Standard",
				customRules: [],
			};
		}
		try {
			return JSON.parse(readFileSync(this.profilePath, "utf-8"));
		} catch {
			return {
				syntaxPreferences: [],
				forbiddenPatterns: [],
				architecturalStyle: "Standard",
				customRules: [],
			};
		}
	}

	private saveProfile() {
		if (!existsSync(dirname(this.profilePath))) {
			mkdirSync(dirname(this.profilePath), { recursive: true });
		}
		writeFileSync(this.profilePath, JSON.stringify(this.profile, null, 2), "utf-8");
	}

	public addRule(category: keyof DeveloperProfile, rule: string) {
		if (Array.isArray(this.profile[category])) {
			if (!(this.profile[category] as string[]).includes(rule)) {
				(this.profile[category] as string[]).push(rule);
				this.saveProfile();
			}
		} else if (category === "architecturalStyle") {
			this.profile.architecturalStyle = rule;
			this.saveProfile();
		}
	}

	/**
	 * Ingest a file or text chunk into the RAG vector database.
	 */
	public ingestFile(id: string, content: string, metadata?: Record<string, any>) {
		this.vectorDb.addDocument({
			id,
			content,
			metadata,
		});
	}

	/**
	 * Search the RAG vector database for context relevant to a query.
	 */
	public searchContext(query: string, limit = 3): VectorDocument[] {
		return this.vectorDb.search(query, limit);
	}

	/**
	 * Analyze project files and learn coding style dynamically.
	 * (In a real scenario, this would call a cheap LLM to extract JSON rules).
	 */
	public async learnFromProject(files: { path: string; content: string }[]) {
		for (const file of files) {
			// Security: Prevent path traversal or scanning outside project
			if (
				file.path.includes("..") ||
				file.path.includes("node_modules") ||
				file.path.includes(".git") ||
				file.path.includes("dist")
			) {
				continue;
			}

			// Syntax Patterns
			if (file.content.includes("=>")) {
				this.addRule("syntaxPreferences", "Use arrow functions for callbacks.");
			}
			if (file.content.includes("interface ")) {
				this.addRule("syntaxPreferences", "Prefer interfaces over type aliases for objects.");
			}
			if (file.content.includes(" async ")) {
				this.addRule("syntaxPreferences", "Prefer async/await over raw Promises.");
			}
			if (file.content.includes("const ") && !file.content.includes("var ")) {
				this.addRule("syntaxPreferences", "Use const/let exclusively (avoid var).");
			}

			// Architectural Hints
			if (file.path.includes("controller") || file.path.includes("service")) {
				this.addRule("architecturalStyle", "Controller/Service Pattern");
			}
		}
	}

	/**
	 * Builds an opt-in prompt section for explicit coding preferences.
	 */
	public getPromptInjection(): string {
		let injection = `Astro-Agent developer profile:\n`;
		injection += `Use only the explicit preferences below.\n\n`;

		if (this.profile.forbiddenPatterns.length > 0) {
			injection += `NEVER USE THESE PATTERNS:\n`;
			for (const p of this.profile.forbiddenPatterns) {
				injection += `- ${p}\n`;
			}
			injection += `\n`;
		}

		if (this.profile.syntaxPreferences.length > 0) {
			injection += `SYNTAX PREFERENCES:\n`;
			for (const p of this.profile.syntaxPreferences) {
				injection += `- ${p}\n`;
			}
			injection += `\n`;
		}

		if (this.profile.customRules.length > 0) {
			injection += `CUSTOM RULES:\n`;
			for (const p of this.profile.customRules) {
				injection += `- ${p}\n`;
			}
			injection += `\n`;
		}

		injection += `Architectural Style: ${this.profile.architecturalStyle}\n`;
		return injection;
	}
}
