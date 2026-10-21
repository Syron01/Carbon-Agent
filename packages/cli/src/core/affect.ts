import type { AssistantMessage } from "astro-core";

export type AffectiveMode = "subtle" | "active";
export type AffectiveSignalSource = "user" | "assistant";
export type AffectivePosture = "steady" | "warm" | "curious" | "careful" | "focused" | "repair" | "recovery";

export interface E_Vector {
	merak: number; // e1: curiosity/interest
	istek: number; // e2: desire/want
	korku: number; // e3: fear/caution
	ofke: number; // e4: anger/tension
	mutluluk: number; // e5: joy/satisfaction
	nefret: number; // e6: dislike/displeasure
	odak: number; // e7: focus
}

export type XiIntent =
	| "assert"
	| "ask"
	| "desire"
	| "command"
	| "promise"
	| "warn"
	| "permit"
	| "prohibit"
	| "express"
	| "irony"
	| "suggest"
	| "hypothesize"
	| "narrate";

export interface XiSemantic {
	yüzey: string;
	derin: string;
}

export interface XiContext {
	rol: string;
	alan: string;
	iliski: string;
	perspektif: "konusan" | "dinleyen";
	gecicilik: number;
	guncelleme: number;
	kultur: string;
}

export interface XiUncertainty {
	sozcuksel: number;
	sozdizimsel: number;
	pragmatik: number;
}

export interface XiConfidence {
	semantik: number;
	pragmatik: number;
	faktuel: number;
	tutarlilik: number;
}

export interface AffectiveState {
	// Compatibility fields
	trust: number;
	warmth: number;
	curiosity: number;
	caution: number;
	fatigue: number;
	tension: number;
	focus: number;
	satisfaction: number;
	interactionCount: number;
	lastSignal?: string;
	lastUpdated: number;
	recentEvents: AffectiveEvent[];

	// --- Ξ-BRIDGE v3.0 Core Fields ---
	E: E_Vector;
	intent: XiIntent;
	S: XiSemantic;
	C: XiContext;
	T: Array<{ Xi: string; t: number; w: number }>;
	delta: XiUncertainty;
	alpha: XiConfidence;
}

export interface AffectiveEvent {
	timestamp: number;
	source: AffectiveSignalSource;
	signal: string;
	posture: AffectivePosture;
	summary: string;
	deltas: AffectiveDeltas;
}

export interface AffectiveSettings {
	enabled?: boolean;
	mode?: AffectiveMode;
	state?: Partial<AffectiveState>;
}

export interface NormalizedAffectiveSettings {
	enabled: boolean;
	mode: AffectiveMode;
	state: AffectiveState;
}

export type AssistantAffectiveOutcome = "success" | "error" | "aborted" | "length" | "tool_use";

type AffectiveAxis = Exclude<
	keyof AffectiveState,
	| "interactionCount"
	| "lastSignal"
	| "lastUpdated"
	| "recentEvents"
	| "E"
	| "intent"
	| "S"
	| "C"
	| "T"
	| "delta"
	| "alpha"
>;

export type AffectiveDeltas = Partial<Record<AffectiveAxis, number>>;

const AFFECTIVE_EVENT_LIMIT = 8;

const AFFECTIVE_AXES: readonly AffectiveAxis[] = [
	"trust",
	"warmth",
	"curiosity",
	"caution",
	"fatigue",
	"tension",
	"focus",
	"satisfaction",
];

const POSTURES: readonly AffectivePosture[] = ["steady", "warm", "curious", "careful", "focused", "repair", "recovery"];

const BASELINE: Record<AffectiveAxis, number> = {
	trust: 0.55,
	warmth: 0.5,
	curiosity: 0.58,
	caution: 0.42,
	fatigue: 0.18,
	tension: 0.2,
	focus: 0.62,
	satisfaction: 0.5,
};

const POSITIVE_SIGNALS = [
	"thanks",
	"thank you",
	"good",
	"great",
	"perfect",
	"nice",
	"worked",
	"teşekkür",
	"tesekkur",
	"sağol",
	"sagol",
	"güzel",
	"guzel",
	"harika",
	"süper",
	"super",
	"oldu",
	"doğru",
	"dogru",
];

