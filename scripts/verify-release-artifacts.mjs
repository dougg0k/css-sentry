import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const output = join(root, ".output");
if (!existsSync(output)) throw new Error(".output is missing. Run WXT build and zip commands before release artifact verification.");

const files = walk(output).map((path) => path.slice(root.length + 1));
const forbiddenDirectories = ["node_modules", "test-results", "playwright-report"];
const forbiddenSuffixes = [".map"];

for (const file of files) {
  for (const dir of forbiddenDirectories) {
    if (file.split(/[\\/]/).includes(dir)) throw new Error(`Release artifact output must not contain ${dir}: ${file}`);
  }
  for (const suffix of forbiddenSuffixes) {
    if (file.endsWith(suffix)) throw new Error(`Release artifact output must not contain sourcemaps: ${file}`);
  }
}

const zipFiles = files.filter((file) => file.endsWith(".zip"));
if (zipFiles.length === 0) throw new Error("No release zip artifacts were found under .output.");
for (const zip of zipFiles) {
  const size = statSync(join(root, zip)).size;
  if (size <= 0) throw new Error(`Release zip is empty: ${zip}`);
}

console.log("Release artifact verification passed.");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return [path];
  });
}
