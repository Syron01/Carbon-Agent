import type { TUI } from "astro-tui";
import type { SettingsManager } from "../../../core/settings-manager.js";
import { initTheme, setTheme, setThemeInstance, type Theme } from "./theme.js";

type ThemeResult = { success: boolean; error?: string };

export class InteractiveThemeController {
	private readonly ui: TUI;
	private readonly settingsManager: SettingsManager;
	private readonly showError: (message: string) => void;
	private readonly onChanged: () => void;
	private activeThemeName: string | undefined;
	private autoSyncEnabled = false;

	constructor(ui: TUI, settingsManager: SettingsManager, showError: (message: string) => void, onChanged: () => void) {
		this.ui = ui;
		this.settingsManager = settingsManager;
		this.showError = showError;
		this.onChanged = onChanged;
		const themeSetting = this.settingsManager.getTheme();
		this.activeThemeName = themeSetting ?? undefined;
		initTheme(this.activeThemeName, true);
		this.ui.onTerminalColorSchemeChange?.((terminalTheme: "dark" | "light") =>
			this.applyTerminalTheme(terminalTheme),
		);
	}

	async applyFromSettings(): Promise<void> {
		const themeSetting = this.settingsManager.getTheme();
		if (themeSetting !== undefined) {
			this.applyThemeName(themeSetting, true);
			return;
		}
		this.applyThemeName("dark", true);
	}

	setThemeName(themeName: string, showError = false): ThemeResult {
		this.setAutoSync(false);
		return this.applyThemeName(themeName, showError);
	}

	setThemeInstance(themeInstance: Theme): ThemeResult {
		this.setAutoSync(false);
		setThemeInstance(themeInstance);
		this.activeThemeName = "<in-memory>";
		this.notifyChanged();
		return { success: true };
	}

	preview(themeSettingOrName: string): void {
		if (setTheme(themeSettingOrName, true).success) {
			this.ui.invalidate();
			this.ui.requestRender();
		}
	}

	disableAutoSync(): void {
		this.setAutoSync(false);
	}

	getTerminalTheme(): "dark" | "light" {
		return this.activeThemeName?.includes("light") ? "light" : "dark";
	}

	private applyThemeName(themeName: string, showError = false): ThemeResult {
		const result = setTheme(themeName, true);
		this.activeThemeName = result.success ? themeName : "dark";
		this.notifyChanged();
		if (!result.success && showError) {
			this.showError(`Failed to load theme "${themeName}": ${result.error}\nFell back to dark theme.`);
		}
		return result;
	}

	private notifyChanged(): void {
		this.ui.invalidate();
		this.onChanged();
	}

	private setAutoSync(enabled: boolean): void {
		if (this.autoSyncEnabled === enabled) return;
		this.autoSyncEnabled = enabled;
		this.ui.setTerminalColorSchemeNotifications(enabled);
	}

	private applyTerminalTheme(_terminalTheme: "dark" | "light"): void {
		if (!this.autoSyncEnabled) return;
		const themeSetting = this.settingsManager.getTheme();
		if (!themeSetting) {
			this.setAutoSync(false);
			return;
		}
		if (themeSetting !== this.activeThemeName) {
			this.applyThemeName(themeSetting);
		}
	}
}
