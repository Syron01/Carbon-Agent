import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { getEngineDir } from "../config.js";
import { AstGraphManager, type DependencyGraph, type ImpactNode } from "./codebase-index/graph-ast.js";

export const FORBIDDEN_MEMORY_PHRASES = [
	"I can see...",
	"I see...",
	"Looking at...",
	"I notice...",
	"I observe...",
	"I detect...",
	"According to...",
	"It shows...",
	"It indicates...",
	"...what I know about you",
	"...your information",
	"your memories",
	"your data",
	"your profile",
	"Based on your memories",
	"Based on my memories",
	"I remember...",
	"I recall...",
	"From memory...",
	"My memories show...",
	"In my memory...",
	"According to my knowledge...",
];

export const ALLOWED_MEMORY_PHRASES = [
	"As we discussed...",
	"In our past conversations...",
	"You mentioned...",
	"You've shared...",
];

export interface SemanticCacheEntry {
	promptHash: string;
	response: string;
	timestamp: number;
}

export interface KnowledgeGraphState {
	userPreferences: string[];
	projectState: string;
	recentDecisions: string[];
	userName?: string;
	expertiseLevel?: "beginner" | "intermediate" | "advanced" | "expert";
	communicationStyle?: string[];
	recentTopics?: string[];
}

export interface MerkleNode {
	name: string;
	type: "root" | "directory" | "file" | "class" | "function" | "interface";
	hash: string;
	children?: MerkleNode[];
	signature?: string;
}

export class HybridMemorySystem {
	private cacheDir: string;
	private stateFile: string;
	private cacheFile: string;
	private vectorFile: string;
	private memoryFile: string;
	private astManagerMap: Map<string, AstGraphManager> = new Map();

	constructor() {
		this.cacheDir = join(getEngineDir(), "hybrid_memory");
		this.stateFile = join(this.cacheDir, "knowledge_graph.json");
		this.cacheFile = join(this.cacheDir, "semantic_cache.json");
		this.vectorFile = join(this.cacheDir, "vector_history.json");
		this.memoryFile = join(this.cacheDir, "user_memories.json");

		if (!existsSync(this.cacheDir)) {
			mkdirSync(this.cacheDir, { recursive: true });
		}
	}

	public checkSemanticCache(prompt: string): string | null {
		if (!existsSync(this.cacheFile)) return null;
		try {
			const hash = createHash("sha256").update(prompt.trim().toLowerCase()).digest("hex");
			const cache: Record<string, SemanticCacheEntry> = JSON.parse(readFileSync(this.cacheFile, "utf-8"));
			if (cache[hash]) {
				return cache[hash].response;
			}
		} catch {}
		return null;
	}

