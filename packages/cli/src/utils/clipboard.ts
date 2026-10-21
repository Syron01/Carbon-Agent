import { execSync, spawn } from "child_process";
import { platform } from "os";
import { isWaylandSession } from "./clipboard-image.js";
import { clipboard } from "./clipboard-native.js";

type NativeClipboardExecOptions = {
	input: string;
	timeout: number;
	stdio: ["pipe", "ignore", "ignore"];
};

function copyToX11Clipboard(options: NativeClipboardExecOptions): void {
	try {
		execSync("xclip -selection clipboard", options);
	} catch {
		execSync("xsel --clipboard --input", options);
	}
}

const MAX_OSC52_ENCODED_LENGTH = 100_000;

function isRemoteSession(env: NodeJS.ProcessEnv = process.env): boolean {
	return Boolean(env.SSH_CONNECTION || env.SSH_CLIENT || env.MOSH_CONNECTION);
}

function emitOsc52(text: string): boolean {
	const encoded = Buffer.from(text).toString("base64");
	if (encoded.length > MAX_OSC52_ENCODED_LENGTH) {
		return false;
	}
	process.stdout.write(`\x1b]52;c;${encoded}\x07`);
	return true;
}

/** Read plain text from the system clipboard, if native clipboard access is available. */
export async function readClipboardText(): Promise<string | null> {
	// Native clipboard module doesn't support getText; use platform tools instead
	const p = platform();
	try {
		if (p === "darwin") {
			return execSync("pbpaste", { encoding: "utf-8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
		}
		if (p === "win32") {
			return execSync("powershell -command Get-Clipboard", { encoding: "utf-8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
		}
		// Linux: try xclip, xsel, or wl-paste
		if (process.env.WAYLAND_DISPLAY) {
			return execSync("wl-paste", { encoding: "utf-8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
		}
		if (process.env.DISPLAY) {
			try {
				return execSync("xclip -selection clipboard -o", { encoding: "utf-8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
			} catch {
				return execSync("xsel --clipboard --output", { encoding: "utf-8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
			}
		}
	} catch {
		return null;
	}
	return null;
}

export async function copyToClipboard(text: string): Promise<void> {
	let copied = false;

	// Prefer direct clipboard writes. Emitting OSC 52 first can make terminals
	// write the same native clipboard concurrently with the addon, and very large
	// OSC 52 payloads can desynchronize terminal rendering.
	try {
		if (clipboard) {
			await clipboard.setText(text);
			copied = true;
		}
	} catch {
		// Fall through to platform-specific clipboard tools.
	}

	const remote = isRemoteSession();
	if (copied && !remote) {
		return;
	}

	const p = platform();
	const options: NativeClipboardExecOptions = { input: text, timeout: 5000, stdio: ["pipe", "ignore", "ignore"] };

	if (!copied) {
		try {
			if (p === "darwin") {
				execSync("pbcopy", options);
				copied = true;
			} else if (p === "win32") {
				execSync("clip", options);
				copied = true;
			} else {
				// Linux. Try Termux, Wayland, or X11 clipboard tools.
				if (process.env.TERMUX_VERSION) {
					try {
						execSync("termux-clipboard-set", options);
						copied = true;
					} catch {
						// Fall back to Wayland or X11 tools.
					}
				}

				if (!copied) {
					const hasWaylandDisplay = Boolean(process.env.WAYLAND_DISPLAY);
					const hasX11Display = Boolean(process.env.DISPLAY);
					const isWayland = isWaylandSession();
					if (isWayland && hasWaylandDisplay) {
						try {
							// Verify wl-copy exists (spawn errors are async and won't be caught)
							execSync("which wl-copy", { stdio: "ignore" });
							// wl-copy with execSync hangs due to fork behavior; use spawn instead
							const proc = spawn("wl-copy", [], { stdio: ["pipe", "ignore", "ignore"] });
							proc.stdin.on("error", () => {
								// Ignore EPIPE errors if wl-copy exits early
							});
							proc.stdin.write(text);
							proc.stdin.end();
							proc.unref();
							copied = true;
						} catch {
							if (hasX11Display) {
								copyToX11Clipboard(options);
								copied = true;
							}
						}
					} else if (hasX11Display) {
						copyToX11Clipboard(options);
						copied = true;
					}
				}
			}
		} catch {
			// Fall through to OSC 52 fallback.
		}
	}

	if (remote || !copied) {
		const osc52Copied = emitOsc52(text);
		copied = copied || osc52Copied;
	}

	if (!copied) {
		throw new Error("Failed to copy to clipboard");
	}
}
