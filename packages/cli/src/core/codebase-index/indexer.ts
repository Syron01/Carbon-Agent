import { createHash } from "node:crypto";
import type { Stats } from "node:fs";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { pipeline } from "@xenova/transformers";
import * as ts from "typescript";
import { getEngineDir } from "../../config.js";

const CODE_EXTENSIONS = new Set([
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
	".py",
	".rb",
	".go",
	".rs",
	".java",
	".kt",
	".swift",
	".c",
	".cpp",
	".h",
	".hpp",
	".cs",
	".vue",
	".svelte",
	".astro",
	".json",
	".yaml",
	".yml",
	".toml",
	".md",
	".mdx",
	".css",
	".scss",
	".less",
	".sh",
	".bash",
	".zsh",
	".sql",
	".graphql",
	".gql",
	".html",
	".xml",
	".dockerfile",
	".env",
]);

const IGNORE_DIRS = new Set([
	"node_modules",
	".git",
	"dist",
	"build",
	"out",
	".next",
	"coverage",
	".nyc_output",
	"__pycache__",
	".venv",
	"venv",
	".cache",
	".turbo",
	".vercel",
	".output",
	"vendor",
	"target",
	"bin",
	"obj",
]);

const IGNORE_FILES = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml", ".DS_Store", "thumbs.db"]);
const CHUNK_SIZE = 50;
const CHUNK_OVERLAP = 5;
const MAX_FILE_SIZE = 512 * 1024;
const MAX_FILES = 8000;
const SCHEMA_VERSION = 3;

let _embedder: any = null;
async function getEmbedder() {
	if (!_embedder) {
		_embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
	}
	return _embedder;
}

export async function embedText(text: string): Promise<number[]> {
	try {
		const embedder = await getEmbedder();
		const output = await embedder(text, { pooling: "mean", normalize: true });
		return Array.from(output.data);
	} catch (_e) {
		return [];
	}
}

export interface CodeChunk {
	filePath: string;
	startLine: number;
	endLine: number;
	symbols: string[];
	tf: Record<string, number>;
	termCount: number;
	embedding?: number[];
}

export interface DependencyEdge {
	from: string;
	to: string;
	type: "import" | "require" | "dynamic-import";
}

export interface CodebaseIndex {
	schemaVersion: number;
	projectHash: string;
	timestamp: number;
	fileCount: number;
	chunkCount: number;
	chunks: CodeChunk[];
	dependencyEdges: DependencyEdge[];
	fileTimestamps: Record<string, number>;
	idf: Record<string, number>;
	avgTermCount: number;
}

const STOP_WORDS = new Set([
	"the",
	"a",
	"an",
	"is",
	"it",
	"in",
	"of",
	"to",
	"and",
	"or",
	"for",
	"if",
	"be",
	"as",
	"at",
	"by",
	"do",
	"go",
	"no",
	"on",
	"so",
	"up",
	"we",
	"he",
	"she",
	"they",
	"from",
	"with",
	"this",
	"that",
	"not",
	"are",
	"was",
	"but",
	"have",
	"had",
	"has",
	"can",
	"will",
	"var",
	"let",
	"const",
	"return",
	"true",
	"false",
	"null",
	"undefined",
]);