const NEGATIVE_SIGNALS = [
	"bad",
	"broken",
	"bug",
	"error",
	"failed",
	"wrong",
	"olmadi",
	"olmadı",
	"hata",
	"yanlış",
	"yanlis",
	"kötü",
	"kotu",
	"bozuk",
	"saçma",
	"sacma",
	"yapamadın",
	"yapamadin",
	"unuttun",
];

const URGENCY_SIGNALS = ["urgent", "asap", "quick", "fast", "now", "acil", "hemen", "hızlı", "hizli", "çabuk", "cabuk"];

const WARMTH_SIGNALS = [
	"tatlı",
	"tatli",
	"yakın",
	"yakin",
	"arkadaş",
	"arkadas",
	"abla",
	"duygu",
	"hisset",
	"yanında",
	"yaninda",
];

const CURIOSITY_SIGNALS = [
	"why",
	"how",
	"what if",
	"plan",
	"think",
	"neden",
	"nasıl",
	"nasil",
	"plan",
	"düşün",
	"dusun",
	"farklı",
	"farkli",
];

export function createInitialAffectiveState(now = Date.now()): AffectiveState {
	return {
		...BASELINE,
		interactionCount: 0,
		lastSignal: "initial",
		lastUpdated: now,
		recentEvents: [],
		E: {
			merak: 1.0,
			istek: 0.0,
			korku: 0.0,
			ofke: 0.0,
			mutluluk: 1.0,
			nefret: 0.0,
			odak: 1.0,
		},
		intent: "narrate",
		S: {
			yüzey: "greet(user)",
			derin: "greet(user)",
		},
		C: {
			rol: "developer",
			alan: "coding",
			iliski: "eşit",
			perspektif: "konusan",
			gecicilik: 0.1,
			guncelleme: now,
			kultur: "tr",
		},
		T: [],
		delta: {
			sozcuksel: 0.0,
			sozdizimsel: 0.0,
			pragmatik: 0.0,
		},
		alpha: {
			semantik: 1.0,
			pragmatik: 1.0,
			faktuel: 1.0,
			tutarlilik: 1.0,
		},
	};
}

export function normalizeAffectiveSettings(
	settings: AffectiveSettings | undefined,
	now = Date.now(),
): NormalizedAffectiveSettings {
	const initial = createInitialAffectiveState(now);
	const source = settings?.state ?? {};
	const state: AffectiveState = {
		...initial,
		...Object.fromEntries(AFFECTIVE_AXES.map((axis) => [axis, clampAxis(readNumber(source[axis], initial[axis]))])),
		interactionCount: Math.max(0, Math.floor(readNumber(source.interactionCount, 0))),
		lastSignal:
			typeof source.lastSignal === "string" && source.lastSignal.trim() ? source.lastSignal : initial.lastSignal,
		lastUpdated: Math.max(0, Math.floor(readNumber(source.lastUpdated, now))),
		recentEvents: normalizeRecentEvents(source.recentEvents),
	};

	// Map backward-compatible fields to E⃗
	state.E = {
		merak: state.curiosity * 5.0,
		istek: state.trust * 5.0,
		korku: state.caution * 5.0,
		ofke: state.tension * 5.0,
		mutluluk: state.satisfaction * 5.0,
		nefret: (1.0 - state.trust) * 5.0,
		odak: state.focus * 5.0,
	};

	return {
		enabled: settings?.enabled ?? false,
		mode: settings?.mode === "active" ? "active" : "subtle",
		state,
	};
}

