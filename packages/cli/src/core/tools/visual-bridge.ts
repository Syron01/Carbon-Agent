import type { EngineTool } from "astro-engine";
import { request } from "http";
import { Type } from "typebox";
import { wrapToolDefinition } from "./tool-definition-wrapper.js";

const visualBridgeSchema = Type.Object({
	action: Type.Union([Type.Literal("extract_css"), Type.Literal("extract_dom"), Type.Literal("get_console_errors")], {
		description: "The visual bridge action to perform via the Chrome extension",
	}),
	selector: Type.Optional(
		Type.String({ description: "CSS selector for the element to target (for CSS/DOM extraction)" }),
	),
});

/**
 * Browser Bridge (Visual & Live Copying)
 * Connects to the Astro-Agent Chrome Extension to extract live DOM, CSS, and console errors
 * straight from the user's active tab.
 */
export function createVisualBridgeToolDefinition(extensionPort: number = 3133) {
	return {
		name: "visual_bridge",
		label: "visual_bridge",
		description:
			"Connects to the Astro-Agent browser extension to read live CSS, DOM, or errors from the active tab.",
		promptSnippet: "Use the visual bridge to extract CSS or errors from Chrome",
		parameters: visualBridgeSchema,
		async execute(_id: string, input: any, signal?: AbortSignal) {
			if (signal?.aborted) throw new Error("aborted");

			return new Promise<any>((resolve, reject) => {
				const req = request(
					{
						hostname: "localhost",
						port: extensionPort,
						path: "/bridge",
						method: "POST",
						headers: { "Content-Type": "application/json" },
					},
					(res) => {
						let data = "";
						res.on("data", (chunk) => {
							data += chunk;
						});
						res.on("end", () => {
							if (res.statusCode === 200) {
								resolve({ content: [{ type: "text", text: data }], details: undefined });
							} else {
								reject(new Error(`Extension bridge returned ${res.statusCode}: ${data}`));
							}
						});
					},
				);

				req.on("error", (err) => {
					reject(
						new Error(
							`Could not connect to Astro-Agent browser extension on port ${extensionPort}. Is it installed and running? Error: ${err.message}`,
						),
					);
				});

				req.write(JSON.stringify(input));
				req.end();
			});
		},
		renderCall(args: any, theme: any) {
			return {
				render: () => [theme.fg("toolTitle", `visual_bridge: ${args?.action}`)],
				invalidate: () => {},
			};
		},
	};
}

export function createVisualBridgeTool(extensionPort?: number): EngineTool<typeof visualBridgeSchema> {
	return wrapToolDefinition(createVisualBridgeToolDefinition(extensionPort));
}
