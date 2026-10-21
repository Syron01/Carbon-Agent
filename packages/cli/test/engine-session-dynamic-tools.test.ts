import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "astro-core";
import { Type } from "typebox";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DefaultResourceLoader } from "../src/core/resource-loader.js";
import { createEngineSession } from "../src/core/sdk.js";
import { SessionManager } from "../src/core/session-manager.js";
import { SettingsManager } from "../src/core/settings-manager.js";

describe("EngineSession dynamic tool registration", () => {
	let tempDir: string;
	let engineDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `astroagent-dynamic-tool-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		engineDir = join(tempDir, "engine");
		mkdirSync(engineDir, { recursive: true });
	});

	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("refreshes tool registry when tools are registered after initialization", async () => {
		const settingsManager = SettingsManager.create(tempDir, engineDir);
		const sessionManager = SessionManager.inMemory();

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
							promptGuidelines: ["Use dynamic_tool when the user asks for dynamic behavior tests."],
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
		});

		expect(session.getAllTools().map((tool) => tool.name)).not.toContain("dynamic_tool");

		await session.bindExtensions({});

		const allTools = session.getAllTools();
		const dynamicTool = allTools.find((tool) => tool.name === "dynamic_tool");
		const readTool = allTools.find((tool) => tool.name === "read");

		expect(allTools.map((tool) => tool.name)).toContain("dynamic_tool");
		expect(dynamicTool?.sourceInfo).toMatchObject({
			path: "<inline:1>",
			source: "inline",
			scope: "temporary",
			origin: "top-level",
		});
		expect(readTool?.sourceInfo).toMatchObject({
			path: "<builtin:read>",
			source: "builtin",
			scope: "temporary",
			origin: "top-level",
		});
		expect(session.getActiveToolNames()).toContain("dynamic_tool");
		expect(session.systemPrompt).toContain("- dynamic_tool: Run dynamic test behavior");
		expect(session.systemPrompt).toContain("- Use dynamic_tool when the user asks for dynamic behavior tests.");

		session.dispose();
	});

	it("returns source metadata for SDK custom tools", async () => {
		const settingsManager = SettingsManager.create(tempDir, engineDir);
		const sessionManager = SessionManager.inMemory();
		const resourceLoader = new DefaultResourceLoader({
			cwd: tempDir,
			engineDir,
			settingsManager,
		});
		await resourceLoader.reload();

		const { session } = await createEngineSession({
			cwd: tempDir,
			engineDir,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			settingsManager,
			sessionManager,
			resourceLoader,
			customTools: [
				{
					name: "sdk_tool",
					label: "SDK Tool",
					description: "Tool registered through createEngineSession",
					parameters: Type.Object({}),
					execute: async () => ({
						content: [{ type: "text", text: "ok" }],
						details: {},
					}),
				},
			],
		});

		const sdkTool = session.getAllTools().find((tool) => tool.name === "sdk_tool");
		expect(sdkTool?.sourceInfo).toMatchObject({
			path: "<sdk:sdk_tool>",
			source: "sdk",
			scope: "temporary",
			origin: "top-level",
		});
		expect(session.getActiveToolNames()).toContain("sdk_tool");

		session.dispose();
	});

	it("activates Discord tools after a token is added and the session reloads", async () => {
		const settingsManager = SettingsManager.create(tempDir, engineDir);
		const sessionManager = SessionManager.inMemory();
		const resourceLoader = new DefaultResourceLoader({
			cwd: tempDir,
			engineDir,
			settingsManager,
		});
		await resourceLoader.reload();

		const { session } = await createEngineSession({
			cwd: tempDir,
			engineDir,
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			settingsManager,
			sessionManager,
			resourceLoader,
		});

		expect(session.getActiveToolNames()).not.toContain("discord_list_guilds");

		settingsManager.setDiscordToken("test-token");
		await session.reload();

		expect(session.getActiveToolNames()).toEqual(
			expect.arrayContaining([
				"discord_list_guilds",
				"discord_get_channels",
				"discord_send_message",
				"discord_manage_channel",
			]),
		);

		session.dispose();
	});

	it("keeps custom tools active but omits them from available tools when promptSnippet is not provided", async () => {
		const settingsManager = SettingsManager.create(tempDir, engineDir);
		const sessionManager = SessionManager.inMemory();

		const resourceLoader = new DefaultResourceLoader({
			cwd: tempDir,
			engineDir,
			settingsManager,
			extensionFactories: [
				(AstroAgent) => {
					AstroAgent.on("session_start", () => {
						AstroAgent.registerTool({
							name: "hidden_tool",
							label: "Hidden Tool",
							description: "Description should not appear in available tools",
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
		});

		await session.bindExtensions({});

		expect(session.getAllTools().map((tool) => tool.name)).toContain("hidden_tool");
		expect(session.getActiveToolNames()).toContain("hidden_tool");
		expect(session.systemPrompt).not.toContain("hidden_tool");
		expect(session.systemPrompt).not.toContain("Description should not appear in available tools");

		session.dispose();
	});
});
