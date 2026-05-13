import type { ParsedCssRule, RuleContext, SourceKind } from "../../../shared/types";

export interface ParseInput {
	cssText: string;
	pageUrl: string;
	sourceKind: SourceKind;
	sourceUrl: string | null;
	frameUrl?: string | null;
}

export interface ParseOptions {
	/**
	 * Uses the complete source scanner instead of building a css-tree AST. This is
	 * intended for very large stylesheets where allocating a full AST is the
	 * higher-risk operation, but security analysis must still inspect the whole
	 * stylesheet.
	 */
	largeSourceScan?: boolean;
}

export interface ParseBudgetOptions {
	startedAt: number;
	maxMs: number;
	now?: () => number;
}

export type CssParserUsed = "css-tree" | "source";

export interface BudgetedParseResult {
	rules: ParsedCssRule[];
	budgetExceeded: boolean;
	parserUsed: CssParserUsed;
	recoveredImports: number;
}

export interface ParseBudgetState {
	deadlineMs: number;
	now: () => number;
	exceeded: boolean;
}

export interface SourceParseResult {
	rules: ParsedCssRule[];
	budgetExceeded: boolean;
}

export function createBaseRuleContext(input: ParseInput): RuleContext {
	return {
		pageUrl: input.pageUrl,
		sourceKind: input.sourceKind,
		sourceUrl: input.sourceUrl,
		frameUrl: input.frameUrl ?? null,
		atRuleStack: [],
	};
}
