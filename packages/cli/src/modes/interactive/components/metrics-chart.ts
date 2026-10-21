import { Container, Spacer, Text } from "astro-tui";
import { theme } from "../theme/theme.js";

export class MetricsChartComponent extends Container {
	private memTextChild!: Text;
	private tokenTextChild!: Text;
	private intervalId?: NodeJS.Timeout;

	constructor(
		private memoryData: number[] = [],
		private tokenData: number[] = [],
	) {
		super();
		this.buildChart();
		this.startLiveUpdates();
	}

	private sparkline(data: number[]): string {
		const ticks = [" ", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
		if (data.length === 0) return "";
		const min = Math.min(...data);
		const max = Math.max(...data);
		const range = max - min === 0 ? 1 : max - min;

		return data
			.map((val) => {
				const tickIndex = Math.floor(((val - min) / range) * (ticks.length - 1));
				return ticks[tickIndex];
			})
			.join("");
	}

	private buildChart(): void {
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.bold(theme.fg("accent", "📊 CANLI SİSTEM METRİKLERİ")), 1, 0));
		this.addChild(new Spacer(1));

		this.memTextChild = new Text("", 1, 0);
		this.tokenTextChild = new Text("", 1, 0);

		this.addChild(this.memTextChild);
		this.addChild(this.tokenTextChild);
		this.addChild(new Spacer(1));

		this.updateDisplays();
	}

	private updateDisplays(): void {
		const memSpark = this.sparkline(this.memoryData);
		const memText = `Bellek (RSS)     : [${theme.fg("success", memSpark.padEnd(20, " "))}]`;
		this.memTextChild.setText(memText);

		const tokenSpark = this.sparkline(this.tokenData);
		const tokenText = `Token Tüketimi   : [${theme.fg("warning", tokenSpark.padEnd(20, " "))}]`;
		this.tokenTextChild.setText(tokenText);
	}

	private startLiveUpdates(): void {
		// Initialize some fake history if empty
		if (this.memoryData.length === 0) {
			for (let i = 0; i < 20; i++) this.memoryData.push(process.memoryUsage().rss / 1024 / 1024);
			for (let i = 0; i < 20; i++) this.tokenData.push(Math.random() * 100);
		}

		this.intervalId = setInterval(() => {
			const memoryMB = process.memoryUsage().rss / 1024 / 1024;
			this.memoryData.push(memoryMB);
			if (this.memoryData.length > 20) this.memoryData.shift();

			// Fake a token usage delta for demonstration if real token hook is not active
			const tokenDelta = Math.random() * 50;
			this.tokenData.push(tokenDelta);
			if (this.tokenData.length > 20) this.tokenData.shift();

			this.updateDisplays();
		}, 2000);
	}

	public stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
		}
	}
}
