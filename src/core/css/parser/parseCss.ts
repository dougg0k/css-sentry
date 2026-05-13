import type { ParsedCssRule } from "../../../shared/types";
import { stripCssComments } from "../text";
import { parseWithCssTree } from "./cssTreeAdapter";
import { parseCompleteSourceRules } from "./fallbackCssParser";
import { addRecoveredImportRules } from "./importRecovery";
import { createParseBudget } from "./parseBudget";
import { createBaseRuleContext, type BudgetedParseResult, type CssParserUsed, type ParseBudgetOptions, type ParseBudgetState, type ParseInput, type ParseOptions } from "./types";

export type { BudgetedParseResult, ParseBudgetOptions, ParseInput, ParseOptions } from "./types";

export function parseCss(input: ParseInput, options: ParseOptions = {}): ParsedCssRule[] {
	return parseCssInternal(input, options).rules;
}

export function parseLargeStylesheetCss(input: ParseInput): ParsedCssRule[] {
	return parseCssInternal(input, { largeSourceScan: true }).rules;
}

export function parseSecurityCriticalSourceRules(input: ParseInput): ParsedCssRule[] {
	const baseContext = createBaseRuleContext(input);
	const normalizedCss = stripCssComments(input.cssText);
	const parsedRules = parseCompleteSourceRules(normalizedCss, baseContext, undefined, { retainOnlyPotentiallyRelevantRules: true });
	return addRecoveredImportRules(input.cssText, baseContext, parsedRules).rules;
}

export function parseCssWithBudget(input: ParseInput, budgetOptions: ParseBudgetOptions, options: ParseOptions = {}): BudgetedParseResult {
	const budget = createParseBudget(budgetOptions);
	const result = parseCssInternal(input, options, budget);
	return { ...result, budgetExceeded: result.budgetExceeded || budget.exceeded };
}

export function parseLargeStylesheetCssWithBudget(input: ParseInput, budgetOptions: ParseBudgetOptions): BudgetedParseResult {
	return parseCssWithBudget(input, budgetOptions, { largeSourceScan: true });
}

function parseCssInternal(input: ParseInput, options: ParseOptions = {}, budget?: ParseBudgetState): BudgetedParseResult {
	const baseContext = createBaseRuleContext(input);
	const normalizedCss = stripCssComments(input.cssText);
	const parsed = options.largeSourceScan ? parseCompleteSourceRules(normalizedCss, baseContext, budget, { retainOnlyPotentiallyRelevantRules: true }) : parseWithCssTree(normalizedCss, baseContext, budget);
	const parserUsed: CssParserUsed = options.largeSourceScan || parsed === null ? "source" : "css-tree";
	const parsedRules = parsed ?? parseCompleteSourceRules(normalizedCss, baseContext, budget);
	const recovered = addRecoveredImportRules(input.cssText, baseContext, parsedRules);
	return {
		rules: recovered.rules,
		budgetExceeded: budget?.exceeded === true,
		parserUsed,
		recoveredImports: recovered.recoveredImports,
	};
}
