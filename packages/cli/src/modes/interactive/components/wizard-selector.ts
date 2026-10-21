/**
 * WizardSelectorComponent — multi-step tabbed option picker.
 * Model triggers via :::wizard blocks in its output.
 * Tab = next step | ↑↓ / number = select | Enter = confirm | Esc = cancel
 */

import { Container, getKeybindings, Spacer, Text } from "astro-tui";
import { DynamicBorder } from "./dynamic-border.js";

const ANSI_RE = /\x1b\[[0-9;]*m/g;
const rgb = (r: number, g: number, b: number, s: string) => `\x1b[38;2;${r};${g};${b}m${s}\x1b[39m`;
const bgc = (r: number, g: number, b: number, s: string) => `\x1b[48;2;${r};${g};${b}m${s}\x1b[49m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const _reset = "\x1b[0m";
const _w = (s: string) => s.replace(ANSI_RE, "").length;

const c = {
	accent: (s: string) => rgb(100, 180, 255, s),
	active: (s: string) => rgb(220, 160, 60, s),
	dim: (s: string) => rgb(65, 65, 65, s),
	muted: (s: string) => rgb(120, 120, 120, s),
	bright: (s: string) => rgb(210, 210, 210, s),
	tabBg: (s: string) => bgc(20, 22, 30, s),
	tabActiveBg: (s: string) => bgc(35, 38, 52, s),
	border: (s: string) => rgb(50, 55, 70, s),
	hint: (s: string) => rgb(75, 75, 75, s),
	num: (s: string) => rgb(140, 200, 140, s),
	desc: (s: string) => rgb(100, 100, 100, s),
};

export interface WizardStep {
	title: string;
	question: string;
	options: Array<{ label: string; description?: string }>;
}

export interface WizardResult {
	answers: string[]; // selected label per step
	completed: boolean;
}

export class WizardSelectorComponent extends Container {
	private steps: WizardStep[];
	private currentStep = 0;
	private selectedIndex = 0;
	private answers: string[] = [];
	private onDone: (result: WizardResult) => void;
	private onCancel: () => void;
	private listContainer: Container;
	private headerContainer: Container;
	private hintText: Text;
	private questionText: Text;

	constructor(steps: WizardStep[], onDone: (result: WizardResult) => void, onCancel: () => void) {
		super();
		this.steps = steps;
		this.onDone = onDone;
		this.onCancel = onCancel;

		this.addChild(new DynamicBorder());
		this.addChild(new Spacer(1));

		// Tab bar
		this.headerContainer = new Container();
		this.addChild(this.headerContainer);

		this.addChild(new Spacer(1));

		// Question text
		this.questionText = new Text("", 1, 0);
		this.addChild(this.questionText);

		this.addChild(new Spacer(1));

		// Options list
		this.listContainer = new Container();
		this.addChild(this.listContainer);

		this.addChild(new Spacer(1));

		// Keyboard hints
		this.hintText = new Text(
			c.hint("⇄ tab") +
				c.dim("  ") +
				c.hint("↑↓ select") +
				c.dim("  ") +
				c.hint("enter confirm") +
				c.dim("  ") +
				c.hint("esc dismiss"),
			1,
			0,
		);
		this.addChild(this.hintText);
		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder());

		this.refresh();
	}

	private refresh(): void {
		this.renderTabs();
		this.renderQuestion();
		this.renderList();
	}

	private renderTabs(): void {
		this.headerContainer.clear();
		const tabLine = this.steps
			.map((step, i) => {
				const isActive = i === this.currentStep;
				const isDone = i < this.currentStep;
				const label = isDone ? `✓ ${step.title}` : step.title;
				if (isActive) {
					return c.tabActiveBg(bold(c.accent(` ${label} `)));
				}
				return c.tabBg(isDone ? c.muted(` ${label} `) : c.dim(` ${label} `));
			})
			.join(c.dim("│"));
		this.headerContainer.addChild(new Text(` ${tabLine}`, 0, 0));
	}

	private renderQuestion(): void {
		const step = this.steps[this.currentStep];
		if (!step) return;
		this.questionText.setText(` ${c.bright(step.question)}`);
	}

	private renderList(): void {
		this.listContainer.clear();
		const step = this.steps[this.currentStep];
		if (!step) return;

		for (let i = 0; i < step.options.length; i++) {
			const opt = step.options[i];
			const isSelected = i === this.selectedIndex;
			const num = `${i + 1}.`;

			if (isSelected) {
				const marker = c.active(bold(`${num} ${opt.label}`));
				const desc = opt.description ? `\n     ${c.desc(opt.description)}` : "";
				this.listContainer.addChild(new Text(` ${marker}${desc}`, 1, 0));
			} else {
				const marker = c.muted(`${num} `) + c.muted(opt.label);
				const desc = opt.description ? `\n     ${c.desc(opt.description)}` : "";
				this.listContainer.addChild(new Text(` ${marker}${desc}`, 1, 0));
			}
		}

		// Show "Type your own answer" at the bottom
		const isLastSelected = this.selectedIndex === step.options.length;
		const ownLabel = isLastSelected ? c.active(bold("Type your own answer")) : c.dim("Type your own answer");
		this.listContainer.addChild(new Text(` ${c.dim(`${step.options.length + 1}.`)} ${ownLabel}`, 1, 0));
	}

	handleInput(keyData: string): void {
		const kb = getKeybindings();
		const step = this.steps[this.currentStep];
		if (!step) return;

		const maxIdx = step.options.length; // +1 for "type own"

		// Number keys 1–9
		if (/^[1-9]$/.test(keyData)) {
			const n = parseInt(keyData, 10) - 1;
			if (n >= 0 && n <= maxIdx) {
				this.selectedIndex = n;
				this.renderList();
				return;
			}
		}

		if (kb.matches(keyData, "tui.select.up") || keyData === "k") {
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
			this.renderList();
		} else if (kb.matches(keyData, "tui.select.down") || keyData === "j") {
			this.selectedIndex = Math.min(maxIdx, this.selectedIndex + 1);
			this.renderList();
		} else if (keyData === "\t") {
			// Tab → next step (without confirming current — allows browsing)
			this.currentStep = (this.currentStep + 1) % this.steps.length;
			this.selectedIndex = 0;
			this.refresh();
		} else if (kb.matches(keyData, "tui.select.confirm") || keyData === "\r" || keyData === "\n") {
			this.confirm();
		} else if (kb.matches(keyData, "tui.select.cancel")) {
			this.onCancel();
		}
	}

	private confirm(): void {
		const step = this.steps[this.currentStep];
		if (!step) return;

		const selected = this.selectedIndex < step.options.length ? step.options[this.selectedIndex]!.label : "custom";

		this.answers[this.currentStep] = selected;

		if (this.currentStep < this.steps.length - 1) {
			// Move to next step
			this.currentStep++;
			this.selectedIndex = 0;
			this.refresh();
		} else {
			// All steps done
			this.onDone({ answers: this.answers, completed: true });
		}
	}

	dispose(): void {}
}

// ── Parser ───────────────────────────────────────────────────────────────────
/**
 * Parses :::wizard...:::end blocks from model output.
 * Format:
 *   :::wizard
 *   ## Step Title
 *   Question text?
 *   - Option label | description
 *   - Option label
 *   ## Next Step Title
 *   ...
 *   :::end
 */
export function parseWizardBlock(text: string): WizardStep[] | null {
	const match = text.match(/:::wizard\n([\s\S]*?):::end/);
	if (!match || !match[1]) return null;

	const body = match[1];
	const stepBlocks = body.split(/^##\s+/m).filter((b) => b.trim());

	if (stepBlocks.length === 0) return null;

	const steps: WizardStep[] = [];

	for (const block of stepBlocks) {
		const lines = block
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
		if (lines.length < 2) continue;

		const title = lines[0]!.trim();
		const questionLine = lines.find((l) => !l.startsWith("-") && l !== title);
		const question = questionLine ?? title;
		const optionLines = lines.filter((l) => l.startsWith("-"));

		const options = optionLines.map((l) => {
			const raw = l.slice(1).trim();
			const parts = raw.split("|");
			return {
				label: parts[0]!.trim(),
				description: parts[1]?.trim(),
			};
		});

		if (options.length > 0) {
			steps.push({ title, question, options });
		}
	}

	return steps.length > 0 ? steps : null;
}
