/**
 * Tests for EngineSession forking behavior.
 *
 * These tests verify:
 * - Forking from a single message works
 * - Forking in --no-session mode (in-memory only)
 * - getUserMessagesForForking returns correct entries
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "astro-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.js";
import type { EngineSession } from "../src/core/engine-session.js";
import {
	type CreateEngineSessionRuntimeFactory,
	createEngineSessionFromServices,
	createEngineSessionRuntime,
	createEngineSessionServices,
	type EngineSessionRuntime,
} from "../src/core/engine-session-runtime.js";
import { SessionManager } from "../src/core/session-manager.js";
import { API_KEY } from "./utilities.js";

describe.skipIf(!API_KEY)("EngineSession forking", () => {
	let session: EngineSession;
	let runtimeHost: EngineSessionRuntime;
	let tempDir: string;
	let sessionManager: SessionManager;

	beforeEach(() => {
		tempDir = join(tmpdir(), `astroagent-branching-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(async () => {
		if (runtimeHost) {
			await runtimeHost.dispose();
		}
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
	});

	async function createSession(noSession: boolean = false) {
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		sessionManager = noSession ? SessionManager.inMemory(tempDir) : SessionManager.create(tempDir);
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		authStorage.setRuntimeApiKey("anthropic", API_KEY!);

		const servicesOptions = {
			engineDir: tempDir,
			authStorage,
			resourceLoaderOptions: {
				noExtensions: true,
				noSkills: true,
				noPromptTemplates: true,
				noThemes: true,
			},
		};
		const createRuntime: CreateEngineSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
			const services = await createEngineSessionServices({
				...servicesOptions,
				cwd,
			});
			return {
				...(await createEngineSessionFromServices({
					services,
					sessionManager,
					sessionStartEvent,
					model,
					tools: ["read", "bash", "edit", "write"],
				})),
				services,
				diagnostics: services.diagnostics,
			};
		};
		runtimeHost = await createEngineSessionRuntime(createRuntime, {
			cwd: tempDir,
			engineDir: tempDir,
			sessionManager,
		});
		session = runtimeHost.session;
		session.subscribe(() => {});
		return session;
	}

	it("should allow forking from single message", async () => {
		await createSession();

		await session.prompt("Say hello");
		await session.engine.waitForIdle();

		const userMessages = session.getUserMessagesForForking();
		expect(userMessages.length).toBe(1);
		expect(userMessages[0].text).toBe("Say hello");

		const result = await runtimeHost.fork(userMessages[0].entryId);
		expect(result.cancelled).toBe(false);
		session = runtimeHost.session;
		expect(result.selectedText).toBe("Say hello");

		expect(session.messages.length).toBe(0);
		expect(session.sessionFile).not.toBeNull();
		expect(existsSync(session.sessionFile!)).toBe(false);
	});

	it("should support in-memory forking in --no-session mode", async () => {
		await createSession(true);

		expect(session.sessionFile).toBeUndefined();

		await session.prompt("Say hi");
		await session.engine.waitForIdle();

		const userMessages = session.getUserMessagesForForking();
		expect(userMessages.length).toBe(1);
		expect(session.messages.length).toBeGreaterThan(0);

		const result = await runtimeHost.fork(userMessages[0].entryId);
		expect(result.cancelled).toBe(false);
		session = runtimeHost.session;
		expect(result.selectedText).toBe("Say hi");

		expect(session.messages.length).toBe(0);
		expect(session.sessionFile).toBeUndefined();
	});

	it("should fork from middle of conversation", async () => {
		await createSession();

		await session.prompt("Say one");
		await session.engine.waitForIdle();

		await session.prompt("Say two");
		await session.engine.waitForIdle();

		await session.prompt("Say three");
		await session.engine.waitForIdle();

		const userMessages = session.getUserMessagesForForking();
		expect(userMessages.length).toBe(3);

		const secondMessage = userMessages[1];
		const result = await runtimeHost.fork(secondMessage.entryId);
		expect(result.cancelled).toBe(false);
		session = runtimeHost.session;
		expect(result.selectedText).toBe("Say two");

		expect(session.messages.length).toBe(2);
		expect(session.messages[0].role).toBe("user");
		expect(session.messages[1].role).toBe("assistant");
	}, 60000);
});
