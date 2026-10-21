/**
 * CLI entry point for the refactored coding engine.
 * Uses main.ts with EngineSession and new mode modules.
 */
import { spawnSync } from "child_process";
import { accessSync, constants, existsSync, readFileSync, realpathSync } from "fs";
import { homedir } from "os";
import { basename, dirname, join, resolve, sep, win32 } from "path";
import { fileURLToPath } from "url";
import { shouldUseWindowsShell } from "./utils/child-process.js";

// =============================================================================
// Package Detection
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Detect if we're running as a Bun compiled binary.
 * Bun binaries have import.meta.url containing "$bunfs", "~BUN", or "%7EBUN" (Bun's virtual filesystem path)
 */
export const isBunBinary =
	import.meta.url.includes("$bunfs") || import.meta.url.includes("~BUN") || import.meta.url.includes("%7EBUN");

/** Detect if Bun is the runtime (compiled binary or bun run) */
export const isBunRuntime = !!process.versions.bun;

// =============================================================================
// Install Method Detection
// =============================================================================

export type InstallMethod = "bun-binary" | "npm" | "pnpm" | "yarn" | "bun" | "unknown";

export interface SelfUpdateCommand {
	command: string;
	args: string[];
	display: string;
}

export function detectInstallMethod(): InstallMethod {
	if (isBunBinary) {
		return "bun-binary";
	}

	const resolvedPath = `${__dirname}\0${process.execPath || ""}`.toLowerCase().replace(/\\/g, "/");

	if (resolvedPath.includes("/pnpm/") || resolvedPath.includes("/.pnpm/")) {
		return "pnpm";
	}
	if (resolvedPath.includes("/yarn/") || resolvedPath.includes("/.yarn/")) {
		return "yarn";
	}
	if (isBunRuntime || resolvedPath.includes("/install/global/node_modules/")) {
		return "bun";
	}
	if (resolvedPath.includes("/npm/") || resolvedPath.includes("/node_modules/")) {
		return "npm";
	}

	return "unknown";
}

function getInferredNpmInstall(packageName: string): { root: string; prefix: string } | undefined {
	const packageDir = getPackageDir();
	const path = process.platform === "win32" || packageDir.includes("\\") ? win32 : { basename, dirname };
	const [scope, name] = packageName.split("/");
	let root: string | undefined;
	if (
		name &&
		scope?.startsWith("@") &&
		path.basename(path.dirname(packageDir)) === scope &&
		path.basename(packageDir) === name
	) {
		root = path.dirname(path.dirname(packageDir));
	} else if (!name && path.basename(packageDir) === packageName) {
		root = path.dirname(packageDir);
	}
	if (!root || path.basename(root) !== "node_modules") return undefined;
	const parent = path.dirname(root);
	if (path.basename(parent) === "lib") return { root, prefix: path.dirname(parent) };
	if (process.platform === "win32") return { root, prefix: parent };
	return undefined;
}

function getSelfUpdateCommandForMethod(
	method: InstallMethod,
	packageName: string,
	npmCommand?: string[],
): SelfUpdateCommand | undefined {
	switch (method) {
		case "bun-binary":
			return undefined;
		case "pnpm":
			return { command: "pnpm", args: ["install", "-g", packageName], display: `pnpm install -g ${packageName}` };
		case "yarn":
			return { command: "yarn", args: ["global", "add", packageName], display: `yarn global add ${packageName}` };
		case "bun":
			return { command: "bun", args: ["install", "-g", packageName], display: `bun install -g ${packageName}` };
		case "npm": {
			const [command = "npm", ...npmArgs] = npmCommand ?? [];
			const inferred = npmCommand?.length ? undefined : getInferredNpmInstall(packageName);
			const args = [...npmArgs, ...(inferred ? ["--prefix", inferred.prefix] : []), "install", "-g", packageName];
			const display = [command, ...args].map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(" ");
			return { command, args, display };
		}
		case "unknown":
			return undefined;
	}
}

function readCommandOutput(
	command: string,
	args: string[],
	options: { requireSuccess?: boolean } = {},
): string | undefined {
	const result = spawnSync(command, args, {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
		shell: shouldUseWindowsShell(command),
	});
	if (result.status === 0) return result.stdout.trim() || undefined;
	if (options.requireSuccess) {
		const reason = result.error?.message || result.stderr.trim() || `exit code ${result.status ?? "unknown"}`;
		throw new Error(`Failed to run ${[command, ...args].join(" ")}: ${reason}`);
	}
	return undefined;
}

function getGlobalPackageRoots(method: InstallMethod, packageName: string, npmCommand?: string[]): string[] {
	switch (method) {
		case "npm": {
			const configured = !!npmCommand?.length;
			const [command = "npm", ...npmArgs] = npmCommand ?? [];
			if (configured && command === "bun") {
				const bunBin = readCommandOutput(command, [...npmArgs, "pm", "bin", "-g"], {
					requireSuccess: true,
				});
				const roots = [join(homedir(), ".bun", "install", "global", "node_modules")];
				if (bunBin) {
					roots.push(join(dirname(bunBin), "install", "global", "node_modules"));
				}
				return roots;
			}
			const root = readCommandOutput(command, [...npmArgs, "root", "-g"], {
				requireSuccess: configured,
			});
			const inferred = configured ? undefined : getInferredNpmInstall(packageName);
			return [root, inferred?.root].filter((x): x is string => !!x);
		}
		case "pnpm": {
			const root = readCommandOutput("pnpm", ["root", "-g"]);
			return root ? [root, dirname(root)] : [];
		}
		case "yarn": {
			const dir = readCommandOutput("yarn", ["global", "dir"]);
			return dir ? [dir, join(dir, "node_modules")] : [];
		}
		case "bun": {
			const bunBin = readCommandOutput("bun", ["pm", "bin", "-g"]);
			const roots = [join(homedir(), ".bun", "install", "global", "node_modules")];
			if (bunBin) {
				roots.push(join(dirname(bunBin), "install", "global", "node_modules"));
			}
			return roots;
		}
		case "bun-binary":
		case "unknown":
			return [];
	}
}

function normalizeExistingPathForComparison(path: string): string | undefined {
	const resolvedPath = resolve(path);
	if (!existsSync(resolvedPath)) {
		return undefined;
	}
	let normalizedPath: string;
	try {
		normalizedPath = realpathSync(resolvedPath);
	} catch {
		return undefined;
	}
	if (process.platform === "win32") {
		normalizedPath = normalizedPath.toLowerCase();
	}
	return normalizedPath;
}

function isSelfUpdatePathWritable(): boolean {
	const packageDir = getPackageDir();
	try {
		accessSync(packageDir, constants.W_OK);
		accessSync(dirname(packageDir), constants.W_OK);
		return true;
	} catch {
		return false;
	}
}

function isManagedByGlobalPackageManager(method: InstallMethod, packageName: string, npmCommand?: string[]): boolean {
	const packageDir = normalizeExistingPathForComparison(getPackageDir());
	return (
		!!packageDir &&
		getGlobalPackageRoots(method, packageName, npmCommand).some((root) => {
			const normalizedRoot = normalizeExistingPathForComparison(root);
			return (
				!!normalizedRoot &&
				packageDir.startsWith(normalizedRoot.endsWith(sep) ? normalizedRoot : `${normalizedRoot}${sep}`)
			);
		})
	);
}

export function getSelfUpdateCommand(packageName: string, npmCommand?: string[]): SelfUpdateCommand | undefined {
	const method = detectInstallMethod();
	const command = getSelfUpdateCommandForMethod(method, packageName, npmCommand);
	if (!command || !isManagedByGlobalPackageManager(method, packageName, npmCommand) || !isSelfUpdatePathWritable()) {
		return undefined;
	}
	return command;
}

export function getSelfUpdateUnavailableInstruction(packageName: string, npmCommand?: string[]): string {
	const method = detectInstallMethod();
	if (method === "bun-binary") {
		return `Download from: https://github.com/theayzek01/Astro-Agent/releases/latest`;
	}
	const command = getSelfUpdateCommandForMethod(method, packageName, npmCommand);
	if (command) {
		if (isManagedByGlobalPackageManager(method, packageName, npmCommand) && !isSelfUpdatePathWritable()) {
			return `This installation is managed by a global ${method} install, but the install path is not writable. Update it yourself with: ${command.display}`;
		}
		return `This installation is not managed by a global ${method} install. Update it with the package manager, wrapper, or source checkout that provides it.`;
	}
	return `Update ${packageName} using the package manager, wrapper, or source checkout that provides this installation.`;
}

export function getUpdateInstruction(packageName: string): string {
	const method = detectInstallMethod();
	const command = getSelfUpdateCommandForMethod(method, packageName);
	if (command) {
		return `Run: ${command.display}`;
	}
	return getSelfUpdateUnavailableInstruction(packageName);
}

// =============================================================================
// Package Asset Paths (shipped with executable)
// =============================================================================

/**
 * Get the base directory for resolving package assets (themes, package.json, README.md, CHANGELOG.md).
 */
export function getPackageDir(): string {
	const envDir = process.env.CARBON_PACKAGE_DIR || process.env.ASTRO_PACKAGE_DIR;
	if (envDir) {
		if (envDir === "~") return homedir();
		if (envDir.startsWith("~/")) return homedir() + envDir.slice(1);
		return envDir;
	}

	if (isBunBinary) {
		return dirname(process.execPath);
	}
	let dir = __dirname;
	while (dir !== dirname(dir)) {
		if (existsSync(join(dir, "package.json"))) {
			return dir;
		}
		dir = dirname(dir);
	}
	return __dirname;
}

/**
 * Get path to built-in themes directory
 */
export function getThemesDir(): string {
	if (isBunBinary) {
		return join(getPackageDir(), "theme");
	}
	const packageDir = getPackageDir();
	if (basename(packageDir) === "dist") {
		return join(packageDir, "modes", "interactive", "theme");
	}
	const srcOrDist = existsSync(join(packageDir, "src")) ? "src" : "dist";
	return join(packageDir, srcOrDist, "modes", "interactive", "theme");
}

/**
 * Get path to HTML export template directory
 */
export function getExportTemplateDir(): string {
	if (isBunBinary) {
		return join(getPackageDir(), "export-html");
	}
	const packageDir = getPackageDir();
	if (basename(packageDir) === "dist") {
		return join(packageDir, "core", "export-html");
	}
	const srcOrDist = existsSync(join(packageDir, "src")) ? "src" : "dist";
	return join(packageDir, srcOrDist, "core", "export-html");
}

/** Get path to package.json */
export function getPackageJsonPath(): string {
	return join(getPackageDir(), "package.json");
}

/** Get path to README.md */
export function getReadmePath(): string {
	return resolve(join(getPackageDir(), "README.md"));
}

/** Get path to docs directory */
export function getDocsPath(): string {
	return resolve(join(getPackageDir(), "docs"));
}

/** Get path to examples directory */
export function getExamplesPath(): string {
	return resolve(join(getPackageDir(), "examples"));
}

/** Get path to CHANGELOG.md */
export function getChangelogPath(): string {
	return resolve(join(getPackageDir(), "CHANGELOG.md"));
}

/**
 * Get path to built-in interactive assets directory.
 */
export function getInteractiveAssetsDir(): string {
	if (isBunBinary) {
		return join(getPackageDir(), "assets");
	}
	const packageDir = getPackageDir();
	const srcOrDist = existsSync(join(packageDir, "src")) ? "src" : "dist";
	return join(packageDir, srcOrDist, "modes", "interactive", "assets");
}

/** Get path to a bundled interactive asset */
export function getBundledInteractiveAssetPath(name: string): string {
	return join(getInteractiveAssetsDir(), name);
}

// =============================================================================
// App Config (from package.json carbonConfig / astroConfig)
// =============================================================================

interface PackageJson {
	name?: string;
	version?: string;
	carbonConfig?: {
		name?: string;
		configDir?: string;
	};
	astroConfig?: {
		name?: string;
		configDir?: string;
	};
}

const pkg = JSON.parse(readFileSync(getPackageJsonPath(), "utf-8")) as PackageJson;

const configName: string | undefined = pkg.carbonConfig?.name || pkg.astroConfig?.name;
export const PACKAGE_NAME: string = pkg.name || "carbon-agent";
export const APP_NAME: string = configName || "Carbon Agent";
export const APP_TITLE: string = configName || "Carbon Agent";
export const CONFIG_DIR_NAME: string = pkg.carbonConfig?.configDir || pkg.astroConfig?.configDir || ".carbonagent";
export const VERSION: string = pkg.version || "49.0.0";

export const ENV_AGENT_DIR = `CARBON_CODING_AGENT_DIR`;
export const ENV_SESSION_DIR = `CARBON_CODING_AGENT_SESSION_DIR`;

export function expandTildePath(path: string): string {
	if (path === "~") return homedir();
	if (path.startsWith("~/")) return homedir() + path.slice(1);
	return path;
}

const DEFAULT_SHARE_VIEWER_URL = "https://github.com/VertexCorporation/Carbon-Agent/session/";

/** Get the share viewer URL for a gist ID */
export function getShareViewerUrl(gistId: string): string {
	const baseUrl = process.env.CARBON_SHARE_VIEWER_URL || process.env.ASTRO_SHARE_VIEWER_URL || DEFAULT_SHARE_VIEWER_URL;
	return `${baseUrl}#${gistId}`;
}

// =============================================================================
// User Config Paths (~/.carbonagent/engine/* or legacy ~/.astroagent/engine/*)
// =============================================================================

/** Get the engine config directory (e.g., ~/.carbonagent/engine/ or legacy ~/.astroagent/engine/) */
export function getEngineDir(): string {
	const envDir = process.env[ENV_AGENT_DIR] || process.env.ASTRO_CODING_AGENT_DIR;
	if (envDir) {
		return expandTildePath(envDir);
	}
	const carbonDir = join(homedir(), CONFIG_DIR_NAME, "engine");
	if (existsSync(carbonDir)) return carbonDir;
	const legacyAstroDir = join(homedir(), ".astroagent", "engine");
	if (existsSync(legacyAstroDir)) return legacyAstroDir;
	return carbonDir;
}

/** Get path to user's custom themes directory */
export function getCustomThemesDir(): string {
	return join(getEngineDir(), "themes");
}

/** Get path to models.json */
export function getModelsPath(): string {
	return join(getEngineDir(), "models.json");
}

/** Get path to auth.json */
export function getAuthPath(): string {
	return join(getEngineDir(), "auth.json");
}

/** Get path to settings.json */
export function getSettingsPath(): string {
	return join(getEngineDir(), "settings.json");
}

/** Get path to tools directory */
export function getToolsDir(): string {
	return join(getEngineDir(), "tools");
}

/** Get path to managed binaries directory (fd, rg) */
export function getBinDir(): string {
	return join(getEngineDir(), "bin");
}

/** Get path to prompt templates directory */
export function getPromptsDir(): string {
	return join(getEngineDir(), "prompts");
}

/** Get path to sessions directory */
export function getSessionsDir(): string {
	return join(getEngineDir(), "sessions");
}

/** Get path to debug log file */
export function getDebugLogPath(): string {
	return join(getEngineDir(), `${APP_NAME.toLowerCase()}-debug.log`);
}
