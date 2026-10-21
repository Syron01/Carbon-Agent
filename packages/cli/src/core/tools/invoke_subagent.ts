import { EventEmitter } from "node:events";
import type { EngineTool } from "astro-engine";
import { type Static, Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";
import { WorkerPool } from "./worker-pool.js";

const invokeSubagentSchema = Type.Object({
	TaskName: Type.String({ description: "Short human-readable name of the task. Also used as the agent ID for IPC." }),
	Task: Type.String({ description: "Detailed task description/prompt for the sub-agent." }),
	Context: Type.Optional(Type.String({ description: "Additional context to pass to the sub-agent." })),
	Model: Type.Optional(
		Type.String({ description: "Optional model id to run this sub-agent on. Defaults to the parent's current model." }),
	),
	Provider: Type.Optional(
		Type.String({ description: "Optional provider id for the Model above (e.g. anthropic, openai)." }),
	),
});

export type InvokeSubagentInput = Static<typeof invokeSubagentSchema>;

export const subagentEventEmitter = new EventEmitter();
export const activeAgents = new Map<string, true>();

let pool: WorkerPool | null = null;
export function getWorkerPool(): WorkerPool {
	if (!pool) {
		const workerUrl = new URL("invoke-subagent-worker.js", import.meta.url).href;
		pool = new WorkerPool(workerUrl);
		pool.on("start", (payload: unknown) => subagentEventEmitter.emit("start", payload));
		pool.on("update", (payload: unknown) => subagentEventEmitter.emit("update", payload));
		pool.on("end", (payload: unknown) => subagentEventEmitter.emit("end", payload));
	}
	return pool;
}

export function createInvokeSubagentToolDefinition(
	cwd: string,
): ToolDefinition<typeof invokeSubagentSchema, undefined, any> {
	return {
		name: "invoke_subagent",
		label: "invoke subagent",
		description:
			"Spawn a new sub-agent to perform a task. The sub-agent runs independently in the background (separate thread). Other agents can message this agent using its TaskName.",
		promptSnippet: "Delegate a complex task to a sub-agent",
		parameters: invokeSubagentSchema,
		async execute(_toolCallId, { TaskName, Task, Context, Model, Provider }, _signal, onUpdate, ctx) {
			if (!ctx.model) {
				throw new Error("No model available to spawn sub-agent.");
			}

			if (activeAgents.has(TaskName)) {
				throw new Error(`An agent with TaskName '${TaskName}' is already running.`);
			}

			// Optional per-sub-agent model override (falls back to the parent model).
			let subModel = ctx.model;
			if (Model) {
				try {
					const resolved = Provider
						? ctx.modelRegistry?.find?.(Provider, Model)
						: ctx.modelRegistry?.getAll?.().find((m: any) => m.id === Model);
					if (resolved) subModel = resolved;
				} catch {
					/* keep the parent model on resolution failure */
				}
			}

			if (onUpdate) {
				onUpdate({
					content: [
						{
							type: "text",
							text: `[Sub-agent '${TaskName}' spawned in separate thread. Waiting for completion...]`,
						},
					],
					details: undefined,
				});
			}

			const systemPrompt = `You are a Astro-Agent sub-agent. Your ID is '${TaskName}'.\n\nTask Details:\n${Task}\n\nContext:\n${Context ?? "None"}\n\nYou can communicate with other agents via the message_agent tool.\n\n${ctx.getSystemPrompt()}`;

			activeAgents.set(TaskName, true);
			subagentEventEmitter.emit("start", { id: TaskName, taskName: TaskName, model: subModel?.id });

			const p = getWorkerPool();

			try {
				const result = await p.runTask(
					{
						taskName: TaskName,
						task: Task,
						cwd,
						systemPrompt,
						model: subModel,
					},
					_signal,
				);

				return result as any;
			} catch (err: unknown) {
				throw new Error(`Sub-agent failed: ${(err as Error).message}`);
			} finally {
				activeAgents.delete(TaskName);
				subagentEventEmitter.emit("end", { id: TaskName });
			}
		},
	};
}

export function createInvokeSubagentTool(cwd: string): EngineTool<typeof invokeSubagentSchema> {
	return wrapToolDefinition(createInvokeSubagentToolDefinition(cwd));
}