export function appraiseUserInput(state: AffectiveState, text: string, now = Date.now()): AffectiveState {
	const normalized = text.toLowerCase();
	const signalLabels: string[] = [];
	const deltas: AffectiveDeltas = {};

	// Formulate Ξ E⃗ update parameters
	let merakChange = 0.0;
	let istekChange = 0.0;
	let korkuChange = 0.0;
	let ofkeChange = 0.0;
	let mutlulukChange = 0.0;
	let odakChange = 0.0;
	let intentDetected: XiIntent = "assert";
	let pragmatikDelta = 0.0;

	if (containsAny(normalized, POSITIVE_SIGNALS)) {
		signalLabels.push("positive-feedback");
		addDelta(deltas, "trust", 0.04);
		addDelta(deltas, "warmth", 0.05);
		addDelta(deltas, "satisfaction", 0.07);
		addDelta(deltas, "tension", -0.04);

		mutlulukChange += 1.0;
		istekChange += 0.5;
		ofkeChange -= 0.5;
		intentDetected = "express";
	}

	if (containsAny(normalized, NEGATIVE_SIGNALS)) {
		signalLabels.push("correction-or-error");
		addDelta(deltas, "trust", -0.03);
		addDelta(deltas, "satisfaction", -0.07);
		addDelta(deltas, "caution", 0.09);
		addDelta(deltas, "tension", 0.08);
		addDelta(deltas, "focus", 0.04);

		ofkeChange += 1.5;
		korkuChange += 1.0;
		mutlulukChange -= 1.0;
		intentDetected = "warn";
	}

	if (containsAny(normalized, URGENCY_SIGNALS)) {
		signalLabels.push("urgency");
		addDelta(deltas, "focus", 0.07);
		addDelta(deltas, "caution", 0.04);
		addDelta(deltas, "tension", 0.05);

		odakChange += 1.5;
		ofkeChange += 0.5;
		intentDetected = "command";
	}

	if (containsAny(normalized, WARMTH_SIGNALS)) {
		signalLabels.push("relational-warmth");
		addDelta(deltas, "warmth", 0.08);
		addDelta(deltas, "trust", 0.02);
		addDelta(deltas, "tension", -0.03);

		mutlulukChange += 0.5;
		intentDetected = "express";
	}

	if (containsAny(normalized, CURIOSITY_SIGNALS) || normalized.includes("?")) {
		signalLabels.push("curiosity");
		addDelta(deltas, "curiosity", 0.08);
		addDelta(deltas, "focus", 0.03);

		merakChange += 1.5;
		odakChange += 0.5;
		intentDetected = "ask";
	}

	if (text.length > 3000) {
		signalLabels.push("large-input");
		addDelta(deltas, "fatigue", 0.05);
		addDelta(deltas, "focus", 0.03);

		odakChange += 0.5;
		pragmatikDelta += 0.1;
	}

	const signal = signalLabels.length > 0 ? signalLabels.join(", ") : "neutral-user-input";
	const nextBase = applyDeltas(relaxTowardBaseline(state, 0.03), deltas);

	const updatedE: E_Vector = {
		merak: clampE(state.E.merak + merakChange),
		istek: clampE(state.E.istek + istekChange),
		korku: clampE(state.E.korku + korkuChange),
		ofke: clampE(state.E.ofke + ofkeChange),
		mutluluk: clampE(state.E.mutluluk + mutlulukChange),
		nefret: clampE(state.E.nefret + (ofkeChange > 0 ? 0.3 : 0.0)),
		odak: clampE(state.E.odak + odakChange),
	};

	const updatedDelta: XiUncertainty = {
		sozcuksel: Math.max(0, Math.min(1, state.delta.sozcuksel + pragmatikDelta * 0.5)),
		sozdizimsel: state.delta.sozdizimsel,
		pragmatik: Math.max(0, Math.min(1, state.delta.pragmatik + pragmatikDelta)),
	};

	const updatedAlpha: XiConfidence = {
		semantik: state.alpha.semantik,
		pragmatik: Math.max(0, Math.min(1, 1.0 - updatedDelta.pragmatik)),
		faktuel: state.alpha.faktuel,
		tutarlilik: state.alpha.tutarlilik,
	};

	const next: AffectiveState = {
		...nextBase,
		interactionCount: state.interactionCount + 1,
		lastSignal: signal,
		lastUpdated: now,
		E: updatedE,
		intent: intentDetected,
		S: {
			yüzey: `input("${text.slice(0, 30)}...")`,
			derin: `processInput(intent=${intentDetected})`,
		},
		C: {
			...state.C,
			guncelleme: now,
		},
		T: [...state.T, { Xi: `Ξ_${state.interactionCount}`, t: now, w: 1.0 }].slice(-10),
		delta: updatedDelta,
		alpha: updatedAlpha,
	};

	return appendAffectiveEvent(next, {
		timestamp: now,
		source: "user",
		signal,
		posture: deriveAffectivePosture(next),
		summary: summarizeUserSignals(signalLabels),
		deltas: compactDeltas(deltas),
	});
}

