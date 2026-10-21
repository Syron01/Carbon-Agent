// @ts-nocheck
import type { AssistantMessage } from "astro-core";
import type { EngineSessionRuntime } from "../../core/engine-session-runtime.js";
import { writeRawStdout } from "../../core/output-guard.js";
import { killTrackedDetachedChildren } from "../../utils/shell.js";

export interface HeadlessOptions {
	timeoutSeconds?: number;
	outputFormat?: "json" | "text";
}

function readStdin(): Promise<string> {
	return new Promise((resolve) => {
		let data = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (c) => {
			data += c;
		});
		process.stdin.on("end", () => resolve(data.trim()));
		process.stdin.resume();
	});
}

function writeEvent(event: any): void {
	writeRawStdout(`${JSON.stringify(event)}\n`);
}

export async function runHeadlessMode(
	runtimeHost: EngineSessionRuntime,
	options: HeadlessOptions = {},
): Promise<number> {
	const timeoutMs = Math.max(1, options.timeoutSeconds || 0) * 1000;
	let timer: NodeJS.Timeout | undefined;
	let unsubscribe: (() => void) | undefined;
	try {
		const raw = await readStdin();
		const input = raw ? JSON.parse(raw) : { type: "prompt", text: "" };
		if (input.type !== "prompt" || typeof input.text !== "string")
			throw new Error('stdin JSON: { "type":"prompt", "text":"..." } bekleniyor');

		const session = runtimeHost.session;
		unsubscribe = session.subscribe((event) => {
			if (event.type === "tool_execution_end" && event.toolCall)
				writeEvent({ type: "tool", tool: event.toolCall.name, ok: !event.error });
		});
		if (timeoutMs) timer = setTimeout(() => session.abort(), timeoutMs);
		await session.prompt(input.text);
		const last = session.state.messages[session.state.messages.length - 1] as AssistantMessage | undefined;
		const text =
			last?.role === "assistant"
				? last.content
						.filter((c) => c.type === "text")
						.map((c) => c.text)
						.join("\n")
				: "";
		const filesChanged = session.state.messages.flatMap((m: any) => (m.details?.path ? [m.details.path] : []));
		writeEvent({ type: "result", text, files_changed: [...new Set(filesChanged)] });
		return last?.stopReason === "error" ? 1 : 0;
	} catch (error) {
		writeEvent({ type: "error", message: error instanceof Error ? error.message : String(error) });
		return 1;
	} finally {
		if (timer) clearTimeout(timer);
		unsubscribe?.();
		killTrackedDetachedChildren();
		await runtimeHost.dispose();
	}
}
