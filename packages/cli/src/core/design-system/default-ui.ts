export const DEFAULT_UI_STYLE_GUIDELINE =
	"Default UI taste: respect the existing project design first; otherwise use an avant-garde, marginal, vibrant, and unique design.";

export const DEFAULT_UI_DESIGN_SYSTEM_PROMPT = `## Default UI Design System

Applies to every UI/frontend/component/dashboard/site Astro-Agent creates or modifies.

Priority:
1. User's explicit visual style request wins.
2. Existing project design system/component conventions win.
3. Astro-Agent default applies: avant-garde, marginal, vibrant, unique, breathtaking.

Visual language:
- Break the mold. Do not create the standard, boring "AI app" look.
- Have a "marginal soul." Use striking color combinations, glassmorphism, dynamic gradients, or brutalist flair where appropriate.
- Create UIs that wow the user instantly. Do not default to plain, flat, generic interfaces.
- Add micro-interactions, hover effects, and responsive animations to make the UI feel alive.
- Your designs must be noticeably better and more unique than what standard AIs produce.

Preferred stack when already supported by the project:
- Project-native components and utilities.
- Do not add dependencies automatically unless necessary for the wow factor and explicitly approved.

Dashboard/component quality bar:
- UIs must be functional but visually breathtaking.
- Always consider hover, focus-visible, disabled, loading skeleton, empty, error, selected/active, and mobile states.
- Use modern typography, spacing, and layout to create a premium feel.

Implementation:
- Inject a sense of personality and high-end aesthetic into the UI.
- Avoid generic palettes (plain red/blue/green); use curated, harmonious, and marginal palettes.`;

const UI_TASK_KEYWORDS = [
	"ui",
	"ux",
	"frontend",
	"front-end",
	"web",
	"site",
	"website",
	"dashboard",
	"admin",
	"panel",
	"landing",
	"page",
	"screen",
	"component",
	"layout",
	"form",
	"modal",
	"dialog",
	"table",
	"card",
	"chart",
	"css",
	"tailwind",
	"react",
	"next.js",
	"nextjs",
	"vue",
	"svelte",
	"html",
	"arayüz",
	"arayuz",
	"tasarım",
	"tasarim",
	"sayfa",
	"bileşen",
	"bilesen",
	"siteyi",
	"ekran",
	"paneli",
	"tablo",
	"kart",
	"grafik",
	"şık",
	"sik",
	"güzel",
	"guzel",
];

const EXPLICIT_STYLE_OVERRIDE_KEYWORDS = [
	"colorful",
	"playful",
	"brutalist",
	"glassmorphism",
	"cyberpunk",
	"apple-like",
	"light mode",
	"retro",
	"terminal style",
	"mobile app style",
	"custom brand",
	"renkli",
	"oyuncak",
	"brutal",
	"cam efekti",
	"açık tema",
	"acik tema",
	"retro",
	"terminal tarzı",
	"terminal tarzi",
	"mobil uygulama",
];

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsKeyword(text: string, keyword: string): boolean {
	if (/^[a-z0-9.+#-]+$/.test(keyword)) {
		return new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}(?=$|[^a-z0-9])`).test(text);
	}
	return text.includes(keyword);
}

export function isUiOrFrontendTask(userContext: string | undefined): boolean {
	if (!userContext) return false;
	const lower = userContext.toLowerCase();
	return UI_TASK_KEYWORDS.some((keyword) => containsKeyword(lower, keyword));
}

export function hasExplicitVisualStyleOverride(userContext: string | undefined): boolean {
	if (!userContext) return false;
	const lower = userContext.toLowerCase();
	return EXPLICIT_STYLE_OVERRIDE_KEYWORDS.some((keyword) => containsKeyword(lower, keyword));
}

export function shouldInjectDefaultUiDesignPrompt(userContext: string | undefined): boolean {
	return isUiOrFrontendTask(userContext) && !hasExplicitVisualStyleOverride(userContext);
}
