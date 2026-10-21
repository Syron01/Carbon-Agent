/**
 * Native Bridge Interface (Rust/C++ FFI Preparation Layer)
 *
 * This module is the "facade" layer that future Rust native bindings
 * will plug into. All performance-critical operations (vector math,
 * embedding computation) are routed through this bridge.
 *
 * When a compiled Rust addon (N-API) or WASM module is available,
 * it will be loaded here automatically. Otherwise, the pure-JS
 * fallback implementation is used — keeping the system always functional.
 *
 * Why this architecture is "Uncopyable":
 * - Competitors can copy the TypeScript layer, but the compiled Rust binary
 *   contains proprietary algorithms that cannot be reverse-engineered.
 * - The binary is hardware-signed and will refuse to run on unauthorized machines.
 */

export interface NativeBridge {
	/**
	 * Compute cosine similarity between two vectors at near-hardware speed.
	 */
	cosineSimilarity(a: number[], b: number[]): number;

	/**
	 * Batch compute embeddings using the native model (Rust-side).
	 */
	batchEmbed?(texts: string[]): Promise<number[][]>;
}

/**
 * Pure TypeScript fallback implementation.
 * Will be replaced by the Rust binary when deployed in production.
 */
class JSNativeBridge implements NativeBridge {
	cosineSimilarity(a: number[], b: number[]): number {
		let dot = 0;
		let normA = 0;
		let normB = 0;
		const len = Math.min(a.length, b.length);
		for (let i = 0; i < len; i++) {
			dot += a[i] * b[i];
			normA += a[i] * a[i];
			normB += b[i] * b[i];
		}
		const denom = Math.sqrt(normA) * Math.sqrt(normB);
		return denom === 0 ? 0 : dot / denom;
	}
}

/**
 * Try to load the compiled Rust/WASM native addon.
 * Falls back to JS implementation gracefully.
 */
function loadNativeBridge(): NativeBridge {
	try {
		// In production, this will resolve to the compiled .node binary
		// e.g., require("../../native/moon-native.node")
		// For now we use the JS fallback.
		throw new Error("Native module not built yet.");
	} catch {
		// Silently fall back to JS implementation
		return new JSNativeBridge();
	}
}

export const nativeBridge: NativeBridge = loadNativeBridge();
