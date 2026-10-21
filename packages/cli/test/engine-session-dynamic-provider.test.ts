import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "astro-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.js";
import { DefaultResourceLoader } from "../src/core/resource-loader.js";
import type { ExtensionFactory } from "../src/core/sdk.js";
import { createEngineSession } from "../src/core/sdk.js";
import { SessionManager } from "../src/core/session-manager.js";
import { SettingsManager } from "../src/core/settings-manager.js";

describe("EngineSession dynamic provider registration", () => {
	let tempDir: string;
	let engineDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `astroagent-dynamic-provider-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		engineDir = join(tempDir, "engine");
		mkdirSync(engineDir, { recursive: true });
	});

	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	async function createSession(extensionFactories: ExtensionFactory[]) {
		const settingsManager = SettingsManager.create(tempDir, engineDir);
		const sessionManager = SessionManager.inMemory();
		const authStorage = AuthStorage.create(join(engineDir, "auth.json"));
		authStorage.setRuntimeApiKey("anthropic", "test-key");
		const resourceLoader = new DefaultResourceLoader({
			cwd: tempDir,
			engineDir,
			settingsManager,
			extensionFactories,
		});
		await resourceLoader.reload();

		const { session } = await createEngineSession({
			cwd: tempDir,
			engineDir,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			settingsManager,
			sessionManager,
			authStorage,
			resourceLoader,
		});

		return session;
	}

	async function capturePromptBaseUrl(
		session: Awaited<ReturnType<typeof createSession>>,
	): Promise<string | undefined> {
		let baseUrl: string | undefined;
		session.engine.streamFn = async (model) => {
			baseUrl = model.baseUrl;
			throw new Error("stop");
		};
		await session.prompt("hello");
		return baseUrl;
	}

	it("applies top-level registerProvider overrides to the active model", async () => {
		const session = await createSession([
			(AstroAgent) => {
				AstroAgent.registerProvider("anthropic", { baseUrl: "http://localhost:8080/top-level" });
			},
		]);

		expect(session.model?.baseUrl).toBe("http://localhost:8080/top-level");
		expect(await capturePromptBaseUrl(session)).toBe("http://localhost:8080/top-level");

		session.dispose();
	});

	it("applies session_start registerProvider overrides to the active model", async () => {
		const session = await createSession([
			(AstroAgent) => {
				AstroAgent.on("session_start", () => {
					AstroAgent.registerProvider("anthropic", { baseUrl: "http://localhost:8080/session-start" });
				});
			},
		]);

		await session.bindExtensions({});

		expect(session.model?.baseUrl).toBe("http://localhost:8080/session-start");
		expect(await capturePromptBaseUrl(session)).toBe("http://localhost:8080/session-start");

		session.dispose();
	});

	it("applies command-time registerProvider overrides without reload", async () => {
		const session = await createSession([
			(AstroAgent) => {
				AstroAgent.registerCommand("use-proxy", {
					description: "Use proxy",
					handler: async () => {
						AstroAgent.registerProvider("anthropic", { baseUrl: "http://localhost:8080/command" });
					},
				});
			},
		]);

		await session.bindExtensions({});
		await session.prompt("/use-proxy");

		expect(session.model?.baseUrl).toBe("http://localhost:8080/command");
		expect(await capturePromptBaseUrl(session)).toBe("http://localhost:8080/command");

		session.dispose();
	});
});
