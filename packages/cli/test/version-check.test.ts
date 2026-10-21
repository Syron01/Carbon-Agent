import { afterEach, describe, expect, it, vi } from "vitest";
import {
	checkForNewAstroAgentVersion,
	comparePackageVersions,
	getLatestAstroAgentVersion,
	isNewerPackageVersion,
} from "../src/utils/version-check.js";

const originalSkipVersionCheck = process.env.ASTRO_SKIP_VERSION_CHECK;
const originalOffline = process.env.ASTRO_OFFLINE;

afterEach(() => {
	vi.unstubAllGlobals();
	if (originalSkipVersionCheck === undefined) {
		delete process.env.ASTRO_SKIP_VERSION_CHECK;
	} else {
		process.env.ASTRO_SKIP_VERSION_CHECK = originalSkipVersionCheck;
	}
	if (originalOffline === undefined) {
		delete process.env.ASTRO_OFFLINE;
	} else {
		process.env.ASTRO_OFFLINE = originalOffline;
	}
});

describe("version checks", () => {
	it("compares package versions", () => {
		expect(comparePackageVersions("0.70.6", "0.70.5")).toBeGreaterThan(0);
		expect(comparePackageVersions("0.70.5", "0.70.5")).toBe(0);
		expect(comparePackageVersions("0.70.4", "0.70.5")).toBeLessThan(0);
		expect(isNewerPackageVersion("0.70.5", "0.70.5")).toBe(false);
		expect(isNewerPackageVersion("0.70.6", "0.70.5")).toBe(true);
	});

	it("returns only newer versions", async () => {
		const fetchMock = vi.fn(async () => Response.json({ version: "1.2.3" }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(checkForNewAstroAgentVersion("1.2.3")).resolves.toBeUndefined();
		await expect(checkForNewAstroAgentVersion("1.2.2")).resolves.toBe("1.2.3");
	});

	it("uses the AstroAgent.dev version check api with a AstroAgent user engine", async () => {
		const fetchMock = vi.fn(async () => Response.json({ version: "1.2.4" }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(getLatestAstroAgentVersion("1.2.3")).resolves.toBe("1.2.4");
		expect(fetchMock).toHaveBeenCalledWith(
			"https://github.com/theayzek01/Astro-Agent/api/latest-version",
			expect.objectContaining({
				headers: expect.objectContaining({
					"User-Engine": expect.stringMatching(/^Moon\/1\.2\.3 /),
					accept: "application/json",
				}),
			}),
		);
	});

	it("skips api calls when version checks are disabled", async () => {
		process.env.ASTRO_SKIP_VERSION_CHECK = "1";
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(getLatestAstroAgentVersion("1.2.3")).resolves.toBeUndefined();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
