import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import chalk from "chalk";
import { detectInstallMethod, getPackageDir, getSelfUpdateCommand, PACKAGE_NAME, VERSION } from "../config.js";

function run(command: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
	const result = spawnSync(command, args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
		shell: process.platform === "win32",
	});
	return { status: result.status, stdout: result.stdout?.trim() ?? "", stderr: result.stderr?.trim() ?? "" };
}

function lines(text: string): string[] {
	return text
		.split(/\r?\n/)
		.map((x) => x.trim())
		.filter(Boolean);
}

function readPackageVersion(path: string): string | undefined {
	try {
		const pkgPath = join(path, "package.json");
		if (!existsSync(pkgPath)) return undefined;
		const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
		return typeof pkg.version === "string" ? pkg.version : undefined;
	} catch {
		return undefined;
	}
}

function resolveCommandCandidates(command: string): string[] {
	if (process.platform === "win32") {
		return lines(run("where", [command]).stdout);
	}
	return lines(run("which", ["-a", command]).stdout);
}

function unique<T>(items: T[]): T[] {
	return [...new Set(items)];
}

export function printDoctor(): void {
	const packageDir = getPackageDir();
	const packageVersion = readPackageVersion(packageDir);
	const _method = detectInstallMethod();
	const selfUpdate = getSelfUpdateCommand(PACKAGE_NAME);
	const candidates = unique([
		...resolveCommandCandidates("astroagent"),
		...resolveCommandCandidates("astro"),
		...resolveCommandCandidates("astrocli"),
	]);

	console.log(
		`Version        : ${VERSION}${packageVersion && packageVersion !== VERSION ? ` (package.json: ${packageVersion})` : ""}`,
	);

	if (candidates.length === 0) {
	} else {
		for (const candidate of candidates) {
			const _marker = candidate === process.argv[1] ? chalk.green("active") : "";
		}
	}

	if (selfUpdate) {
	} else {
	}

	const _activeDir = dirname(process.argv[1] || "");
	if (candidates.length > 1) {
		console.log(
			chalk.yellow(
				"\nWarning: Multiple Moon installations found on PATH. If the old version shows up, remove the first wrapper or fix PATH order.",
			),
		);
	}
	if (packageVersion && packageVersion !== VERSION) {
		console.log(
			chalk.red(
				"\nWarning: Compiled VERSION differs from package.json version. Run `npm run build --workspace=packages/cli`.",
			),
		);
	}
}
