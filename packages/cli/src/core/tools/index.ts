// @ts-nocheck
export { type AskQuestionInput, createAskQuestionTool, createAskQuestionToolDefinition } from "./ask_question.js";
export {
	type BashOperations,
	type BashSpawnContext,
	type BashSpawnHook,
	type BashToolDetails,
	type BashToolInput,
	type BashToolOptions,
	createBashTool,
	createBashToolDefinition,
	createLocalBashOperations,
} from "./bash.js";
export {
	type BrowserPageToolInput,
	type BrowserTabsToolInput,
	type BrowserToolDetails,
	createBrowserPageTool,
	createBrowserPageToolDefinition,
	createBrowserTabsTool,
	createBrowserTabsToolDefinition,
} from "./browser.js";
export { createCodebaseIndexTool, createCodebaseIndexToolDefinition } from "./codebase_index.js";
export {
	createDigestTool,
	createDigestToolDefinition,
	type DigestToolInput,
} from "./digest.js";
export {
	createDiscordGetChannelsTool,
	createDiscordListGuildsTool,
	createDiscordManageChannelTool,
	createDiscordSendMessageTool,
	createDiscordToolDefinitions,
	type DiscordToolOptions,
} from "./discord.js";
export {
	createEditTool,
	createEditToolDefinition,
	type EditOperations,
	type EditToolDetails,
	type EditToolInput,
	type EditToolOptions,
} from "./edit.js";
export { withFileMutationQueue } from "./file-mutation-queue.js";
export {
	createFindTool,
	createFindToolDefinition,
	type FindOperations,
	type FindToolDetails,
	type FindToolInput,
	type FindToolOptions,
} from "./find.js";
export { createGitShipTool, createGitShipToolDefinition } from "./git-ship.js";
export {
	createGrepTool,
	createGrepToolDefinition,
	type GrepOperations,
	type GrepToolDetails,
	type GrepToolInput,
	type GrepToolOptions,
} from "./grep.js";
export { createIntuitionTool, createIntuitionToolDefinition } from "./intuition.js";
export {
	createInvokeSubagentTool,
	createInvokeSubagentToolDefinition,
	type InvokeSubagentInput,
} from "./invoke_subagent.js";
export {
	createLsTool,
	createLsToolDefinition,
	type LsOperations,
	type LsToolDetails,
	type LsToolInput,
	type LsToolOptions,
} from "./ls.js";
export {
	createMathEvaluateTool,
	createMathEvaluateToolDefinition,
	type MathEvaluateToolDetails,
	type MathEvaluateToolInput,
} from "./math_evaluate.js";
export { createMessageAgentTool, createMessageAgentToolDefinition, type MessageAgentInput } from "./message_agent.js";
export {
	createReadTool,
	createReadToolDefinition,
	type ReadOperations,
	type ReadToolDetails,
	type ReadToolInput,
	type ReadToolOptions,
} from "./read.js";
export { createSemanticSearchTool, createSemanticSearchToolDefinition } from "./semantic_search.js";
export { createSnapshotTool, createSnapshotToolDefinition, type SnapshotToolInput } from "./snapshot.js";
export {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	type TruncationOptions,
	type TruncationResult,
	truncateHead,
	truncateLine,
	truncateTail,
} from "./truncate.js";
export {
	createUserProfileTool,
	createUserProfileToolDefinition,
	type UserProfileToolInput,
} from "./update_user_profile.js";
export {
	createWriteTool,
	createWriteToolDefinition,
	type WriteOperations,
	type WriteToolInput,
	type WriteToolOptions,
} from "./write.js";

import type { EngineTool } from "astro-engine";
import type { ToolDefinition } from "../extensions/types.js";
import { createAskQuestionTool, createAskQuestionToolDefinition } from "./ask_question.js";
import { type BashToolOptions, createBashTool, createBashToolDefinition } from "./bash.js";
import { createCodebaseIndexTool, createCodebaseIndexToolDefinition } from "./codebase_index.js";
import { createDigestTool, createDigestToolDefinition } from "./digest.js";
import {
	createDiscordGetChannelsTool,
	createDiscordListGuildsTool,
	createDiscordManageChannelTool,
	createDiscordSendMessageTool,
	createDiscordToolDefinitions,
	type DiscordToolOptions,
} from "./discord.js";
import { createEditTool, createEditToolDefinition, type EditToolOptions } from "./edit.js";
import { createFindTool, createFindToolDefinition, type FindToolOptions } from "./find.js";
import { createGitShipTool, createGitShipToolDefinition } from "./git-ship.js";
import { createGrepTool, createGrepToolDefinition, type GrepToolOptions } from "./grep.js";
import { createInvokeSubagentTool, createInvokeSubagentToolDefinition } from "./invoke_subagent.js";
import { createLsTool, createLsToolDefinition, type LsToolOptions } from "./ls.js";
import { createMathEvaluateTool, createMathEvaluateToolDefinition } from "./math_evaluate.js";
import { createMessageAgentTool, createMessageAgentToolDefinition } from "./message_agent.js";
import { createReadTool, createReadToolDefinition, type ReadToolOptions } from "./read.js";
import { createSemanticSearchTool, createSemanticSearchToolDefinition } from "./semantic_search.js";
import { createSnapshotTool, createSnapshotToolDefinition } from "./snapshot.js";
import { createTaskTool, createTaskToolDefinition } from "./task.js";
import { createTodoTool, createTodoToolDefinition } from "./todo.js";
import { createUserProfileTool, createUserProfileToolDefinition } from "./update_user_profile.js";
import { createWriteTool, createWriteToolDefinition, type WriteToolOptions } from "./write.js";

