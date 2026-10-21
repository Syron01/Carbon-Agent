/**
 * OKF: Object-centric Knowledge Framework
 * Google Cloud Knowledge Catalog style implementation for selective context injection.
 */

export interface KnowledgeFrame {
	id: string;
	type: "FileObject" | "TaskObject" | "EntityObject" | "ArchitecturalDecisionObject";
	content: string;
	lastUpdated: number;
	relevanceScore?: number;
}

export class ObjectKnowledgeFramework {
	private frames: Map<string, KnowledgeFrame> = new Map();

	public ingestMessage(msg: any): void {
		// Simple extraction of files or objects mentioned
		const text =
			typeof msg.content === "string" ? msg.content : typeof msg.text === "string" ? msg.text : JSON.stringify(msg);

		// Extract files
		const fileMatches = text.match(/([a-zA-Z0-9_\-/\\]+\.(ts|js|json|html|css|md))/g);
		if (fileMatches) {
			fileMatches.forEach((f: string) => {
				this.updateFrame(f, "FileObject", `File mentioned/modified: ${f}`);
			});
		}

		// Extract tasks/todos
		if (text.toLowerCase().includes("todo") || text.toLowerCase().includes("task")) {
			const taskId = `task_${Date.now()}`;
			this.updateFrame(taskId, "TaskObject", text.substring(0, 100));
		}
	}

	public updateFrame(id: string, type: KnowledgeFrame["type"], content: string) {
		this.frames.set(id, {
			id,
			type,
			content,
			lastUpdated: Date.now(),
		});
	}

	public getSelectiveContext(currentQuery: string, limit: number = 3): KnowledgeFrame[] {
		const query = currentQuery.toLowerCase();
		const scoredFrames = Array.from(this.frames.values()).map((f) => {
			let score = 0;
			if (query.includes(f.id.toLowerCase())) score += 10;
			if (query.includes(f.type.toLowerCase())) score += 2;
			f.relevanceScore = score;
			return f;
		});

		return scoredFrames
			.filter((f) => f.relevanceScore && f.relevanceScore > 0)
			.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
			.slice(0, limit);
	}

	public buildOkfPrompt(query: string): string {
		const relevantFrames = this.getSelectiveContext(query);
		if (relevantFrames.length === 0) return "";

		let prompt = `\n\n[OKF: Object-centric Knowledge Framework - Context]\n`;
		relevantFrames.forEach((f) => {
			prompt += `- [${f.type}] ${f.id}: ${f.content}\n`;
		});
		return `${prompt}\n`;
	}
}

export const globalOkf = new ObjectKnowledgeFramework();