	public updateSemanticCache(prompt: string, response: string): void {
		try {
			const hash = createHash("sha256").update(prompt.trim().toLowerCase()).digest("hex");
			const cache: Record<string, SemanticCacheEntry> = existsSync(this.cacheFile)
				? JSON.parse(readFileSync(this.cacheFile, "utf-8"))
				: {};
			cache[hash] = { promptHash: hash, response, timestamp: Date.now() };
			writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2), "utf-8");
		} catch {}
	}

	public loadKnowledgeGraph(): KnowledgeGraphState {
		if (existsSync(this.stateFile)) {
			try {
				return JSON.parse(readFileSync(this.stateFile, "utf-8"));
			} catch {}
		}
		return { userPreferences: [], projectState: "Initializing...", recentDecisions: [] };
	}

	public updateKnowledgeGraph(newState: Partial<KnowledgeGraphState>): void {
		const current = this.loadKnowledgeGraph();
		const merged = { ...current, ...newState };
		writeFileSync(this.stateFile, JSON.stringify(merged, null, 2), "utf-8");
	}

	public getUserMemories(): string[] {
		if (!existsSync(this.memoryFile)) return [];
		try {
			return JSON.parse(readFileSync(this.memoryFile, "utf-8"));
		} catch {
			return [];
		}
	}

	public saveUserMemory(memory: string): void {
		try {
			const memories = this.getUserMemories();
			if (!memories.includes(memory)) {
				memories.push(memory);
				writeFileSync(this.memoryFile, JSON.stringify(memories.slice(-50), null, 2), "utf-8");
			}
		} catch {}
	}

	public removeUserMemory(index: number): void {
		try {
			const memories = this.getUserMemories();
			if (index >= 0 && index < memories.length) {
				memories.splice(index, 1);
				writeFileSync(this.memoryFile, JSON.stringify(memories, null, 2), "utf-8");
			}
		} catch {}
	}

	public async searchVectorHistory(query: string): Promise<any[]> {
		if (!existsSync(this.vectorFile)) return [];
		try {
			const history: Array<{ prompt: string; response: string; tags: string[] }> = JSON.parse(
				readFileSync(this.vectorFile, "utf-8"),
			);
			const queryWords = query
				.toLowerCase()
				.split(/\s+/)
				.filter((w) => w.length > 2);
			const results = history
				.map((item) => {
					let score = 0;
					const text = `${item.prompt} ${item.response}`.toLowerCase();
					for (const word of queryWords) {
						if (text.includes(word)) score += 1;
					}
					return { item, score };
				})
				.filter((r) => r.score > 0);
			results.sort((a, b) => b.score - a.score);
			return results.slice(0, 3).map((r) => r.item);
		} catch {
			return [];
		}
	}

	public saveVectorHistory(prompt: string, response: string): void {
		try {
			const history = existsSync(this.vectorFile) ? JSON.parse(readFileSync(this.vectorFile, "utf-8")) : [];
			const words = prompt
				.toLowerCase()
				.split(/\s+/)
				.filter((w) => w.length > 3)
				.slice(0, 5);
			history.push({ prompt, response, tags: words });
			writeFileSync(this.vectorFile, JSON.stringify(history.slice(-100), null, 2), "utf-8");
		} catch {}
	}

	public buildCodebaseMerkleTree(cwd: string): MerkleNode {
		let fileCount = 0;
		const MAX_FILES = 1000;

		const buildNode = (currentPath: string): MerkleNode => {
			if (fileCount >= MAX_FILES) {
				return { name: basename(currentPath), type: "file", hash: "max_files_reached" };
			}

			const name = basename(currentPath);
			const stat = statSync(currentPath);
			if (stat.isDirectory()) {
				const children: MerkleNode[] = [];
				const items = readdirSync(currentPath);
				for (const item of items) {
					if (item === "node_modules" || item === ".git" || item === "dist" || item.startsWith(".")) continue;
					try {
						children.push(buildNode(join(currentPath, item)));
					} catch {}
				}
				const hasher = createHash("md5");
				for (const child of children) hasher.update(child.hash);
				return { name, type: "directory", hash: hasher.digest("hex").slice(0, 12), children };
			} else {
				fileCount++;
				if (fileCount >= MAX_FILES) return { name, type: "file", hash: "max_files_reached" };

				const content = readFileSync(currentPath, "utf-8");
				const fileHash = createHash("md5").update(content).digest("hex").slice(0, 12);
				const ext = extname(currentPath);
				const children: MerkleNode[] = [];
				if (ext === ".ts" || ext === ".js") {
					const classRegex = /class\s+(\w+)/g;
					for (const classMatch of content.matchAll(classRegex)) {
						const className = classMatch[1];
						children.push({
							name: className,
							type: "class",
							hash: createHash("md5").update(`class ${className}`).digest("hex").slice(0, 8),
							signature: `class ${className}`,
						});
					}
					const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
					for (const funcMatch of content.matchAll(funcRegex)) {
						const s = `function ${funcMatch[1]}(${funcMatch[2]})`;
						children.push({
							name: funcMatch[1],
							type: "function",
							hash: createHash("md5").update(s).digest("hex").slice(0, 8),
							signature: s,
						});
					}
				}
				return { name, type: "file", hash: fileHash, children: children.length > 0 ? children : undefined };
			}
		};
		return buildNode(cwd);
	}

	public getFractalTreeSummary(cwd: string): string {
		const tree = this.buildCodebaseMerkleTree(cwd);
		const lines: string[] = [];
		const formatNode = (node: MerkleNode, depth = 0) => {
			const indent = "  ".repeat(depth);
			if (node.type === "directory") {
				lines.push(`${indent}[${node.name}] h:${node.hash}`);
				if (node.children) for (const child of node.children) formatNode(child, depth + 1);
			} else if (node.type === "file") {
				lines.push(`${indent} ${node.name} h:${node.hash}`);
				if (node.children)
					for (const child of node.children) lines.push(`${indent}  ${child.signature} h:${child.hash}`);
			}
		};
		formatNode(tree);
		return lines.join("\n");
	}

	public getMemorySystemPrompt(): string {
		const memories = this.getUserMemories();
		const kg = this.loadKnowledgeGraph();
		const parts: string[] = [];
		if (kg.userName) parts.push(`Name: ${kg.userName}`);
		if (kg.expertiseLevel) parts.push(`Level: ${kg.expertiseLevel}`);
		if (kg.projectState && kg.projectState !== "Initializing...") parts.push(`Project: ${kg.projectState}`);
		if (memories.length > 0) parts.push(`Notes: ${memories.slice(-5).join("; ")}`);
		return parts.length > 0 ? parts.join("\n") : "";
	}

	public getAstManager(cwd: string): AstGraphManager {
		if (!this.astManagerMap.has(cwd)) {
			this.astManagerMap.set(cwd, new AstGraphManager(cwd));
		}
		return this.astManagerMap.get(cwd)!;
	}

	public getImpactAnalysis(cwd: string, targetFilePath: string, symbolName: string): ImpactNode[] {
		const manager = this.getAstManager(cwd);
		return manager.getImpactAnalysis(targetFilePath, symbolName);
	}

	public getHolisticMap(cwd: string): DependencyGraph {
		const manager = this.getAstManager(cwd);
		return manager.buildHolisticMap();
	}
}
