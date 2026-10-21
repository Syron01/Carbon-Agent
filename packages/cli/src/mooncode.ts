#!/usr/bin/env node
/**
 * `mooncode` entry point.
 *
 * Opens the Astro Agent Web Studio UI (http://127.0.0.1:3135) in the browser.
 * Any extra CLI arguments are forwarded, so `mooncode --help` etc. still work.
 */
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { APP_NAME } from "./config.js";
import { main } from "./main.js";

process.title = `${APP_NAME} Studio`;
process.env.PI_CODING_AGENT = "true";
process.emitWarning = (() => {}) as typeof process.emitWarning;

setGlobalDispatcher(new EnvHttpProxyAgent({ bodyTimeout: 0, headersTimeout: 0 }));

// Force the Web Studio mode, forward any extra flags/args.
main(["--studio", ...process.argv.slice(2)]);