export function tokenize(text: string): string[] {
	const raw = text
		.toLowerCase()
		.replace(/[^a-z0-9_]/g, " ")
		.split(/\s+/)
		.filter((token) => token.length > 1 && !STOP_WORDS.has(token));

	const expanded: string[] = [];
	for (const token of raw) {
		expanded.push(token);
		const camel = token
			.replace(/([a-z])([A-Z])/g, "$1 $2")
			.toLowerCase()
			.split(" ");
		if (camel.length > 1) expanded.push(...camel);
		const snake = token.split("_").filter(Boolean);
		if (snake.length > 1) expanded.push(...snake);
	}
	return [...new Set(expanded)].filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function buildTF(tokens: string[]): { tf: Record<string, number>; termCount: number } {
	const tf: Record<string, number> = {};
	for (const token of tokens) tf[token] = (tf[token] ?? 0) + 1;
	return { tf, termCount: tokens.length };
}

function loadGitignorePatterns(cwd: string): string[] {
	const path = join(cwd, ".gitignore");
	if (!existsSync(path)) return [];
	try {
		return readFileSync(path, "utf-8")
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"));
	} catch {
		return [];
	}
}

function shouldIgnorePath(relativePath: string, patterns: string[]): boolean {
	const parts = relativePath.split(/[/\\]/);
	for (const part of parts) {
		if (IGNORE_DIRS.has(part)) return true;
	}
	const fileName = basename(relativePath);
	if (IGNORE_FILES.has(fileName)) return true;
	if (fileName.startsWith(".")) return true;
	for (const pattern of patterns) {
		const clean = pattern.replace(/\/$/, "");
		if (parts.includes(clean)) return true;
		if (fileName === clean) return true;
	}
	return false;
}

function collectFiles(cwd: string, patterns: string[]): string[] {
	const files: string[] = [];

	function walk(dir: string): void {
		if (files.length >= MAX_FILES) return;
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			return;
		}

		for (const entry of entries) {
			if (files.length >= MAX_FILES) return;
			const fullPath = join(dir, entry);
			const relPath = relative(cwd, fullPath);
			if (shouldIgnorePath(relPath, patterns)) continue;

			let stat: Stats | undefined;
			try {
				stat = statSync(fullPath);
			} catch {
				continue;
			}

			if (stat.isDirectory()) {
				walk(fullPath);
				continue;
			}

			if (!stat.isFile() || stat.size > MAX_FILE_SIZE) continue;
			const ext = extname(entry).toLowerCase();
			if (!ext && !["dockerfile", "makefile", "rakefile", "gemfile"].includes(entry.toLowerCase())) continue;
			if (ext && !CODE_EXTENSIONS.has(ext)) continue;
			files.push(fullPath);
		}
	}

	walk(cwd);
	return files;
}

function addUnique(list: string[], seen: Set<string>, value: string | undefined): void {
	if (!value) return;
	const trimmed = value.trim();
	if (!trimmed || seen.has(trimmed)) return;
	seen.add(trimmed);
	list.push(trimmed);
}

function extractTypeScriptFacts(
	content: string,
	filePath: string,
): { symbols: string[]; dependencies: DependencyEdge[] } {
	const symbols: string[] = [];
	const seen = new Set<string>();
	const dependencies: DependencyEdge[] = [];
	const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

	const visit = (node: ts.Node): void => {
		if (
			ts.isFunctionDeclaration(node) ||
			ts.isClassDeclaration(node) ||
			ts.isInterfaceDeclaration(node) ||
			ts.isTypeAliasDeclaration(node)
		) {
			addUnique(symbols, seen, node.name?.text);
		} else if (ts.isEnumDeclaration(node)) {
			addUnique(symbols, seen, node.name.text);
		} else if (ts.isVariableStatement(node)) {
			for (const decl of node.declarationList.declarations) {
				if (ts.isIdentifier(decl.name)) addUnique(symbols, seen, decl.name.text);
			}
		} else if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
			if (node.name && ts.isIdentifier(node.name)) addUnique(symbols, seen, node.name.text);
		} else if (ts.isImportDeclaration(node)) {
			if (ts.isStringLiteral(node.moduleSpecifier)) {
				dependencies.push({ from: filePath, to: node.moduleSpecifier.text, type: "import" });
			}
			const clause = node.importClause;
			if (clause?.name) addUnique(symbols, seen, clause.name.text);
			if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
				for (const element of clause.namedBindings.elements) {
					addUnique(symbols, seen, element.name.text);
				}
			}
		} else if (ts.isCallExpression(node)) {
			const callee = node.expression.getText(sourceFile);
			const arg = node.arguments[0];
			if (callee === "require" && arg && ts.isStringLiteral(arg)) {
				dependencies.push({ from: filePath, to: arg.text, type: "require" });
			}
		}

		if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
			const arg = node.arguments[0];
			if (arg && ts.isStringLiteral(arg)) {
				dependencies.push({ from: filePath, to: arg.text, type: "dynamic-import" });
			}
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	return { symbols, dependencies };
}

