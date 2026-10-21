/**
 * Design prompt builder.
 *
 * Builds the design-system context that gets injected into the system prompt
 * when the user asks for UI/design work. Picks the best direction automatically
 * from context clues, or uses a user-specified design system.
 */

import { DEFAULT_UI_DESIGN_SYSTEM_PROMPT } from "./default-ui.js";
import { DESIGN_DIRECTIONS, type DesignDirection } from "./directions.js";
import { type DesignSystemSummary, listDesignSystems } from "./registry.js";

/** Keywords that suggest which direction to auto-pick */
const DIRECTION_KEYWORDS: Record<string, string[]> = {
	"modern-minimal": [
		"shadcn",
		"vercel",
		"saas",
		"dashboard",
		"admin",
		"startup",
		"tool",
		"platform",
		"analytics",
		"minimal",
		"clean",
		"dark",
	],
	"editorial-monocle": ["blog", "magazine", "editorial", "news", "article", "publication", "press", "media"],
	"human-approachable": ["consumer", "marketplace", "education", "social", "wellness", "community", "app", "mobile"],
	"tech-utility": ["developer", "devtool", "api", "cli", "terminal", "code", "ide", "github", "dark"],
	"brutalist-experimental": ["portfolio", "creative", "studio", "art", "experimental", "brutalist", "gallery"],
};

/**
 * Auto-pick a design direction based on the user's prompt context.
 * Falls back to "modern-minimal" (safest default).
 */
export function pickDesignDirection(context: string): DesignDirection {
	const lower = context.toLowerCase();
	let bestId = "modern-minimal";
	let bestScore = 0;

	for (const [dirId, keywords] of Object.entries(DIRECTION_KEYWORDS)) {
		const score = keywords.reduce((sum, kw) => sum + (lower.includes(kw) ? 1 : 0), 0);
		if (score > bestScore) {
			bestScore = score;
			bestId = dirId;
		}
	}

	return DESIGN_DIRECTIONS.find((d) => d.id === bestId) ?? DESIGN_DIRECTIONS[0];
}

/**
 * Build design context prompt section.
 *
 * @param projectRoot - Project root for scanning design-systems/
 * @param userContext - User's message/brief for direction auto-pick
 * @param explicitDirection - Explicitly chosen direction ID (overrides auto)
 */
export function buildDesignPrompt(options: {
	projectRoot?: string;
	userContext?: string;
	explicitDirection?: string;
}): string {
	const { projectRoot, userContext, explicitDirection } = options;
	const sections: string[] = [];

	// 1. Try project-local design systems
	if (projectRoot) {
		const designDir = `${projectRoot}/design-systems`;
		const systems = listDesignSystems(designDir);
		if (systems.length > 0) {
			sections.push(formatAvailableSystems(systems));
		}
	}

	// 2. Pick or use direction
	let direction: DesignDirection;
	if (explicitDirection) {
		direction = DESIGN_DIRECTIONS.find((d) => d.id === explicitDirection) ?? DESIGN_DIRECTIONS[0];
	} else {
		direction = pickDesignDirection(userContext ?? "");
	}

	sections.push(formatDirection(direction));

	// 3. Astro-Agent's default UI taste + universal quality rules
	sections.push(DEFAULT_UI_DESIGN_SYSTEM_PROMPT);
	sections.push(DESIGN_RULES);

	return `\n\n## Design System Context\n\n${sections.join("\n\n")}`;
}

function formatDirection(dir: DesignDirection): string {
	const paletteLines = Object.entries(dir.palette)
		.map(([key, val]) => `  --${key}: ${val};`)
		.join("\n");

	return `### Active Direction: ${dir.label}

**Mood:** ${dir.mood}
**References:** ${dir.references.join(", ")}

**Fonts:**
- Display: \`${dir.displayFont}\`
- Body: \`${dir.bodyFont}\`

**Palette (OKLch):**
\`\`\`css
:root {
${paletteLines}
}
\`\`\`

**Layout Posture:**
${dir.posture.map((p) => `- ${p}`).join("\n")}`;
}

function formatAvailableSystems(systems: DesignSystemSummary[]): string {
	const list = systems
		.slice(0, 10)
		.map((s) => `- **${s.title}** (\`${s.id}\`): ${s.summary}`)
		.join("\n");
	return `### Available Design Systems\n\n${list}`;
}

const DESIGN_RULES = `### Design Quality Rules

When generating HTML/CSS/React/Tailwind for UI or design artifacts:
1. **Bind tokens first.** Use the existing project tokens/component system when present; otherwise set CSS custom properties on \`:root\` from the active direction/system before writing components. Never freestyle colors.
2. **Typography hierarchy.** At least 3 distinct levels (display → body → caption). Use the specified font stacks. Set \`line-height\`, \`letter-spacing\`, \`font-weight\` deliberately.
3. **Spacing system.** Use a consistent base unit (4px or 8px). All margin/padding should be multiples.
4. **Color discipline.** Max 1 accent color for primary actions. Neutral palette carries 90% of the UI. Status colors (success/warning/error) are semantic, not decorative.
5. **No AI slop.** No generic stock-photo placeholders, no lorem ipsum when real copy is available, no gratuitous gradients, no decorative blur, no excessive rounded corners unless the direction says so.
6. **Responsive by default.** Use clamp(), min(), max() for fluid type. Set viewport meta. Test at 375px and 1440px mentally.
7. **Accessibility baseline.** Color contrast ≥ 4.5:1 for text. Focus-visible states. Semantic HTML elements.
8. **Self-critique.** After generating, mentally check: Is the palette consistent? Is hierarchy clear? Would a senior designer ship this?`;
