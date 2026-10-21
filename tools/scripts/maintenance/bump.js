import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const version = "12.05.2026-v2";
const packages = [
    "package.json",
    "packages/cli/package.json",
    "packages/core/package.json",
    "packages/engine/package.json",
    "packages/tui/package.json",
    "packages/web-ui/package.json",
];

for (const pkgPath of packages) {
    const fullPath = join(process.cwd(), pkgPath);
    try {
        const content = readFileSync(fullPath, "utf-8");
        const json = JSON.parse(content);
        json.version = version;
        
        // Update workspace dependencies if they exist
        const deps = ["dependencies", "devDependencies", "peerDependencies"];
        for (const depType of deps) {
            if (json[depType]) {
                for (const key in json[depType]) {
                    if (key.startsWith("moon-") || key === "astrocli") {
                        json[depType][key] = version;
                    }
                }
            }
        }
        
        writeFileSync(fullPath, JSON.stringify(json, null, 2) + "\n", "utf-8");
        console.log(`Updated ${pkgPath} to ${version}`);
    } catch (e) {
        console.error(`Failed to update ${pkgPath}:`, e);
    }
}
