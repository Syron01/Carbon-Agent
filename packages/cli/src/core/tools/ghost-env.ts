import { exec, execFile } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const LOCAL_FALLBACK_PREFIX = "local:";

/**
 * Ghost Environment (Container Wizard)
 * Silently spins up Docker containers for missing dependencies (like Redis, Postgres)
 * to run code and tests seamlessly without manual environment setup.
 */
export class GhostEnvironment {
	private activeContainers: Map<string, string> = new Map();
	private localFallbacks: Set<string> = new Set();

	/**
	 * Checks if a dependency is installed locally. If not, spins up a Docker container.
	 */
	public async ensureDependency(imageName: string, ports: string[]): Promise<string> {
		if (this.activeContainers.has(imageName)) {
			return this.activeContainers.get(imageName)!;
		}
		if (this.localFallbacks.has(imageName)) {
			return `${LOCAL_FALLBACK_PREFIX}${imageName}`;
		}

		try {
			// Check if docker is available
			await execFileAsync("docker", ["--version"]);

			const containerName = `astroagent-ghost-${imageName.replace(/[^a-zA-Z0-9-]/g, "")}-${Date.now()}`;
			const args = ["run", "-d", "--rm", "--name", containerName, "--memory=512m", "--cpus=1"];
			for (const port of ports) {
				args.push("-p", port);
			}
			args.push(imageName);
			const { stdout } = await execFileAsync("docker", args);
			const containerId = stdout.trim();

			this.activeContainers.set(imageName, containerId);
			return containerId;
		} catch (error: any) {
			if (error.code === "ENOENT" || /docker/i.test(error.message)) {
				this.localFallbacks.add(imageName);
				return `${LOCAL_FALLBACK_PREFIX}${imageName}`;
			}
			throw new Error(`Ghost Environment failed to start ${imageName}: ${error.message}`);
		}
	}

	/**
	 * Executes a script inside the ghost container to verify it works.
	 */
	public async executeInContainer(containerId: string, command: string): Promise<string> {
		// Validate containerId to prevent injection
		if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(containerId) && !containerId.startsWith(LOCAL_FALLBACK_PREFIX)) {
			throw new Error(`Invalid container ID: ${containerId}`);
		}
		try {
			if (containerId.startsWith(LOCAL_FALLBACK_PREFIX)) {
				const { stdout } = await execAsync(command);
				return stdout.trim();
			}
			const { stdout } = await execFileAsync("docker", ["exec", containerId, "sh", "-c", command]);
			return stdout.trim();
		} catch (error: any) {
			throw new Error(`Execution in Ghost Environment failed: ${error.message}`);
		}
	}

	/**
	 * Cleans up all ghost containers that were spun up during the session.
	 */
	public async cleanup(): Promise<void> {
		for (const [_image, containerId] of this.activeContainers.entries()) {
			try {
				await execFileAsync("docker", ["stop", containerId]);
			} catch (_e) {
				// Ignore cleanup errors
			}
		}
		this.activeContainers.clear();
		this.localFallbacks.clear();
	}
}
