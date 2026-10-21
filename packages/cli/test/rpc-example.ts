import { dirname, join } from "node:path";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";
import { RpcClient } from "../src/modes/rpc/rpc-client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Interactive example of using cli via RpcClient.
 * Usage: npx tsx test/rpc-example.ts
 */

async function main() {
	const client = new RpcClient({
		cliPath: join(__dirname, "../dist/cli.js"),
		provider: "anthropic",
		model: "claude-sonnet-4-20250514",
		args: ["--no-session"],
	});

	// Stream events to console
	client.onEvent((event) => {
		if (event.type === "message_update") {
			const { assistantMessageEvent } = event;
			if (assistantMessageEvent.type === "text_delta" || assistantMessageEvent.type === "thinking_delta") {
				process.stdout.write(assistantMessageEvent.delta);
			}
		}

		if (event.type === "tool_execution_start") {
		}

		if (event.type === "tool_execution_end") {
		}
	});

	await client.start();

	const _state = await client.getState();

	// Handle user input
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: true,
	});

	let isWaiting = false;

	const prompt = () => {
		if (!isWaiting) process.stdout.write("You: ");
	};

	rl.on("line", async (line) => {
		if (isWaiting) return;
		if (line.trim() === "exit") {
			await client.stop();
			process.exit(0);
		}

		isWaiting = true;
		await client.promptAndWait(line);
		isWaiting = false;
		prompt();
	});

	rl.on("SIGINT", () => {
		if (isWaiting) {
			client.abort();
		} else {
			client.stop();
			process.exit(0);
		}
	});

	prompt();
}

main().catch(console.error);
