import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const aiSrcIndex = fileURLToPath(new URL("../ai/src/index.ts", import.meta.url));
const aiSrcOAuth = fileURLToPath(new URL("../ai/src/oauth.ts", import.meta.url));
const engineSrcIndex = fileURLToPath(new URL("../engine/src/index.ts", import.meta.url));

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		testTimeout: 30000,
		server: {
			deps: {
				external: [/@silvia-odwyer\/photon-node/],
			},
		},
	},
	resolve: {
		alias: [
			{ find: /^@mariozechner\/astroagent-ai$/, replacement: aiSrcIndex },
			{ find: /^@mariozechner\/astroagent-ai\/oauth$/, replacement: aiSrcOAuth },
			{ find: /^@mariozechner\/astro-engine-core$/, replacement: engineSrcIndex },
		],
	},
});



