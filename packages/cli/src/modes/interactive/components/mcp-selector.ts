import { Container, type Focusable, fuzzyFilter, getKeybindings, Input, Spacer, TruncatedText } from "astro-tui";
import { theme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";

export type McpSelectorOption = {
	id: string;
	name: string;
	description: string;
};

/**
 * Component that renders the MCP interactive selector menu
 */
export class McpSelectorComponent extends Container implements Focusable {
	private searchInput: Input;

	private _focused = false;
	get focused(): boolean {
		return this._focused;
	}
	set focused(value: boolean) {
		this._focused = value;
		this.searchInput.focused = value;
	}

	private listContainer: Container;
	private allOptions: McpSelectorOption[];
	private filteredOptions: McpSelectorOption[];
	private selectedIndex: number = 0;
	private onSelectCallback: (optionId: string) => void;
	private onCancelCallback: () => void;
	private mcpStatusMessage: string;

	constructor(
		options: McpSelectorOption[],
		mcpStatusMessage: string,
		onSelect: (optionId: string) => void,
		onCancel: () => void,
	) {
		super();

		this.allOptions = options;
		this.filteredOptions = options;
		this.mcpStatusMessage = mcpStatusMessage;
		this.onSelectCallback = onSelect;
		this.onCancelCallback = onCancel;

		this.addChild(new DynamicBorder());
		this.addChild(new Spacer(1));

		this.addChild(new TruncatedText(theme.fg("accent", theme.bold("Model Bağlam Protokolü (MCP) Menüsü:")), 1, 0));
		this.addChild(new TruncatedText(theme.fg("muted", this.mcpStatusMessage), 1, 0));
		this.addChild(new Spacer(1));

		this.searchInput = new Input();
		this.searchInput.onSubmit = () => {
			const selectedOption = this.filteredOptions[this.selectedIndex];
			if (selectedOption) {
				this.onSelectCallback(selectedOption.id);
			}
		};
		this.addChild(this.searchInput);
		this.addChild(new Spacer(1));

		this.listContainer = new Container();
		this.addChild(this.listContainer);

		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder());

		this.filterOptions("");
	}

	private filterOptions(query: string): void {
		this.filteredOptions = query
			? fuzzyFilter(this.allOptions, query, (option) => `${option.name} ${option.description}`)
			: this.allOptions;
		this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, Math.max(0, this.filteredOptions.length - 1)));
		this.updateList();
	}

	private updateList(): void {
		this.listContainer.clear();

		const maxVisible = 8;
		const startIndex = Math.max(
			0,
			Math.min(this.selectedIndex - Math.floor(maxVisible / 2), this.filteredOptions.length - maxVisible),
		);
		const endIndex = Math.min(startIndex + maxVisible, this.filteredOptions.length);

		for (let i = startIndex; i < endIndex; i++) {
			const option = this.filteredOptions[i];
			if (!option) continue;

			const isSelected = i === this.selectedIndex;

			let line = "";
			if (isSelected) {
				const prefix = theme.fg("accent", "→ ");
				const text = theme.fg("accent", option.name);
				line = prefix + text + theme.fg("muted", ` - ${option.description}`);
			} else {
				const text = `  ${theme.fg("text", option.name)}`;
				line = text + theme.fg("muted", ` - ${option.description}`);
			}

			this.listContainer.addChild(new TruncatedText(line, 1, 0));
		}

		if (startIndex > 0 || endIndex < this.filteredOptions.length) {
			const scrollInfo = theme.fg("muted", `  (${this.selectedIndex + 1}/${this.filteredOptions.length})`);
			this.listContainer.addChild(new TruncatedText(scrollInfo, 1, 0));
		}

		if (this.filteredOptions.length === 0) {
			this.listContainer.addChild(new TruncatedText(theme.fg("muted", `  Seçenek bulunamadı`), 1, 0));
		}
	}

	handleInput(keyData: string): void {
		const kb = getKeybindings();
		if (kb.matches(keyData, "tui.select.up")) {
			if (this.filteredOptions.length === 0) return;
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
			this.updateList();
		} else if (kb.matches(keyData, "tui.select.down")) {
			if (this.filteredOptions.length === 0) return;
			this.selectedIndex = Math.min(this.filteredOptions.length - 1, this.selectedIndex + 1);
			this.updateList();
		} else if (kb.matches(keyData, "tui.select.confirm")) {
			const selectedOption = this.filteredOptions[this.selectedIndex];
			if (selectedOption) {
				this.onSelectCallback(selectedOption.id);
			}
		} else if (kb.matches(keyData, "tui.select.cancel")) {
			this.onCancelCallback();
		} else {
			this.searchInput.handleInput(keyData);
			this.filterOptions(this.searchInput.getValue());
		}
	}
}
