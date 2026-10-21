import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { EngineTool } from "astro-engine";
import { type Static, Type } from "typebox";
import { getEngineDir } from "../../config.js";
import type { ToolDefinition } from "../extensions/types.js";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const profileSchema = Type.Object({
	category: Type.String({
		description: "Category of preference (e.g. 'frameworks', 'architecture', 'styling', 'naming', 'general')",
	}),
	preference: Type.String({
		description:
			"The specific preference or rule the user wants to enforce (e.g. 'Prefers Vanilla CSS over Tailwind')",
	}),
});

export type UserProfileToolInput = Static<typeof profileSchema>;

function getProfilePath(): string {
	const baseDir = getEngineDir();
	const profilesDir = join(baseDir, "profiles");
	if (!existsSync(profilesDir)) {
		mkdirSync(profilesDir, { recursive: true });
	}
	return join(profilesDir, "user-style.json");
}

export function loadUserProfile(): Record<string, string[]> {
	const profilePath = getProfilePath();
	if (!existsSync(profilePath)) return {};
	try {
		return JSON.parse(readFileSync(profilePath, "utf-8"));
	} catch {
		return {};
	}
}

export function createUserProfileToolDefinition(): ToolDefinition<typeof profileSchema, undefined, any> {
	return {
		name: "update_user_profile",
		label: "update profile",
		description:
			"Long-term Style Memory: Update the user's coding profile with a new learned preference. Call this when the user explicitly or implicitly states a strong architectural, stylistic, or tooling preference that should be remembered across all projects.",
		promptSnippet: "Update user's long-term profile",
		parameters: profileSchema,
		async execute(_toolCallId, { category, preference }, _signal, _onUpdate, _ctx) {
			try {
				const profilePath = getProfilePath();
				const profile = loadUserProfile();

				if (!profile[category]) {
					profile[category] = [];
				}

				// Avoid exact duplicates
				if (!profile[category].includes(preference)) {
					profile[category].push(preference);
					writeFileSync(profilePath, JSON.stringify(profile, null, 2), "utf-8");
					return {
						content: [
							{ type: "text", text: `Successfully saved preference '${preference}' to category '${category}'.` },
						],
						details: undefined,
					};
				}

				return {
					content: [{ type: "text", text: `Preference already exists in category '${category}'.` }],
					details: undefined,
				};
			} catch (err: any) {
				return {
					content: [{ type: "text", text: `Failed to update profile: ${err.message}` }],
					details: undefined,
				};
			}
		},
	};
}

export function createUserProfileTool(): EngineTool<typeof profileSchema> {
	return wrapToolDefinition(createUserProfileToolDefinition());
}

export function getUserProfilePreface(): string {
	const profile = loadUserProfile();
	if (Object.keys(profile).length === 0) return "";

	let preface = "## User Long-Term Style Memory\n";
	preface +=
		"The user has the following established coding preferences. ALWAYS adhere to these rules unless explicitly told otherwise:\n";

	for (const [category, preferences] of Object.entries(profile)) {
		preface += `\n### ${category.toUpperCase()}\n`;
		for (const pref of preferences) {
			preface += `- ${pref}\n`;
		}
	}

	return `${preface}\n`;
}
