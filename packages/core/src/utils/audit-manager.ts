export interface AuditEntry {
	timestamp: number;
	id: string;
	component: string;
	action: string;
	status: "success" | "failure" | "warning";
	details: any;
	metadata?: Record<string, any>;
}

/**
 * Enterprise-grade Audit & Observability Manager.
 * Provides high-fidelity tracing for all AI decisions and system actions.
 */
export class AuditManager {
	private logs: AuditEntry[] = [];
	private readonly MAX_LOGS = 5000;

	private generateId(): string {
		return typeof crypto !== "undefined" && crypto.randomUUID
			? crypto.randomUUID()
			: Math.random().toString(36).substring(2, 15);
	}

	public log(entry: Omit<AuditEntry, "timestamp" | "id">) {
		// Simple deduplication for repeating sequential logs
		const last = this.logs[this.logs.length - 1];
		if (last && last.component === entry.component && last.action === entry.action && last.status === entry.status) {
			last.metadata = { ...(last.metadata || {}), repeatCount: ((last.metadata?.repeatCount as number) || 1) + 1 };
			last.timestamp = Date.now(); // Update last seen
			return;
		}

		const fullEntry: AuditEntry = {
			...entry,
			timestamp: Date.now(),
			id: this.generateId(),
		};

		this.logs.push(fullEntry);

		// Maintain memory limits
		if (this.logs.length > this.MAX_LOGS) {
			this.logs.shift();
		}

		// In a real enterprise system, this would stream to ELK, Datadog, or CloudWatch
		if (process.env.ASTRO_DEBUG === "1") {
		}
	}

	public getLogs(filter?: (entry: AuditEntry) => boolean): AuditEntry[] {
		return filter ? this.logs.filter(filter) : this.logs;
	}

	public clear() {
		this.logs = [];
	}

	/**
	 * Exports logs to JSON for enterprise compliance reporting.
	 */
	public exportAuditReport(): string {
		return JSON.stringify(this.logs, null, 2);
	}
}

export const auditManager = new AuditManager();
