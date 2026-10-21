import { nativeBridge } from "./native-bridge.js";

export interface VectorDocument {
	id: string;
	content: string;
	metadata?: Record<string, any>;
	embedding?: number[];
}

/**
 * Simple in-memory Vector Database using basic TF-IDF / Cosine Similarity.
 * In a production scenario, this could be backed by ChromaDB, SQLite-vss or Pinecone,
 * and use text-embedding-004 for embeddings.
 */
export class VectorDB {
	private documents: VectorDocument[] = [];
	private docIds: Set<string> = new Set();
	private readonly MAX_DOCS = 1000; // Prevent OOM by limiting documents in-memory

	/**
	 * Adds a document to the knowledge base.
	 */
	public addDocument(doc: VectorDocument) {
		if (this.docIds.has(doc.id)) {
			// Update existing document instead of duplicating
			const index = this.documents.findIndex((d) => d.id === doc.id);
			if (index !== -1) {
				this.documents[index] = { ...doc, embedding: this.mockEmbed(doc.content) };
			}
			return;
		}

		if (this.documents.length >= this.MAX_DOCS) {
			return;
		}

		if (!doc.embedding) {
			doc.embedding = this.mockEmbed(doc.content);
		}
		this.documents.push(doc);
		this.docIds.add(doc.id);
	}

	/**
	 * Searches the knowledge base for the most relevant documents.
	 */
	public search(query: string, limit = 5): VectorDocument[] {
		if (this.documents.length === 0) return [];
		const queryEmbedding = this.mockEmbed(query);

		const scoredDocs = this.documents.map((doc) => ({
			doc,
			score: this.cosineSimilarity(queryEmbedding, doc.embedding!),
		}));

		scoredDocs.sort((a, b) => b.score - a.score);
		return scoredDocs.slice(0, limit).map((s) => s.doc);
	}

	/**
	 * Enhanced mocked embedding (Murmur-style multi-hash) for better semantic separation.
	 * Replaces actual LLM embedding to keep the module dependency-free while improving quality.
	 * Increased to 1024 dimensions to avoid vector saturation.
	 */
	private mockEmbed(text: string): number[] {
		const dim = 1024;
		const vector = new Array(dim).fill(0);
		const words = text.toLowerCase().split(/\W+/);

		for (const word of words) {
			if (word.length > 1) {
				// Multiple hashes to simulate higher dimensionality and reduce collisions
				for (let seed = 0; seed < 4; seed++) {
					let hash = seed;
					for (let i = 0; i < word.length; i++) {
						hash = (hash << 5) - hash + word.charCodeAt(i);
						hash |= 0;
					}
					const index = Math.abs(hash) % dim;
					vector[index] += 1;
				}
			}
		}
		// Normalize for cosine similarity
		const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
		return vector.map((v) => v / magnitude);
	}

	private cosineSimilarity(vecA: number[], vecB: number[]): number {
		// Route through NativeBridge: uses Rust binary when available, JS fallback otherwise
		return nativeBridge.cosineSimilarity(vecA, vecB);
	}
}
