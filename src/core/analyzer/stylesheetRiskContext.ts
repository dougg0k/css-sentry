import type { CssUrlAnalysis, DeclarationInfo, ParsedCssRule } from "../../shared/types";
import { analyzeDeclaration, parseDeclarations, type RawDeclaration } from "../css/declarations";
import { extractImportUrls } from "../css/normalizeUrl";
import { splitTopLevel, unquoteCssString } from "../css/text";

export interface StylesheetRiskContext {
	hasRemoteFontFace: boolean;
	hasRemoteFontMeasurementSetup: boolean;
	hasGeneratedContentFontProbe: boolean;
	hasFontLigatureFeatures: boolean;
	hasFontAnimationChain: boolean;
	hasFontImportChain: boolean;
}

interface RemoteFontFace { urls: CssUrlAnalysis[]; hasUnicodeRange: boolean; }

export function collectStylesheetRiskContext(rules: ParsedCssRule[]): { remoteFontFaces: Map<string, RemoteFontFace>; stylesheetRiskContext: StylesheetRiskContext } {
	const remoteFontFaces = collectRemoteFontFaces(rules);
	return { remoteFontFaces, stylesheetRiskContext: collectFontSideChannelContext(rules, remoteFontFaces) };
}

export function parseImportUrls(rule: ParsedCssRule) {
	const baseUrl = rule.context.sourceUrl ?? rule.context.pageUrl;
	return extractImportUrls(rule.declarationsText, baseUrl);
}

export function hasFontSideChannelContextForRule(
	rule: ParsedCssRule,
	context: StylesheetRiskContext,
	hasContainerQueryContext: boolean,
	hasKeyframesContext: boolean,
): boolean {
	if (!context.hasRemoteFontFace) return false;
	if (hasContainerQueryContext && (context.hasRemoteFontMeasurementSetup || context.hasGeneratedContentFontProbe || context.hasFontImportChain)) return true;
	if (hasKeyframesContext && (context.hasFontAnimationChain || context.hasGeneratedContentFontProbe || context.hasRemoteFontMeasurementSetup)) return true;
	if (isGeneratedContentSelector(rule.selector) && (context.hasGeneratedContentFontProbe || context.hasRemoteFontMeasurementSetup)) return true;
	if (isTextBearingLeakSelector(rule.selector) && context.hasRemoteFontMeasurementSetup) return true;
	return false;
}

export function fontSideChannelScoreForContext(context: StylesheetRiskContext, hasContainerSizeQueryContext: boolean, hasKeyframesContext: boolean): number {
	let score = 4;
	if (hasContainerSizeQueryContext) score += 1;
	if (hasKeyframesContext) score += 1;
	if (context.hasRemoteFontMeasurementSetup) score += 1;
	if (context.hasGeneratedContentFontProbe) score += 1;
	if (context.hasFontLigatureFeatures) score += 1;
	if (context.hasFontAnimationChain) score += 1;
	if (context.hasFontImportChain) score += 1;
	return score;
}

export function isContainerSizeQuery(entry: string): boolean {
	return /^@container\b/i.test(entry) && /\b(?:width|height|inline-size|block-size|min-width|max-width|min-height|max-height|cqw|cqh|cqi|cqb|cqmin|cqmax)\b/i.test(entry);
}

export function declarationReferencesRemoteFont(declaration: RawDeclaration, fonts: Map<string, RemoteFontFace>): boolean {
	return remoteFontReferenceDeclaration(declaration, fonts) !== null;
}

export function remoteFontReferenceDeclaration(declaration: RawDeclaration, fonts: Map<string, RemoteFontFace>): DeclarationInfo | null {
	if (fonts.size === 0 || !(declaration.property === "font-family" || declaration.property === "font")) return null;
	const urls: CssUrlAnalysis[] = [];
	let usesFontUnicodeRange = false;
	for (const family of fontFamilyNames(declaration.value)) {
		const matches = fonts.get(family);
		if (matches) {
			urls.push(...matches.urls);
			usesFontUnicodeRange = usesFontUnicodeRange || matches.hasUnicodeRange;
		}
	}
	if (urls.length === 0) return null;
	return {
		property: declaration.property,
		value: declaration.value,
		resolvedValue: declaration.value,
		urls,
		usesUnresolvedVar: false,
		unresolvedVars: [],
		usesCustomPropertyUrl: false,
		usesFontUnicodeRange,
	};
}

