import { randomUUID } from "node:crypto";
import { renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/**
 * Atomically replace the contents of a file: write to a temp file next to the
 * target, then rename it over the target (rename is atomic on the same volume).
 * Readers never observe a partially written file.
 */
export function writeFileAtomicSync(absolutePath: string, content: string): void {
	const tmp = join(dirname(absolutePath), `.${randomUUID()}-${basename(absolutePath)}.tmp`);
	try {
		writeFileSync(tmp, content, "utf-8");
		renameSync(tmp, absolutePath);
	} catch (error) {
		try {
			unlinkSync(tmp);
		} catch {
			/* ignore cleanup errors */
		}
		throw error;
	}
}

/** Promise-based variant for tool operation interfaces that return promises. */
export async function writeFileAtomic(absolutePath: string, content: string): Promise<void> {
	writeFileAtomicSync(absolutePath, content);
}
