import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { EngineTool } from "astro-engine";
import { type Static, Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const snapshotSchema = Type.Object({
	action: Type.String({ description: "Action to perform: 'create', 'restore', or 'list'" }),
	snapshotName: Type.Optional(
		Type.String({ description: "Name of the snapshot (optional for create, required for restore)" }),
	),
});

export type SnapshotToolInput = Static<typeof snapshotSchema>;

export function createSnapshotToolDefinition(cwd: string): ToolDefinition<typeof snapshotSchema, undefined, any> {
	return {
		name: "snapshot",
		label: "snapshot",
		description:
			"Time-Travel Debugging: Create, restore, or list project snapshots. Use this to backup the workspace before risky operations, or to rollback when an error occurs.",
		promptSnippet: "Manage workspace snapshots",
		parameters: snapshotSchema,
		async execute(_toolCallId, { action, snapshotName }, _signal, _onUpdate, _ctx) {
			const astroagentDir = join(cwd, ".astroagent");
			const snapshotsDir = join(astroagentDir, "snapshots");

			if (!existsSync(astroagentDir)) mkdirSync(astroagentDir, { recursive: true });
			if (!existsSync(snapshotsDir)) mkdirSync(snapshotsDir, { recursive: true });

			const filterFunc = (src: string, _dest: string) => {
				const ignores = ["node_modules", ".git", ".astroagent", "dist"];
				for (const ignore of ignores) {
					if (
						src.includes(`\\${ignore}\\`) ||
						src.includes(`/${ignore}/`) ||
						src.endsWith(`\\${ignore}`) ||
						src.endsWith(`/${ignore}`)
					) {
						return false;
					}
				}
				return true;
			};

			let resultText = "";

			try {
				if (action === "create") {
					const name = snapshotName || `snap_${Date.now()}`;
					const targetDir = join(snapshotsDir, name);
					if (existsSync(targetDir)) {
						resultText = `Snapshot '${name}' already exists.`;
					} else {
						mkdirSync(targetDir, { recursive: true });
						const items = readdirSync(cwd);
						for (const item of items) {
							if (["node_modules", ".git", ".astroagent", "dist"].includes(item)) continue;
							cpSync(join(cwd, item), join(targetDir, item), { recursive: true, filter: filterFunc });
						}
						resultText = `Snapshot '${name}' created successfully at .astroagent/snapshots/${name}`;
					}
				} else if (action === "restore") {
					if (!snapshotName) {
						throw new Error("snapshotName is required for restore.");
					}
					const targetDir = join(snapshotsDir, snapshotName);
					if (!existsSync(targetDir)) {
						resultText = `Snapshot '${snapshotName}' not found.`;
					} else {
						const items = readdirSync(cwd);
						for (const item of items) {
							if (["node_modules", ".git", ".astroagent"].includes(item)) continue;
							rmSync(join(cwd, item), { recursive: true, force: true });
						}
						cpSync(targetDir, cwd, { recursive: true });
						resultText = `Workspace restored to snapshot '${snapshotName}'`;
					}
				} else if (action === "list") {
					const snaps = readdirSync(snapshotsDir);
					if (snaps.length === 0) {
						resultText = "No snapshots found.";
					} else {
						resultText = `Available snapshots:\n${snaps.join("\n")}`;
					}
				} else {
					throw new Error("Invalid action.");
				}
			} catch (err: any) {
				resultText = `Error executing snapshot action: ${err.message}`;
			}

			return {
				content: [{ type: "text", text: resultText }],
				details: undefined,
			};
		},
	};
}

export function createSnapshotTool(cwd: string): EngineTool<typeof snapshotSchema> {
	return wrapToolDefinition(createSnapshotToolDefinition(cwd));
}
