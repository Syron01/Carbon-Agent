/**
 * Credential storage for API keys and OAuth tokens.
 * Handles loading, saving, and refreshing credentials from auth.json.
 *
 * Uses file locking to prevent race conditions when multiple Astro-Agent instances
 * try to refresh tokens simultaneously.
 */

import {
	findEnvKeys,
	getEnvApiKey,
	type OAuthCredentials,
	type OAuthLoginCallbacks,
	type OAuthProviderId,
} from "astro-core";
import { getOAuthApiKey, getOAuthProvider, getOAuthProviders } from "astro-core/oauth";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import * as os from "os";
import { dirname, join } from "path";
import lockfile from "proper-lockfile";
import { getEngineDir } from "../config.js";
import { resolveConfigValue } from "./resolve-config-value.js";

export type ApiKeyCredential = {
	type: "api_key";
	key: string;
};

export type OAuthCredential = {
	type: "oauth";
} & OAuthCredentials;

export type AuthCredential = ApiKeyCredential | OAuthCredential;

export type AuthStorageData = Record<string, AuthCredential>;

const AUTH_PROVIDER_ALIASES: Record<string, string> = {
	codex: "openai-codex",
};

function normalizeAuthProviderId(provider: string): string {
	return AUTH_PROVIDER_ALIASES[provider.toLowerCase()] ?? provider;
}

function normalizeAuthStorageData(data: AuthStorageData): AuthStorageData {
	const normalized: AuthStorageData = {};
	for (const [provider, credential] of Object.entries(data)) {
		normalized[normalizeAuthProviderId(provider)] = credential;
	}
	return normalized;
}

export type ManagedAuthAccount = {
	id: string;
	provider: string;
	label: string;
	type: "oauth" | "api_key";
	credential: AuthCredential;
	createdAt: number;
	lastUsedAt?: number;
	useCount?: number;
	quotaLabel?: string;
	active?: boolean;
};

type AuthAccountsFile = {
	accounts: ManagedAuthAccount[];
	activeByProvider: Record<string, string>;
};

export type AuthStatus = {
	configured: boolean;
	source?: "stored" | "runtime" | "environment" | "fallback" | "models_json_key" | "models_json_command";
	label?: string;
};

type LockResult<T> = {
	result: T;
	next?: string;
};

export interface AuthStorageBackend {
	withLock<T>(fn: (current: string | undefined) => LockResult<T>): T;
	withLockAsync<T>(fn: (current: string | undefined) => Promise<LockResult<T>>): Promise<T>;
}

export class FileAuthStorageBackend implements AuthStorageBackend {
	constructor(private authPath: string = join(getEngineDir(), "auth.json")) {}

	private ensureParentDir(): void {
		const dir = dirname(this.authPath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true, mode: 0o700 });
		}
	}

	private ensureFileExists(): void {
		if (!existsSync(this.authPath)) {
			writeFileSync(this.authPath, "{}", "utf-8");
			chmodSync(this.authPath, 0o600);
		}
	}

	private acquireLockSyncWithRetry(path: string): () => void {
		const maxAttempts = 10;
		const delayMs = 20;
		let lastError: unknown;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				return lockfile.lockSync(path, { realpath: false });
			} catch (error) {
				const code =
					typeof error === "object" && error !== null && "code" in error
						? String((error as { code?: unknown }).code)
						: undefined;
				if (code !== "ELOCKED" || attempt === maxAttempts) {
					throw error;
				}
				lastError = error;
				const start = Date.now();
				while (Date.now() - start < delayMs) {
					// Sleep synchronously to avoid changing callers to async.
				}
			}
		}

		throw (lastError as Error) ?? new Error("Failed to acquire auth storage lock");
	}

	withLock<T>(fn: (current: string | undefined) => LockResult<T>): T {
		this.ensureParentDir();
		this.ensureFileExists();

		let release: (() => void) | undefined;
		try {
			release = this.acquireLockSyncWithRetry(this.authPath);
			const current = existsSync(this.authPath) ? readFileSync(this.authPath, "utf-8") : undefined;
			const { result, next } = fn(current);
			if (next !== undefined) {
				writeFileSync(this.authPath, next, "utf-8");
				chmodSync(this.authPath, 0o600);
			}
			return result;
		} finally {
			if (release) {
				release();
			}
		}
	}

	async withLockAsync<T>(fn: (current: string | undefined) => Promise<LockResult<T>>): Promise<T> {
		this.ensureParentDir();
		this.ensureFileExists();

		let release: (() => Promise<void>) | undefined;
		let lockCompromised = false;
		let lockCompromisedError: Error | undefined;
		const throwIfCompromised = () => {
			if (lockCompromised) {
				throw lockCompromisedError ?? new Error("Auth storage lock was compromised");
			}
		};

		try {
			release = await lockfile.lock(this.authPath, {
				retries: {
					retries: 10,
					factor: 2,
					minTimeout: 100,
					maxTimeout: 10000,
					randomize: true,
				},
				stale: 30000,
				onCompromised: (err) => {
					lockCompromised = true;
					lockCompromisedError = err;
				},
			});

			throwIfCompromised();
			const current = existsSync(this.authPath) ? readFileSync(this.authPath, "utf-8") : undefined;
			const { result, next } = await fn(current);
			throwIfCompromised();
			if (next !== undefined) {
				writeFileSync(this.authPath, next, "utf-8");
				chmodSync(this.authPath, 0o600);
			}
			throwIfCompromised();
			return result;
		} finally {
			if (release) {
				try {
					await release();
				} catch {
					// Ignore unlock errors when lock is compromised.
				}
			}
		}
	}
}