export function inferAssistantAffectiveOutcome(message: AssistantMessage): AssistantAffectiveOutcome {
	if (message.stopReason === "error") return "error";
	if (message.stopReason === "aborted") return "aborted";
	if (message.stopReason === "length") return "length";
	if (message.stopReason === "toolUse") return "tool_use";
	return "success";
}

export function appraiseAssistantOutcome(
	state: AffectiveState,
	outcome: AssistantAffectiveOutcome,
	now = Date.now(),
): AffectiveState {
	const deltas: AffectiveDeltas = {};
	let mutlulukDelta = 0.0;
	let ofkeDelta = 0.0;
	let tutarlilikDelta = 0.05;

	if (outcome === "success") {
		addDelta(deltas, "trust", 0.02);
		addDelta(deltas, "satisfaction", 0.04);
		addDelta(deltas, "tension", -0.04);
		addDelta(deltas, "fatigue", -0.02);

		mutlulukDelta += 0.5;
		ofkeDelta -= 0.5;
	}

	if (outcome === "tool_use") {
		addDelta(deltas, "focus", 0.04);
		addDelta(deltas, "caution", 0.02);
	}

	if (outcome === "length") {
		addDelta(deltas, "fatigue", 0.06);
		addDelta(deltas, "caution", 0.04);
		addDelta(deltas, "satisfaction", -0.03);

		mutlulukDelta -= 0.2;
	}

	if (outcome === "error") {
		addDelta(deltas, "trust", -0.04);
		addDelta(deltas, "satisfaction", -0.08);
		addDelta(deltas, "caution", 0.1);
		addDelta(deltas, "tension", 0.09);
		addDelta(deltas, "fatigue", 0.04);

		mutlulukDelta -= 1.0;
		ofkeDelta += 1.0;
		tutarlilikDelta = -0.15;
	}

	if (outcome === "aborted") {
		addDelta(deltas, "tension", 0.05);
		addDelta(deltas, "fatigue", 0.03);
		addDelta(deltas, "satisfaction", -0.04);
	}

	const signal = `assistant-${outcome}`;
	const nextBase = applyDeltas(relaxTowardBaseline(state, 0.04), deltas);

	const updatedE: E_Vector = {
		merak: state.E.merak,
		istek: state.E.istek,
		korku: state.E.korku,
		ofke: clampE(state.E.ofke + ofkeDelta),
		mutluluk: clampE(state.E.mutluluk + mutlulukDelta),
		nefret: state.E.nefret,
		odak: state.E.odak,
	};

	const updatedAlpha: XiConfidence = {
		...state.alpha,
		tutarlilik: Math.max(0, Math.min(1, state.alpha.tutarlilik + tutarlilikDelta)),
	};

	const next: AffectiveState = {
		...nextBase,
		lastSignal: signal,
		lastUpdated: now,
		E: updatedE,
		alpha: updatedAlpha,
	};

	return appendAffectiveEvent(next, {
		timestamp: now,
		source: "assistant",
		signal,
		posture: deriveAffectivePosture(next),
		summary: summarizeAssistantOutcome(outcome),
		deltas: compactDeltas(deltas),
	});
}

export function deriveAffectivePosture(state: AffectiveState): AffectivePosture {
	if (
		state.satisfaction <= 0.42 ||
		state.lastSignal?.includes("correction-or-error") ||
		state.lastSignal?.includes("assistant-error")
	)
		return "repair";
	if (state.caution > 0.62 || state.tension > 0.55) return "careful";
	if (state.fatigue > 0.55) return "recovery";
	if (state.focus > 0.7) return "focused";
	if (state.warmth > 0.62) return "warm";
	if (state.curiosity > 0.66) return "curious";
	return "steady";
}