function extractFallbackSymbols(content: string, ext: string): string[] {
	const symbols: string[] = [];
	const lines = content.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();
		if (ext === ".py") {
			const fnMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)/);
			if (fnMatch) symbols.push(fnMatch[1]);
			const classMatch = trimmed.match(/^class\s+(\w+)/);
			if (classMatch) symbols.push(classMatch[1]);
		} else if (ext === ".go") {
			const fnMatch = trimmed.match(/^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/);
			if (fnMatch) symbols.push(fnMatch[1]);
			const typeMatch = trimmed.match(/^type\s+(\w+)/);
			if (typeMatch) symbols.push(typeMatch[1]);
		} else if (ext === ".rs") {
			const fnMatch = trimmed.match(/^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/);
			if (fnMatch) symbols.push(fnMatch[1]);
			const structMatch = trimmed.match(/^(?:pub\s+)?struct\s+(\w+)/);
			if (structMatch) symbols.push(structMatch[1]);
		}
	}

	return [...new Set(symbols)];
}

function extractSymbolsAndDependencies(
	content: string,
	filePath: string,
): { symbols: string[]; dependencies: DependencyEdge[] } {
	const ext = extname(filePath).toLowerCase();
	if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro"].includes(ext)) {
		const facts = extractTypeScriptFacts(content, filePath);
		return {
			symbols: [...new Set([...facts.symbols, ...extractFallbackSymbols(content, ext)])],
			dependencies: facts.dependencies,
		};
	}
	return { symbols: extractFallbackSymbols(content, ext), dependencies: [] };
}

function chunkFile(filePath: string, cwd: string): { chunks: CodeChunk[]; dependencies: DependencyEdge[] } {
	let content: string;
	try {
		content = readFileSync(filePath, "utf-8");
	} catch {
		return { chunks: [], dependencies: [] };
	}

	const lines = content.split("\n");
	if (lines.length === 0) return { chunks: [], dependencies: [] };

	const relPath = relative(cwd, filePath).replace(/\\/g, "/");
	const _ext = extname(filePath).toLowerCase();
	const facts = extractSymbolsAndDependencies(content, filePath);
	const chunks: CodeChunk[] = [];

	const makeChunk = (start: number, end: number): CodeChunk => {
		const chunkText = lines.slice(start, end).join("\n");
		const chunkTokens = tokenize(chunkText);
		for (const symbol of facts.symbols) chunkTokens.push(symbol.toLowerCase());
		const imports = facts.dependencies.map((edge) => edge.to.toLowerCase().replace(/[^a-z0-9_]/g, " "));
		for (const dep of imports) chunkTokens.push(...tokenize(dep));
		const { tf, termCount } = buildTF(chunkTokens);
		return { filePath: relPath, startLine: start + 1, endLine: end, symbols: facts.symbols, tf, termCount };
	};

	if (lines.length <= CHUNK_SIZE * 1.5) {
		chunks.push(makeChunk(0, lines.length));
		return { chunks, dependencies: facts.dependencies };
	}

	for (let i = 0; i < lines.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
		const start = i;
		const end = Math.min(i + CHUNK_SIZE, lines.length);
		chunks.push(makeChunk(start, end));
		if (end >= lines.length) break;
	}

	return { chunks, dependencies: facts.dependencies };
}

function buildIDF(chunks: CodeChunk[]): Record<string, number> {
	const total = chunks.length;
	const documentFrequency: Record<string, number> = {};
	for (const chunk of chunks) {
		for (const term of Object.keys(chunk.tf)) {
			documentFrequency[term] = (documentFrequency[term] ?? 0) + 1;
		}
	}

	const idf: Record<string, number> = {};
	for (const [term, frequency] of Object.entries(documentFrequency)) {
		idf[term] = Math.log((total - frequency + 0.5) / (frequency + 0.5) + 1);
	}
	return idf;
}

