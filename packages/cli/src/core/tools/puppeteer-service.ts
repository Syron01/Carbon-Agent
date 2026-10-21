import { platform } from "node:os";
import puppeteer, { type Browser } from "puppeteer-core";

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
	if (browserInstance) {
		try {
			await browserInstance.version();
			return browserInstance;
		} catch {
			browserInstance = null;
		}
	}

	const edgePaths = {
		win32: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
		darwin: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
		linux: "/usr/bin/microsoft-edge",
	};
	const chromePaths = {
		win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
		darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		linux: "/usr/bin/google-chrome",
	};

	const os = platform() as "win32" | "darwin" | "linux";
	let executablePath = chromePaths[os];

	try {
		browserInstance = await puppeteer.launch({
			executablePath,
			headless: false,
			defaultViewport: null,
			args: ["--start-maximized", "--no-sandbox"],
		});
	} catch (_e) {
		executablePath = edgePaths[os];
		browserInstance = await puppeteer.launch({
			executablePath,
			headless: false,
			defaultViewport: null,
			args: ["--start-maximized", "--no-sandbox"],
		});
	}

	return browserInstance;
}

export async function executePuppeteerAction(action: string, params: any): Promise<any> {
	const browser = await getBrowser();
	const pages = await browser.pages();
	const page = pages.length > 0 ? pages[0] : await browser.newPage();

	switch (action) {
		case "navigate":
			await page.goto(params.url, { waitUntil: "domcontentloaded" });
			return { success: true, url: page.url() };
		case "read": {
			const title = await page.title();
			const text = await page.evaluate(() => document.body.innerText);
			return { title, url: page.url(), text: text.substring(0, params.maxChars || 5000) };
		}
		case "click":
			if (params.selector) {
				await page.click(params.selector);
			} else if (params.x !== undefined && params.y !== undefined) {
				await page.mouse.click(params.x, params.y);
			}
			return { success: true };
		case "type":
			if (params.selector && params.text) {
				if (!params.append)
					await page.evaluate((sel: string) => {
						const el = document.querySelector(sel) as HTMLInputElement;
						if (el) el.value = "";
					}, params.selector);
				await page.type(params.selector, params.text);
			} else {
				await page.keyboard.type(params.text || "");
			}
			return { success: true };
		case "press_key":
			if (params.key) {
				await page.keyboard.press(params.key as any);
			}
			return { success: true };
		case "screenshot": {
			const b64 = await page.screenshot({ encoding: "base64" });
			return { format: "png", data: b64 };
		}
		case "get_elements":
			return await page.evaluate(() => {
				const els = Array.from(document.querySelectorAll("a, button, input, select, textarea, [role='button']"));
				return els
					.map((e) => ({ tag: e.tagName, text: (e as any).innerText || (e as any).value || "", id: e.id }))
					.slice(0, 50);
			});
		case "evaluate":
			if (params.script) {
				const res = await page.evaluate(params.script);
				return { result: res };
			}
			return { error: "No script" };
		case "scroll":
			await page.evaluate((amount: number) => window.scrollBy(0, amount), params.amount || 500);
			return { success: true };
		case "wait":
			await new Promise((r) => setTimeout(r, params.ms || 1000));
			return { success: true };
		default:
			return { success: true, warning: `Action ${action} mapped to basic success in native mode.` };
	}
}

export async function executePuppeteerTabs(action: string, _params: any): Promise<any> {
	const browser = await getBrowser();
	switch (action) {
		case "list": {
			const pages = await browser.pages();
			return { tabs: pages.map((p, i) => ({ id: i, url: p.url(), title: "Tab" })) };
		}
		case "open":
			await browser.newPage();
			return { success: true };
		case "close": {
			const toClose = await browser.pages();
			if (toClose.length > 0) await toClose[toClose.length - 1].close();
			return { success: true };
		}
		default:
			return { success: true };
	}
}
