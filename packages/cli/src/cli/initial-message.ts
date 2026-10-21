import * as os from "node:os";
import chalk from "chalk";

function getDisplayName(): string {
	const envName = process.env.ASTRO_USER_NAME || process.env.USERNAME || process.env.USER || os.userInfo().username;
	return envName?.trim() || "friend";
}

function getGreeting(): string {
	const hour = new Date().getHours();
	if (hour >= 5 && hour < 11) return "Good morning";
	if (hour >= 11 && hour < 17) return "Good afternoon";
	if (hour >= 17 && hour < 22) return "Good evening";
	return "Good night";
}

export function buildWelcomeMessage(): { text: string } {
	const blue = chalk.hex("#7ab7ff");
	const dim = chalk.hex("#6f7a8f");
	const bright = chalk.hex("#e9eef8").bold;
	const bar = blue("=".repeat(52));

	const text = [
		"",
		blue("                          Astro-Agent"),
		"",
		bright(`${getGreeting()}, ${getDisplayName()}.`),
		dim("Astro-Agent is ready. Thinking, checking, offering short info suggestions."),
		"",
		bright("Fast coding agent. Clean tools. Quiet output."),
		bright("Terminal coding agent with MCP, Browser Bridge, and DreamKernel."),
		"",
		`      ${bar}`,
		`${dim("/help  |  /brain  |  /autothink  |  /mcp  |  /login")}`,
		"",
	].join("\n");

	return { text };
}

import type { ImageContent } from "astro-core";
import type { Args } from "./args.js";

export function buildInitialMessage({
	parsed,
	stdinContent,
	fileText,
	fileImages,
}: {
	parsed: Args;
	stdinContent?: string;
	fileText?: string;
	fileImages?: ImageContent[];
}): { initialMessage?: string; initialImages?: ImageContent[] } {
	const parts: string[] = [];
	if (stdinContent) parts.push(stdinContent.trimEnd());
	if (fileText) parts.push(fileText.trimEnd());

	if (parts.length > 0) {
		if (parsed.messages.length > 0) {
			parts.push(parsed.messages.shift()!);
		}
		return {
			initialMessage: parts.join("\n"),
			initialImages: fileImages,
		};
	}

	return {
		initialMessage: parsed.messages.length > 0 ? parsed.messages.shift()! : undefined,
		initialImages: fileImages,
	};
}
