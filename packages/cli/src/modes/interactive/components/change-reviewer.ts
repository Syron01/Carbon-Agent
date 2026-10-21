import { Container, Text } from "astro-tui";
import { theme } from "../theme/theme.js";
import { DiffPreviewComponent } from "./diff-preview.js";

export type ChangeReviewAction = "accept" | "reject" | "edit";

export class ChangeReviewerComponent extends Container {
	constructor(
		diff: string,
		private onAction?: (action: ChangeReviewAction) => void,
	) {
		super();
		this.addChild(
			new Text(theme.bold("Change Review") + theme.fg("muted", "  Enter=accept Esc=reject e=edit"), 1, 0),
		);
		this.addChild(new DiffPreviewComponent(diff));
	}

	onKeyPress(key: any): boolean {
		if (key.name === "return") {
			this.onAction?.("accept");
			return true;
		}
		if (key.name === "escape") {
			this.onAction?.("reject");
			return true;
		}
		if (key.sequence === "e") {
			this.onAction?.("edit");
			return true;
		}
		return false;
	}
}
