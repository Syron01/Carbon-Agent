import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getEngineDir } from "../../config.js";
import { redactSensitiveText } from "./policy.js";

export interface AuditEvent {
	id: string;
	timestamp: string;
	actor: "user" | "system" | "tool";
	action: string;
	status: "success" | "failure" | "blocked" | "warning";
	target?: string;
	message?: string;
	meta?: Record<string, unknown>;
}

function getAuditPath(): string {
	return join(getEngineDir(), "audit", "audit.jsonl");
}

export function appendAuditEvent(event: Omit<AuditEvent, "id" | "timestamp">): void {
	const full: AuditEvent = {
		...event,
		id: randomUUID(),
		timestamp: new Date().toISOString(),
		message: event.message ? redactSensitiveText(event.message) : undefined,
		meta: event.meta ? JSON.parse(redactSensitiveText(JSON.stringify(event.meta))) : undefined,
	};

	try {
		const filePath = getAuditPath();
		mkdirSync(join(getEngineDir(), "audit"), { recursive: true });
		writeFileSync(filePath, `${JSON.stringify(full)}\n`, { flag: "a" });
	} catch {
		// best effort
	}
}
