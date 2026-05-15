import type { AnalysisSummary, Finding, ParsedCssRule, SourceKind } from "../../shared/types";
import { ANALYSIS_LIMITS } from "../../shared/constants";
import type { Now } from "../../shared/clock";
import { systemNow } from "../../shared/clock";
import { parseCssWithBudget, parseLargeStylesheetCssWithBudget, parseSecurityCriticalSourceRules, type BudgetedParseResult } from "../css/parseCss";
import { createFinding } from "../findings/createFinding";
import { analyzeParsedRules, analysisBudgetExceeded } from "./stylesheetRuleAnalysis";

export interface AnalyzeStylesheetInput {
	cssText: string;
	pageUrl: string;
	sourceKind: SourceKind;
	sourceUrl: string | null;
	frameUrl?: string | null;
	maxFindings?: number;
	now?: Now;
	enableCssFingerprintingGuard?: boolean;
}

export { analyzeParsedRules } from "./stylesheetRuleAnalysis";

export function analyzeStylesheet(input: AnalyzeStylesheetInput): AnalysisSummary {
	const now = input.now ?? systemNow;
	const startedAt = now();
	const maxFindings = input.maxFindings ?? ANALYSIS_LIMITS.maxFindingsPerPage;
	const isLargeStylesheet = byteLength(input.cssText) > ANALYSIS_LIMITS.maxStyleTextBytes;
	const parseResult = isLargeStylesheet
		? parseLargeStylesheetCssWithBudget(input, { startedAt, maxMs: ANALYSIS_LIMITS.maxAnalysisMsPerDocument, now })
		: parseCssWithBudget(input, { startedAt, maxMs: ANALYSIS_LIMITS.maxAnalysisMsPerDocument, now });

	if (parseResult.budgetExceeded) {
		const budgetResilientFindings = analyzeParsedRules(securityCriticalRulesFromBudgetedParse(input, parseResult), maxFindings, startedAt, { enforceBudget: false, now, enableCssFingerprintingGuard: input.enableCssFingerprintingGuard });
		return createPerformanceBudgetAnalysisSummary(input, startedAt, budgetResilientFindings, now);
	}

	if (analysisBudgetExceeded(startedAt, now)) {
		const budgetResilientFindings = analyzeParsedRules(securityCriticalRulesFromBudgetedParse(input, parseResult), maxFindings, startedAt, { enforceBudget: false, now, enableCssFingerprintingGuard: input.enableCssFingerprintingGuard });
		return createPerformanceBudgetAnalysisSummary(input, startedAt, budgetResilientFindings, now);
	}
	const findings = analyzeParsedRules(parseResult.rules, maxFindings, startedAt, { now, enableCssFingerprintingGuard: input.enableCssFingerprintingGuard });
	if (analysisBudgetExceeded(startedAt, now)) return createPerformanceBudgetAnalysisSummary(input, startedAt, findings, now);
	return {
		state: findings.some((finding) => finding.state !== "analysis.complete") ? "analysis.partial" : "analysis.complete",
		findings,
		analyzedStylesheets: 1,
		partialStylesheets: 0,
		analyzedFrames: 0,
		partialFrames: 0,
		startedAt,
		finishedAt: now(),
	};
}

function securityCriticalRulesFromBudgetedParse(input: AnalyzeStylesheetInput, parseResult: BudgetedParseResult): ParsedCssRule[] {
	const importRulesFromBudgetedParse = parseResult.rules.filter((rule) => rule.type === "import");
	const sourceRules = parseSecurityCriticalSourceRules(input);
	const sourceNonImportRules = sourceRules.filter((rule) => rule.type !== "import");
	if (sourceNonImportRules.length === 0) return importRulesFromBudgetedParse;
	return [...importRulesFromBudgetedParse, ...sourceNonImportRules];
}

function createPerformanceBudgetAnalysisSummary(input: AnalyzeStylesheetInput, startedAt: number, findings: Finding[], now: Now): AnalysisSummary {
	const finishedAt = now();
	return {
		state: "analysis.skipped.performance_budget",
		findings: [
			...findings.slice(0, input.maxFindings ?? ANALYSIS_LIMITS.maxFindingsPerPage),
			createFinding({
				severity: "info",
				confidence: 100,
				pageUrl: input.pageUrl,
				frameUrl: input.frameUrl ?? input.pageUrl,
				sourceKind: input.sourceKind,
				sourceUrl: input.sourceUrl,
				state: "analysis.skipped.performance_budget",
				reasons: ["analysis.skipped.performance_budget"],
				details: "Stylesheet analysis stopped after reaching the configured performance budget.",
				timestamp: finishedAt,
			}),
		],
		analyzedStylesheets: 0,
		partialStylesheets: 1,
		analyzedFrames: 0,
		partialFrames: 0,
		startedAt,
		finishedAt,
	};
}

function byteLength(value: string): number {
	if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).length;
	return value.length;
}
