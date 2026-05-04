import * as cssTree from "css-tree";
import type { ParsedCssRule, RuleContext, SourceKind } from "../../shared/types";
import { extractImportUrls } from "./normalizeUrl";
import { splitTopLevel, stripCssComments } from "./text";

interface ParseInput {
	cssText: string;
	pageUrl: string;
	sourceKind: SourceKind;
	sourceUrl: string | null;
	frameUrl?: string | null;
}

interface ParseOptions {
	/**
	 * Uses the complete source scanner instead of building a css-tree AST. This is
	 * intended for very large stylesheets where allocating a full AST is the
	 * higher-risk operation, but security analysis must still inspect the whole
	 * stylesheet.
	 */
	largeSourceScan?: boolean;
}

const GROUPING_AT_RULES = new Set([
	"@media",
	"@supports",
	"@layer",
	"@container",
	"@scope",
	"@document",
	"@starting-style",
	"@when",
	"@else",
]);

const parser = cssTree as unknown as {
	parse: (source: string, options?: Record<string, unknown>) => unknown;
	generate: (node: unknown) => string;
};

export function parseCss(input: ParseInput, options: ParseOptions = {}): ParsedCssRule[] {
	const baseContext: RuleContext = {
		pageUrl: input.pageUrl,
		sourceKind: input.sourceKind,
		sourceUrl: input.sourceUrl,
		frameUrl: input.frameUrl ?? null,
		atRuleStack: [],
	};
	const normalizedCss = stripCssComments(input.cssText);
	const parsed = options.largeSourceScan ? parseCompleteSourceRules(normalizedCss, baseContext) : parseWithCssTree(normalizedCss, baseContext);
	const rules = parsed ?? parseCompleteSourceRules(normalizedCss, baseContext);
	return addRecoveredImportRules(input.cssText, baseContext, rules);
}

export function parseLargeStylesheetCss(input: ParseInput): ParsedCssRule[] {
	const baseContext: RuleContext = {
		pageUrl: input.pageUrl,
		sourceKind: input.sourceKind,
		sourceUrl: input.sourceUrl,
		frameUrl: input.frameUrl ?? null,
		atRuleStack: [],
	};
	const normalizedCss = stripCssComments(input.cssText);
	return addRecoveredImportRules(input.cssText, baseContext, parseCompleteSourceRules(normalizedCss, baseContext));
}


function addRecoveredImportRules(cssText: string, context: RuleContext, rules: ParsedCssRule[]): ParsedCssRule[] {
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
	return recovered.length > 0 ? [...rules, ...recovered] : rules;
}

function parseWithCssTree(cssText: string, context: RuleContext): ParsedCssRule[] | null {
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
		const rules: ParsedCssRule[] = [];
		walkCssTreeChildren(getChildren(ast), context, rules, []);
		return rules;
	} catch {
		return null;
	}
}

function walkCssTreeChildren(children: unknown[], context: RuleContext, output: ParsedCssRule[], selectorStack: string[]): void {
	for (const child of children) {
		const node = asCssTreeNode(child);
		if (!node) continue;
		if (node.type === "Atrule") {
			walkCssTreeAtRule(node, context, output, selectorStack);
			continue;
		}
		if (node.type === "Rule") {
			walkCssTreeRule(node, context, output, selectorStack);
		}
	}
}

function walkCssTreeAtRule(node: Record<string, unknown>, context: RuleContext, output: ParsedCssRule[], selectorStack: string[]): void {
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
	if (node.block && GROUPING_AT_RULES.has(atName)) {
		walkCssTreeChildren(getChildren(node.block), { ...context, atRuleStack: [...context.atRuleStack, atRuleText] }, output, selectorStack);
	}
}

function walkCssTreeRule(node: Record<string, unknown>, context: RuleContext, output: ParsedCssRule[], selectorStack: string[]): void {
	const selectorText = safeGenerate(node.prelude).trim();
	const declarationsText = declarationsTextFromBlock(node.block);
	if (declarationsText) {
		for (const selector of splitTopLevel(selectorText, ",").map((part) => part.trim()).filter(Boolean)) {
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
		walkCssTreeChildren(childRules, { ...context, atRuleStack: [...context.atRuleStack, "nested-style-rule"] }, output, nextSelectorStack);
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

function parseCompleteSourceRules(cssText: string, context: RuleContext): ParsedCssRule[] {
	const rules: ParsedCssRule[] = [];
	let index = 0;
	while (index < cssText.length) {
		index = skipWhitespace(cssText, index);
		if (index >= cssText.length) break;

		if (cssText[index] === "@") {
			const statementEnd = findTopLevelSemicolon(cssText, index);
			const blockOpen = findNextTopLevel(cssText, "{", index);
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
			const close = findMatchingBrace(cssText, blockOpen);
			const blockEnd = close === -1 ? cssText.length : close;
			const body = cssText.slice(blockOpen + 1, blockEnd);
			const atName = prelude.match(/^@[a-z-]+/i)?.[0]?.toLowerCase() ?? prelude.toLowerCase();
			if (GROUPING_AT_RULES.has(atName)) {
				rules.push(
					...parseCompleteSourceRules(body, {
						...context,
						atRuleStack: [...context.atRuleStack, prelude],
					}),
				);
			} else if (atName === "@font-face") {
				rules.push({ type: "font-face", selector: "@font-face", declarationsText: body, context });
			}
			index = close === -1 ? cssText.length : close + 1;
			continue;
		}

		const blockOpen = findNextTopLevel(cssText, "{", index);
		if (blockOpen === -1) break;
		const selectorText = cssText.slice(index, blockOpen).trim();
		const close = findMatchingBrace(cssText, blockOpen);
		const blockEnd = close === -1 ? cssText.length : close;
		const body = cssText.slice(blockOpen + 1, blockEnd);
		for (const selector of splitTopLevel(selectorText, ",").map((part) => part.trim()).filter(Boolean)) {
			rules.push({ type: "style", selector, declarationsText: body, context });
		}
		if (body.includes("{")) {
			rules.push(...parseCompleteSourceRules(body, { ...context, atRuleStack: [...context.atRuleStack, "nested-style-rule"] }));
		}
		index = close === -1 ? cssText.length : close + 1;
	}
	return rules;
}

function skipWhitespace(input: string, index: number): number {
	while (index < input.length && /\s/.test(input[index] ?? "")) index += 1;
	return index;
}

function findTopLevelSemicolon(input: string, start: number): number {
	return findNextTopLevel(input, ";", start);
}

function findNextTopLevel(input: string, target: string, start: number): number {
	let quote: '"' | "'" | null = null;
	let parenDepth = 0;
	let bracketDepth = 0;
	for (let index = start; index < input.length; index += 1) {
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

function findMatchingBrace(input: string, openIndex: number): number {
	let quote: '"' | "'" | null = null;
	let depth = 0;
	for (let index = openIndex; index < input.length; index += 1) {
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
