/**
 * Stdout takeover for TUI modes.
 *
 * When the interactive TUI (e.g. Ink/Blessed) is running it owns the real
 * stdout fd. Any third-party library that writes to process.stdout would
 * corrupt the TUI rendering. takeOverStdout() redirects process.stdout to
 * stderr so those writes stay visible in the terminal without corrupting the
 * UI. writeRawStdout() bypasses the redirect and writes directly to the real
 * stdout fd (used by the TUI renderer itself).
 */

type WriteCallback = (error?: Error | null) => void;

interface StdoutTakeoverState {
	rawStdoutWrite: (chunk: string | Uint8Array, callback?: WriteCallback) => boolean;
	rawStderrWrite: (chunk: string | Uint8Array, callback?: WriteCallback) => boolean;
	originalStdoutWrite: typeof process.stdout.write;
}

let stdoutTakeoverState: StdoutTakeoverState | undefined;

export function takeOverStdout(): void {
	if (stdoutTakeoverState) {
		return;
	}

	const rawStdoutWrite = process.stdout.write.bind(process.stdout) as StdoutTakeoverState["rawStdoutWrite"];
	const rawStderrWrite = process.stderr.write.bind(process.stderr) as StdoutTakeoverState["rawStderrWrite"];
	const originalStdoutWrite = process.stdout.write.bind(process.stdout);

	// Redirect stdout → stderr while TUI is active so library writes don't corrupt the UI
	process.stdout.write = ((
		chunk: string | Uint8Array,
		encodingOrCallback?: BufferEncoding | WriteCallback,
		callback?: WriteCallback,
	): boolean => {
		if (typeof encodingOrCallback === "function") {
			return rawStderrWrite(chunk, encodingOrCallback);
		}
		return rawStderrWrite(chunk, callback);
	}) as typeof process.stdout.write;

	stdoutTakeoverState = {
		rawStdoutWrite,
		rawStderrWrite,
		originalStdoutWrite,
	};
}

export function restoreStdout(): void {
	if (!stdoutTakeoverState) {
		return;
	}

	process.stdout.write = stdoutTakeoverState.originalStdoutWrite;
	stdoutTakeoverState = undefined;
}

export function isStdoutTakenOver(): boolean {
	return stdoutTakeoverState !== undefined;
}

export function writeRawStdout(text: string): void {
	if (stdoutTakeoverState) {
		stdoutTakeoverState.rawStdoutWrite(text);
		return;
	}
	process.stdout.write(text);
}

export async function flushRawStdout(): Promise<void> {
	const writer = stdoutTakeoverState?.rawStdoutWrite ?? process.stdout.write.bind(process.stdout);
	await new Promise<void>((resolve, reject) => {
		writer("", (err) => {
			if (err) reject(err);
			else resolve();
		});
	});
}
