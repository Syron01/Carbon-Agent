export interface TokenOptimizeResult {
	optimizedText: string;
	wasOptimized: boolean;
	reductionChars: number;
}

export interface PromptCapsuleResult extends TokenOptimizeResult {
	capsuleApplied: boolean;
}

// ── Regexes (static, no global lastIndex risk) ────────────────────────────────
const ANSI_ESCAPE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const OSC_ESCAPE = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const HTML_COMMENTS = /<!--[\s\S]*?-->/g;
const TRAILING_WHITESPACE = /[ \t]+$/gm;
const REPEATED_WHITESPACE = /[ \t]{3,}/g;
const REPEATED_BLANK_LINES = /\n{3,}/g;
const REDUNDANT_PUNCTUATION = /([.!?]){3,}/g;
const STACK_TRACE_LINE = /^\s*at\s+.+(?:\(|file:|[A-Za-z]:\\|\/).*/;
const JSONISH_BLOCK = /^\s*[[{][\s\S]*[\]}]\s*$/;

// Long timestamp/date noise common in log files
const LOG_TIMESTAMP = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g;

const REPEATED_LOG_LINE_THRESHOLD = 2;
const CAPSULE_MIN_CHARS = 2_000;
const CAPSULE_MAX_RAW_CHARS = 1_000;
const CAPSULE_MAX_LINES = 15;

// ── Tool block trimming ────────────────────────────────────────────────────────
function trimLongToolBlock(block: string): string {
	const lines = block.split("\n");
	if (lines.length <= 24) return block;
	const HEAD = 12;
	const TAIL = 6;
	const trimmed = lines.length - HEAD - TAIL;
	return `${lines.slice(0, HEAD).join("\n")}\n...[${trimmed}L]...\n${lines.slice(-TAIL).join("\n")}`;
}

// ── Stack trace trimming ───────────────────────────────────────────────────────
function trimStackTraces(text: string, maxFrames = 2): string {
	const lines = text.split("\n");
	let frames = 0;
	return lines
		.filter((line) => {
			if (!STACK_TRACE_LINE.test(line)) {
				frames = 0;
				return true;
			}
			return ++frames <= maxFrames;
		})
		.join("\n");
}

// ── JSON compaction ────────────────────────────────────────────────────────────
function compactJsonish(text: string): string {
	if (!JSONISH_BLOCK.test(text) || text.length > 200_000) return text;
	try {
		return JSON.stringify(JSON.parse(text));
	} catch {
		return text;
	}
}

// ── Long line trimming ─────────────────────────────────────────────────────────
function trimLongLines(text: string, maxLen = 300): string {
	return text
		.split("\n")
		.map((line) => {
			if (line.length <= maxLen) return line;
			return `${line.slice(0, maxLen)}…[+${line.length - maxLen}]`;
		})
		.join("\n");
}

// ── Comment stripping from code fences ────────────────────────────────────────
function stripCommentsFromCodeBlock(code: string, lang: string): string {
	const l = (lang || "").toLowerCase().trim();
	if (!l) return code;
	if (["json", "jsonish"].includes(l)) {
		return code.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
	}
	if (["js", "javascript", "ts", "typescript", "tsx", "jsx", "go", "java", "c", "cpp", "cs", "css"].includes(l)) {
		return code
			.replace(/([^:]|^)\/\/.*$/gm, "$1") // single-line
			.replace(/\/\*[\s\S]*?\*\//g, ""); // block
	}
	if (["py", "python", "sh", "bash", "shell", "yaml", "yml", "rb", "ruby"].includes(l)) {
		return code.replace(/(^|\s)#.*$/gm, "$1");
	}
	if (["html", "xml", "xhtml", "svg"].includes(l)) {
		return code.replace(/<!--[\s\S]*?-->/g, "");
	}
	if (["sql"].includes(l)) {
		return code.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
	}
	return code;
}

// ── Strip dead/empty lines left after comment removal ─────────────────────────
function collapseEmptyLines(code: string): string {
	return code.replace(/\n{3,}/g, "\n\n").trim();
}

// ── Deduplicate repeated log lines ────────────────────────────────────────────
function deduplicateLogLines(text: string): string {
	const lines = text.split("\n");
	if (lines.length < REPEATED_LOG_LINE_THRESHOLD * 2) return text;

	const result: string[] = [];
	let prevPattern = "";
	let repeatCount = 0;
	let firstLine = "";
	let lastLine = "";

	const normalize = (line: string) =>
		line
			.replace(/\d{2,}/g, "N")
			.replace(/[0-9a-f]{8,}/gi, "H")
			.replace(LOG_TIMESTAMP, "TS")
			.trim();

	for (const line of lines) {
		const pattern = normalize(line);
		if (pattern === prevPattern && pattern.length > 4) {
			// was 5
			repeatCount++;
			lastLine = line;
		} else {
			if (repeatCount >= REPEATED_LOG_LINE_THRESHOLD) {
				result.push(firstLine);
				result.push(`  ...[${repeatCount - 1} similar]...`);
				if (lastLine !== firstLine) result.push(lastLine);
			} else {
				for (let i = 0; i < repeatCount; i++) result.push(lastLine || firstLine);
			}
			prevPattern = pattern;
			repeatCount = 1;
			firstLine = line;
			lastLine = line;
		}
	}

	if (repeatCount >= REPEATED_LOG_LINE_THRESHOLD) {
		result.push(firstLine);
		result.push(`  ...[${repeatCount - 1} similar]...`);
		if (lastLine !== firstLine) result.push(lastLine);
	} else {
		for (let i = 0; i < repeatCount; i++) result.push(lastLine || firstLine);
	}

	return result.join("\n");
}

// ─── Ξ-BRIDGE COGNITIVE VECTOR COMPRESSION ENGINE (RAZOR) ────────────────────
export function compressCognitiveVector(text: string): string {
	if (!text) return text;
	let compressed = text;

	// 1. Remove verbose common phrases & convert to high-density semantic representations
	const contractions: [RegExp, string][] = [
		[
			/\b(please |could you |would you mind |can you |help me to |i want to |i need to |please help me write |write a function that|lütfen |yapabilir misin |yardımcı olur musun |istiyorum |gerekiyor)\b/gi,
			"",
		],
		[
			/\b(make sure that |make sure to |ensure that |be careful to |keep in mind that|emin ol |dikkat et |unutma)\b/gi,
			"ensure:",
		],
		[/\b(for example|such as|like|örneğin|mesela|gibi)\b/gi, "e.g."],
		[/\b(in order to|so that we can|amacıyla|için)\b/gi, "to"],
		[/\b(as soon as possible|at your earliest convenience|en kısa sürede|hemen)\b/gi, "ASAP"],
		[/\b(in the case of|in terms of|with respect to|durumunda|açısından)\b/gi, "re:"],
		[/\b(is responsible for|has the responsibility of|sorumludur|sorumlu)\b/gi, "handles"],
		[/\b(utilize|utilizing|use of|make use of|kullan|kullanarak|kullanımı)\b/gi, "use"],
		[/\b(implement|implementation of|create|creating|oluştur|yarat|uygula)\b/gi, "build"],
	];

	for (const [pattern, repl] of contractions) {
		compressed = compressed.replace(pattern, repl);
	}

	// 2. Aggressive terminal output/log compression: keep only errors, warnings, stack traces, and commands
	const lines = compressed.split("\n");
	if (lines.length > 30) {
		let isLogOrOutput = false;
		let logLineCount = 0;
		for (const line of lines) {
			if (
				line.includes("[info]") ||
				line.includes("DEBUG") ||
				line.includes("INFO") ||
				/^\d{4}-\d{2}-\d{2}/.test(line)
			) {
				logLineCount++;
			}
		}
		if (logLineCount > lines.length * 0.3) {
			isLogOrOutput = true;
		}

		if (isLogOrOutput) {
			const preservedLines: string[] = [];
			let skipActive = false;
			let skippedCount = 0;

			for (const line of lines) {
				const isVital =
					/\b(error|failed|failure|exception|warn|warning|fatal|exit code|stderr|assert|expect|received|invalid|invalid_argument|unauthorized|critical|npm ERR|denied)\b/i.test(
						line,
					) ||
					STACK_TRACE_LINE.test(line) ||
					/^(?:[$>]\s*)?(?:npm|pnpm|yarn|bun|node|python|pytest|vitest|cargo|go|git|rg|grep|tsc|eslint)(?:\s|$)/i.test(
						line.trim(),
					);

				if (isVital) {
					if (skipActive && skippedCount > 0) {
						preservedLines.push(`  ...[compressed ${skippedCount} lines of verbose logs]...`);
						skipActive = false;
						skippedCount = 0;
					}
					preservedLines.push(line);
				} else {
					skipActive = true;
					skippedCount++;
				}
			}
			if (skipActive && skippedCount > 0) {
				preservedLines.push(`  ...[compressed ${skippedCount} lines of verbose logs]...`);
			}
			compressed = preservedLines.join("\n");
		}
	}

	return compressed;
}

// ── Primary optimizer ─────────────────────────────────────────────────────────
export function optimizePromptText(text: string): TokenOptimizeResult {
	const originalLength = text.length;

	let normalized = compressCognitiveVector(text)
		.replace(/\r\n/g, "\n")
		.replace(HTML_COMMENTS, "")
		.replace(ANSI_ESCAPE, "")
		.replace(OSC_ESCAPE, "")
		.replace(TRAILING_WHITESPACE, "")
		.replace(REPEATED_WHITESPACE, " ")
		.replace(REPEATED_BLANK_LINES, "\n\n")
		.replace(REDUNDANT_PUNCTUATION, (_, p) => p);

	normalized = trimStackTraces(normalized);
	normalized = deduplicateLogLines(normalized);

	// Code fence processing (fresh regex per call — avoid lastIndex bug)
	const toolBlockRe = /```([A-Za-z0-9_+.-]*)\n([\s\S]*?)```/g;
	normalized = normalized.replace(toolBlockRe, (_full, lang: string, inner: string) => {
		let body = compactJsonish(inner.trim());
		body = trimLongLines(trimLongToolBlock(body));
		body = stripCommentsFromCodeBlock(body, lang);
		body = collapseEmptyLines(body);
		return `\`\`\`${lang}\n${body}\n\`\`\``;
	});

	normalized = compactJsonish(normalized);
	normalized = normalized.trim();

	if (normalized === text) return { optimizedText: text, wasOptimized: false, reductionChars: 0 };
	return {
		optimizedText: normalized,
		wasOptimized: true,
		reductionChars: Math.max(0, originalLength - normalized.length),
	};
}

// ── Capsule helpers ───────────────────────────────────────────────────────────
function uniqueLimited(items: string[], limit: number): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const item of items) {
		const n = item.trim();
		if (!n || seen.has(n)) continue;
		seen.add(n);
		out.push(n);
		if (out.length >= limit) break;
	}
	return out;
}

function extractPathHints(text: string): string[] {
	const pathLike =
		/(?:[A-Za-z]:\\[^\s"'`<>|]+|\.{0,2}\/[^\s"'`<>|]+|[\w.-]+\/[\w./-]+\.[A-Za-z0-9]{1,8}|[\w.-]+\\[\w.-]+\.[A-Za-z0-9]{1,8})/g;
	return uniqueLimited(text.match(pathLike) ?? [], 12);
}

function extractCommandHints(text: string): string[] {
	const lines = text.split("\n");
	return uniqueLimited(
		lines
			.map((line) => line.trim())
			.filter((line) =>
				/^(?:[$>]\s*)?(?:npm|pnpm|yarn|bun|node|python|pytest|vitest|cargo|go|git|rg|grep|tsc|eslint)(?:\s|$)/i.test(
					line,
				),
			)
			.map((line) => line.replace(/^[$>]\s*/, "")),
		8,
	);
}

function extractErrorHints(text: string): string[] {
	const lines = text.split("\n");
	return uniqueLimited(
		lines.filter((line) =>
			/\b(error|exception|failed|failure|traceback|timeout|eacces|enoent|cannot find|expected|received)\b/i.test(
				line,
			),
		),
		8,
	);
}

function summarizeCodeFences(text: string): string[] {
	const summaries: string[] = [];
	const fenceRe = /```([A-Za-z0-9_+.-]*)\n([\s\S]*?)```/g;
	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
	while ((match = fenceRe.exec(text)) && summaries.length < 10) {
		// was 16
		const lang = match[1] || "text";
		const body = match[2] ?? "";
		const lines = body.split("\n");
		const first = lines.find((l) => l.trim().length > 0)?.trim() ?? "";
		summaries.push(`${lang}:${lines.length}L${first ? `,${first.slice(0, 80)}` : ""}`);
	}
	return summaries;
}

function summarizeLongPrompt(text: string): string {
	const normalized = optimizePromptText(text).optimizedText;
	const lines = normalized.split("\n");
	const headN = Math.min(20, lines.length); // was 30
	const tailN = Math.min(20, lines.length); // was 30
	const head = lines.slice(0, headN).join("\n");
	const tail = lines.slice(-tailN).join("\n");
	const paths = extractPathHints(normalized);
	const cmds = extractCommandHints(normalized);
	const errs = extractErrorHints(normalized);
	const fences = summarizeCodeFences(normalized);

	const capsule = [
		"[capsule]",
		`${text.length}ch/${text.split("\n").length}L`,
		paths.length ? `paths:${paths.slice(0, 12).join(",")}` : "",
		cmds.length ? `cmds:${cmds.slice(0, 8).join(",")}` : "",
		errs.length ? `errs:${errs.slice(0, 8).join(" | ")}` : "",
		fences.length ? `fences:${fences.join(" | ")}` : "",
		"[head]",
		head,
		"[tail]",
		tail,
	]
		.filter(Boolean)
		.join("\n");

	const rawTail = normalized.length > CAPSULE_MAX_RAW_CHARS ? normalized.slice(-CAPSULE_MAX_RAW_CHARS) : normalized;
	const trimmedRawTail = rawTail.split("\n").slice(-CAPSULE_MAX_LINES).join("\n");
	return `${capsule}\n[raw]\n${trimmedRawTail}`;
}

// ── Intent capsule ────────────────────────────────────────────────────────────
export function optimizePromptForIntentCapsule(text: string): PromptCapsuleResult {
	const base = optimizePromptText(text);
	const optimized = base.optimizedText;
	const shouldCapsule =
		optimized.length > CAPSULE_MIN_CHARS ||
		optimized.split("\n").length > 150 ||
		/```[\s\S]{4000,}```/.test(optimized);

	if (!shouldCapsule) return { ...base, capsuleApplied: false };

	const capsule = summarizeLongPrompt(optimized).trim();
	if (capsule.length >= optimized.length) return { ...base, capsuleApplied: false };

	return {
		optimizedText: capsule,
		wasOptimized: true,
		reductionChars: Math.max(0, text.length - capsule.length),
		capsuleApplied: true,
	};
}

// ── Local/Ollama aggressive trim ──────────────────────────────────────────────
export function optimizeForLocalModel(text: string, maxChars = 2_000): TokenOptimizeResult {
	// was 6000
	const base = optimizePromptText(text);
	const working = base.optimizedText;
	if (working.length <= maxChars) return base;

	const head = Math.floor(maxChars * 0.65);
	const tail = maxChars - head;
	const trimmed = `${working.slice(0, head)}\n\n...[${working.length - maxChars}ch skipped]...\n\n${working.slice(-tail)}`;

	return {
		optimizedText: trimmed,
		wasOptimized: true,
		reductionChars: Math.max(0, text.length - trimmed.length),
	};
}
