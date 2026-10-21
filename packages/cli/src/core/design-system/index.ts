/**
 * Astro-Agent Design System Module
 *
 * Inspired by Open Design (nexu-io/open-design) but built lightweight
 * for a CLI-first agent. Provides:
 * - 5 curated design directions (deterministic palettes + font stacks)
 * - Design system registry (scan project for DESIGN.md files)
 * - Design prompt injection into system prompt
 * - Auto-direction picker based on project context
 */

export {
	DEFAULT_UI_DESIGN_SYSTEM_PROMPT,
	DEFAULT_UI_STYLE_GUIDELINE,
	hasExplicitVisualStyleOverride,
	isUiOrFrontendTask,
	shouldInjectDefaultUiDesignPrompt,
} from "./default-ui.js";
export { DESIGN_DIRECTIONS, type DesignDirection } from "./directions.js";
export { buildDesignPrompt, pickDesignDirection } from "./prompt.js";
export {
	type DesignSystemSummary,
	listDesignSystems,
	readDesignSystem,
} from "./registry.js";
