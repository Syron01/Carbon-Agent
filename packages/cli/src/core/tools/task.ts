import { EventEmitter } from "node:events";
import type { EngineTool } from "astro-engine";
import { type Static, Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const taskSchema = Type.Object({
	action: Type.String({ description: "Action to perform: 'add', 'update', or 'clear'" }),
	id: Type.Optional(Type.String({ description: "Unique ID for the task (required for add and update)" })),
	label: Type.Optional(Type.String({ description: "Task description (e.g., 'Fix login bug', required for add)" })),
	status: Type.Optional(
		Type.String({ description: "Task status: 'pending', 'active', or 'done' (required for add and update)" }),
	),
});

export type TaskInput = Static<typeof taskSchema>;

export const taskEventEmitter = new EventEmitter();

export function createTaskToolDefinition(): ToolDefinition<typeof taskSchema, undefined, any> {
	return {
		name: "manage_task",
		label: "manage task",
		description:
			"Manage your internal task list shown in the UI panel. Use this to organize complex jobs into a roadmap or to-do list.",
		promptSnippet: "Manage internal task list",
		parameters: taskSchema,
		async execute(_toolCallId, { action, id, label, status }, _signal, _onUpdate, _ctx) {
			if (action === "add") {
				if (!id || !label || !status) {
					throw new Error("id, label, and status are required for 'add' action.");
				}
			} else if (action === "update") {
				if (!id || !status) {
					throw new Error("id and status are required for 'update' action.");
				}
			}

			// Emit event to the UI
			taskEventEmitter.emit("manage", { action, id, label, status });

			return {
				content: [{ type: "text", text: `Task list ${action} operation successful.` }],
				details: undefined,
			};
		},
	};
}

export function createTaskTool(): EngineTool<typeof taskSchema> {
	return wrapToolDefinition(createTaskToolDefinition());
}