function getProjectHash(cwd: string): string {
	return createHash("md5").update(resolve(cwd)).digest("hex").slice(0, 12);
}

function getIndexPath(cwd: string): string {
	const indexDir = join(getEngineDir(), "codebase-index");
	if (!existsSync(indexDir)) mkdirSync(indexDir, { recursive: true });
	return join(indexDir, `${getProjectHash(cwd)}.json`);
}

export function loadCachedIndex(cwd: string): CodebaseIndex | null {
	const indexPath = getIndexPath(cwd);
	if (!existsSync(indexPath)) return null;
	try {
		return JSON.parse(readFileSync(indexPath, "utf-8")) as CodebaseIndex;
	} catch {
		return null;
	}
}

export async function buildIndex(cwd: string, force = false): Promise<CodebaseIndex> {
	const patterns = loadGitignorePatterns(cwd);
	const files = collectFiles(cwd, patterns);
	const projectHash = getProjectHash(cwd);
	const cached = force ? null : loadCachedIndex(cwd);
	const cachedTimestamps = cached?.fileTimestamps ?? {};
	const cachedChunksByFile = new Map<string, CodeChunk[]>();
	const dependencyEdges: DependencyEdge[] = [];

	if (cached) {
		for (const chunk of cached.chunks) {
			const list = cachedChunksByFile.get(chunk.filePath) ?? [];
			list.push(chunk);
			cachedChunksByFile.set(chunk.filePath, list);
		}
	}

	const newTimestamps: Record<string, number> = {};
	const chunks: CodeChunk[] = [];

	for (const file of files) {
		const relPath = relative(cwd, file).replace(/\\/g, "/");
		let mtimeMs = 0;
		try {
			mtimeMs = statSync(file).mtimeMs;
		} catch {
			continue;
		}
		newTimestamps[relPath] = mtimeMs;

		if (!force && cachedTimestamps[relPath] === mtimeMs && cachedChunksByFile.has(relPath)) {
			chunks.push(...(cachedChunksByFile.get(relPath) ?? []));
			continue;
		}

		const result = chunkFile(file, cwd);

		// Generate embeddings for new chunks
		for (const chunk of result.chunks) {
			const chunkTextForEmbed = Array.from(new Set([...chunk.symbols, ...Object.keys(chunk.tf)])).join(" ");
			if (chunkTextForEmbed.length > 5) {
				chunk.embedding = await embedText(chunkTextForEmbed);
			}
		}

		chunks.push(...result.chunks);
		dependencyEdges.push(...result.dependencies);
	}

	const idf = buildIDF(chunks);
	const avgTermCount = chunks.length > 0 ? chunks.reduce((sum, chunk) => sum + chunk.termCount, 0) / chunks.length : 1;

	const index: CodebaseIndex = {
		schemaVersion: SCHEMA_VERSION,
		projectHash,
		timestamp: Date.now(),
		fileCount: files.length,
		chunkCount: chunks.length,
		chunks,
		dependencyEdges,
		fileTimestamps: newTimestamps,
		idf,
		avgTermCount,
	};

	try {
		writeFileSync(getIndexPath(cwd), JSON.stringify(index), "utf-8");
	} catch {
		// best-effort cache
	}

	return index;
}

export function getIndexStats(
	cwd: string,
): { indexed: boolean; fileCount: number; chunkCount: number; ageMs: number; schemaVersion?: number } | null {
	const cached = loadCachedIndex(cwd);
	if (!cached) return null;
	return {
		indexed: true,
		fileCount: cached.fileCount,
		chunkCount: cached.chunkCount,
		ageMs: Date.now() - cached.timestamp,
		schemaVersion: cached.schemaVersion,
	};
}
