import { getAstroUserEngine } from "./astro-user-engine.js";

const LATEST_VERSION_URL = "https://github.com/theayzek01/Astro-Agent/api/latest-version";
const DEFAULT_VERSION_CHECK_TIMEOUT_MS = 10000;

export interface LatestAstroAgentRelease {
	version: string;
	packageName?: string;
	note?: string;
}

interface ParsedVersion {
	major: number;
	minor: number;
	patch: number;
	prerelease?: string;
}

function parsePackageVersion(version: string): ParsedVersion | undefined {
	const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/);
	if (!match) {
		return undefined;
	}
	return {
		major: Number.parseInt(match[1], 10),
		minor: Number.parseInt(match[2], 10),
		patch: Number.parseInt(match[3], 10),
		prerelease: match[4],
	};
}

export function comparePackageVersions(leftVersion: string, rightVersion: string): number | undefined {
	const left = parsePackageVersion(leftVersion);
	const right = parsePackageVersion(rightVersion);
	if (!left || !right) {
		return undefined;
	}

	if (left.major !== right.major) return left.major - right.major;
	if (left.minor !== right.minor) return left.minor - right.minor;
	if (left.patch !== right.patch) return left.patch - right.patch;
	if (left.prerelease === right.prerelease) return 0;
	if (!left.prerelease) return 1;
	if (!right.prerelease) return -1;
	return left.prerelease.localeCompare(right.prerelease);
}

export function isNewerPackageVersion(candidateVersion: string, currentVersion: string): boolean {
	const comparison = comparePackageVersions(candidateVersion, currentVersion);
	if (comparison !== undefined) {
		return comparison > 0;
	}
	return candidateVersion.trim() !== currentVersion.trim();
}

export async function getLatestAstroAgentVersion(
	currentVersion: string,
	options: { timeoutMs?: number } = {},
): Promise<string | undefined> {
	if (process.env.ASTRO_SKIP_VERSION_CHECK || process.env.ASTRO_OFFLINE) return undefined;

	const response = await fetch(LATEST_VERSION_URL, {
		headers: {
			"User-Engine": getAstroUserEngine(currentVersion),
			accept: "application/json",
		},
		signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_VERSION_CHECK_TIMEOUT_MS),
	});
	if (!response.ok) return undefined;

	const data = (await response.json()) as { version?: unknown };
	return typeof data.version === "string" && data.version.trim() ? data.version.trim() : undefined;
}

export async function checkForNewAstroAgentVersion(currentVersion: string): Promise<LatestAstroAgentRelease | undefined> {
	try {
		const latestVersion = await getLatestAstroAgentVersion(currentVersion);
		if (latestVersion && isNewerPackageVersion(latestVersion, currentVersion)) {
			return { version: latestVersion };
		}
		return undefined;
	} catch {
		return undefined;
	}
}
