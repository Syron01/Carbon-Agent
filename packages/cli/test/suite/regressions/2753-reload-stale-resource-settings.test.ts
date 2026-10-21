import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerFauxProvider } from "astro-core";
import { afterEach, describe, expect, it } from "vitest";
import { AuthStorage } from "../../../src/core/auth-storage.js";
import {
	type CreateEngineSessionRuntimeFactory,
	createEngineSessionFromServices,
	createEngineSessionRuntime,
	createEngineSessionServices,
} from "../../../src/core/engine-session-runtime.js";
import { SessionManager } from "../../../src/core/session-manager.js";

describe("issue #2753 reload stale resource settings", () => {
	const cleanups: Array<() => void> = [];

	afterEach(() => {
		while (cleanups.length > 0) {
			cleanups.pop()?.();
		}
	});

	it("applies updated top-level prompt settings on reload after startup", async () => {
		const tempDir = join(tmpdir(), `astroagent-2753-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		const engineDir = join(tempDir, "engine");
		const promptsDir = join(engineDir, "prompts");
		mkdirSync(promptsDir, { recursive: true });
		writeFileSync(join(promptsDir, "test.md"), "Echo test prompt\n");

		const faux = registerFauxProvider({
			models: [{ id: "faux-1", reasoning: false }],
		});
		const authStorage = AuthStorage.inMemory();
		authStorage.setRuntimeApiKey(faux.getModel().provider, "faux-key");

		const createRuntime: CreateEngineSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
			const services = await createEngineSessionServices({
				cwd,
				engineDir,
				authStorage,
				resourceLoaderOptions: {
					extensionFactories: [
						(AstroAgent) => {
							AstroAgent.registerProvider(faux.getModel().provider, {
								baseUrl: faux.getModel().baseUrl,
								apiKey: "faux-key",
								api: faux.api,
								models: faux.models.map((registeredModel) => ({
									id: registeredModel.id,
									name: registeredModel.name,
									api: registeredModel.api,
									reasoning: registeredModel.reasoning,
									input: registeredModel.input,
									cost: registeredModel.cost,
									contextWindow: registeredModel.contextWindow,
									maxTokens: registeredModel.maxTokens,
								})),
							});
						},
					],
					noSkills: true,
					noThemes: true,
				},
			});
			return {
				...(await createEngineSessionFromServices({
					services,
					sessionManager,
					sessionStartEvent,
					model: faux.getModel(),
				})),
				services,
				diagnostics: services.diagnostics,
			};
		};
		const runtime = await createEngineSessionRuntime(createRuntime, {
			cwd: tempDir,
			engineDir,
			sessionManager: SessionManager.create(tempDir),
		});

		cleanups.push(() => {
			runtime.session.dispose();
			faux.unregister();
			if (existsSync(tempDir)) {
				rmSync(tempDir, { recursive: true, force: true });
			}
		});

		expect(runtime.session.promptTemplates.map((prompt) => prompt.name)).toContain("test");

		writeFileSync(
			join(engineDir, "settings.json"),
			`${JSON.stringify({ prompts: ["-prompts/test.md"] }, null, 2)}\n`,
		);

		await runtime.session.reload();

		expect(runtime.services.settingsManager.getGlobalSettings().prompts).toEqual(["-prompts/test.md"]);
		expect(runtime.session.promptTemplates.map((prompt) => prompt.name)).not.toContain("test");
	});
});
