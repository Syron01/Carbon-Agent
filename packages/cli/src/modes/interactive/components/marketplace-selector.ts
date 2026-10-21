import { Container, Text } from "astro-tui";
import type { RegistryEntry } from "../../../core/marketplace.js";
import { theme } from "../theme/theme.js";

export class MarketplaceSelectorComponent extends Container {
	private selected = 0;
	constructor(
		private entries: RegistryEntry[],
		private onInstall: (entry: RegistryEntry) => void,
		private onCancel: () => void,
	) {
		super();
		this.redraw();
	}

	setEntries(entries: RegistryEntry[]): void {
		this.entries = entries;
		this.selected = 0;
		this.redraw();
	}

	onKeyPress(key: any): boolean {
		if (key.name === "escape") {
			this.onCancel();
			return true;
		}
		if (key.name === "return") {
			const entry = this.entries[this.selected];
			if (entry) this.onInstall(entry);
			return true;
		}
		if (key.name === "up") this.selected = Math.max(0, this.selected - 1);
		else if (key.name === "down") this.selected = Math.min(this.entries.length - 1, this.selected + 1);
		else return false;
		this.redraw();
		return true;
	}

	private redraw(): void {
		this.clear();
		this.addChild(new Text(theme.bold("Marketplace") + theme.fg("muted", "  Enter=kur Esc=kapat"), 1, 0));
		for (const [i, entry] of this.entries.slice(0, 15).entries()) {
			const prefix = i === this.selected ? theme.fg("accent", "› ") : "  ";
			this.addChild(
				new Text(
					`${prefix}${entry.name} ${theme.fg("muted", `[${entry.type}]`)} - ${entry.description || ""}`,
					1,
					0,
				),
			);
		}
	}
}
