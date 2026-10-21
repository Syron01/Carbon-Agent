import { parentPort } from "node:worker_threads";
import { Engine } from "astro-engine";
import { createCodingTools } from "./index.js";

let engine: Engine | null = null;

parentPort!.on("message", async (msg: Record<string, unknown>) => {
	switch (msg.type) {
		case "run": {
			const task = msg.task as {
				taskName: string;
				task: string;
				cwd: string;
				systemPrompt: string;
				model: unknown;
			};

			parentPort!.postMessage({
				type: "event",
				name: "start",
				payload: { id: task.taskName, taskName: task.taskName },
			});

			engine = new Engine({
				initialState: {
					model: task.model as any,
					systemPrompt: task.systemPrompt,
					tools: createCodingTools(task.cwd),
				},
			});

			engine.subscribe((event: unknown) => {
				parentPort!.postMessage({ type: "event", name: "update", payload: { id: task.taskName, event } });
			});

			try {
				await engine.prompt(task.task);
				await engine.waitForIdle();

				const finalMessages = engine.state.messages;
				const assistantMessages = (finalMessages as any[]).filter((m) => m.role === "assistant");
				const finalOutput =
					assistantMessages.length > 0
						? (assistantMessages[assistantMessages.length - 1].content as Array<{ type: string; text: string }>)
								.filter((c) => c.type === "text")
								.map((c) => c.text)
								.join("\n")
						: "Task completed with no text output.";

				parentPort!.postMessage({
					type: "result",
					data: {
						content: [
							{
								type: "text",
								text: `Sub-agent completed task '${task.taskName}'.\n\nResult:\n${finalOutput}`,
							},
						],
						details: undefined,
					},
				});
			} catch (err: unknown) {
				parentPort!.postMessage({
					type: "error",
					message: `Sub-agent failed: ${(err as Error).message}`,
				});
			} finally {
				parentPort!.postMessage({ type: "event", name: "end", payload: { id: task.taskName } });
				engine = null;
			}
			break;
		}

		case "ipc_message": {
			if (engine) {
				engine.prompt(`[IPC MESSAGE from another Agent]\n\n${msg.message as string}`);
			}
			break;
		}

		case "abort": {
			if (engine) {
				engine.abort();
			}
			break;
		}

		case "shutdown": {
			if (engine) {
				engine.abort();
			}
			break;
		}
	}
});
