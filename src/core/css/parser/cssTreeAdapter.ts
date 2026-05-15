import * as cssTree from "css-tree";
import type { ParsedCssRule, RuleContext } from "../../../shared/types";
import { extractImportUrls } from "../normalizeUrl";
import { splitTopLevel } from "../text";
import { GROUPING_AT_RULES } from "./cssParserConstants";
import { isParseBudgetExceeded } from "./parseBudget";
import type { ParseBudgetState } from "./types";

const parser = cssTree as unknown as {
	parse: (source: string, options?: Record<string, unknown>) => unknown;
	generate: (node: unknown) => string;
};

export function parseWithCssTree(cssText: string, context: RuleContext, budget?: ParseBudgetState): ParsedCssRule[] | null {
	if (isParseBudgetExceeded(budget)) return [];
	try {
		let parseErrors = 0;
		const ast = parser.parse(cssText, {
			context: "stylesheet",
			positions: false,
			parseAtrulePrelude: false,
			parseCustomProperty: false,
			onParseError: () => {
				parseErrors += 1;
			},
		});
		if (parseErrors > 0) return null;
		if (isParseBudgetExceeded(budget)) return [];
		const rules: ParsedCssRule[] = [];
		walkCssTreeChildren(getChildren(ast), context, rules, [], budget);
		return rules;
	} catch {
		return null;
	}
}

function walkCssTreeChildren(children: unknown[], context: RuleContext, output: ParsedCssRule[], selectorStack: string[], budget?: ParseBudgetState): void {
	for (const child of children) {
		if (isParseBudgetExceeded(budget)) break;
		const node = asCssTreeNode(child);
		if (!node) continue;
		if (node.type === "Atrule") {
			walkCssTreeAtRule(node, context, output, selectorStack, budget);
			continue;
		}
		if (node.type === "Rule") {
			walkCssTreeRule(node, context, output, selectorStack, budget);
		}
	}
}

function walkCssTreeAtRule(node: Record<string, unknown>, context: RuleContext, output: ParsedCssRule[], selectorStack: string[], budget?: ParseBudgetState): void {
	const name = String(node.name ?? "").toLowerCase();
	const atName = `@${name}`;
	const prelude = safeGenerate(node.prelude).trim();
	const atRuleText = prelude ? `${atName} ${prelude}` : atName;
	if (name === "import") {
		const statement = `${atRuleText};`;
		output.push({
			type: "import",
			selector: "@import",
			declarationsText: statement,
			importValue: extractImportUrls(statement, context.sourceUrl ?? context.pageUrl)[0]?.normalized ?? statement,
			context,
		});
		return;
	}
	if (name === "font-face") {
		output.push({ type: "font-face", selector: "@font-face", declarationsText: declarationsTextFromBlock(node.block), context });
		return;
	}
	if (name === "page") {
		const declarationsText = declarationsTextFromBlock(node.block);
		if (declarationsText) output.push({ type: "style", selector: atRuleText, declarationsText, context: { ...context, atRuleStack: [...context.atRuleStack, atRuleText] } });
		return;
	}
	if (node.block && GROUPING_AT_RULES.has(atName)) {
		walkCssTreeChildren(getChildren(node.block), { ...context, atRuleStack: [...context.atRuleStack, atRuleText] }, output, selectorStack, budget);
	}
}

function walkCssTreeRule(node: Record<string, unknown>, context: RuleContext, output: ParsedCssRule[], selectorStack: string[], budget?: ParseBudgetState): void {
	const selectorText = safeGenerate(node.prelude).trim();
	const declarationsText = declarationsTextFromBlock(node.block);
	if (declarationsText) {
		for (const selector of splitTopLevel(selectorText, ",").map((part) => part.trim()).filter(Boolean)) {
			if (isParseBudgetExceeded(budget)) break;
			const effectiveSelector = selectorStack.length > 0 ? `${selectorStack.join(" ")} ${selector}` : selector;
			output.push({ type: "style", selector: effectiveSelector, declarationsText, context });
		}
	}
	const childRules = getChildren(node.block).filter((child) => {
		const childNode = asCssTreeNode(child);
		return childNode?.type === "Rule" || childNode?.type === "Atrule";
	});
	if (childRules.length > 0) {
		const nextSelectorStack = selectorText ? [...selectorStack, selectorText] : selectorStack;
		walkCssTreeChildren(childRules, { ...context, atRuleStack: [...context.atRuleStack, "nested-style-rule"] }, output, nextSelectorStack, budget);
	}
}

function declarationsTextFromBlock(block: unknown): string {
	const declarations: string[] = [];
	for (const child of getChildren(block)) {
		const node = asCssTreeNode(child);
		if (node?.type !== "Declaration") continue;
		const property = String(node.property ?? "").trim();
		const value = safeGenerate(node.value).trim();
		const important = node.important === true ? " !important" : "";
		if (property && value) declarations.push(`${property}: ${value}${important}`);
	}
	return declarations.join("; ");
}

function getChildren(node: unknown): unknown[] {
	const maybeChildren = asCssTreeNode(node)?.children;
	if (!maybeChildren) return [];
	if (Array.isArray(maybeChildren)) return maybeChildren;
	const list = maybeChildren as { toArray?: () => unknown[]; forEach?: (callback: (item: unknown) => void) => void };
	if (typeof list.toArray === "function") return list.toArray();
	if (typeof list.forEach === "function") {
		const items: unknown[] = [];
		list.forEach((item) => items.push(item));
		return items;
	}
	return [];
}

function safeGenerate(node: unknown): string {
	if (!node) return "";
	try {
		return parser.generate(node);
	} catch {
		return "";
	}
}

function asCssTreeNode(node: unknown): Record<string, unknown> | null {
	return typeof node === "object" && node !== null ? (node as Record<string, unknown>) : null;
}
