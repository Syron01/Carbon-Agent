export function getAstroUserEngine(version: string): string {
	const runtime = process.versions.bun ? `bun/${process.versions.bun}` : `node/${process.version}`;
	return `AstroAgent/${version} (${process.platform}; ${runtime}; ${process.arch})`;
}
