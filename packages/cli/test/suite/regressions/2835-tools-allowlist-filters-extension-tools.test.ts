import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "astro-core";
import { Type } from "typebox";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DefaultResourceLoader } from "../../../src/core/resource-loader.js";
import { createEngineSession } from "../../../src/core/sdk.js";
import { SessionManager } from "../../../src/core/session-manager.js";
import { SettingsManager } from "../../../src/core/settings-manager.js";

describe("regression #2835: tool allowlists filter extension tools", () => {
	let tempDir: string;
	let engineDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `astroagent-tools-filter-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		engineDir = join(tempDir, "engine");
		mkdirSync(engineDir, { recursive: true });
	});

	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	async function createSession(allowedToolNames?: string[]) {
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
			tools: allowedToolNames,
		});
		await session.bindExtensions({});
		return session;
	}

	it("allows only explicitly listed built-in and extension tools", async () => {
		const session = await createSession(["read", "dynamic_tool"]);

		expect(
			session
				.getAllTools()
				.map((tool) => tool.name)
				.sort(),
		).toEqual(["dynamic_tool", "read"]);
		expect(session.getActiveToolNames().sort()).toEqual(["dynamic_tool", "read"]);
		expect(session.systemPrompt).toContain("- read: Read file contents");
		expect(session.systemPrompt).toContain("- dynamic_tool: Run dynamic test behavior");
		expect(session.systemPrompt).not.toContain("- bash:");
		expect(session.systemPrompt).not.toContain("- edit:");
		session.dispose();
	});

	it("disables all tools when the allowlist is empty", async () => {
		const session = await createSession([]);

		expect(session.getAllTools()).toEqual([]);
		expect(session.getActiveToolNames()).toEqual([]);
		expect(session.systemPrompt).toContain("Available tools:\n(none)");
		expect(session.systemPrompt).not.toContain("dynamic_tool");
		session.dispose();
	});
});