export type Tool = EngineTool<any>;
export type ToolDef = ToolDefinition<any, any>;
export type ToolName =
	| "read"
	| "bash"
	| "edit"
	| "write"
	| "grep"
	| "find"
	| "ls"
	| "semantic_search"
	| "codebase_index"
	| "git_ship"
	| "ask_question"
	| "invoke_subagent"
	| "discord_list_guilds"
	| "discord_get_channels"
	| "discord_send_message"
	| "discord_manage_channel"
	| "snapshot"
	| "update_user_profile"
	| "message_agent"
	| "digest"
	| "todo";

export const allToolNames: Set<ToolName> = new Set([
	"read",
	"bash",
	"edit",
	"write",
	"grep",
	"find",
	"ls",
	"semantic_search",
	"codebase_index",
	"git_ship",
	"ask_question",
	"invoke_subagent",
	"discord_list_guilds",
	"discord_get_channels",
	"discord_send_message",
	"discord_manage_channel",
	"snapshot",
	"update_user_profile",
	"message_agent",
	"digest",
	"todo",
]);

export interface ToolsOptions {
	read?: ReadToolOptions;
	bash?: BashToolOptions;
	write?: WriteToolOptions;
	edit?: EditToolOptions;
	grep?: GrepToolOptions;
	find?: FindToolOptions;
	ls?: LsToolOptions;
	discord?: DiscordToolOptions;
	/** Returns whether the current model supports image/vision input */
	getModelVisionSupport?: () => boolean;
}

export function createToolDefinition(toolName: ToolName, cwd: string, options?: ToolsOptions): ToolDef {
	switch (toolName) {
		case "read":
			return createReadToolDefinition(cwd, options?.read);
		case "bash":
			return createBashToolDefinition(cwd, options?.bash);
		case "edit":
			return createEditToolDefinition(cwd, options?.edit);
		case "write":
			return createWriteToolDefinition(cwd, options?.write);
		case "grep":
			return createGrepToolDefinition(cwd, options?.grep);
		case "find":
			return createFindToolDefinition(cwd, options?.find);
		case "ls":
			return createLsToolDefinition(cwd, options?.ls);
		case "semantic_search":
			return createSemanticSearchToolDefinition(cwd);
		case "codebase_index":
			return createCodebaseIndexToolDefinition(cwd);
		case "git_ship":
			return createGitShipToolDefinition(cwd);
		case "browser_tabs":
			return createBrowserTabsToolDefinition();
		case "browser_page":
			return createBrowserPageToolDefinition();
		case "ask_question":
			return createAskQuestionToolDefinition();
		case "invoke_subagent":
			return createInvokeSubagentToolDefinition(cwd);
		case "discord_list_guilds":
		case "discord_get_channels":
		case "discord_send_message":
		case "discord_manage_channel":
			return createDiscordToolDefinitions(options?.discord).find((definition) => definition.name === toolName)!;
		case "snapshot":
			return createSnapshotToolDefinition(cwd);
		case "update_user_profile":
			return createUserProfileToolDefinition();
		case "message_agent":
			return createMessageAgentToolDefinition();
		case "digest":
			return createDigestToolDefinition(cwd);
		case "todo":
			return createTodoToolDefinition();
		default:
			throw new Error(`Unknown tool name: ${toolName}`);
	}
}

export function createTool(toolName: ToolName, cwd: string, options?: ToolsOptions): Tool {
	switch (toolName) {
		case "read":
			return createReadTool(cwd, options?.read);
		case "bash":
			return createBashTool(cwd, options?.bash);
		case "edit":
			return createEditTool(cwd, options?.edit);
		case "write":
			return createWriteTool(cwd, options?.write);
		case "grep":
			return createGrepTool(cwd, options?.grep);
		case "find":
			return createFindTool(cwd, options?.find);
		case "ls":
			return createLsTool(cwd, options?.ls);
		case "semantic_search":
			return createSemanticSearchTool(cwd);
		case "codebase_index":
			return createCodebaseIndexTool(cwd);
		case "git_ship":
			return createGitShipTool(cwd);
		case "browser_tabs":
			return createBrowserTabsTool();
		case "browser_page":
			return createBrowserPageTool(options?.getModelVisionSupport);
		case "ask_question":
			return createAskQuestionTool();
		case "invoke_subagent":
			return createInvokeSubagentTool(cwd);
		case "discord_list_guilds":
			return createDiscordListGuildsTool(options?.discord);
		case "discord_get_channels":
			return createDiscordGetChannelsTool(options?.discord);
		case "discord_send_message":
			return createDiscordSendMessageTool(options?.discord);
		case "discord_manage_channel":
			return createDiscordManageChannelTool(options?.discord);
		case "snapshot":
			return createSnapshotTool(cwd);
		case "update_user_profile":
			return createUserProfileTool();
		case "message_agent":
			return createMessageAgentTool();
		case "digest":
			return createDigestTool(cwd);
		case "todo":
			return createTodoTool();
		case "intuition":
			return createIntuitionTool();
		default:
			throw new Error(`Unknown tool name: ${toolName}`);
	}
}