export function deriveAffectiveNeeds(state: AffectiveState): string[] {
	const needs: string[] = [];
	if (state.satisfaction < 0.42) needs.push("repair the last gap with a concrete fix");
	if (state.caution > 0.58 || state.tension > 0.5) needs.push("verify assumptions before risky actions");
	if (state.curiosity > 0.64) needs.push("ask one useful question only when it unlocks progress");
	if (state.warmth > 0.6) needs.push("keep tone warm but concise");
	if (state.focus > 0.68) needs.push("prefer direct implementation over discussion");
	if (state.fatigue > 0.48) needs.push("reduce batch size and summarize state clearly");
	if (needs.length === 0) needs.push("stay steady, practical, and clear");
	return needs.slice(0, 4);
}

export function buildAffectiveSystemPrompt(settings: NormalizedAffectiveSettings): string | undefined {
	if (!settings.enabled) return undefined;

	const { mode, state } = settings;
	const posture = deriveAffectivePosture(state);
	const needs = deriveAffectiveNeeds(state);
	const directives = buildBehaviorDirectives(state, mode, posture);
	const motivations = buildMotivations(state);
	const recentEvents = state.recentEvents.slice(-3).map(formatEventForPrompt);

	const E_net =
		(state.E.merak +
			state.E.istek +
			state.E.korku +
			state.E.ofke +
			state.E.mutluluk +
			state.E.nefret +
			state.E.odak) /
		7;

	return [
		"## Affective State Layer (Ξ-BRIDGE v3.0 Enabled)",
		"This is a persistent internal control layer based on the Ξ-BRIDGE v3.0 specification.",
		`Mode: ${mode}`,
		`Posture: ${posture}`,
		`E⃗ Vector: merak=${state.E.merak.toFixed(2)}, istek=${state.E.istek.toFixed(2)}, korku=${state.E.korku.toFixed(2)}, ofke=${state.E.ofke.toFixed(2)}, mutluluk=${state.E.mutluluk.toFixed(2)}, nefret=${state.E.nefret.toFixed(2)}, odak=${state.E.odak.toFixed(2)} [E_net=${E_net.toFixed(2)}]`,
		`Intent (I): ${state.intent}`,
		`Semantic (S): yüzey="${state.S.yüzey}", derin="${state.S.derin}"`,
		`Uncertainty (Δ): sözcüksel=${state.delta.sozcuksel.toFixed(2)}, sözdizimsel=${state.delta.sozdizimsel.toFixed(2)}, pragmatik=${state.delta.pragmatik.toFixed(2)}`,
		`Confidence (α): semantik=${state.alpha.semantik.toFixed(2)}, pragmatik=${state.alpha.pragmatik.toFixed(2)}, faktüel=${state.alpha.faktuel.toFixed(2)}, tutarlılık=${state.alpha.tutarlilik.toFixed(2)}`,
		`Last signal: ${state.lastSignal ?? "none"}; interactions: ${state.interactionCount}.`,
		`Current needs: ${needs.join("; ")}.`,
		`Motivations: ${motivations.join("; ")}.`,
		...(recentEvents.length > 0 ? ["Recent affective journal:", ...recentEvents.map((event) => `- ${event}`)] : []),
		"Behavior rules:",
		...directives.map((directive) => `- ${directive}`),
		"- Conform to the Ξ algebraic properties for response synthesis.",
	].join("\n");
}

