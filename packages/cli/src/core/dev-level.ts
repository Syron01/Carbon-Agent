import * as fs from "node:fs";
import * as path from "node:path";
import { getEngineDir } from "../config.js";

export interface DevLevelState {
	level: number;
	xp: number;
	lastReason: string;
	notificationTicks: number; // how many renders to show the notification
}

const state: DevLevelState = {
	level: 1,
	xp: 0,
	lastReason: "",
	notificationTicks: 0,
};

let initialized = false;

function getSavePath(): string {
	return path.join(getEngineDir(), "dev_level.json");
}

export function initializeDevLevel(): void {
	if (initialized) return;
	try {
		const filePath = getSavePath();
		if (fs.existsSync(filePath)) {
			const raw = fs.readFileSync(filePath, "utf-8");
			const parsed = JSON.parse(raw);
			state.level = typeof parsed.level === "number" ? parsed.level : 1;
			state.xp = typeof parsed.xp === "number" ? parsed.xp : 0;
		}
	} catch {
		// Suppress filesystem errors gracefully
	}
	initialized = true;
}

export function saveDevLevel(): void {
	try {
		const dir = getEngineDir();
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.writeFileSync(getSavePath(), JSON.stringify({ level: state.level, xp: state.xp }), "utf-8");
	} catch {
		// Graceful suppression
	}
}

export function getXpNeeded(level: number): number {
	// Leveling curve: level 1 needs 200 XP, 2 needs 350, 3 needs 500, etc.
	return level * 150 + 50;
}

export interface XpEarnedResult {
	xpEarned: number;
	levelUp: boolean;
	oldLevel: number;
	newLevel: number;
	currentXp: number;
	neededXp: number;
	reason: string;
}

export function addXp(amount: number, reason: string): XpEarnedResult {
	initializeDevLevel();
	const oldLevel = state.level;
	state.xp += amount;
	state.lastReason = `+${amount} XP: ${reason}`;
	state.notificationTicks = 15; // Show notification for 15 status redraws (about 2 seconds)

	let levelUp = false;
	while (state.xp >= getXpNeeded(state.level)) {
		state.xp -= getXpNeeded(state.level);
		state.level++;
		levelUp = true;
	}

	if (levelUp) {
		state.lastReason = `✦ LEVEL UP! Reached Level ${state.level}! ✦`;
		state.notificationTicks = 25; // show longer for level ups
	}

	saveDevLevel();

	return {
		xpEarned: amount,
		levelUp,
		oldLevel,
		newLevel: state.level,
		currentXp: state.xp,
		neededXp: getXpNeeded(state.level),
		reason,
	};
}

export function getDevLevelState() {
	initializeDevLevel();
	const needed = getXpNeeded(state.level);
	const percent = Math.floor((state.xp / needed) * 100);

	let notification = "";
	if (state.notificationTicks > 0) {
		notification = state.lastReason;
		state.notificationTicks--;
	}

	return {
		level: state.level,
		xp: state.xp,
		neededXp: needed,
		percent,
		notification,
	};
}