export function createCodingToolDefinitions(cwd: string, options?: ToolsOptions): ToolDef[] {
	return [
		createReadToolDefinition(cwd, options?.read),
		createBashToolDefinition(cwd, options?.bash),
		createEditToolDefinition(cwd, options?.edit),
		createWriteToolDefinition(cwd, options?.write),
		createBrowserTabsToolDefinition(),
		createBrowserPageToolDefinition(),
		createAskQuestionToolDefinition(),
		createInvokeSubagentToolDefinition(cwd),
		createTaskToolDefinition(),
		createSnapshotToolDefinition(cwd),
		createUserProfileToolDefinition(),
		createMessageAgentToolDefinition(),
		createIntuitionToolDefinition(),
		createMathEvaluateToolDefinition(),
	];
}

export function createReadOnlyToolDefinitions(cwd: string, options?: ToolsOptions): ToolDef[] {
	return [
		createReadToolDefinition(cwd, options?.read),
		createGrepToolDefinition(cwd, options?.grep),
		createFindToolDefinition(cwd, options?.find),
		createLsToolDefinition(cwd, options?.ls),
	];
}

export function createAllToolDefinitions(cwd: string, options?: ToolsOptions): Record<ToolName, ToolDef> {
	return {
		read: createReadToolDefinition(cwd, options?.read),
		bash: createBashToolDefinition(cwd, options?.bash),
		edit: createEditToolDefinition(cwd, options?.edit),
		write: createWriteToolDefinition(cwd, options?.write),
		grep: createGrepToolDefinition(cwd, options?.grep),
		find: createFindToolDefinition(cwd, options?.find),
		ls: createLsToolDefinition(cwd, options?.ls),
		semantic_search: createSemanticSearchToolDefinition(cwd),
		codebase_index: createCodebaseIndexToolDefinition(cwd),
		git_ship: createGitShipToolDefinition(cwd),
		ask_question: createAskQuestionToolDefinition(),
		invoke_subagent: createInvokeSubagentToolDefinition(cwd),
		snapshot: createSnapshotToolDefinition(cwd),
		update_user_profile: createUserProfileToolDefinition(),
		message_agent: createMessageAgentToolDefinition(),
		digest: createDigestToolDefinition(cwd),
		todo: createTodoToolDefinition(),
		math_evaluate: createMathEvaluateToolDefinition(),
		...Object.fromEntries(createDiscordToolDefinitions(options?.discord).map((tool) => [tool.name, tool])),
	};
}

export function createCodingTools(cwd: string, options?: ToolsOptions): Tool[] {
	return [
		createReadTool(cwd, options?.read),
		createBashTool(cwd, options?.bash),
		createEditTool(cwd, options?.edit),
		createWriteTool(cwd, options?.write),
		createAskQuestionTool(),
		createInvokeSubagentTool(cwd),
		createTaskTool(),
		createSnapshotTool(cwd),
		createUserProfileTool(),
		createMessageAgentTool(),
		createMathEvaluateTool(),
	];
}

export function createReadOnlyTools(cwd: string, options?: ToolsOptions): Tool[] {
	return [
		createReadTool(cwd, options?.read),
		createGrepTool(cwd, options?.grep),
		createFindTool(cwd, options?.find),
		createLsTool(cwd, options?.ls),
	];
}

export function createAllTools(cwd: string, options?: ToolsOptions): Record<ToolName, Tool> {
	return {
		read: createReadTool(cwd, options?.read),
		bash: createBashTool(cwd, options?.bash),
		edit: createEditTool(cwd, options?.edit),
		write: createWriteTool(cwd, options?.write),
		grep: createGrepTool(cwd, options?.grep),
		find: createFindTool(cwd, options?.find),
		ls: createLsTool(cwd, options?.ls),
		semantic_search: createSemanticSearchTool(cwd),
		codebase_index: createCodebaseIndexTool(cwd),
		git_ship: createGitShipTool(cwd),
		ask_question: createAskQuestionTool(),
		invoke_subagent: createInvokeSubagentTool(cwd),
		discord_list_guilds: createDiscordListGuildsTool(options?.discord),
		discord_get_channels: createDiscordGetChannelsTool(options?.discord),
		discord_send_message: createDiscordSendMessageTool(options?.discord),
		discord_manage_channel: createDiscordManageChannelTool(options?.discord),
		snapshot: createSnapshotTool(cwd),
		update_user_profile: createUserProfileTool(),
		message_agent: createMessageAgentTool(),
		math_evaluate: createMathEvaluateTool(),
		digest: createDigestTool(cwd),
		todo: createTodoTool(),
		intuition: createIntuitionTool(),
	};
}
