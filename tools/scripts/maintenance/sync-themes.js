import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const themesDir = "packages/cli/src/modes/interactive/theme";
const smootContent = readFileSync(join(themesDir, "smoot.json"), "utf-8");
const smootJson = JSON.parse(smootContent);

const otherThemes = ["north-dark.json", "darkx.json", "north-light.json"];

for (const themeFile of otherThemes) {
    const path = join(themesDir, themeFile);
    try {
        const themeJson = JSON.parse(readFileSync(path, "utf-8"));
        themeJson.vars = smootJson.vars;
        themeJson.colors = smootJson.colors;
        writeFileSync(path, JSON.stringify(themeJson, null, "\t"), "utf-8");
        console.log(`Synced ${themeFile} to Smoot aesthetic`);
    } catch (e) {
        console.log(`Skipped ${themeFile}`);
    }
}
