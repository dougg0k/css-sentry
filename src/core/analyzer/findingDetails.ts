import type { DeclarationInfo, ParsedCssRule } from "../../shared/types";

export function buildFindingDetails(rule: ParsedCssRule, declaration: DeclarationInfo, selectorSensitive: boolean): string {
	const source = rule.type === "style" ? "CSS rule" : rule.type === "font-face" ? "@font-face rule" : "@import rule";
	const sensitivity = selectorSensitive ? " with sensitive selector signals" : declaration.usesAttributeSource || declaration.usesConditionalIf || declaration.usesStyleQuery ? " with declaration-level data-probe signals" : "";
	const urlCount = declaration.urls.filter((url) => url.isRemote).length;
	return `${source}${sensitivity} uses ${declaration.property} with ${urlCount} remote URL sink(s).`;
}
