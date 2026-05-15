import type { ParsedCssRule, RuleContext } from "../../../shared/types";
import { extractImportUrls } from "../normalizeUrl";
import { splitTopLevel } from "../text";
import { GROUPING_AT_RULES } from "./cssParserConstants";
import { isParseBudgetExceeded } from "./parseBudget";
import type { ParseBudgetState } from "./types";

export interface SourceRuleParseOptions {
	retainOnlyPotentiallyRelevantRules?: boolean;
}

export function parseCompleteSourceRules(cssText: string, context: RuleContext, budget?: ParseBudgetState, options: SourceRuleParseOptions = {}): ParsedCssRule[] {
	const rules: ParsedCssRule[] = [];
	let index = 0;
	while (index < cssText.length) {
		if (isParseBudgetExceeded(budget)) break;
		if (options.retainOnlyPotentiallyRelevantRules) {
			index = advanceToNextPotentiallyRelevantRule(cssText, index);
		}
		index = skipWhitespace(cssText, index, budget);
		if (index >= cssText.length) break;

		if (cssText[index] === "@") {
			const statementEnd = findTopLevelSemicolon(cssText, index, budget);
			const blockOpen = findNextTopLevel(cssText, "{", index, budget);
			if (statementEnd !== -1 && (blockOpen === -1 || statementEnd < blockOpen)) {
				const statement = cssText.slice(index, statementEnd + 1).trim();
				if (/^@import\b/i.test(statement)) {
					rules.push({
						type: "import",
						selector: "@import",
						declarationsText: statement,
						importValue: extractImportUrls(statement, context.sourceUrl ?? context.pageUrl)[0]?.normalized ?? statement,
						context,
					});
				}
				index = statementEnd + 1;
				continue;
			}
			if (blockOpen === -1) break;
			const prelude = cssText.slice(index, blockOpen).trim();
			const close = findMatchingBrace(cssText, blockOpen, budget);
			const blockEnd = close === -1 ? cssText.length : close;
			const body = cssText.slice(blockOpen + 1, blockEnd);
			const atName = prelude.match(/^@[a-z-]+/i)?.[0]?.toLowerCase() ?? prelude.toLowerCase();
			if (GROUPING_AT_RULES.has(atName)) {
				rules.push(
					...parseCompleteSourceRules(body, {
						...context,
						atRuleStack: [...context.atRuleStack, prelude],
					}, budget, options),
				);
			} else if (atName === "@page") {
				if (!options.retainOnlyPotentiallyRelevantRules || isPotentiallyRelevantSourceRule(prelude, body)) {
					rules.push({ type: "style", selector: prelude, declarationsText: body, context: { ...context, atRuleStack: [...context.atRuleStack, prelude] } });
				}
			} else if (atName === "@font-face") {
				rules.push({ type: "font-face", selector: "@font-face", declarationsText: body, context });
			}
			index = close === -1 ? cssText.length : close + 1;
			continue;
		}

		const blockOpen = findNextTopLevel(cssText, "{", index, budget);
		if (blockOpen === -1) break;
		const selectorText = cssText.slice(index, blockOpen).trim();
		const close = findMatchingBrace(cssText, blockOpen, budget);
		const blockEnd = close === -1 ? cssText.length : close;
		const body = cssText.slice(blockOpen + 1, blockEnd);
		const bodyMayContainNestedRules = body.includes("{");
		if (!options.retainOnlyPotentiallyRelevantRules || isPotentiallyRelevantSourceRule(selectorText, body)) {
			for (const selector of splitTopLevel(selectorText, ",").map((part) => part.trim()).filter(Boolean)) {
				if (isParseBudgetExceeded(budget)) break;
				rules.push({ type: "style", selector, declarationsText: body, context });
			}
		}
		if (!isParseBudgetExceeded(budget) && bodyMayContainNestedRules) {
			rules.push(...parseCompleteSourceRules(body, { ...context, atRuleStack: [...context.atRuleStack, "nested-style-rule"] }, budget, options));
		}
		index = close === -1 ? cssText.length : close + 1;
	}
	return rules;
}

export function skipWhitespace(input: string, index: number, budget?: ParseBudgetState): number {
	while (index < input.length && /\s/.test(input[index] ?? "")) {
		if ((index & 0x0fff) === 0 && isParseBudgetExceeded(budget)) break;
		index += 1;
	}
	return index;
}

export function findTopLevelSemicolon(input: string, start: number, budget?: ParseBudgetState): number {
	return findNextTopLevel(input, ";", start, budget);
}

export function findNextTopLevel(input: string, target: string, start: number, budget?: ParseBudgetState): number {
	let quote: '"' | "'" | null = null;
	let parenDepth = 0;
	let bracketDepth = 0;
	for (let index = start; index < input.length; index += 1) {
		if ((index & 0x0fff) === 0 && isParseBudgetExceeded(budget)) return -1;
		const char = input[index];
		if (quote) {
			if (char === "\\") {
				index += 1;
				continue;
			}
			if (char === quote) quote = null;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (char === "(") parenDepth += 1;
		else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
		else if (char === "[") bracketDepth += 1;
		else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
		else if (char === target && parenDepth === 0 && bracketDepth === 0) return index;
	}
	return -1;
}

export function findMatchingBrace(input: string, openIndex: number, budget?: ParseBudgetState): number {
	let quote: '"' | "'" | null = null;
	let depth = 0;
	for (let index = openIndex; index < input.length; index += 1) {
		if ((index & 0x0fff) === 0 && isParseBudgetExceeded(budget)) return -1;
		const char = input[index];
		if (quote) {
			if (char === "\\") {
				index += 1;
				continue;
			}
			if (char === quote) quote = null;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (char === "{") depth += 1;
		else if (char === "}") {
			depth -= 1;
			if (depth === 0) return index;
		}
	}
	return -1;
}

function isPotentiallyRelevantSourceRule(selectorText: string, body: string): boolean {
	if (/url\s*\(|(?:-webkit-)?image-set\s*\(|\battr\s*\(|\bif\s*\(|\bstyle\s*\(|\bvar\s*\(|--[_a-zA-Z][_a-zA-Z0-9-]*/i.test(body)) return true;
	if (/\[(?:[^\]~|^$*=]+)\s*(?:\^=|\$=|\*=|=)/i.test(selectorText) && /background|border-image|list-style|cursor|content|mask|clip-path|filter|fill|stroke|marker|font/i.test(body)) return true;
	return false;
}

const SOURCE_RISK_TOKEN_RE = /@import\b|url\s*\(|(?:-webkit-)?image-set\s*\(|\battr\s*\(|\bif\s*\(|\bstyle\s*\(|\bvar\s*\(|--[_a-zA-Z][_a-zA-Z0-9-]*/gim;

function advanceToNextPotentiallyRelevantRule(input: string, index: number): number {
	const riskIndex = findNextPotentialSourceRisk(input, index);
	if (riskIndex === -1) return input.length;
	const previousRuleClose = input.lastIndexOf("}", riskIndex);
	if (previousRuleClose < index) return index;
	return previousRuleClose + 1;
}

function findNextPotentialSourceRisk(input: string, index: number): number {
	SOURCE_RISK_TOKEN_RE.lastIndex = index;
	const match = SOURCE_RISK_TOKEN_RE.exec(input);
	return match?.index ?? -1;
}