export class InMemoryAuthStorageBackend implements AuthStorageBackend {
	private value: string | undefined;

	withLock<T>(fn: (current: string | undefined) => LockResult<T>): T {
		const { result, next } = fn(this.value);
		if (next !== undefined) {
			this.value = next;
		}
		return result;
	}

	async withLockAsync<T>(fn: (current: string | undefined) => Promise<LockResult<T>>): Promise<T> {
		const { result, next } = await fn(this.value);
		if (next !== undefined) {
			this.value = next;
		}
		return result;
	}
}

/**
 * Credential storage backed by a JSON file.
 */
export class AuthStorage {
	private data: AuthStorageData = {};
	private runtimeOverrides: Map<string, string> = new Map();
	private fallbackResolver?: (provider: string) => string | undefined;
	private loadError: Error | null = null;
	private errors: Error[] = [];
	private accountsPath = join(getEngineDir(), "auth-accounts.json");

	private constructor(private storage: AuthStorageBackend) {
		this.reload();
	}

	static create(authPath?: string): AuthStorage {
		return new AuthStorage(new FileAuthStorageBackend(authPath ?? join(getEngineDir(), "auth.json")));
	}

	static fromStorage(storage: AuthStorageBackend): AuthStorage {
		return new AuthStorage(storage);
	}

	static inMemory(data: AuthStorageData = {}): AuthStorage {
		const storage = new InMemoryAuthStorageBackend();
		storage.withLock(() => ({ result: undefined, next: JSON.stringify(data, null, 2) }));
		return AuthStorage.fromStorage(storage);
	}

	private readAccountsFile(): AuthAccountsFile {
		try {
			if (!existsSync(this.accountsPath)) {
				return { accounts: [], activeByProvider: {} };
			}
			const parsed = JSON.parse(readFileSync(this.accountsPath, "utf-8")) as Partial<AuthAccountsFile>;
			const accounts = Array.isArray(parsed.accounts)
				? (parsed.accounts as ManagedAuthAccount[]).map((account) => ({
						...account,
						provider: normalizeAuthProviderId(account.provider),
					}))
				: [];
			const activeByProvider =
				parsed.activeByProvider && typeof parsed.activeByProvider === "object"
					? Object.fromEntries(
							Object.entries(parsed.activeByProvider as Record<string, string>).map(([provider, accountId]) => [
								normalizeAuthProviderId(provider),
								accountId,
							]),
						)
					: {};
			return {
				accounts,
				activeByProvider,
			};
		} catch (error) {
			this.recordError(error);
			return { accounts: [], activeByProvider: {} };
		}
	}