function collectFontSideChannelContext(rules: ParsedCssRule[], remoteFontFaces: Map<string, RemoteFontFace>): StylesheetRiskContext {
	if (remoteFontFaces.size === 0) {
		return {
			hasRemoteFontFace: false,
			hasRemoteFontMeasurementSetup: false,
			hasGeneratedContentFontProbe: false,
			hasFontLigatureFeatures: false,
			hasFontAnimationChain: false,
			hasFontImportChain: false,
		};
	}

	let remoteFontUsage = false;
	let metricSetup = false;
	let generatedContent = false;
	let generatedContentWithRemoteFont = false;
	let ligatureFeatures = false;
	let animationChain = false;
	let remoteImport = false;

	for (const rule of rules) {
		if (rule.type === "import") {
			remoteImport = remoteImport || parseImportUrls(rule).some((url) => url.isRemote);
			continue;
		}
		if (rule.type === "font-face") continue;

		const declarations = parseDeclarations(rule.declarationsText);
		const referencesRemoteFont = declarations.some((declaration) => declarationReferencesRemoteFont(declaration, remoteFontFaces));
		const hasGeneratedSelector = isGeneratedContentSelector(rule.selector);
		const ruleHasGeneratedContent = hasGeneratedSelector || declarations.some(isGeneratedContentDeclaration);
		const ruleHasLigatureFeature = declarations.some(isFontLigatureDeclaration);
		const ruleHasMetricSetup = declarations.some(isFontMetricSetupDeclaration);
		const ruleHasAnimation = declarations.some(isAnimationDeclaration) || rule.context.atRuleStack.some((entry) => /^@(?:-webkit-)?keyframes\b/i.test(entry));

		remoteFontUsage = remoteFontUsage || referencesRemoteFont;
		generatedContent = generatedContent || ruleHasGeneratedContent;
		ligatureFeatures = ligatureFeatures || (referencesRemoteFont && ruleHasLigatureFeature);
		metricSetup = metricSetup || (referencesRemoteFont && (ruleHasMetricSetup || ruleHasLigatureFeature || ruleHasGeneratedContent || isTextBearingLeakSelector(rule.selector)));
		generatedContentWithRemoteFont = generatedContentWithRemoteFont || (referencesRemoteFont && ruleHasGeneratedContent);
		animationChain = animationChain || (referencesRemoteFont && ruleHasAnimation);
	}

	const hasRemoteFontMeasurementSetup = remoteFontUsage && (metricSetup || (generatedContent && ligatureFeatures));
	const hasGeneratedContentFontProbe = generatedContentWithRemoteFont || (remoteFontUsage && generatedContent && (ligatureFeatures || metricSetup));
	const hasFontAnimationChain = animationChain || (remoteFontUsage && rules.some((rule) => rule.context.atRuleStack.some((entry) => /^@(?:-webkit-)?keyframes\b/i.test(entry))));
	const hasFontImportChain = remoteImport && (hasRemoteFontMeasurementSetup || hasGeneratedContentFontProbe || hasFontAnimationChain);

	return {
		hasRemoteFontFace: true,
		hasRemoteFontMeasurementSetup,
		hasGeneratedContentFontProbe,
		hasFontLigatureFeatures: ligatureFeatures,
		hasFontAnimationChain,
		hasFontImportChain,
	};
}

function isGeneratedContentSelector(selector: string): boolean {
	return /::(?:before|after|marker|first-letter|first-line)\b/i.test(selector);
}

function isGeneratedContentDeclaration(declaration: RawDeclaration): boolean {
	if (declaration.property !== "content") return false;
	const value = declaration.value.trim().toLowerCase();
	return value !== "normal" && value !== "none" && value !== '\"\"' && value !== "''";
}

function isFontLigatureDeclaration(declaration: RawDeclaration): boolean {
	if (declaration.property === "font-feature-settings") {
		return splitTopLevel(declaration.value, ",").some((part) => {
			const match = part.trim().match(/^["']?(liga|clig|dlig|hlig|calt|salt|rlig)["']?\s*(.*)$/i);
			if (!match) return false;
			const featureValue = (match[2] ?? "").trim();
			return !/^(?:0|off|false)\b/i.test(featureValue);
		});
	}
	if (declaration.property === "font-variant-ligatures") return !/\bnone\b/i.test(declaration.value);
	return false;
}

function isFontMetricSetupDeclaration(declaration: RawDeclaration): boolean {
	const property = declaration.property;
	const value = declaration.value.toLowerCase();
	if (property === "width" || property === "inline-size" || property === "max-width" || property === "min-width") return /\b(?:fit-content|max-content|min-content|calc\(|cqw|cqi|px|ch|em|rem)\b/i.test(value);
	if (property === "height" || property === "line-height" || property === "font-size" || property === "letter-spacing" || property === "white-space" || property === "overflow") return true;
	return false;
}

function isAnimationDeclaration(declaration: RawDeclaration): boolean {
	return declaration.property === "animation" || declaration.property === "animation-name" || declaration.property === "-webkit-animation" || declaration.property === "-webkit-animation-name";
}

function isTextBearingLeakSelector(selector: string): boolean {
	return /\b(?:script|style|textarea|pre|code|output|kbd|samp)\b|(?:secret|token|credential|password|nonce|csrf|access[-_]?key)/i.test(selector);
}

function collectRemoteFontFaces(rules: ParsedCssRule[]): Map<string, RemoteFontFace> {
	const fonts = new Map<string, RemoteFontFace>();
	for (const rule of rules) {
		if (rule.type !== "font-face") continue;
		const declarations = parseDeclarations(rule.declarationsText);
		const fontFamily = declarations.find((declaration) => declaration.property === "font-family");
		const src = declarations.find((declaration) => declaration.property === "src");
		const unicodeRange = declarations.find((declaration) => declaration.property === "unicode-range");
		if (!fontFamily || !src) continue;
		const analyzedSrc = analyzeDeclaration(src, rule.context.sourceUrl ?? rule.context.pageUrl, new Map());
		const remoteUrls = analyzedSrc.urls.filter((url) => url.isRemote);
		if (remoteUrls.length === 0) continue;
		for (const family of fontFamilyNames(fontFamily.value)) {
			const existing = fonts.get(family);
			fonts.set(family, { urls: [...(existing?.urls ?? []), ...remoteUrls], hasUnicodeRange: Boolean(existing?.hasUnicodeRange || unicodeRange) });
		}
	}
	return fonts;
}

function fontFamilyNames(value: string): string[] {
	return splitTopLevel(value, ",")
		.map((part) => unquoteCssString(part.trim()))
		.map((part) => part.replace(/^(?:normal|italic|oblique|small-caps|bold|bolder|lighter|[0-9]{3}|(?:xx?-)?(?:small|large)|medium)\s+/gi, ""))
		.map((part) => part.trim().toLowerCase())
		.filter(Boolean);
}
