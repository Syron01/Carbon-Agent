/**
 * Simple in-memory cache with TTL for expensive operations.
 */

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

export class Cache<T = unknown> {
	private store = new Map<string, CacheEntry<T>>();
	private defaultTTL: number;

	constructor(defaultTTLMs = 30_000) {
		this.defaultTTL = defaultTTLMs;
	}

	get(key: string): T | undefined {
		const entry = this.store.get(key);
		if (!entry) return undefined;
		if (Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return undefined;
		}
		return entry.value;
	}

	set(key: string, value: T, ttlMs?: number): void {
		this.store.set(key, {
			value,
			expiresAt: Date.now() + (ttlMs ?? this.defaultTTL),
		});
	}

	has(key: string): boolean {
		return this.get(key) !== undefined;
	}

	delete(key: string): void {
		this.store.delete(key);
	}

	clear(): void {
		this.store.clear();
	}

	/** Get-or-compute: if cached, return; otherwise compute, store, return. */
	async getOrCompute(key: string, fn: () => Promise<T>, ttlMs?: number): Promise<T> {
		const existing = this.get(key);
		if (existing !== undefined) return existing;
		const value = await fn();
		this.set(key, value, ttlMs);
		return value;
	}

	/** Synchronous get-or-compute */
	getOrComputeSync(key: string, fn: () => T, ttlMs?: number): T {
		const existing = this.get(key);
		if (existing !== undefined) return existing;
		const value = fn();
		this.set(key, value, ttlMs);
		return value;
	}

	get size(): number {
		return this.store.size;
	}

	/** Clean expired entries */
	prune(): number {
		const now = Date.now();
		let removed = 0;
		for (const [key, entry] of this.store) {
			if (now > entry.expiresAt) {
				this.store.delete(key);
				removed++;
			}
		}
		return removed;
	}
}

/** Singleton for app-wide caching */
export const appCache = new Cache();

/** Model resolution cache (short TTL: 10s) */
export const modelCache = new Cache(10_000);

/** Tool execution cache (medium TTL: 60s) */
export const toolCache = new Cache(60_000);
