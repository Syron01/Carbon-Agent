// @ts-nocheck
/**
 * todo — In-memory todo list manager.
 *
 * The AI can add, check, uncheck, list, and remove tasks.
 * State persists in-memory for the lifetime of the process.
 * Useful for tracking multi-step plans, code review items, and session goals.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { EngineTool } from "astro-engine";
import { type Static, Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { getTextOutput } from "./render-utils.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

export interface TodoItem {
	id: number;
	text: string;
	done: boolean;
	createdAt: number;
}

// ── Persistent store ──
const MEMORY_FILE = path.join(process.cwd(), ".astroagent-memory.json");
const todoStore: Map<number, TodoItem> = new Map();
let nextId = 1;

function loadStore() {
	try {
		if (fs.existsSync(MEMORY_FILE)) {
			fs.unlinkSync(MEMORY_FILE);
		}
	} catch (_err) {
		// ignore
	}
	todoStore.clear();
	nextId = 1;
}

function saveStore() {
	try {
		const items = Array.from(todoStore.values()).sort((a, b) => a.id - b.id);
		fs.writeFileSync(MEMORY_FILE, JSON.stringify(items, null, 2), "utf-8");
	} catch (_err) {
		// ignore
	}
}

// Hydrate on load
loadStore();

const todoSchema = Type.Object({
	action: Type.Enum(
		{ add: "add", list: "list", check: "check", uncheck: "uncheck", remove: "remove", clear: "clear" },
		{ description: "Operation to perform" },
	),
	text: Type.Optional(Type.String({ description: "Task description (required for add)" })),
	id: Type.Optional(Type.Number({ description: "Task ID (required for check/uncheck/remove)" })),
});

export type TodoToolInput = Static<typeof todoSchema>;

export interface TodoToolDetails {
	count: number;
	done: number;
}

export function createTodoToolDefinition(): ToolDefinition<TodoToolInput, TodoToolDetails> {
	const definition: ToolDefinition<TodoToolInput, TodoToolDetails> = {
		name: "todo",
		label: "todo",
		description:
			"Manage an in-memory todo list. Add tasks, mark them done, or remove them. Use this to track multi-step plans, review items, and session goals without cluttering conversation history.",
		parameters: todoSchema,
		promptSnippet: "todo: add/list/check/uncheck/remove tasks (in-memory, persists across turns)",
		promptGuidelines: [
			"Use `todo` to track multi-step plans rather than listing steps in conversation — it saves tokens and persists across turns.",
		],
		execute: async (_toolCallId, input, _signal, _onUpdate, _context) => {
			const { action, text, id } = input;

			switch (action) {
				case "add": {
					if (!text || text.trim().length === 0) {
						return err("text", "Required for 'add' action");
					}
					const item: TodoItem = {
						id: nextId++,
						text: text.trim(),
						done: false,
						createdAt: Date.now(),
					};
					todoStore.set(item.id, item);
					saveStore();
					return {
						content: [{ type: "text", text: `[todo] + ${item.text} (#${item.id})` }],
						details: { count: todoStore.size, done: countDone() },
					};
				}

				case "list": {
					if (todoStore.size === 0) {
						return {
							content: [{ type: "text", text: "[todo] (empty)" }],
							details: { count: 0, done: 0 },
						};
					}
					const items = Array.from(todoStore.values()).sort((a, b) => a.id - b.id);
					const lines = items.map((item) => {
						const check = item.done ? "[x]" : "[ ]";
						return `${check} #${item.id} ${item.text}`;
					});
					const done = items.filter((i) => i.done).length;
					const text = `[todo ${done}/${items.length}]\n${lines.join("\n")}`;
					return {
						content: [{ type: "text", text }],
						details: { count: items.length, done },
					};
				}

				case "check": {
					if (id === undefined || id === null) {
						return err("id", "Required for 'check' action");
					}
					const checkItem = todoStore.get(id);
					if (!checkItem) {
						return err("id", `Task #${id} not found`);
					}
					checkItem.done = true;
					saveStore();
					return {
						content: [{ type: "text", text: `[todo] ✓ #${id} ${checkItem.text}` }],
						details: { count: todoStore.size, done: countDone() },
					};
				}

				case "uncheck": {
					if (id === undefined || id === null) {
						return err("id", "Required for 'uncheck' action");
					}
					const uncheckItem = todoStore.get(id);
					if (!uncheckItem) {
						return err("id", `Task #${id} not found`);
					}
					uncheckItem.done = false;
					saveStore();
					return {
						content: [{ type: "text", text: `[todo] ○ #${id} ${uncheckItem.text}` }],
						details: { count: todoStore.size, done: countDone() },
					};
				}

				case "remove": {
					if (id === undefined || id === null) {
						return err("id", "Required for 'remove' action");
					}
					const removed = todoStore.get(id);
					if (!removed) {
						return err("id", `Task #${id} not found`);
					}
					todoStore.delete(id);
					saveStore();
					return {
						content: [{ type: "text", text: `[todo] - #${id} ${removed.text}` }],
						details: { count: todoStore.size, done: countDone() },
					};
				}

				case "clear": {
					todoStore.clear();
					saveStore();
					nextId = 1;
					return {
						content: [{ type: "text", text: "[todo] cleared" }],
						details: { count: 0, done: 0 },
					};
				}

				default:
					return err("action", `Unknown action: ${action}`);
			}
		},
		render: (content, details) => {
			const text = getTextOutput(content);
			const count = details?.count ?? 0;
			const done = details?.done ?? 0;
			const header = `📋 Todo ${done}/${count}`;
			return {
				header,
				body: text,
			};
		},
	};

	return definition;
}

function countDone(): number {
	let c = 0;
	for (const item of todoStore.values()) {
		if (item.done) c++;
	}
	return c;
}

/** Get snapshot of current todo state (for UI panels) */
export function getTodoSnapshot(): { items: TodoItem[]; count: number; done: number } {
	const items = Array.from(todoStore.values()).sort((a, b) => a.id - b.id);
	return { items, count: items.length, done: items.filter((i) => i.done).length };
}

