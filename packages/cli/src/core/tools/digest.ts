// @ts-nocheck
/**
 * digest — Ultra-compact file overview.
 *
 * Returns a token-efficient summary of a file: first N lines + structural
 * signatures (function/class/interface/enum/type definitions).
 * Use this INSTEAD of `read` when you just need to understand a file's shape.
 */
import { readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import type { EngineTool } from "astro-engine";
import { type Static, Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { resolveToCwd } from "./path-utils.js";
import { getTextOutput } from "./render-utils.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const digestSchema = Type.Object({
	path: Type.String({ description: "Path to the file to digest" }),
	headLines: Type.Optional(Type.Number({ description: "Lines from file head to include (0 = none, default: 20)" })),
	tailLines: Type.Optional(Type.Number({ description: "Lines from file tail to include (0 = none, default: 0)" })),
});

export type DigestToolInput = Static<typeof digestSchema>;

export interface DigestToolDetails {
	filePath: string;
	totalLines: number;
	signatures: string[];
}

const STRUCTURAL_PATTERNS = [
	/^(?:export\s+)?(?:async\s+)?function\s+\w+/,
	/^(?:export\s+)?(?:abstract\s+)?class\s+\w+/,
	/^(?:export\s+)?interface\s+\w+/,
	/^(?:export\s+)?type\s+\w+\s*=/,
	/^(?:export\s+)?enum\s+\w+/,
	/^(?:export\s+)?const\s+\w+\s*[:=]/,
	/^(?:export\s+)?let\s+\w+\s*[:=]/,
	/^(?:export\s+)?default\s+(?:function|class)/,
	/^(?:export\s+)?module\s+\w+/,
	/^(?:export\s+)?namespace\s+\w+/,
	/^def\s+\w+/,
	/^class\s+\w+/,
	/^async\s+def\s+\w+/,
];

function extractSignatures(content: string): string[] {
	const sigs: string[] = [];
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		for (const pattern of STRUCTURAL_PATTERNS) {
			if (pattern.test(trimmed)) {
				sigs.push(trimmed);
				break;
			}
		}
	}
	// Deduplicate and sort
	return [...new Set(sigs)].sort();
}

export interface DigestOperations {
	isFile: (absolutePath: string) => boolean;
	readFile: (absolutePath: string) => string;
}

const defaultDigestOperations: DigestOperations = {
	isFile: (p) => statSync(p).isFile(),
	readFile: (p) => readFileSync(p, "utf-8"),
};

export function createDigestToolDefinition(
	cwd: string,
	operations?: DigestOperations,
): ToolDefinition<DigestToolInput, DigestToolDetails> {
	const ops = operations ?? defaultDigestOperations;

	const definition: ToolDefinition<DigestToolInput, DigestToolDetails> = {
		name: "digest",
		label: "digest",
		description:
			"Read a compact overview of a file: first N lines + structural signatures. MUCH cheaper than `read`. Use this first to understand file shape, then `read` specific sections.",
		parameters: digestSchema,
		promptSnippet: "digest: compact file overview (head+signatures), cheaper than read",
		promptGuidelines: [
			"Prefer `digest` over `read` when exploring unfamiliar files — it returns structure (function/class/type signatures) at a fraction of the token cost.",
		],
		execute: async (_toolCallId, input, _signal, _onUpdate, _context) => {
			const absPath = resolveToCwd(input.path, cwd);
			if (!ops.isFile(absPath)) {
				return { content: [{ type: "text", text: `[digest] Not a file: ${input.path}` }] };
			}

			const content = ops.readFile(absPath);
			const lines = content.split("\n");
			const totalLines = lines.length;

			const head = input.headLines ?? 20;
			const tail = input.tailLines ?? 0;

			const parts: string[] = [];
			const ext = extname(absPath).toLowerCase();

			// Head
			if (head > 0) {
				const headContent = lines.slice(0, Math.min(head, lines.length)).join("\n");
				parts.push(`[head ${Math.min(head, lines.length)}/${totalLines}L]`);
				parts.push(headContent);
			}

			// Tail (most recent content — important for logs, configs)
			if (tail > 0 && tail < totalLines) {
				const tailContent = lines.slice(-tail).join("\n");
				parts.push(`[tail ${Math.min(tail, totalLines)}/${totalLines}L]`);
				parts.push(tailContent);
			} else if (tail > 0) {
				parts.push(`[tail: file has only ${totalLines} lines, already shown in head]`);
			}

			// Structural signatures (only for code files)
			const codeExts = new Set([
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
				".cpp",
				".c",
				".h",
				".hpp",
				".cs",
				".php",
				".vue",
				".svelte",
			]);
			if (codeExts.has(ext)) {
				const sigs = extractSignatures(content);
				if (sigs.length > 0) {
					parts.push(`[signatures ${sigs.length}]`);
					parts.push(sigs.join("\n"));
				} else {
					parts.push("[no structural signatures found]");
				}
			} else {
				parts.push(`[${ext} file — no signature extraction]`);
			}

			const text = parts.join("\n");

			return {
				content: [{ type: "text", text }],
				details: {
					filePath: absPath,
					totalLines,
					signatures: extractSignatures(content),
				},
			};
		},
		render: (content, details, options) => {
			const text = getTextOutput(content);
			const fileName = basename(details?.filePath ?? input?.path ?? "file");
			const lines = details?.totalLines ?? 0;
			const sigCount = details?.signatures?.length ?? 0;
			const header = `${fileName} (${lines}L, ${sigCount} sigs)`;
			return {
				header,
				body: options?.simplified ? text : undefined,
			};
		},
	};

	return definition;
}

export function createDigestTool(cwd: string, operations?: DigestOperations): EngineTool<DigestToolInput> {
	return wrapToolDefinition(createDigestToolDefinition(cwd, operations));
}
