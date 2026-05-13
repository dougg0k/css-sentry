import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const aiConfig = readFileSync(join(projectRoot, "vitest.ai.config.ts"), "utf8");
const testAi = packageJson.scripts?.["test:ai"] ?? "";
const failures = [];

if (!testAi.includes("vitest run")) failures.push("test:ai must run Vitest in non-watch mode.");
if (!testAi.includes("--config vitest.ai.config.ts")) failures.push("test:ai must use vitest.ai.config.ts.");
if (!/reporters\s*:\s*\[\s*"json"\s*\]/.test(aiConfig)) failures.push("vitest.ai.config.ts must use the JSON reporter.");
if (!/outputFile\s*:\s*\{\s*json\s*:\s*"\.\/json-report\.json"\s*,?\s*\}/s.test(aiConfig)) failures.push("vitest.ai.config.ts must write ./json-report.json.");
if (failures.length > 0) {
  console.error(["AI report verification failed:", ...failures.map((failure) => `- ${failure}`)].join("\n"));
  process.exit(1);
}