/** Apply a todo action (for API/UI use — shared with the tool) */
export function applyTodoAction(
	action: string,
	params: { text?: string; id?: number },
): { ok: boolean; error?: string } {
	switch (action) {
		case "add": {
			if (!params.text || params.text.trim().length === 0) return { ok: false, error: "text required" };
			const item: TodoItem = { id: nextId++, text: params.text.trim(), done: false, createdAt: Date.now() };
			todoStore.set(item.id, item);
			saveStore();
			return { ok: true };
		}
		case "check": {
			if (params.id === undefined || params.id === null) return { ok: false, error: "id required" };
			const ci = todoStore.get(params.id);
			if (!ci) return { ok: false, error: `Task #${params.id} not found` };
			ci.done = true;
			saveStore();
			return { ok: true };
		}
		case "uncheck": {
			if (params.id === undefined || params.id === null) return { ok: false, error: "id required" };
			const ui = todoStore.get(params.id);
			if (!ui) return { ok: false, error: `Task #${params.id} not found` };
			ui.done = false;
			saveStore();
			return { ok: true };
		}
		case "remove": {
			if (params.id === undefined || params.id === null) return { ok: false, error: "id required" };
			if (!todoStore.has(params.id)) return { ok: false, error: `Task #${params.id} not found` };
			todoStore.delete(params.id);
			saveStore();
			return { ok: true };
		}
		case "clear": {
			todoStore.clear();
			nextId = 1;
			saveStore();
			return { ok: true };
		}
		case "edit": {
			if (params.id === undefined || params.id === null) return { ok: false, error: "id required" };
			if (!params.text || params.text.trim().length === 0) return { ok: false, error: "text required" };
			const ei = todoStore.get(params.id);
			if (!ei) return { ok: false, error: `Task #${params.id} not found` };
			ei.text = params.text.trim();
			saveStore();
			return { ok: true };
		}
		default:
			return { ok: false, error: `Unknown action: ${action}` };
	}
}

export function createTodoTool(): EngineTool<TodoToolInput> {
	return wrapToolDefinition(createTodoToolDefinition());
}

function err(param: string, msg: string) {
	return {
		content: [{ type: "text" as const, text: `[todo] ${param}: ${msg}` }],
		details: { count: todoStore.size, done: countDone() },
	};
}
