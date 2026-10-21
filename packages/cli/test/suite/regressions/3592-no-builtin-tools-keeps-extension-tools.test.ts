import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "astro-core";
import { Type } from "typebox";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createEngineSessionFromServices,
	createEngineSessionServices,
} from "../../../src/core/engine-session-services.js";
import { DefaultResourceLoader } from "../../../src/core/resource-loader.js";
import { createEngineSession } from "../../../src/core/sdk.js";
import { SessionManager } from "../../../src/core/session-manager.js";
import { SettingsManager } from "../../../src/core/settings-manager.js";

describe("regression #3592: no-builtin-tools keeps extension tools enabled", () => {
	let tempDir: string;
	let engineDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `astroagent-no-builtin-tools-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		engineDir = join(tempDir, "engine");
		mkdirSync(engineDir, { recursive: true });
	});

	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	async function createSession(options?: { noTools?: "all" | "builtin"; tools?: string[] }) {
		const settingsManager = SettingsManager.create(tempDir, engineDir);
		const sessionManager = SessionManager.inMemory(tempDir);
		const resourceLoader = new DefaultResourceLoader({
			cwd: tempDir,
			engineDir,
			settingsManager,
			extensionFactories: [
				(AstroAgent) => {
					AstroAgent.on("session_start", () => {
						AstroAgent.registerTool({
							name: "dynamic_tool",
							label: "Dynamic Tool",
							description: "Tool registered from session_start",
							promptSnippet: "Run dynamic test behavior",
							parameters: Type.Object({}),
							execute: async () => ({
								content: [{ type: "text", text: "ok" }],
								details: {},
							}),
						});
					});
				},
			],
		});
		await resourceLoader.reload();

		const { session } = await createEngineSession({
			cwd: tempDir,
			engineDir,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			settingsManager,
			sessionManager,
			resourceLoader,
			noTools: options?.noTools,
			tools: options?.tools,
		});
		await session.bindExtensions({});
		return session;
	}

	it("keeps extension tools active when built-in defaults are disabled", async () => {
		const session = await createSession({ noTools: "builtin" });

		expect(session.getAllTools().map((tool) => tool.name)).toContain("dynamic_tool");
		expect(session.getActiveToolNames()).toEqual(["dynamic_tool"]);
		expect(session.systemPrompt).toContain("dynamic_tool: Run dynamic test behavior");
		expect(session.systemPrompt).not.toContain("read:");
		expect(session.systemPrompt).not.toContain("bash:");
		session.dispose();
	});

	it("still disables all tools when noTools is all", async () => {
		const session = await createSession({ noTools: "all" });

		expect(session.getAllTools()).toEqual([]);
		expect(session.getActiveToolNames()).toEqual([]);
		expect(session.systemPrompt).toContain("(none)");
		session.dispose();
	});

	it("propagates noTools through service-based session creation", async () => {
		const settingsManager = SettingsManager.create(tempDir, engineDir);
		const sessionManager = SessionManager.inMemory(tempDir);
		const services = await createEngineSessionServices({
			cwd: tempDir,
			engineDir,
			settingsManager,
		});

		const { session } = await createEngineSessionFromServices({
			services,
			sessionManager,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			noTools: "builtin",
		});

		expect(session.getActiveToolNames()).toEqual([]);
		expect(session.systemPrompt).toContain("(none)");
		expect(session.systemPrompt).not.toContain("read:");
		session.dispose();
	});
});