	private writeAccountsFile(file: AuthAccountsFile): void {
		try {
			const dir = dirname(this.accountsPath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true, mode: 0o700 });
			}
			writeFileSync(this.accountsPath, JSON.stringify(file, null, 2), "utf-8");
			chmodSync(this.accountsPath, 0o600);
		} catch (error) {
			this.recordError(error);
		}
	}

	private createAccountId(provider: string): string {
		return `${provider}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	}

	private defaultAccountLabel(_provider: string, _type: "oauth" | "api_key"): string {
		return process.env.USERNAME || os.hostname() || "My PC";
	}

	upsertManagedAccount(
		provider: string,
		credential: AuthCredential,
		options: { label?: string; activate?: boolean; quotaLabel?: string } = {},
	): ManagedAuthAccount {
		const file = this.readAccountsFile();
		const now = Date.now();
		const existingIndex = file.accounts.findIndex(
			(account) =>
				account.provider === provider &&
				account.type === credential.type &&
				JSON.stringify(account.credential) === JSON.stringify(credential),
		);
		const account: ManagedAuthAccount =
			existingIndex >= 0
				? {
						...file.accounts[existingIndex],
						label: options.label?.trim() || file.accounts[existingIndex].label,
						credential,
						quotaLabel: options.quotaLabel ?? file.accounts[existingIndex].quotaLabel,
					}
				: {
						id: this.createAccountId(provider),
						provider,
						label: options.label?.trim() || this.defaultAccountLabel(provider, credential.type),
						type: credential.type,
						credential,
						createdAt: now,
						useCount: 0,
						quotaLabel: options.quotaLabel,
					};
		if (existingIndex >= 0) {
			file.accounts[existingIndex] = account;
		} else {
			file.accounts.push(account);
		}
		if (options.activate ?? true) {
			file.activeByProvider[provider] = account.id;
			this.data[provider] = credential;
			this.persistProviderChange(provider, credential);
		}
		this.writeAccountsFile(file);
		return { ...account, active: file.activeByProvider[provider] === account.id };
	}

	listManagedAccounts(): ManagedAuthAccount[] {
		const file = this.readAccountsFile();
		return file.accounts.map((account) => ({
			...account,
			active: file.activeByProvider[account.provider] === account.id,
		}));
	}

	setActiveManagedAccount(accountId: string): ManagedAuthAccount | undefined {
		const file = this.readAccountsFile();
		const account = file.accounts.find((item) => item.id === accountId);
		if (!account) {
			return undefined;
		}
		const provider = normalizeAuthProviderId(account.provider);
		file.activeByProvider[provider] = account.id;
		this.data[provider] = account.credential;
		this.persistProviderChange(provider, account.credential);
		this.writeAccountsFile(file);
		return { ...account, active: true };
	}

	activateNextManagedAccount(provider: string): ManagedAuthAccount | undefined {
		const normalizedProvider = normalizeAuthProviderId(provider);
		const file = this.readAccountsFile();
		const providerAccounts = file.accounts.filter((account) => account.provider === normalizedProvider);
		if (providerAccounts.length === 0) return undefined;
		const activeId = file.activeByProvider[normalizedProvider];
		const activeIndex = providerAccounts.findIndex((account) => account.id === activeId);
		const next = providerAccounts[(activeIndex + 1 + providerAccounts.length) % providerAccounts.length];
		if (!next || next.id === activeId) return undefined;
		file.activeByProvider[normalizedProvider] = next.id;
		this.data[normalizedProvider] = next.credential;
		this.persistProviderChange(normalizedProvider, next.credential);
		this.writeAccountsFile(file);
		return { ...next, active: true };
	}

	removeManagedAccount(accountId: string): boolean {
		const file = this.readAccountsFile();
		const account = file.accounts.find((item) => item.id === accountId);
		if (!account) return false;
		file.accounts = file.accounts.filter((item) => item.id !== accountId);
		if (file.activeByProvider[account.provider] === accountId) {
			delete file.activeByProvider[account.provider];
			this.remove(account.provider);
		}
		this.writeAccountsFile(file);
		return true;
	}

	private markManagedAccountUsed(provider: string): void {
		const normalizedProvider = normalizeAuthProviderId(provider);
		const file = this.readAccountsFile();
		const activeId = file.activeByProvider[normalizedProvider];
		if (!activeId) return;
		const index = file.accounts.findIndex((account) => account.id === activeId);
		if (index < 0) return;
		file.accounts[index] = {
			...file.accounts[index],
			lastUsedAt: Date.now(),
			useCount: (file.accounts[index].useCount ?? 0) + 1,
		};
		this.writeAccountsFile(file);
	}

	/**
	 * Set a runtime API key override (not persisted to disk).
	 * Used for CLI --api-key flag.
	 */
	setRuntimeApiKey(provider: string, apiKey: string): void {
		this.runtimeOverrides.set(normalizeAuthProviderId(provider), apiKey);
	}

	/**
	 * Remove a runtime API key override.
	 */
	removeRuntimeApiKey(provider: string): void {
		this.runtimeOverrides.delete(normalizeAuthProviderId(provider));
	}

	/**
	 * Set a fallback resolver for API keys not found in auth.json or env vars.
	 * Used for custom provider keys from models.json.
	 */
	setFallbackResolver(resolver: (provider: string) => string | undefined): void {
		this.fallbackResolver = resolver;
	}

	private recordError(error: unknown): void {
		const normalizedError = error instanceof Error ? error : new Error(String(error));
		this.errors.push(normalizedError);
	}

	private parseStorageData(content: string | undefined): AuthStorageData {
		if (!content) {
			return {};
		}
		return normalizeAuthStorageData(JSON.parse(content) as AuthStorageData);
	}

	/**
	 * Reload credentials from storage.
	 */
	reload(): void {
		let content: string | undefined;
		try {
			this.storage.withLock((current) => {
				content = current;
				return { result: undefined };
			});
			this.data = this.parseStorageData(content);
			this.loadError = null;
		} catch (error) {
			this.loadError = error as Error;
			this.recordError(error);
		}
	}

	private persistProviderChange(provider: string, credential: AuthCredential | undefined): void {
		const normalizedProvider = normalizeAuthProviderId(provider);
		if (this.loadError) {
			return;
		}

		try {
			this.storage.withLock((current) => {
				const currentData = this.parseStorageData(current);
				const merged: AuthStorageData = { ...currentData };
				if (credential) {
					merged[normalizedProvider] = credential;
				} else {
					delete merged[normalizedProvider];
				}
				return { result: undefined, next: JSON.stringify(merged, null, 2) };
			});
		} catch (error) {
			this.recordError(error);
		}
	}

	/**
	 * Get credential for a provider.
	 */
	get(provider: string): AuthCredential | undefined {
		return this.data[normalizeAuthProviderId(provider)] ?? undefined;
	}

	/**
	 * Set credential for a provider.
	 */
	set(provider: string, credential: AuthCredential): void {
		const normalizedProvider = normalizeAuthProviderId(provider);
		this.data[normalizedProvider] = credential;
		this.persistProviderChange(normalizedProvider, credential);
		this.upsertManagedAccount(normalizedProvider, credential, { activate: true });
	}

	/**
	 * Remove credential for a provider.
	 */
	remove(provider: string): void {
		const normalizedProvider = normalizeAuthProviderId(provider);
		delete this.data[normalizedProvider];
		this.persistProviderChange(normalizedProvider, undefined);
	}

	/**
	 * List all providers with credentials.
	 */
	list(): string[] {
		return Object.keys(this.data);
	}

	/**
	 * Check if credentials exist for a provider in auth.json.
	 */
	has(provider: string): boolean {
		return normalizeAuthProviderId(provider) in this.data;
	}

	/**
	 * Check if any form of auth is configured for a provider.
	 * Unlike getApiKey(), this doesn't refresh OAuth tokens.
	 */
	hasAuth(provider: string): boolean {
		const normalizedProvider = normalizeAuthProviderId(provider);
		if (this.runtimeOverrides.has(normalizedProvider)) return true;
		if (this.data[normalizedProvider]) return true;
		if (getEnvApiKey(normalizedProvider)) return true;
		if (this.fallbackResolver?.(normalizedProvider)) return true;
		return false;
	}

	/**
	 * Return auth status without exposing credential values or refreshing tokens.
	 */
	getAuthStatus(provider: string): AuthStatus {
		const normalizedProvider = normalizeAuthProviderId(provider);
		if (this.data[normalizedProvider]) {
			return { configured: true, source: "stored" };
		}

		if (this.runtimeOverrides.has(normalizedProvider)) {
			return { configured: false, source: "runtime", label: "--api-key" };
		}

		const envKeys = findEnvKeys(normalizedProvider);
		if (envKeys?.[0]) {
			return { configured: false, source: "environment", label: envKeys[0] };
		}

		if (this.fallbackResolver?.(normalizedProvider)) {
			return { configured: false, source: "fallback", label: "custom provider config" };
		}

		return { configured: false };
	}

	/**
	 * Get all credentials (for passing to getOAuthApiKey).
	 */
	getAll(): AuthStorageData {
		return { ...this.data };
	}

	drainErrors(): Error[] {
		const drained = [...this.errors];
		this.errors = [];
		return drained;
	}

	/**
	 * Login to an OAuth provider.
	 */
	async login(providerId: OAuthProviderId, callbacks: OAuthLoginCallbacks): Promise<void> {
		const normalizedProviderId = normalizeAuthProviderId(providerId);
		const provider = getOAuthProvider(normalizedProviderId);
		if (!provider) {
			throw new Error(`Unknown OAuth provider: ${providerId}`);
		}

		const credentials = await provider.login(callbacks);
		const credential: AuthCredential = { type: "oauth", ...credentials };
		this.set(normalizedProviderId, credential);
	}

	/**
	 * Logout from a provider.
	 */
	logout(provider: string): void {
		this.remove(normalizeAuthProviderId(provider));
	}

	/**
	 * Refresh OAuth token with backend locking to prevent race conditions.
	 * Multiple Astro-Agent instances may try to refresh simultaneously when tokens expire.
	 */
	private async refreshOAuthTokenWithLock(
		providerId: OAuthProviderId,
	): Promise<{ apiKey: string; newCredentials: OAuthCredentials } | null> {
		const normalizedProviderId = normalizeAuthProviderId(providerId);
		const provider = getOAuthProvider(normalizedProviderId);
		if (!provider) {
			return null;
		}

		const result = await this.storage.withLockAsync(async (current) => {
			const currentData = this.parseStorageData(current);
			this.data = currentData;
			this.loadError = null;

			const cred = currentData[normalizedProviderId];
			if (cred?.type !== "oauth") {
				return { result: null };
			}

			if (Date.now() < cred.expires) {
				return { result: { apiKey: provider.getApiKey(cred), newCredentials: cred } };
			}

			const oauthCreds: Record<string, OAuthCredentials> = {};
			for (const [key, value] of Object.entries(currentData)) {
				if (value.type === "oauth") {
					oauthCreds[key] = value;
				}
			}

			const refreshed = await getOAuthApiKey(normalizedProviderId, oauthCreds);
			if (!refreshed) {
				return { result: null };
			}

			const merged: AuthStorageData = {
				...currentData,
				[normalizedProviderId]: { type: "oauth", ...refreshed.newCredentials },
			};
			this.data = merged;
			this.loadError = null;
			return { result: refreshed, next: JSON.stringify(merged, null, 2) };
		});

		return result;
	}

	/**
	 * Get API key for a provider.
	 * Priority:
	 * 1. Runtime override (CLI --api-key)
	 * 2. API key from auth.json
	 * 3. OAuth token from auth.json (auto-refreshed with locking)
	 * 4. Environment variable
	 * 5. Fallback resolver (models.json custom providers)
	 */
	async getApiKey(providerId: string, options?: { includeFallback?: boolean }): Promise<string | undefined> {
		const normalizedProviderId = normalizeAuthProviderId(providerId);
		// Runtime override takes highest priority
		const runtimeKey = this.runtimeOverrides.get(normalizedProviderId);
		if (runtimeKey) {
			this.markManagedAccountUsed(normalizedProviderId);
			return runtimeKey;
		}

		const cred = this.data[normalizedProviderId];

		if (cred?.type === "api_key") {
			this.markManagedAccountUsed(normalizedProviderId);
			return resolveConfigValue(cred.key);
		}

		if (cred?.type === "oauth") {
			const provider = getOAuthProvider(normalizedProviderId);
			if (!provider) {
				// Unknown OAuth provider, can't get API key
				return undefined;
			}

			// Check if token needs refresh
			const needsRefresh = Date.now() >= cred.expires;

			if (needsRefresh) {
				// Use locked refresh to prevent race conditions
				try {
					const result = await this.refreshOAuthTokenWithLock(normalizedProviderId);
					if (result) {
						this.markManagedAccountUsed(normalizedProviderId);
						return result.apiKey;
					}
				} catch (error) {
					this.recordError(error);
					// Refresh failed - re-read file to check if another instance succeeded
					this.reload();
					const updatedCred = this.data[normalizedProviderId];

					if (updatedCred?.type === "oauth" && Date.now() < updatedCred.expires) {
						// Another instance refreshed successfully, use those credentials
						return provider.getApiKey(updatedCred);
					}

					// Refresh truly failed - return undefined so model discovery skips this provider
					// User can /login to re-authenticate (credentials preserved for retry)
					return undefined;
				}
			} else {
				// Token not expired, use current access token
				this.markManagedAccountUsed(normalizedProviderId);
				return provider.getApiKey(cred);
			}
		}

		// Fall back to environment variable
		const envKey = getEnvApiKey(normalizedProviderId);
		if (envKey) {
			this.markManagedAccountUsed(normalizedProviderId);
			return envKey;
		}

		// Fall back to custom resolver (e.g., models.json custom providers)
		if (options?.includeFallback !== false) {
			const fallback = this.fallbackResolver?.(normalizedProviderId) ?? undefined;
			if (fallback) this.markManagedAccountUsed(normalizedProviderId);
			return fallback;
		}

		return undefined;
	}

	/**
	 * Get all registered OAuth providers
	 */
	getOAuthProviders() {
		return getOAuthProviders();
	}
}
