import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface ExperienceItem {
	error: string;
	attemptedFix: string;
	outcome: "success" | "failure";
	lesson: string;
	timestamp: number;
}

export class LearningMemory {
	private static instance: LearningMemory | null = null;
	private memoryPath: string;
	private experiences: ExperienceItem[] = [];

	private constructor() {
		const moonDir = path.join(os.homedir(), ".astroagent");
		if (!fs.existsSync(moonDir)) {
			fs.mkdirSync(moonDir, { recursive: true });
		}
		this.memoryPath = path.join(moonDir, "learning-experience.json");
		this.loadMemory();
	}

	public static getInstance(): LearningMemory {
		if (!LearningMemory.instance) {
			LearningMemory.instance = new LearningMemory();
		}
		return LearningMemory.instance;
	}

	public getExperiences(): ExperienceItem[] {
		return this.experiences;
	}

	private loadMemory(): void {
		try {
			if (fs.existsSync(this.memoryPath)) {
				const data = fs.readFileSync(this.memoryPath, "utf-8");
				this.experiences = JSON.parse(data);
			}
		} catch {
			this.experiences = [];
		}
	}

	private saveMemory(): void {
		try {
			fs.writeFileSync(this.memoryPath, JSON.stringify(this.experiences, null, 2), "utf-8");
		} catch (e) {
			console.error("[LearningMemory] Failed to save experience memory:", e);
		}
	}

	public recordExperience(error: string, attemptedFix: string, outcome: "success" | "failure", lesson: string): void {
		// Clean inputs to avoid huge logs
		const cleanError = error.slice(0, 1000).trim();
		const cleanFix = attemptedFix.slice(0, 1000).trim();
		const cleanLesson = lesson.slice(0, 200).trim();

		// Avoid duplicate records
		const exists = this.experiences.some(
			(exp) => exp.error === cleanError && exp.attemptedFix === cleanFix && exp.outcome === outcome,
		);
		if (exists) return;

		this.experiences.push({
			error: cleanError,
			attemptedFix: cleanFix,
			outcome,
			lesson: cleanLesson,
			timestamp: Date.now(),
		});

		// Limit memory to latest 100 items to keep context window safe
		if (this.experiences.length > 100) {
			this.experiences = this.experiences.slice(-100);
		}

		this.saveMemory();
	}

	public getLessonsForPrompt(limit = 5): string[] {
		if (this.experiences.length === 0) return [];

		// Return latest experiences formatted nicely
		return this.experiences.slice(-limit).map((exp) => {
			if (exp.outcome === "success") {
				return `- **Learned Pattern (Success)**: When faced with error \`${exp.error.replace(/\n/g, " ")}\`, the successful fix is: \`${exp.attemptedFix.replace(/\n/g, " ")}\`. Reason: ${exp.lesson}`;
			} else {
				return `- **Trap Avoided (Failure)**: When faced with error \`${exp.error.replace(/\n/g, " ")}\`, DO NOT attempt: \`${exp.attemptedFix.replace(/\n/g, " ")}\`, because it was tested and failed in previous runs. Reason: ${exp.lesson}`;
			}
		});
	}
}
