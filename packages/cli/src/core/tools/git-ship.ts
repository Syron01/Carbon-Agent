// @ts-nocheck
import type { EngineTool } from "astro-engine";
import { Type } from "typebox";
import type { ToolDefinition } from "../extensions/types.js";
import {
	commitAll,
	createBranch,
	createPR,
	getDiffSummary,
	getGitStatus,
	pushBranch,
	shipChanges,
} from "../git-utils.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const gitShipSchema = Type.Object({
	action: Type.Union(
		[
			Type.Literal("status"),
			Type.Literal("commit"),
			Type.Literal("branch"),
			Type.Literal("push"),
			Type.Literal("pr"),
			Type.Literal("ship"),
		],
		{ description: "Git action to perform" },
	),
	message: Type.Optional(Type.String({ description: "Commit/PR message" })),
	branchName: Type.Optional(Type.String({ description: "Branch name" })),
});

export function createGitShipToolDefinition(cwd: string): ToolDefinition<typeof gitShipSchema, any, any> {
	return {
		name: "git_ship",
		label: "git_ship",
		description: "Executes the Git status/branch/commit/push/PR/ship workflow. ship = branch + commit + push + PR.",
		promptSnippet: "Ship Git changes (branch/commit/push/PR)",
		parameters: gitShipSchema,
		async execute(_id, input, signal) {
			if (signal?.aborted) throw new Error("aborted");
			const action = input.action || "status";
			let text = "";
			if (action === "status") text = await getGitStatus(cwd);
			else if (action === "branch")
				text = `Branch: ${await createBranch(cwd, input.branchName || "Astro-Agent/update")}`;
			else if (action === "commit") text = await commitAll(cwd, input.message || "chore: update via Astro-Agent");
			else if (action === "push") text = await pushBranch(cwd, input.branchName);
			else if (action === "pr")
				text = await createPR(
					cwd,
					input.message || "Astro-Agent changes",
					await getDiffSummary(cwd),
					input.branchName,
				);
			else {
				const result = await shipChanges(cwd, { message: input.message, branchName: input.branchName });
				text = [
					`Branch: ${result.branch}`,
					result.message,
					result.diffStat,
					result.prUrl ? `PR: ${result.prUrl}` : "",
				]
					.filter(Boolean)
					.join("\n");
			}
			return { content: [{ type: "text", text }] };
		},
		renderCall(args, theme) {
			return {
				render: () => [theme.fg("toolTitle", `git_ship: ${args?.action || "status"}`)],
				invalidate: () => {},
			};
		},
	};
}

export function createGitShipTool(cwd: string): EngineTool<typeof gitShipSchema> {
	return wrapToolDefinition(createGitShipToolDefinition(cwd));
}
