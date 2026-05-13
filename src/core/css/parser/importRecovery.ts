import type { ParsedCssRule, RuleContext } from "../../../shared/types";
import { extractImportUrls } from "../normalizeUrl";

export function addRecoveredImportRules(cssText: string, context: RuleContext, rules: readonly ParsedCssRule[]): { rules: ParsedCssRule[]; recoveredImports: number } {
	const existingImports = new Set(
		rules
			.filter((rule) => rule.type === "import")
			.map((rule) => extractImportUrls(rule.declarationsText, context.sourceUrl ?? context.pageUrl)[0]?.normalized)
			.filter((value): value is string => Boolean(value)),
	);
	const recovered: ParsedCssRule[] = [];
	for (const url of extractImportUrls(cssText, context.sourceUrl ?? context.pageUrl)) {
		if (!url.normalized || existingImports.has(url.normalized)) continue;
		existingImports.add(url.normalized);
		recovered.push({
			type: "import",
			selector: "@import",
			declarationsText: `@import url("${url.normalized}");`,
			importValue: url.normalized,
			context,
		});
	}
	return { rules: recovered.length > 0 ? [...rules, ...recovered] : [...rules], recoveredImports: recovered.length };
}

export function securityCriticalRecoveredRules(result: { rules: readonly ParsedCssRule[]; recoveredImports: number }): ParsedCssRule[] {
	if (result.recoveredImports <= 0) return [];
	return result.rules.filter((rule) => rule.type === "import").slice(-result.recoveredImports);
}
