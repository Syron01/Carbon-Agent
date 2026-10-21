import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getEngineDir } from "../config.js";

interface QuotaStats {
	spent: number;
	limit: number;
	percent: number;
}

export class QuotaManager {
	private static instance: QuotaManager;
	private filePath: string;
	private limit = 500.0; // Default budget $500.00
	private spent = 0.0;

	private constructor() {
		const engineDir = getEngineDir();
		try {
			mkdirSync(engineDir, { recursive: true });
		} catch {
			// ignore
		}
		this.filePath = join(engineDir, "quota-usage.json");
		this.load();
	}

	public static getInstance(): QuotaManager {
		if (!QuotaManager.instance) {
			QuotaManager.instance = new QuotaManager();
		}
		return QuotaManager.instance;
	}

	private load(): void {
		if (!existsSync(this.filePath)) {
			this.spent = 0.0;
			this.limit = 500.0;
			this.save();
			this.scanAndSumPastCosts();
			return;
		}
		try {
			const data = JSON.parse(readFileSync(this.filePath, "utf8"));
			this.spent = typeof data.spent === "number" ? data.spent : 0.0;
			this.limit = typeof data.limit === "number" ? data.limit : 500.0;
		} catch {
			this.spent = 0.0;
			this.limit = 500.0;
		}
		this.scanAndSumPastCosts();

		// Auto-scale limit if spent exceeds or matches limit
		if (this.spent >= this.limit) {
			this.limit = Math.ceil((this.spent + 100) / 100) * 100;
			this.save();
		}
	}

	private scanAndSumPastCosts(): void {
		try {
			const sessionsDir = join(getEngineDir(), "sessions");
			if (!existsSync(sessionsDir)) return;

			const workspaces = readdirSync(sessionsDir);
			let totalSpent = 0.0;

			for (const workspace of workspaces) {
				const wsPath = join(sessionsDir, workspace);
				if (!statSync(wsPath).isDirectory()) continue;

				const files = readdirSync(wsPath);
				for (const file of files) {
					if (!file.endsWith(".jsonl")) continue;
					const filePath = join(wsPath, file);
					try {
						const content = readFileSync(filePath, "utf8");
						const lines = content.split("\n");
						for (const line of lines) {
							if (!line.trim()) continue;
							const entry = JSON.parse(line);
							if (entry.type === "message" && entry.message?.role === "assistant") {
								const cost = entry.message.usage?.cost?.total;
								if (typeof cost === "number" && Number.isFinite(cost)) {
									totalSpent += cost;
								}
							}
						}
					} catch {
						// ignore corrupted files
					}
				}
			}

			if (totalSpent > 0) {
				this.spent = totalSpent;
				this.save();
			}
		} catch {
			// ignore folder reading errors
		}
	}

	private save(): void {
		try {
			writeFileSync(this.filePath, JSON.stringify({ spent: this.spent, limit: this.limit }, null, 2), "utf8");
		} catch {
			// ignore
		}
	}

	public getStats(): QuotaStats {
		const remaining = Math.max(0, this.limit - this.spent);
		const percent = this.limit > 0 ? Math.max(0, Math.min(100, (remaining / this.limit) * 100)) : 100;
		return {
			spent: this.spent,
			limit: this.limit,
			percent,
		};
	}

	public addCost(cost: number): void {
		if (typeof cost !== "number" || !Number.isFinite(cost) || cost <= 0) return;
		this.spent += cost;
		this.save();
	}

	public setLimit(limit: number): void {
		if (typeof limit !== "number" || limit <= 0) return;
		this.limit = limit;
		this.save();
	}
}