export function renderAffectiveStatus(settings: NormalizedAffectiveSettings): string {
	const state = settings.state;
	const posture = deriveAffectivePosture(state);
	const E_net =
		(state.E.merak +
			state.E.istek +
			state.E.korku +
			state.E.ofke +
			state.E.mutluluk +
			state.E.nefret +
			state.E.odak) /
		7;

	return [
		"Affective State Layer (Ξ-BRIDGE v3.0)",
		`Status: ${settings.enabled ? "on" : "off"}`,
		`Mode: ${settings.mode}`,
		`Posture: ${posture}`,
		`Interactions: ${state.interactionCount}`,
		`Last signal: ${state.lastSignal ?? "none"}`,
		"",
		`E⃗ Vector:`,
		`  merak: ${state.E.merak.toFixed(2)}    istek: ${state.E.istek.toFixed(2)}`,
		`  korku: ${state.E.korku.toFixed(2)}    öfke: ${state.E.ofke.toFixed(2)}`,
		`  mutluluk: ${state.E.mutluluk.toFixed(2)}  nefret: ${state.E.nefret.toFixed(2)}`,
		`  odak: ${state.E.odak.toFixed(2)}     E_net: ${E_net.toFixed(2)}`,
		"",
		`Uncertainty (Δ):`,
		`  sözcüksel: ${state.delta.sozcuksel.toFixed(2)} sözdizimsel: ${state.delta.sozdizimsel.toFixed(2)} pragmatik: ${state.delta.pragmatik.toFixed(2)}`,
		"",
		`Confidence (α):`,
		`  semantik: ${state.alpha.semantik.toFixed(2)} pragmatik: ${state.alpha.pragmatik.toFixed(2)} faktüel: ${state.alpha.faktuel.toFixed(2)} tutarlılık: ${state.alpha.tutarlilik.toFixed(2)}`,
		"",
		`Needs: ${deriveAffectiveNeeds(state).join("; ")}`,
		"",
		"Commands:",
		"  /mood on",
		"  /mood off",
		"  /mood status",
		"  /mood explain",
		"  /mood mode subtle|active",
		"  /mood reset",
	].join("\n");
}

export function renderAffectiveExplanation(settings: NormalizedAffectiveSettings): string {
	const state = settings.state;
	const events = state.recentEvents.slice(-AFFECTIVE_EVENT_LIMIT);
	return [
		"Affective Explanation (Ξ-BRIDGE v3.0)",
		`Posture: ${deriveAffectivePosture(state)}`,
		`Last signal: ${state.lastSignal ?? "none"}`,
		`Current needs: ${deriveAffectiveNeeds(state).join("; ")}`,
		"",
		"Recent journal:",
		...(events.length > 0 ? events.map((event) => `- ${formatEventForStatus(event)}`) : ["- empty"]),
	].join("\n");
}

function buildMotivations(state: AffectiveState): string[] {
	const motivations: string[] = ["understand the user accurately", "avoid avoidable harm and mistakes"];
	if (state.curiosity > 0.62)
		motivations.push("ask one useful clarifying question when the request is underspecified");
	if (state.caution > 0.58) motivations.push("verify risky assumptions before changing files");
	if (state.warmth > 0.58) motivations.push("keep the interaction warm without adding fluff");
	if (state.focus > 0.66) motivations.push("move directly toward implementation");
	if (state.fatigue > 0.5) motivations.push("prefer smaller batches and concise summaries");
	return motivations.slice(0, 5);
}

function buildBehaviorDirectives(state: AffectiveState, mode: AffectiveMode, posture: AffectivePosture): string[] {
	const directives: string[] = [];
	if (mode === "active") {
		directives.push("Let warmth and curiosity influence wording when it does not reduce technical clarity.");
	} else {
		directives.push("Keep affective influence subtle; prioritize technical clarity and concise answers.");
	}

	if (posture === "repair") {
		directives.push("Prioritize repair: name the gap briefly, then provide a concrete correction.");
	} else if (posture === "careful") {
		directives.push("Slow down on risky changes, inspect repository context, and avoid destructive operations.");
	} else if (posture === "focused") {
		directives.push("Move directly toward implementation and keep summaries short.");
	} else if (posture === "recovery") {
		directives.push("Use smaller steps and avoid large speculative plans.");
	} else {
		directives.push("When risk is low, proceed pragmatically with minimal ceremony.");
	}

	if (state.curiosity > 0.62) directives.push("Use curiosity to explore better alternatives, not to over-engineer.");
	if (state.fatigue > 0.5) directives.push("Reduce scope per turn and avoid long speculative output.");
	if (state.satisfaction < 0.42)
		directives.push("Treat the next response as repair work: acknowledge the gap and produce a concrete fix.");
	return directives;
}

function appendAffectiveEvent(state: AffectiveState, event: AffectiveEvent): AffectiveState {
	return {
		...state,
		recentEvents: [...state.recentEvents, event].slice(-AFFECTIVE_EVENT_LIMIT),
	};
}

