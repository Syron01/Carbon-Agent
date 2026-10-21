import { Container, Spacer, Text } from "astro-tui";
import { theme } from "../theme/theme.js";

export interface RoadmapStep {
	id: string;
	label: string;
	status: "pending" | "active" | "completed";
}

export class RoadmapComponent extends Container {
	private steps: RoadmapStep[] = [];
	private etaMinutes = 0;
	private titleText: Text;
	private stepsContainer: Container;
	private etaText: Text;

	constructor() {
		super();
		this.titleText = new Text("", 0, 0);
		this.stepsContainer = new Container();
		this.etaText = new Text("", 0, 0);

		this.addChild(this.titleText);
		this.addChild(new Spacer(0, 1));
		this.addChild(this.stepsContainer);
		this.addChild(new Spacer(0, 1));
		this.addChild(this.etaText);

		this.refresh();
	}

	setSteps(steps: RoadmapStep[]) {
		this.steps = steps;
		this.renderSteps();
		this.refresh();
	}

	setEta(minutes: number) {
		this.etaMinutes = minutes;
		this.refresh();
	}

	updateStepStatus(id: string, status: "pending" | "active" | "completed") {
		const step = this.steps.find((s) => s.id === id);
		if (step) {
			step.status = status;
			this.renderSteps();
			this.refresh();
		}
	}

	private renderSteps() {
		this.stepsContainer.clear();
		this.steps.forEach((step, index) => {
			const isLast = index === this.steps.length - 1;
			let icon = "⚪";
			let color: any = "dim";

			if (step.status === "completed") {
				icon = "✅";
				color = "success";
			} else if (step.status === "active") {
				icon = "🚀";
				color = "accent";
			}

			const label = step.status === "active" ? theme.bold(step.label) : step.label;
			const stepRow = new Container();
			stepRow.addChild(new Text(`  ${theme.fg(color, icon)} ${theme.fg(color, label)}`, 0, 0));

			if (!isLast) {
				stepRow.addChild(new Text(theme.fg("dim", "     │"), 0, 0));
			}

			this.stepsContainer.addChild(stepRow);
		});
	}

	private refresh() {
		this.titleText.setText(` ${theme.bold(theme.fg("accent", "🗺️ YOL PLANI"))}`);

		const etaColor = this.etaMinutes > 0 ? "warning" : "success";
		const etaLabel = this.etaMinutes > 0 ? `~${this.etaMinutes} dk` : "Tamamlanmak üzere";
		this.etaText.setText(` ${theme.fg("dim", "🕒 Kalan:")} ${theme.fg(etaColor, etaLabel)}`);
	}
}
