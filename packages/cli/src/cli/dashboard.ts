// @ts-nocheck

import chalk from "chalk";
import { execSync } from "child_process";
import { existsSync, readdirSync, statSync } from "fs";
import { cpus, freemem, homedir, totalmem } from "os";
import { join } from "path";
import readline from "readline";

/**
 * 20+ FEATURE ULTIMATE INTERACTIVE TERMINAL DASHBOARD
 * FOR Carbon-Agent v2026-beta1
 */

interface MenuItem {
	key: string;
	name: string;
	desc: string;
}

export async function showEpicDashboard(_version: string, cwd: string): Promise<boolean> {
	// Ensure raw mode is enabled
	const wasRaw = process.stdin.isRaw;
	if (process.stdin.isTTY) {
		process.stdin.setRawMode(true);
	}
	readline.emitKeypressEvents(process.stdin);

	let currentThemeIndex = 0;
	const themes = [
		{
			name: "Dark Obsidian",
			primary: chalk.hex("#9d4edd"),
			secondary: chalk.hex("#e0aaff"),
			bg: chalk.bgHex("#0b090a"),
		},
		{
			name: "Dark Abyss",
			primary: chalk.hex("#0077b6"),
			secondary: chalk.hex("#00b4d8"),
			bg: chalk.bgHex("#03045e"),
		},
		{
			name: "Dark Forest",
			primary: chalk.hex("#2d6a4f"),
			secondary: chalk.hex("#52b788"),
			bg: chalk.bgHex("#081c15"),
		},
		{
			name: "Dark Carbon",
			primary: chalk.hex("#6c757d"),
			secondary: chalk.hex("#adb5bd"),
			bg: chalk.bgHex("#121212"),
		},
		{
			name: "Light Cloud",
			primary: chalk.hex("#0077b6"),
			secondary: chalk.hex("#00b4d8"),
			bg: chalk.bgHex("#f8f9fa"),
		},
		{
			name: "Light Sand",
			primary: chalk.hex("#d4a373"),
			secondary: chalk.hex("#faedcd"),
			bg: chalk.bgHex("#fefae0"),
		},
		{
			name: "Light Mint",
			primary: chalk.hex("#2d6a4f"),
			secondary: chalk.hex("#52b788"),
			bg: chalk.bgHex("#f1faee"),
		},
		{
			name: "Light Lavender",
			primary: chalk.hex("#9d4edd"),
			secondary: chalk.hex("#c77dff"),
			bg: chalk.bgHex("#f8f9fa"),
		},
	];

	let currentView:
		| "menu"
		| "starfield"
		| "game"
		| "doctor"
		| "explorer"
		| "evolution"
		| "benchmarker"
		| "docs"
		| "history"
		| "keys" = "menu";
	let activeIndex = 0;

	const menuItems: MenuItem[] = [
		{ key: "1", name: "Launch AI Session", desc: "Start the cognitive interactive multi-agent coding experience" },
		{
			key: "2",
			name: "Start 3D Cosmic Portal",
			desc: "Open the stunning interactive WebGL space dashboard in your browser",
		},
		{
			key: "3",
			name: "Play Moon Arcade (Snake)",
			desc: "Play an interactive classic terminal arcade game styled in Obsidian",
		},
		{ key: "4", name: "Run System Doctor", desc: "Audit workspace health, environment settings, and permissions" },
		{ key: "5", name: "Semantic File Explorer", desc: "Explore local folders, sizes, and file types dynamically" },
		{
			key: "6",
			name: "Self-Evolution Simulator",
			desc: "Simulate Carbon-Agent analyzing its own source AST and self-improving",
		},
		{
			key: "7",
			name: "Speed & Cost Benchmarker",
			desc: "Benchmark token generation rates, latencies, and project expenses",
		},
		{
			key: "8",
			name: "Help & Commands Manual",
			desc: "Detailed list of keyboard shortcuts, slash commands, and extension guides",
		},
		{
			key: "9",
			name: "Previous Sessions Browser",
			desc: "View, search, or compact previously saved interactive sessions",
		},
		{
			key: "10",
			name: "Secure Key Manager",
			desc: "Manage and verify Anthropic, OpenAI, Gemini, and local Ollama keys",
		},
		{ key: "11", name: "Switch UI Themes", desc: "Cycle between 8 designer color templates in real time" },
		{ key: "12", name: "Exit Portal", desc: "Exit cleanly to the normal command line shell" },
	];

	// System statistics
	const totalGB = (totalmem() / 1024 / 1024 / 1024).toFixed(1);
	const freeGB = (freemem() / 1024 / 1024 / 1024).toFixed(1);
	const cpuName = cpus()[0]?.model.trim() || "Unknown Processor";
	const nodeVersion = process.version;
	const _platformName = process.platform;

	let gitBranch = "unknown";
	try {
		gitBranch = execSync("git rev-parse --abbrev-ref HEAD", { stdio: "pipe" }).toString().trim();
	} catch {}

	function clearScreen() {
		process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
	}

	function drawHeader(theme: (typeof themes)[0]) {
		const _P = theme.primary;
		const _S = theme.secondary;
	}

	function drawAsciiArt(theme: (typeof themes)[0]) {
		const P = theme.primary;
		const S = theme.secondary;
		const _ascii = `
   ${P("███╗   ███╗ ██████╗  ██████╗ ███╗   ██╗  ██████╗  ██████╗  ██████╗  ███████╗")}
   ${P("████╗ ████║██╔═══██╗██╔═══██╗████╗  ██║ ██╔════╝ ██╔═══██╗ ██╔═══██╗ ██╔════╝")}
   ${S("██╔████╔██║██║   ██║██║   ██║██╔██╗ ██║ ██║      ██║   ██║ ██║   ██║ █████╗  ")}
   ${S("██║╚██╔╝██║██║   ██║██║   ██║██║╚██╗██║ ██║      ██║   ██║ ██║   ██║ ██╔══╝  ")}
   ${P("██║ ╚═╝ ██║╚██████╔╝╚██████╔╝██║ ╚████║ ╚██████╗ ╚██████╔╝ ╚██████╔╝ ███████╗")}
   ${P("╚═╝     ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝  ╚══════╝  ╚═════╝  ╚═════╝  ╚══════╝")}
    `;
	}

	function drawMenu() {
		clearScreen();
		const theme = themes[currentThemeIndex];
		drawHeader(theme);
		drawAsciiArt(theme);

		const P = theme.primary;
		const _S = theme.secondary;

		// Grid details
		console.log(
			chalk.dim("  SYS: ") +
				chalk.yellow(`${cpuName} (${cpus().length} Cores)`) +
				chalk.dim(" │ MEM: ") +
				chalk.cyan(`${freeGB} GB Free / ${totalGB} GB`) +
				chalk.dim(" │ NODE: ") +
				chalk.green(nodeVersion),
		);
		console.log(
			chalk.dim("  GIT: ") +
				chalk.magenta(gitBranch) +
				chalk.dim(" │ THEME: ") +
				P(theme.name) +
				chalk.dim(" │ STATUS: ") +
				chalk.green("✓ APEX MODE ACTIVE"),
		);

		// Menu options rendering
		for (let i = 0; i < menuItems.length; i++) {
			const item = menuItems[i];
			const _prefix = i === activeIndex ? P("  ● ") : "    ";
			const _name = i === activeIndex ? P.bold(item.name) : chalk.white(item.name);
			const _indexStr = chalk.gray(`[${i + 1}]`);
			const _spaces = " ".repeat(30 - item.name.length);
		}
	}

	// ---------------------------------------------------------------------------
	// 3. Mini-Game: Moon Arcade Snake (TUI)
	// ---------------------------------------------------------------------------
	let gameInterval: NodeJS.Timeout | null = null;
	let snake: { x: number; y: number }[] = [];
	let dir = { x: 1, y: 0 };
	let food = { x: 5, y: 5 };
	let _score = 0;
	const gameW = 40;
	const gameH = 15;

	function initGame() {
		snake = [
			{ x: 10, y: 5 },
			{ x: 9, y: 5 },
			{ x: 8, y: 5 },
		];
		dir = { x: 1, y: 0 };
		_score = 0;
		spawnFood();
	}

	function spawnFood() {
		food = {
			x: Math.floor(Math.random() * (gameW - 2)) + 1,
			y: Math.floor(Math.random() * (gameH - 2)) + 1,
		};
	}

	function drawGame() {
		clearScreen();
		const theme = themes[currentThemeIndex];
		drawHeader(theme);
		const P = theme.primary;
		const S = theme.secondary;

		// Render game board
		for (let y = 0; y < gameH; y++) {
			let _row = "  ";
			for (let x = 0; x < gameW; x++) {
				if (y === 0 || y === gameH - 1 || x === 0 || x === gameW - 1) {
					_row += P("█");
				} else if (snake[0].x === x && snake[0].y === y) {
					_row += S("●"); // Snake head
				} else if (snake.some((s, idx) => idx > 0 && s.x === x && s.y === y)) {
					_row += P("o"); // Snake body
				} else if (food.x === x && food.y === y) {
					_row += chalk.red("★"); // Star/food
				} else {
					_row += " ";
				}
			}
		}
	}

	function updateGame() {
		const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

		// Boundary collision
		if (head.x <= 0 || head.x >= gameW - 1 || head.y <= 0 || head.y >= gameH - 1) {
			gameOver();
			return;
		}

		// Self collision
		if (snake.some((s) => s.x === head.x && s.y === head.y)) {
			gameOver();
			return;
		}

		snake.unshift(head);

		// Eating food
		if (head.x === food.x && head.y === food.y) {
			_score += 1;
			spawnFood();
			process.stdout.write("\x07"); // beep sound
		} else {
			snake.pop();
		}

		drawGame();
	}

	function gameOver() {
		if (gameInterval) clearInterval(gameInterval);
		gameInterval = null;
		drawGame();
	}

	// ---------------------------------------------------------------------------
	// 4. ANSI Starfield Animation
	// ---------------------------------------------------------------------------
	let starfieldInterval: NodeJS.Timeout | null = null;
	let stars: { x: number; y: number; char: string; color: any }[] = [];
	const starW = 80;
	const starH = 20;

	function _initStarfield() {
		stars = [];
		const starChars = [".", "*", "✦", "°", "x", "+"];
		const starColors = [chalk.cyan, chalk.purple, chalk.magenta, chalk.gray, chalk.blue, chalk.white];
		for (let i = 0; i < 40; i++) {
			stars.push({
				x: Math.floor(Math.random() * starW),
				y: Math.floor(Math.random() * starH),
				char: starChars[Math.floor(Math.random() * starChars.length)],
				color: starColors[Math.floor(Math.random() * starColors.length)],
			});
		}
	}

	function drawStarfield() {
		clearScreen();
		const theme = themes[currentThemeIndex];
		drawHeader(theme);
		const _P = theme.primary;
		const _S = theme.secondary;

		// Render starfield board
		for (let y = 0; y < starH; y++) {
			let _row = "  ";
			for (let x = 0; x < starW; x++) {
				const star = stars.find((s) => Math.floor(s.x) === x && Math.floor(s.y) === y);
				if (star) {
					_row += star.color(star.char);
				} else {
					_row += " ";
				}
			}
		}
	}

	function _updateStarfield() {
		stars.forEach((s) => {
			s.x -= 0.8; // move left
			if (s.x < 0) {
				s.x = starW - 1;
				s.y = Math.floor(Math.random() * starH);
			}
		});
		drawStarfield();
	}

	// ---------------------------------------------------------------------------
	// 5. System Doctor & Diagnostics View
	// ---------------------------------------------------------------------------
	function drawDoctor() {
		clearScreen();
		const theme = themes[currentThemeIndex];
		drawHeader(theme);
		const _P = theme.primary;
		const _S = theme.secondary;

		console.log(
			`  • Git Repository  : ${existsSync(join(cwd, ".git")) ? chalk.green("✓ ACTIVE") : chalk.yellow("○ INACTIVE")}`,
		);
		console.log(
			`  • package.json    : ${existsSync(join(cwd, "package.json")) ? chalk.green("✓ FOUND") : chalk.yellow("○ MISSING")}`,
		);

		const keysToCheck = ["GEMINI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OLLAMA_HOST"];
		keysToCheck.forEach((k) => {
			const _isSet = process.env[k] ? chalk.green("✓ CONFIGURED") : chalk.yellow("○ UNDEFINED");
		});
	}

	// ---------------------------------------------------------------------------
	// 6. Semantic File Explorer
	// ---------------------------------------------------------------------------
	let fileList: { name: string; isDir: boolean; size: number }[] = [];
	function loadFiles() {
		try {
			const names = readdirSync(cwd).slice(0, 15);
			fileList = names.map((n) => {
				try {
					const s = statSync(join(cwd, n));
					return { name: n, isDir: s.isDirectory(), size: s.size };
				} catch {
					return { name: n, isDir: false, size: 0 };
				}
			});
		} catch {
			fileList = [];
		}
	}

	function drawExplorer() {
		clearScreen();
		const theme = themes[currentThemeIndex];
		drawHeader(theme);
		const P = theme.primary;
		const _S = theme.secondary;

		fileList.forEach((file, _index) => {
			const _icon = file.isDir ? P("📁 [DIR] ") : chalk.white("📄 [FILE]");
			const _sizeStr = file.isDir ? "" : `(${(file.size / 1024).toFixed(1)} KB)`;
		});

		if (fileList.length === 0) {
		}
	}

	// ---------------------------------------------------------------------------
	// 7. AST Self-Evolution Simulator
	// ---------------------------------------------------------------------------
	let evolutionFrame = 0;
	let evolutionInterval: NodeJS.Timeout | null = null;
	const evolutionPhases = [
		"Analyzing Node AST tokens...",
		"Scanning semantic function scopes...",
		"Optimizing file read vector indices...",
		"Reducing redundant abstraction layers...",
		"Synthesizing meta-instructions for model...",
		"Rebuilding binary package links...",
		"System compilation successfully upgraded!",
	];

	function drawEvolution() {
		clearScreen();
		const theme = themes[currentThemeIndex];
		drawHeader(theme);
		const _P = theme.primary;
		const _S = theme.secondary;

		const _phaseIndex = Math.min(Math.floor(evolutionFrame / 3), evolutionPhases.length - 1);
		console.log(
			`  Status       : ${evolutionFrame >= 20 ? chalk.green("✓ COMPLETED") : chalk.yellow("⚡ OPTIMIZING")}`,
		);

		// Draw visual progress bar
		const progress = Math.min(evolutionFrame * 5, 100);
		const barW = 40;
		const filled = Math.floor((progress / 100) * barW);
		const _empty = barW - filled;

		if (evolutionFrame >= 20) {
		}
	}

	// ---------------------------------------------------------------------------
	// 8. Help & Guide
	// ---------------------------------------------------------------------------
	function drawDocs() {
		clearScreen();
		const theme = themes[currentThemeIndex];
		drawHeader(theme);
		const _P = theme.primary;
		const _S = theme.secondary;
	}

	// ---------------------------------------------------------------------------
	// 9. Cost Benchmarker
	// ---------------------------------------------------------------------------
	function drawBenchmarker() {
		clearScreen();
		const theme = themes[currentThemeIndex];
		drawHeader(theme);
		const _P = theme.primary;
		const _S = theme.secondary;
	}

	// ---------------------------------------------------------------------------
	// 10. Sessions Browser
	// ---------------------------------------------------------------------------
	function drawHistory() {
		clearScreen();
		const theme = themes[currentThemeIndex];
		drawHeader(theme);
		const _P = theme.primary;
		const _S = theme.secondary;
	}

	// ---------------------------------------------------------------------------
	// 11. Key Manager
	// ---------------------------------------------------------------------------
	function drawKeys() {
		clearScreen();
		const theme = themes[currentThemeIndex];
		drawHeader(theme);
		const _P = theme.primary;
		const _S = theme.secondary;

		console.log(
			"  • GEMINI_API_KEY      : " +
				(process.env.GEMINI_API_KEY
					? chalk.green(`VALID [••••••••••••${process.env.GEMINI_API_KEY.slice(-4)}]`)
					: chalk.red("MISSING")),
		);
		console.log(
			"  • ANTHROPIC_API_KEY   : " +
				(process.env.ANTHROPIC_API_KEY
					? chalk.green(`VALID [••••••••••••${process.env.ANTHROPIC_API_KEY.slice(-4)}]`)
					: chalk.red("MISSING")),
		);
		console.log(
			"  • OPENAI_API_KEY      : " +
				(process.env.OPENAI_API_KEY
					? chalk.green(`VALID [••••••••••••${process.env.OPENAI_API_KEY.slice(-4)}]`)
					: chalk.red("MISSING")),
		);
		console.log(
			"  • OLLAMA_HOST         : " +
				(process.env.OLLAMA_HOST
					? chalk.green(`VALID [${process.env.OLLAMA_HOST}]`)
					: chalk.dim("DEFAULT [127.0.0.1:11434]")),
		);
	}

	// ---------------------------------------------------------------------------
	// Main Input/Navigation Loop
	// ---------------------------------------------------------------------------
	drawMenu();

	return new Promise<boolean>((resolve) => {
		function onKeypress(str: string, key: any) {
			// Return key bindings
			if (key?.ctrl && key.name === "c") {
				cleanup();
				process.exit(0);
			}

			if (key && key.name === "q") {
				cleanup();
				process.exit(0);
			}

			// Quick Theme Change
			if (key && key.name === "t") {
				currentThemeIndex = (currentThemeIndex + 1) % themes.length;
				if (currentView === "menu") drawMenu();
				else if (currentView === "starfield") drawStarfield();
				else if (currentView === "game") drawGame();
				else if (currentView === "doctor") drawDoctor();
				else if (currentView === "explorer") drawExplorer();
				else if (currentView === "evolution") drawEvolution();
				else if (currentView === "benchmarker") drawBenchmarker();
				else if (currentView === "docs") drawDocs();
				else if (currentView === "history") drawHistory();
				else if (currentView === "keys") drawKeys();
				return;
			}

			// Exit back to menu
			if (key && key.name === "b" && currentView !== "menu") {
				stopLoops();
				currentView = "menu";
				drawMenu();
				return;
			}

			// View-specific input processing
			if (currentView === "menu") {
				if (key && key.name === "up") {
					activeIndex = (activeIndex - 1 + menuItems.length) % menuItems.length;
					drawMenu();
				} else if (key && key.name === "down") {
					activeIndex = (activeIndex + 1) % menuItems.length;
					drawMenu();
				} else if (key && key.name === "return") {
					handleMenuSelection(activeIndex);
				} else if (str && /[1-9]/.test(str)) {
					const index = parseInt(str, 10) - 1;
					if (index >= 0 && index < menuItems.length) {
						activeIndex = index;
						handleMenuSelection(index);
					}
				}
			} else if (currentView === "game") {
				if (key && key.name === "up" && dir.y === 0) dir = { x: 0, y: -1 };
				else if (key && key.name === "down" && dir.y === 0) dir = { x: 0, y: 1 };
				else if (key && key.name === "left" && dir.x === 0) dir = { x: -1, y: 0 };
				else if (key && key.name === "right" && dir.x === 0) dir = { x: 1, y: 0 };
				else if (str === "w" && dir.y === 0) dir = { x: 0, y: -1 };
				else if (str === "s" && dir.y === 0) dir = { x: 0, y: 1 };
				else if (str === "a" && dir.x === 0) dir = { x: -1, y: 0 };
				else if (str === "d" && dir.x === 0) dir = { x: 1, y: 0 };
				else if (key && key.name === "r") {
					stopLoops();
					initGame();
					gameInterval = setInterval(updateGame, 120);
				}
			} else if (currentView === "starfield") {
				if (key && key.name === "f") {
					// add meteor
					stars.push({
						x: starW - 1,
						y: Math.floor(Math.random() * starH),
						char: "☄",
						color: chalk.red.bold,
					});
				}
			}
		}

		function handleMenuSelection(index: number) {
			const item = menuItems[index];

			if (item.name === "Launch AI Session") {
				cleanup();
				resolve(true); // Continue back to standard TUI
			} else if (item.name === "Start 3D Cosmic Portal") {
				cleanup();
				// open in browser
				const openCmd =
					process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
				const dashboardPath = join(homedir(), "Carbon-Agent_dashboard.html");
				try {
					if (existsSync(dashboardPath)) {
						execSync(`${openCmd} "${dashboardPath}"`);
					}
				} catch {}
				setTimeout(() => {
					resolve(true);
				}, 1000);
			} else if (item.name === "Play Moon Arcade (Snake)") {
				currentView = "game";
				initGame();
				drawGame();
				gameInterval = setInterval(updateGame, 120);
			} else if (item.name === "Run System Doctor") {
				currentView = "doctor";
				drawDoctor();
			} else if (item.name === "Semantic File Explorer") {
				currentView = "explorer";
				loadFiles();
				drawExplorer();
			} else if (item.name === "Self-Evolution Simulator") {
				currentView = "evolution";
				evolutionFrame = 0;
				drawEvolution();
				evolutionInterval = setInterval(() => {
					evolutionFrame++;
					drawEvolution();
					if (evolutionFrame >= 20) {
						clearInterval(evolutionInterval!);
						evolutionInterval = null;
					}
				}, 300);
			} else if (item.name === "Speed & Cost Benchmarker") {
				currentView = "benchmarker";
				drawBenchmarker();
			} else if (item.name === "Help & Commands Manual") {
				currentView = "docs";
				drawDocs();
			} else if (item.name === "Previous Sessions Browser") {
				currentView = "history";
				drawHistory();
			} else if (item.name === "Secure Key Manager") {
				currentView = "keys";
				drawKeys();
			} else if (item.name === "Switch UI Themes") {
				currentThemeIndex = (currentThemeIndex + 1) % themes.length;
				drawMenu();
			} else if (item.name === "Exit Portal") {
				cleanup();
				process.exit(0);
			}
		}

		function stopLoops() {
			if (gameInterval) clearInterval(gameInterval);
			if (starfieldInterval) clearInterval(starfieldInterval);
			if (evolutionInterval) clearInterval(evolutionInterval);
			gameInterval = null;
			starfieldInterval = null;
			evolutionInterval = null;
		}

		function cleanup() {
			stopLoops();
			process.stdin.removeListener("keypress", onKeypress);
			if (process.stdin.isTTY) {
				process.stdin.setRawMode(wasRaw);
			}
		}

		process.stdin.on("keypress", onKeypress);
	});
}
