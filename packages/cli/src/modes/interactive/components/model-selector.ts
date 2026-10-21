// @ts-nocheck
import { type Model, modelsAreEqual } from "astro-core";
import { Container, type Focusable, fuzzyFilter, getKeybindings, Input, Spacer, Text, type TUI } from "astro-tui";
import type { ModelRegistry } from "../../../core/model-registry.js";
import { QuotaManager } from "../../../core/quota-manager.js";
import type { SettingsManager } from "../../../core/settings-manager.js";
import { theme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";
import { keyHint } from "./keybinding-hints.js";

interface ModelItem {
	provider: string;
	id: string;
	model: Model<any>;
}

interface ScopedModelItem {
	model: Model<any>;
	thinkingLevel?: string;
}

type ModelScope = "all" | "scoped";

/**
 * Modern Model Selector - Redesigned for premium look and feel
 */
export class ModelSelectorComponent extends Container implements Focusable {
	private searchInput: Input;
	private _focused = false;
	private listContainer: Container;
	private allModels: ModelItem[] = [];
	private scopedModelItems: ModelItem[] = [];
	private activeModels: ModelItem[] = [];
	private filteredModels: ModelItem[] = [];
	private selectedIndex: number = 0;
	private currentModel?: Model<any>;
	private settingsManager: SettingsManager;
	private modelRegistry: ModelRegistry;
	private onSelectCallback: (model: Model<any>) => void;
	private onCancelCallback: () => void;
	private errorMessage?: string;
	private tui: TUI;
	private scopedModels: ReadonlyArray<ScopedModelItem>;
	private scope: ModelScope = "all";
	private scopeText?: Text;

	constructor(
		tui: TUI,
		currentModel: Model<any> | undefined,
		settingsManager: SettingsManager,
		modelRegistry: ModelRegistry,
		scopedModels: ReadonlyArray<ScopedModelItem>,
		onSelect: (model: Model<any>) => void,
		onCancel: () => void,
		initialSearchInput?: string,
	) {
		super();

		this.tui = tui;
		this.currentModel = currentModel;
		this.settingsManager = settingsManager;
		this.modelRegistry = modelRegistry;
		this.scopedModels = scopedModels;
		this.scope = scopedModels.length > 0 ? "scoped" : "all";
		this.onSelectCallback = onSelect;
		this.onCancelCallback = onCancel;

		this.setupUI(initialSearchInput);
		this.loadModels().then(() => {
			if (initialSearchInput) {
				this.filterModels(initialSearchInput);
			} else {
				this.updateList();
			}
			this.tui.requestRender();
		});
	}

	get focused(): boolean {
		return this._focused;
	}
	set focused(value: boolean) {
		this._focused = value;
		this.searchInput.focused = value;
	}

	private setupUI(initialSearchInput?: string) {
		this.addChild(new DynamicBorder());
		this.addChild(new Spacer(1));

		const titleText = theme.bold(theme.fg("accent", " ❯ MODEL SEÇİMİ"));
		this.addChild(new Text(titleText, 0, 0));

		if (this.scopedModels.length > 0) {
			this.scopeText = new Text(this.getScopeText(), 1, 0);
			this.addChild(this.scopeText);
		}

		this.addChild(new Spacer(1));

		this.searchInput = new Input();
		if (initialSearchInput) this.searchInput.setValue(initialSearchInput);

		this.searchInput.onSubmit = () => {
			if (this.filteredModels[this.selectedIndex]) {
				this.handleSelect(this.filteredModels[this.selectedIndex].model);
			}
		};
		this.addChild(this.searchInput);
		this.addChild(new Spacer(1));

		this.listContainer = new Container();
		this.addChild(this.listContainer);

		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder());

		// Footer hints
		const hints = `${keyHint("tui.select.up")}/${keyHint("tui.select.down")} seç • ${keyHint("tui.select.confirm")} onayla • ${keyHint("tui.select.cancel")} iptal`;
		this.addChild(new Text(theme.fg("dim", ` ${hints}`), 0, 0));
	}

	private async loadModels(): Promise<void> {
		this.modelRegistry.refresh();
		const loadError = this.modelRegistry.getError();
		if (loadError) this.errorMessage = loadError;

		try {
			const availableModels = await this.modelRegistry.getAvailable();
			this.allModels = this.sortModels(availableModels.map((m) => ({ provider: m.provider, id: m.id, model: m })));
		} catch (error) {
			this.errorMessage = error instanceof Error ? error.message : String(error);
			return;
		}

		this.scopedModelItems = this.scopedModels.map((s) => ({
			provider: s.model.provider,
			id: s.model.id,
			model: s.model,
		}));

		this.activeModels = this.scope === "scoped" ? this.scopedModelItems : this.allModels;
		this.filteredModels = this.activeModels;

		const currentIndex = this.filteredModels.findIndex((item) => modelsAreEqual(this.currentModel, item.model));
		this.selectedIndex = currentIndex >= 0 ? currentIndex : 0;
	}

	private sortModels(models: ModelItem[]): ModelItem[] {
		return [...models].sort((a, b) => {
			const aIsCurrent = modelsAreEqual(this.currentModel, a.model);
			const bIsCurrent = modelsAreEqual(this.currentModel, b.model);
			if (aIsCurrent && !bIsCurrent) return -1;
			if (!aIsCurrent && bIsCurrent) return 1;

			// Provider sorting: ollama first, then alphabetically
			if (a.provider === "ollama" && b.provider !== "ollama") return -1;
			if (a.provider !== "ollama" && b.provider === "ollama") return 1;

			return a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id);
		});
	}

	private getScopeText(): string {
		const allTag =
			this.scope === "all" ? theme.bg("selectedBg", theme.fg("text", " HEPSİ ")) : theme.fg("dim", " HEPSİ ");
		const scopedTag =
			this.scope === "scoped" ? theme.bg("selectedBg", theme.fg("text", " KISITLI ")) : theme.fg("dim", " KISITLI ");
		return `${theme.fg("dim", "Kapsam [TAB]: ")}${allTag} ${scopedTag}`;
	}

	private filterModels(query: string): void {
		this.filteredModels = query
			? fuzzyFilter(this.activeModels, query, ({ id, provider }) => `${provider}/${id} ${id}`)
			: this.activeModels;
		this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredModels.length - 1));
		this.updateList();
	}

	private updateList(): void {
		this.listContainer.clear();

		if (this.errorMessage) {
			this.listContainer.addChild(new Text(theme.fg("error", ` ⚠ Error: ${this.errorMessage}`), 1, 0));
			return;
		}

		if (this.filteredModels.length === 0) {
			this.listContainer.addChild(new Text(theme.fg("dim", "   Sonuç bulunamadı..."), 1, 0));
			return;
		}

		const maxVisible = 10;
		const startIndex = Math.max(0, Math.min(this.selectedIndex - 4, this.filteredModels.length - maxVisible));
		const endIndex = Math.min(startIndex + maxVisible, this.filteredModels.length);

		let lastProvider = "";

		for (let i = startIndex; i < endIndex; i++) {
			const item = this.filteredModels[i];
			const isSelected = i === this.selectedIndex;
			const isCurrent = modelsAreEqual(this.currentModel, item.model);

			if (!this.searchInput.getValue() && item.provider !== lastProvider) {
				const providerLabel = item.provider.toUpperCase();
				this.listContainer.addChild(new Text(theme.bold(theme.fg("dim", ` ── ${providerLabel} ──`)), 1, 0));
				lastProvider = item.provider;
			}

			const idStr = item.id;
			const providerStr = `[${item.provider}]`;
			const ctx = item.model.contextWindow ? `${Math.floor(item.model.contextWindow / 1024)}k` : "";
			const ctxStr = ctx ? `(${ctx} ctx)` : "";

			// Left column: ID, Right columns: provider and context aligned to the right!
			const rightContent = `${providerStr} ${ctxStr}`;

			// Calculate padding based on a fixed width
			const targetWidth = 52;
			const visibleLeft = idStr.length + 2;
			const visibleRight = rightContent.length;
			const paddingNeeded = Math.max(2, targetWidth - visibleLeft - visibleRight);
			const spacePadding = " ".repeat(paddingNeeded);

			const reasoning = item.model.reasoning ? theme.fg("warning", " ⚛") : "  ";
			const check = isCurrent ? theme.fg("success", " ●") : "  ";

			let line = "";
			if (isSelected) {
				const highlightedId = theme.bold(theme.fg("accent", ` ❯ ${idStr}`));
				const highlightedInfo = theme.fg("dim", rightContent);
				line = `${theme.bg("selectedBg", ` ${highlightedId}${spacePadding}${highlightedInfo} `)}${reasoning}${check}`;
			} else {
				const dimId = theme.fg("text", `   ${idStr}`);
				const dimInfo = theme.fg("dim", rightContent);
				line = ` ${dimId}${spacePadding}${dimInfo} ${reasoning}${check}`;
			}

			this.listContainer.addChild(new Text(line, 0, 0));
		}

		// Selected Detail Panel
		const selected = this.filteredModels[this.selectedIndex];
		if (selected) {
			this.listContainer.addChild(new Spacer(1));
			const detailBox = new Container();
			detailBox.addChild(
				new Text(
					theme.fg("accent", ` ┌─ BİLGİ: ${selected.model.name.toUpperCase()} ──────────────────────────`),
					0,
					0,
				),
			);
			const ctx = selected.model.contextWindow
				? `${Math.floor(selected.model.contextWindow / 1024)}k`
				: "Bilinmiyor";
			const info = ` │  Sağlayıcı : ${selected.provider.toUpperCase()}\n │  Bağlam    : ${ctx} tokens\n │  Zihin     : ${selected.model.reasoning ? "Aktif (DeepThink)" : "Standart Model"}`;

			const quotaStats = QuotaManager.getInstance().getStats();
			const quotaColor = quotaStats.percent > 20 ? "success" : "error";
			const remainingVal = Math.max(0, quotaStats.limit - quotaStats.spent);
			const quotaLine = `\n │  Kota      : ${theme.fg(quotaColor, `${quotaStats.percent.toFixed(1)}%`)} (${theme.fg("dim", `$${remainingVal.toFixed(2)} kaldı`)})`;

			detailBox.addChild(new Text(theme.fg("dim", info + quotaLine), 0, 0));
			detailBox.addChild(
				new Text(theme.fg("accent", ` └──────────────────────────────────────────────────────────`), 0, 0),
			);
			this.listContainer.addChild(detailBox);
		}
	}

	handleInput(keyData: string): void {
		const kb = getKeybindings();

		if (kb.matches(keyData, "tui.input.tab")) {
			if (this.scopedModelItems.length > 0) {
				this.scope = this.scope === "all" ? "scoped" : "all";
				this.activeModels = this.scope === "scoped" ? this.scopedModelItems : this.allModels;
				if (this.scopeText) this.scopeText.setText(this.getScopeText());
				this.filterModels(this.searchInput.getValue());
			}
			return;
		}

		if (kb.matches(keyData, "tui.select.up")) {
			if (this.filteredModels.length === 0) return;
			this.selectedIndex = (this.selectedIndex - 1 + this.filteredModels.length) % this.filteredModels.length;
			this.updateList();
			this.tui.requestRender();
		} else if (kb.matches(keyData, "tui.select.down")) {
			if (this.filteredModels.length === 0) return;
			this.selectedIndex = (this.selectedIndex + 1) % this.filteredModels.length;
			this.updateList();
			this.tui.requestRender();
		} else if (kb.matches(keyData, "tui.select.confirm")) {
			const sel = this.filteredModels[this.selectedIndex];
			if (sel) this.handleSelect(sel.model);
		} else if (kb.matches(keyData, "tui.select.cancel")) {
			this.onCancelCallback();
		} else {
			this.searchInput.handleInput(keyData);
			this.filterModels(this.searchInput.getValue());
			this.tui.requestRender();
		}
	}

	private handleSelect(model: Model<any>): void {
		this.settingsManager.setDefaultModelAndProvider(model.provider, model.id);
		this.onSelectCallback(model);
	}

	getSearchInput(): Input {
		return this.searchInput;
	}
}
