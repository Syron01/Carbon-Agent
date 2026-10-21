import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ENV_AGENT_DIR } from "../src/config.js";
import { KeybindingsManager } from "../src/core/keybindings.js";
import { runMigrations } from "../src/migrations.js";

describe("keybindings migration", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs.splice(0)) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	function createEngineDir(config: Record<string, unknown>): string {
		const engineDir = fs.mkdtempSync(path.join(os.tmpdir(), "astroagent-keybindings-test-"));
		tempDirs.push(engineDir);
		fs.writeFileSync(path.join(engineDir, "keybindings.json"), `${JSON.stringify(config, null, 2)}\n`, "utf-8");
		return engineDir;
	}

	it("rewrites old key names to namespaced ids", () => {
		const engineDir = createEngineDir({
			cursorUp: ["up", "ctrl+p"],
			expandTools: "ctrl+x",
		});
		const previousEngineDir = process.env[ENV_AGENT_DIR];
		process.env[ENV_AGENT_DIR] = engineDir;
		runMigrations(engineDir);
		if (previousEngineDir === undefined) {
			delete process.env[ENV_AGENT_DIR];
		} else {
			process.env[ENV_AGENT_DIR] = previousEngineDir;
		}

		const migrated = JSON.parse(fs.readFileSync(path.join(engineDir, "keybindings.json"), "utf-8")) as Record<
			string,
			unknown
		>;
		expect(migrated).toEqual({
			"tui.editor.cursorUp": ["up", "ctrl+p"],
			"app.tools.expand": "ctrl+x",
		});
	});

	it("keeps the namespaced value when old and new names both exist", () => {
		const engineDir = createEngineDir({
			expandTools: "ctrl+x",
			"app.tools.expand": "ctrl+y",
		});
		const previousEngineDir = process.env[ENV_AGENT_DIR];
		process.env[ENV_AGENT_DIR] = engineDir;
		runMigrations(engineDir);
		if (previousEngineDir === undefined) {
			delete process.env[ENV_AGENT_DIR];
		} else {
			process.env[ENV_AGENT_DIR] = previousEngineDir;
		}

		const migrated = JSON.parse(fs.readFileSync(path.join(engineDir, "keybindings.json"), "utf-8")) as Record<
			string,
			unknown
		>;
		expect(migrated).toEqual({
			"app.tools.expand": "ctrl+y",
		});
	});

	it("loads old key names in memory before the file is rewritten", () => {
		const engineDir = createEngineDir({
			selectConfirm: "enter",
			interrupt: "ctrl+x",
		});

		const keybindings = KeybindingsManager.create(engineDir);

		expect(keybindings.getUserBindings()).toEqual({
			"tui.select.confirm": "enter",
			"app.interrupt": "ctrl+x",
		});
		const effective = keybindings.getEffectiveConfig();
		expect(effective["tui.select.confirm"]).toBe("enter");
		expect(effective["app.interrupt"]).toBe("ctrl+x");
	});
});
