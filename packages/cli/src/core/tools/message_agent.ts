import type { EngineTool } from "astro-engine";
import { type Static, Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.js";
import { activeAgents, getWorkerPool } from "./invoke_subagent.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const messageAgentSchema = Type.Object({
	targetAgentId: Type.String({
		description:
			"The ID (TaskName) of the agent to send the message to. You can list active agents by passing 'list' as the targetAgentId.",
	}),
	message: Type.Optional(
		Type.String({ description: "The message payload to send. Required if targetAgentId is not 'list'." }),
	),
});

export type MessageAgentInput = Static<typeof messageAgentSchema>;

export function createMessageAgentToolDefinition(): ToolDefinition<typeof messageAgentSchema, undefined, any> {
	return {
		name: "message_agent",
		label: "message agent",
		description:
			"Multi-Agent Swarm: Send an IPC message to another active sub-agent running in a separate thread. This allows collaboration between specialized agents (e.g. Researcher sending docs to Coder).",
		promptSnippet: "Send message to a running sub-agent",
		parameters: messageAgentSchema,
		async execute(_toolCallId, { targetAgentId, message }, _signal, _onUpdate, _ctx) {
			if (targetAgentId === "list") {
				const agents = Array.from(activeAgents.keys());
				if (agents.length === 0)
					return { content: [{ type: "text", text: "No active sub-agents found." }], details: undefined };
				return {
					content: [{ type: "text", text: `Active sub-agents:\n- ${agents.join("\n- ")}` }],
					details: undefined,
				};
			}

			if (!message) {
				throw new Error("Message is required when targetAgentId is not 'list'.");
			}

			if (!activeAgents.has(targetAgentId)) {
				return {
					content: [
						{
							type: "text",
							text: `Error: Sub-agent '${targetAgentId}' not found. It may have already finished or the ID is incorrect.`,
						},
					],
					details: undefined,
				};
			}

			getWorkerPool().sendMessage(targetAgentId, message);

			return {
				content: [{ type: "text", text: `Message successfully delivered to agent '${targetAgentId}'.` }],
				details: undefined,
			};
		},
	};
}

export function createMessageAgentTool(): EngineTool<typeof messageAgentSchema> {
	return wrapToolDefinition(createMessageAgentToolDefinition());
}
