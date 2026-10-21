/**
 * Shared command execution utilities for extensions and custom tools.
 */

import { spawn } from "node:child_process";
import { waitForChildProcess } from "../utils/child-process.js";

/**
 * Options for executing shell commands.
 */
export interface ExecOptions {
	/** AbortSignal to cancel the command */
	signal?: AbortSignal;
	/** Timeout in milliseconds */
	timeout?: number;
	/** Working directory */
	cwd?: string;
}

/**
 * Result of executing a shell command.
 */
export interface ExecResult {
	stdout: string;
	stderr: string;
	code: number;
	killed: boolean;
}

/**
 * Execute a shell command and return stdout/stderr/code.
 * Supports timeout and abort signal.
 */
export async function execCommand(
	command: string,
	args: string[],
	cwd: string,
	options?: ExecOptions,
): Promise<ExecResult> {
	return new Promise((resolve) => {
		const proc = spawn(command, args, {
			cwd,
			shell: false,
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		let killed = false;
		let timeoutId: NodeJS.Timeout | undefined;
		// Track the force-kill timer so we can clear it if the process exits cleanly
		let forceKillId: NodeJS.Timeout | undefined;

		const killProcess = () => {
			if (killed) return;
			killed = true;
			try {
				proc.kill("SIGTERM");
			} catch {
				/* process may already be gone */
			}

			// Force kill after 5 seconds if SIGTERM doesn't work
			forceKillId = setTimeout(() => {
				forceKillId = undefined;
				if (!proc.killed) {
					try {
						proc.kill("SIGKILL");
					} catch {
						/* ignore */
					}
				}
			}, 5000);
		};

		// Handle abort signal
		if (options?.signal) {
			if (options.signal.aborted) {
				killProcess();
			} else {
				options.signal.addEventListener("abort", killProcess, { once: true });
			}
		}

		// Handle timeout
		if (options?.timeout && options.timeout > 0) {
			timeoutId = setTimeout(killProcess, options.timeout);
		}

		proc.stdout?.on("data", (data: Buffer) => {
			stdout += data.toString();
		});

		proc.stderr?.on("data", (data: Buffer) => {
			stderr += data.toString();
		});

		waitForChildProcess(proc)
			.then((code) => {
				// Clear all pending timers to avoid post-exit side-effects
				if (timeoutId !== undefined) clearTimeout(timeoutId);
				if (forceKillId !== undefined) clearTimeout(forceKillId);
				if (options?.signal) {
					options.signal.removeEventListener("abort", killProcess);
				}
				resolve({ stdout, stderr, code: code ?? 0, killed });
			})
			.catch(() => {
				if (timeoutId !== undefined) clearTimeout(timeoutId);
				if (forceKillId !== undefined) clearTimeout(forceKillId);
				if (options?.signal) {
					options.signal.removeEventListener("abort", killProcess);
				}
				resolve({ stdout, stderr, code: 1, killed });
			});
	});
}
