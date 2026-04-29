import type { DeclarationInfo } from "../../shared/types";
import { extractUrls } from "./normalizeUrl";
import { cssUnescape, splitTopLevel, stripCssComments } from "./text";

export interface RawDeclaration {
	property: string;
	value: string;
}

export function parseDeclarations(declarationsText: string): RawDeclaration[] {
	const clean = stripCssComments(declarationsText);
	return splitTopLevel(clean, ";")
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			const colonIndex = findTopLevelColon(part);
			if (colonIndex < 1) return null;
			return {
				property: cssUnescape(part.slice(0, colonIndex)).trim().toLowerCase(),
				value: part.slice(colonIndex + 1).trim(),
			};
		})
		.filter((decl): decl is RawDeclaration => decl !== null);
}

function findTopLevelColon(value: string): number {
	let quote: '"' | "'" | null = null;
	let parenDepth = 0;
	for (let index = 0; index < value.length; index += 1) {
		const char = value[index];
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
		else if (char === ":" && parenDepth === 0) return index;
	}
	return -1;
}

export function collectCustomProperties(declarationsText: string): Map<string, string> {
	const map = new Map<string, string>();
	for (const declaration of parseDeclarations(declarationsText)) {
		if (declaration.property.startsWith("--")) {
			map.set(declaration.property, declaration.value);
		}
	}
	return map;
}

export function mergeCustomProperties(base: Map<string, string>, next: Map<string, string>): Map<string, string> {
	const merged = new Map(base);
	for (const [key, value] of next) merged.set(key, value);
	return merged;
}

export function resolveCssVars(
	value: string,
	customProperties: Map<string, string>,
	maxDepth = 8,
): { resolved: string; unresolved: string[]; usedCustomPropertyUrl: boolean } {
	const unresolved = new Set<string>();
	let usedCustomPropertyUrl = false;

	function resolveInner(input: string, depth: number, seen: Set<string>): string {
		if (depth <= 0) return input;
		let output = "";
		let index = 0;
		while (index < input.length) {
			const varStart = input.toLowerCase().indexOf("var(", index);
			if (varStart === -1) {
				output += input.slice(index);
				break;
			}
			output += input.slice(index, varStart);
			const openIndex = varStart + 3;
			const closeIndex = findMatchingParen(input, openIndex);
			if (closeIndex === -1) {
				output += input.slice(varStart);
				break;
			}
			const args = input.slice(openIndex + 1, closeIndex);
			const [rawName, rawFallback] = splitVarArguments(args);
			const name = rawName.trim();
			const valueForName = customProperties.get(name);
			if (!name.startsWith("--") || valueForName === undefined || seen.has(name)) {
				unresolved.add(name || "<invalid-var>");
				if (rawFallback !== undefined) {
					output += resolveInner(rawFallback, depth - 1, seen);
				} else {
					output += input.slice(varStart, closeIndex + 1);
				}
			} else {
				if (/url\s*\(/i.test(valueForName)) usedCustomPropertyUrl = true;
				const nextSeen = new Set(seen);
				nextSeen.add(name);
				output += resolveInner(valueForName, depth - 1, nextSeen);
			}
			index = closeIndex + 1;
		}
		return output;
	}

	return {
		resolved: resolveInner(value, maxDepth, new Set()),
		unresolved: [...unresolved],
		usedCustomPropertyUrl,
	};
}

function findMatchingParen(input: string, openIndex: number): number {
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
		if (char === "(") depth += 1;
		else if (char === ")") {
			depth -= 1;
			if (depth === 0) return index;
		}
	}
	return -1;
}

function splitVarArguments(args: string): [string, string?] {
	let quote: '"' | "'" | null = null;
	let parenDepth = 0;
	for (let index = 0; index < args.length; index += 1) {
		const char = args[index];
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
		else if (char === "," && parenDepth === 0) {
			return [args.slice(0, index), args.slice(index + 1)];
		}
	}
	return [args];
}

export function analyzeDeclaration(
	declaration: RawDeclaration,
	baseUrl: string,
	customProperties: Map<string, string>,
): DeclarationInfo {
	const resolution = resolveCssVars(declaration.value, customProperties);
	return {
		property: declaration.property,
		value: declaration.value,
		resolvedValue: resolution.resolved,
		urls: extractUrls(resolution.resolved, baseUrl),
		usesUnresolvedVar: resolution.unresolved.length > 0,
		unresolvedVars: resolution.unresolved,
		usesCustomPropertyUrl: resolution.usedCustomPropertyUrl,
	};
}