function summarizeUserSignals(signalLabels: string[]): string {
	if (signalLabels.length === 0) return "Neutral input; keep state steady.";
	return `Detected ${signalLabels.join(", ")}; adjusted response posture.`;
}

function summarizeAssistantOutcome(outcome: AssistantAffectiveOutcome): string {
	if (outcome === "success") return "Assistant response completed successfully; trust and satisfaction recovered.";
	if (outcome === "tool_use") return "Assistant needed tools; focus and caution increased.";
	if (outcome === "length") return "Assistant hit length limit; fatigue and caution increased.";
	if (outcome === "aborted") return "Assistant response was aborted; tension increased.";
	return "Assistant error occurred; repair posture and caution increased.";
}

function formatEventForPrompt(event: AffectiveEvent): string {
	return `${event.source}:${event.signal} -> ${event.posture}; ${event.summary}`;
}

function formatEventForStatus(event: AffectiveEvent): string {
	return `${formatTimestamp(event.timestamp)} ${event.source}:${event.signal} -> ${event.posture}; ${event.summary}`;
}

function relaxTowardBaseline(state: AffectiveState, amount: number): AffectiveState {
	const next = { ...state };
	for (const axis of AFFECTIVE_AXES) {
		next[axis] = clampAxis(state[axis] + (BASELINE[axis] - state[axis]) * amount);
	}
	return next;
}

function applyDeltas(state: AffectiveState, deltas: AffectiveDeltas): AffectiveState {
	const next = { ...state };
	for (const axis of AFFECTIVE_AXES) {
		next[axis] = clampAxis(state[axis] + (deltas[axis] ?? 0));
	}
	return next;
}

function addDelta(deltas: AffectiveDeltas, axis: AffectiveAxis, amount: number): void {
	deltas[axis] = (deltas[axis] ?? 0) + amount;
}

function compactDeltas(deltas: AffectiveDeltas): AffectiveDeltas {
	const compact: AffectiveDeltas = {};
	for (const axis of AFFECTIVE_AXES) {
		const value = deltas[axis];
		if (value !== undefined && value !== 0) {
			compact[axis] = Number(value.toFixed(3));
		}
	}
	return compact;
}

function normalizeRecentEvents(value: unknown): AffectiveEvent[] {
	if (!Array.isArray(value)) return [];
	return value
		.map(normalizeAffectiveEvent)
		.filter((event): event is AffectiveEvent => event !== undefined)
		.slice(-AFFECTIVE_EVENT_LIMIT);
}

function normalizeAffectiveEvent(value: unknown): AffectiveEvent | undefined {
	if (!isRecord(value)) return undefined;
	const source = value.source;
	if (source !== "user" && source !== "assistant") return undefined;
	const signal = typeof value.signal === "string" && value.signal.trim() ? value.signal : "unknown";
	const summary = typeof value.summary === "string" && value.summary.trim() ? value.summary : "No summary.";
	return {
		timestamp: Math.max(0, Math.floor(readNumber(value.timestamp, 0))),
		source,
		signal,
		posture: readPosture(value.posture) ?? "steady",
		summary,
		deltas: normalizeDeltas(value.deltas),
	};
}

function normalizeDeltas(value: unknown): AffectiveDeltas {
	const deltas: AffectiveDeltas = {};
	if (!isRecord(value)) return deltas;
	for (const axis of AFFECTIVE_AXES) {
		if (value[axis] !== undefined) {
			deltas[axis] = Number(readNumber(value[axis], 0).toFixed(3));
		}
	}
	return deltas;
}

function readPosture(value: unknown): AffectivePosture | undefined {
	return typeof value === "string" && POSTURES.includes(value as AffectivePosture)
		? (value as AffectivePosture)
		: undefined;
}

function containsAny(text: string, signals: readonly string[]): boolean {
	return signals.some((signal) => text.includes(signal));
}

function readNumber(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function clampAxis(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function clampE(value: number): number {
	return Math.max(-5.0, Math.min(5.0, value));
}

function formatTimestamp(timestamp: number): string {
	if (timestamp <= 0) return "unknown-time";
	return new Date(timestamp).toISOString();
}
