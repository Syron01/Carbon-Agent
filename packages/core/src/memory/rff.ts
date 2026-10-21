import type { Message } from "../types.js";

/**
 * RFF Context Compressor
 * Kernelized Fast Attention via Random Fourier Features (RFF)
 *
 * Replaces O(N^2) full attention over large contexts with an
 * O(N·d^2) kernel approximation by projecting text segments
 * into a Fourier feature space and ranking by kernel similarity to the query.
 */

const VOCAB_DIM = 512;
const RFF_DIM = 256;
const MAX_CHUNKS = 480;
const TOP_K = 60;

const W = generateGaussianMatrix(RFF_DIM, VOCAB_DIM);

function generateGaussianMatrix(M: number, D: number): Float64Array[] {
	const mat: Float64Array[] = [];
	let seed = 0x9e3779b9;

	function lcg() {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 0x100000000;
	}

	for (let i = 0; i < M; i++) {
		const row = new Float64Array(D);
		for (let j = 0; j < D; j += 2) {
			const u1 = Math.max(lcg(), 1e-10);
			const u2 = lcg();
			const r = Math.sqrt(-2 * Math.log(u1));
			const t = 2 * Math.PI * u2;
			row[j] = r * Math.cos(t);
			if (j + 1 < D) row[j + 1] = r * Math.sin(t);
		}
		mat.push(row);
	}
	return mat;
}

function textToVector(text: string): Float64Array {
	const vec = new Float64Array(VOCAB_DIM);
	const words = (text || "").toLowerCase().split(/\s+/);

	for (const word of words) {
		let h = 0x811c9dc5;
		for (let i = 0; i < word.length; i++) {
			h ^= word.charCodeAt(i);
			h = Math.imul(h, 0x01000193) >>> 0;
		}
		vec[h % VOCAB_DIM] += 1;
	}

	let norm = 0;
	for (let i = 0; i < VOCAB_DIM; i++) norm += vec[i] * vec[i];
	norm = Math.sqrt(norm) || 1;
	for (let i = 0; i < VOCAB_DIM; i++) vec[i] /= norm;

	return vec;
}

function rffProject(x: Float64Array): Float64Array {
	const M = W.length;
	const phi = new Float64Array(2 * M);
	const scale = 1 / Math.sqrt(M);

	for (let i = 0; i < M; i++) {
		let dot = 0;
		const wi = W[i];
		for (let j = 0; j < VOCAB_DIM; j++) dot += wi[j] * x[j];
		phi[i] = scale * Math.sin(dot);
		phi[i + M] = scale * Math.cos(dot);
	}
	return phi;
}

function kernelSim(phiQ: Float64Array, phiX: Float64Array): number {
	let s = 0;
	for (let i = 0; i < phiQ.length; i++) s += phiQ[i] * phiX[i];
	return s;
}

export interface RffOptions {
	topK?: number;
	debug?: boolean;
}

export interface RffResult {
	compressed: string[];
	indices: number[];
	scores: number[];
	durationMs: number;
}

export function rffCompress(query: string, segments: string[], options: RffOptions = {}): RffResult {
	const startMs = Date.now();
	const topK = options.topK ?? TOP_K;

	if (!segments || segments.length === 0) {
		return { compressed: [], indices: [], scores: [], durationMs: 0 };
	}

	const limited = segments.slice(-MAX_CHUNKS);

	const qVec = textToVector(query);
	const phiQ = rffProject(qVec);

	const ranked = limited.map((seg, idx) => {
		const xVec = textToVector(seg);
		const phiX = rffProject(xVec);
		const sim = kernelSim(phiQ, phiX);
		return { seg, sim, idx };
	});

	ranked.sort((a, b) => b.sim - a.sim);

	const topK_ = ranked.slice(0, topK).sort((a, b) => a.idx - b.idx);

	const durationMs = Date.now() - startMs;

	return {
		compressed: topK_.map((r) => r.seg),
		indices: topK_.map((r) => r.idx),
		scores: topK_.map((r) => r.sim),
		durationMs,
	};
}

export interface CompressMessagesResult<T> {
	messages: T[];
	stats: {
		skipped?: boolean;
		originalCount?: number;
		compressedCount?: number;
		reduction?: string;
		durationMs?: number;
		scores?: number[];
	};
}

export function compressMessages<T extends Message>(messages: T[], query: string): CompressMessagesResult<T> {
	if (!messages || messages.length <= 3) {
		return { messages, stats: { skipped: true } };
	}

	const system = messages.filter((m) => (m.role as string) === "system");
	const history = messages.filter((m) => (m.role as string) !== "system");
	const lastUser = history.findLast((m) => (m.role as string) === "user");

	if (!lastUser) {
		return { messages, stats: { skipped: true } };
	}

	const prior = history.filter((m) => m !== lastUser);

	if (prior.length === 0) return { messages, stats: { skipped: true } };

	// Note: Only compress text messages. Tool calls and results should ideally not be compressed natively this way,
	// but for now we serialize them to string representation.
	const segments = prior.map((m) => {
		if (typeof m.content === "string") return `[${m.role.toUpperCase()}]: ${m.content}`;
		// Primitive fallback for object content arrays
		if (Array.isArray(m.content)) {
			const textParts = m.content.filter((p: any) => p.type === "text").map((p: any) => p.text);
			return `[${m.role.toUpperCase()}]: ${textParts.join(" ")}`;
		}
		return `[${m.role.toUpperCase()}]: <content>`;
	});

	const { indices, scores, durationMs } = rffCompress(query, segments, { debug: false });

	const offset = Math.max(0, prior.length - MAX_CHUNKS);
	const compressedMsgs: T[] = indices.map((idx) => prior[offset + idx]);

	const result = [...system, ...compressedMsgs, lastUser];

	return {
		messages: result,
		stats: {
			originalCount: messages.length,
			compressedCount: result.length,
			reduction: `${((1 - result.length / messages.length) * 100).toFixed(1)}%`,
			durationMs,
			scores,
		},
	};
}
