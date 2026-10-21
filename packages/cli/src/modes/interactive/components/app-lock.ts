// @ts-nocheck
import { Container, matchesKey, Spacer, Text } from "astro-tui";
import { theme } from "../theme/theme.js";
import { DynamicBorder } from "./dynamic-border.js";

/**
 * AppLockComponent - displays a beautiful lock overlay when /app is active
 */
export class AppLockComponent extends Container {
	constructor(
		private onUnlock: () => void,
		private readonly appUrl = "http://127.0.0.1:3131/app",
	) {
		super();

		// Top border
		this.addChild(new DynamicBorder((text) => theme.fg("accent", text)));
		this.addChild(new Spacer(1));

		// Title
		this.addChild(new Text(theme.fg("accent", theme.bold("  🔒 Carbon-Agent WEB ARAYÜZÜ AKTİF")), 0, 0));
		this.addChild(new Spacer(1));

		// Description
		this.addChild(new Text("  TUI geçici olarak kilitlendi. Carbon-Agent'ı tarayıcınızdan", 0, 0));
		this.addChild(new Text("  anlık olarak izleyebilir ve yeni mesajlar gönderebilirsiniz.", 0, 0));
		this.addChild(new Spacer(1));

		// Address info
		this.addChild(new Text(`  Adres: ${theme.fg("accent", theme.underline(this.appUrl))}`, 0, 0));
		this.addChild(new Spacer(1));

		// Key hints
		this.addChild(new Text(theme.fg("dim", "  [q / Esc / Ctrl+C] TUI kilidini açar ve buraya döner"), 0, 0));
		this.addChild(new Spacer(1));

		// Bottom border
		this.addChild(new DynamicBorder((text) => theme.fg("accent", text)));
	}

	override handleInput(data: string): void {
		if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c") || data === "q" || data === "Q") {
			this.onUnlock();
		}
	}
}
