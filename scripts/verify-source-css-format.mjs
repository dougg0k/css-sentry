import { readFileSync } from "node:fs";

const CSS_SOURCE_FILES = [
  "src/entrypoints/options/style.css",
  "src/entrypoints/popup/style.css",
  "src/entrypoints/report/style.css",
];
const MAX_SOURCE_CSS_LINE_LENGTH = 160;

let failed = false;
for (const file of CSS_SOURCE_FILES) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
  if (longestLine > MAX_SOURCE_CSS_LINE_LENGTH) {
    console.error(`${file} contains a ${longestLine}-character line; source CSS must remain reviewable.`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("Source CSS formatting check passed.");
