/**
 * Tool wrappers for extension-registered tools.
 *
 * These wrappers only adapt tool execution so extension tools receive the runner context.
 * Tool call and tool result interception is handled by EngineSession via engine-core hooks.
 */

import type { EngineTool } from "astro-engine";
import { wrapToolDefinition, wrapToolDefinitions } from "../tools/tool-definition-wrapper.js";
import type { ExtensionRunner } from "./runner.js";
import type { RegisteredTool } from "./types.js";

/**
 * Wrap a RegisteredTool into an EngineTool.
 * Uses the runner's createContext() for consistent context across tools and event handlers.
 */
export function wrapRegisteredTool(registeredTool: RegisteredTool, runner: ExtensionRunner): EngineTool {
	return wrapToolDefinition(registeredTool.definition, () => runner.createContext());
}

/**
 * Wrap all registered tools into EngineTools.
 * Uses the runner's createContext() for consistent context across tools and event handlers.
 */
export function wrapRegisteredTools(registeredTools: RegisteredTool[], runner: ExtensionRunner): EngineTool[] {
	return wrapToolDefinitions(
		registeredTools.map((registeredTool) => registeredTool.definition),
		() => runner.createContext(),
	);
}
