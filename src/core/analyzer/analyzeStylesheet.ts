import type { AnalysisSummary, CssUrlAnalysis, DeclarationInfo, Finding, ParsedCssRule, ReasonCode, SourceKind } from "../../shared/types";
import { ANALYSIS_LIMITS } from "../../shared/constants";
import { analyzeDeclaration, collectCustomProperties, mergeCustomProperties, parseDeclarations, type RawDeclaration } from "../css/declarations";
import { extractImportUrls } from "../css/normalizeUrl";
import { splitTopLevel, unquoteCssString } from "../css/text";
import { parseCss, parseLargeStylesheetCss } from "../css/parseCss";
import { createFinding } from "../findings/createFinding";
import { analyzeDeclarationRisk } from "./analyzeDeclaration";
import { analyzeSelector } from "./analyzeSelector";
import { confidenceFromScore, severityFromScore } from "./riskScore";

export interface AnalyzeStylesheetInput {
	cssText: string;
	pageUrl: string;
	sourceKind: SourceKind;
	sourceUrl: string | null;
	frameUrl?: string | null;
	maxFindings?: number;
}

export function analyzeStylesheet(input: AnalyzeStylesheetInput): AnalysisSummary {
	const startedAt = Date.now();
	const isLargeStylesheet = byteLength(input.cssText) > ANALYSIS_LIMITS.maxStyleTextBytes;
	const rules = isLargeStylesheet ? parseLargeStylesheetCss(input) : parseCss(input);
	const findings = analyzeParsedRules(rules, input.maxFindings ?? ANALYSIS_LIMITS.maxFindingsPerPage);
	return {
		state: findings.some((finding) => finding.state !== "analysis.complete") ? "analysis.partial" : "analysis.complete",
		findings,
		analyzedStylesheets: 1,
		partialStylesheets: 0,
		analyzedFrames: 0,
		partialFrames: 0,
		startedAt,
		finishedAt: Date.now(),
	};
}

interface StylesheetRiskContext {
	hasRemoteFontFace: boolean;
	hasRemoteFontMeasurementSetup: boolean;
	hasGeneratedContentFontProbe: boolean;
	hasFontLigatureFeatures: boolean;
	hasFontAnimationChain: boolean;
	hasFontImportChain: boolean;
}

export function analyzeParsedRules(rules: ParsedCssRule[], maxFindings: number = ANALYSIS_LIMITS.maxFindingsPerPage): Finding[] {
	const findings: Finding[] = [];
	let inheritedCustomProperties = new Map<string, string>();
	const remoteFontFaces = collectRemoteFontFaces(rules);
	const stylesheetRiskContext = collectFontSideChannelContext(rules, remoteFontFaces);

	for (const rule of rules) {
		const localProperties = collectCustomProperties(rule.declarationsText);
		const customProperties = mergeCustomProperties(inheritedCustomProperties, localProperties);
		if (localProperties.size > 0) inheritedCustomProperties = customProperties;

		const selectorAnalysis = rule.type === "style" ? analyzeSelector(rule.selector) : null;
		const declarations = parseDeclarations(rule.declarationsText);
		if (rule.type === "import") {
			const importDeclaration: DeclarationInfo = {
				property: "@import",
				value: rule.declarationsText,
				resolvedValue: rule.declarationsText,
				urls: [],
				usesUnresolvedVar: false,
				unresolvedVars: [],
				usesCustomPropertyUrl: false,
			};
			for (const url of parseImportUrls(rule)) {
				importDeclaration.urls.push(url);
			}
			pushFindingForDeclaration(findings, rule, selectorAnalysis, importDeclaration, maxFindings, stylesheetRiskContext);
			continue;
		}

		// Standalone @font-face declarations are common and not CSS exfiltration by themselves.
		// Remote font URLs are considered again only when a sensitive selector conditionally
		// references a remote font-family declared in the same stylesheet.
		if (rule.type === "font-face") continue;

		for (const declaration of declarations) {
			const analyzed = analyzeDeclaration(declaration, rule.context.sourceUrl ?? rule.context.pageUrl, customProperties);
			pushFindingForDeclaration(findings, rule, selectorAnalysis, analyzed, maxFindings, stylesheetRiskContext);

			const fontReference = remoteFontReferenceDeclaration(declaration, remoteFontFaces);
			if (fontReference) pushFindingForDeclaration(findings, rule, selectorAnalysis, fontReference, maxFindings, stylesheetRiskContext);
		}
	}
	return findings;
}

function parseImportUrls(rule: ParsedCssRule) {
	const baseUrl = rule.context.sourceUrl ?? rule.context.pageUrl;
	return extractImportUrls(rule.declarationsText, baseUrl);
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

function hasFontSideChannelContextForRule(
	rule: ParsedCssRule,
	context: StylesheetRiskContext,
	hasContainerQueryContext: boolean,
	hasKeyframesContext: boolean,
): boolean {
	if (!context.hasRemoteFontFace) return false;
	if (hasContainerQueryContext && (context.hasRemoteFontMeasurementSetup || context.hasGeneratedContentFontProbe || context.hasFontImportChain)) return true;
	if (hasKeyframesContext && (context.hasFontAnimationChain || context.hasGeneratedContentFontProbe || context.hasRemoteFontMeasurementSetup)) return true;
	if ((rule.selector.includes("::before") || rule.selector.includes("::after")) && context.hasGeneratedContentFontProbe) return true;
	return false;
}

function fontSideChannelScoreForContext(context: StylesheetRiskContext, hasContainerSizeQueryContext: boolean, hasKeyframesContext: boolean): number {
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

function isContainerSizeQuery(entry: string): boolean {
	return /^@container\b/i.test(entry) && /\b(?:width|height|inline-size|block-size|min-width|max-width|min-height|max-height|cqw|cqh|cqi|cqb|cqmin|cqmax)\b/i.test(entry);
}

function declarationReferencesRemoteFont(declaration: RawDeclaration, fonts: Map<string, RemoteFontFace>): boolean {
	return remoteFontReferenceDeclaration(declaration, fonts) !== null;
}

function isGeneratedContentSelector(selector: string): boolean {
	return /::(?:before|after|marker|first-letter|first-line)\b/i.test(selector);
}

function isGeneratedContentDeclaration(declaration: RawDeclaration): boolean {
	if (declaration.property !== "content") return false;
	const value = declaration.value.trim().toLowerCase();
	return value !== "normal" && value !== "none" && value !== '""' && value !== "''";
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

function pushFindingForDeclaration(
	findings: Finding[],
	rule: ParsedCssRule,
	selectorAnalysis: ReturnType<typeof analyzeSelector> | null,
	declaration: DeclarationInfo,
	maxFindings: number,
	stylesheetRiskContext: StylesheetRiskContext,
): void {
	const declarationRisk = analyzeDeclarationRisk(declaration, rule.type);
	const hasSensitiveSelectorSignals = selectorAnalysis?.isSensitive ?? false;
	const isImportRule = rule.type === "import";
	const isStandaloneFontFace = declarationRisk.isStandaloneFontFace;
	const hasRemoteSink = declarationRisk.hasRemoteSink;
	const hasLocalNetworkSink = declaration.urls.some((url) => url.isLocalNetwork);
	const hasCssOnlyRisk = declarationRisk.hasCssOnlyRisk;
	const hasDeclarationDataProbe = declarationRisk.hasDeclarationDataProbe;
	const hasContainerQueryContext = rule.context.atRuleStack.some((entry) => /^@container\b/i.test(entry));
	const hasKeyframesContext = rule.context.atRuleStack.some((entry) => /^@(?:-webkit-)?keyframes\b/i.test(entry));
	const hasContainerSizeQueryContext = rule.context.atRuleStack.some(isContainerSizeQuery);
	const hasFontSideChannelContext = hasFontSideChannelContextForRule(rule, stylesheetRiskContext, hasContainerQueryContext, hasKeyframesContext);

	if (isStandaloneFontFace) return;
	if (!hasRemoteSink) return;
	if (!isImportRule && !hasCssOnlyRisk && !hasSensitiveSelectorSignals && !hasLocalNetworkSink && !hasDeclarationDataProbe && !hasFontSideChannelContext) return;

	const selectorScore = selectorAnalysis?.score ?? (isImportRule ? 1 : 0);
	const nestedScore = rule.context.atRuleStack.length > 0 ? 1 : 0;
	const declarationProbeScore = hasDeclarationDataProbe ? 4 : 0;
	const fontSideChannelScore = hasFontSideChannelContext ? fontSideChannelScoreForContext(stylesheetRiskContext, hasContainerSizeQueryContext, hasKeyframesContext) : 0;
	const score = selectorScore + declarationRisk.score + nestedScore + declarationProbeScore + fontSideChannelScore;
	if (score < 3) return;

	const reasons = new Set<ReasonCode>([
		...(selectorAnalysis?.reasons ?? []),
		...declarationRisk.reasons,
	]);
	if (rule.context.atRuleStack.length > 0) reasons.add("css.grouping_rule.nested");
	if (hasContainerQueryContext) reasons.add("css.container_query");
	if (hasContainerSizeQueryContext) reasons.add("css.container_size_query");
	if (hasKeyframesContext) reasons.add("css.keyframes_remote_sink");
	if (hasFontSideChannelContext) reasons.add("sink.font_metric_side_channel");
	if (hasFontSideChannelContext && stylesheetRiskContext.hasRemoteFontMeasurementSetup) reasons.add("css.font_measurement_setup");
	if (hasFontSideChannelContext && stylesheetRiskContext.hasGeneratedContentFontProbe) reasons.add("css.font_generated_content_probe");
	if (hasFontSideChannelContext && stylesheetRiskContext.hasFontLigatureFeatures) reasons.add("css.font_ligature_feature");
	if (hasFontSideChannelContext && stylesheetRiskContext.hasFontAnimationChain) reasons.add("css.font_animation_chain");
	if (hasFontSideChannelContext && stylesheetRiskContext.hasFontImportChain) reasons.add("css.font_import_chain");

	const primaryUrl = declaration.urls.find((url) => url.isRemote) ?? declaration.urls[0] ?? null;
	addCappedFinding(
		findings,
		createFinding({
			severity: severityFromScore(score),
			confidence: confidenceFromScore(score),
			pageUrl: rule.context.pageUrl,
			frameUrl: rule.context.frameUrl ?? null,
			sourceKind: rule.context.sourceKind,
			sourceUrl: rule.context.sourceUrl,
			selector: rule.selector,
			property: declaration.property,
			destinationUrl: primaryUrl?.normalized ?? null,
			state: "analysis.complete",
			reasons: [...reasons],
			details: buildFindingDetails(rule, declaration, selectorAnalysis?.isSensitive ?? false),
		}),
		maxFindings,
	);
}

function addCappedFinding(findings: Finding[], candidate: Finding, maxFindings: number): void {
	if (maxFindings <= 0) return;
	if (findings.length < maxFindings) {
		findings.push(candidate);
		return;
	}
	let weakestIndex = 0;
	for (let index = 1; index < findings.length; index += 1) {
		if (compareFindingPriority(findings[index], findings[weakestIndex]) < 0) weakestIndex = index;
	}
	if (compareFindingPriority(candidate, findings[weakestIndex]) > 0) findings[weakestIndex] = candidate;
}

const SEVERITY_PRIORITY = { info: 0, low: 1, medium: 2, high: 3, critical: 4 } as const;

function compareFindingPriority(left: Finding, right: Finding): number {
	const severityDelta = SEVERITY_PRIORITY[left.severity] - SEVERITY_PRIORITY[right.severity];
	if (severityDelta !== 0) return severityDelta;
	const confidenceDelta = left.confidence - right.confidence;
	if (confidenceDelta !== 0) return confidenceDelta;
	return reasonPriority(left) - reasonPriority(right);
}

function reasonPriority(finding: Finding): number {
	let score = 0;
	if (finding.reasons.includes("url.local_network")) score += 3;
	if (finding.reasons.includes("selector.attribute.prefix_match") || finding.reasons.includes("selector.attribute.substring_match") || finding.reasons.includes("selector.attribute.suffix_match")) score += 2;
	if (finding.reasons.includes("css.value.attr_source") || finding.reasons.includes("css.value.conditional_if") || finding.reasons.includes("css.value.style_query")) score += 2;
	if (finding.reasons.includes("sink.font_metric_side_channel") || finding.reasons.includes("css.container_query") || finding.reasons.includes("css.container_size_query") || finding.reasons.includes("css.keyframes_remote_sink")) score += 2;
	if (finding.reasons.includes("css.font_generated_content_probe") || finding.reasons.includes("css.font_ligature_feature") || finding.reasons.includes("css.font_animation_chain") || finding.reasons.includes("css.font_import_chain")) score += 2;
	if (finding.reasons.includes("sink.import_remote")) score += 2;
	if (finding.reasons.includes("sink.remote_url") || finding.reasons.includes("sink.svg_paint_remote")) score += 1;
	return score;
}

interface RemoteFontFace { urls: CssUrlAnalysis[]; hasUnicodeRange: boolean; }

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

function remoteFontReferenceDeclaration(declaration: RawDeclaration, fonts: Map<string, RemoteFontFace>): DeclarationInfo | null {
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

function fontFamilyNames(value: string): string[] {
	return splitTopLevel(value, ",")
		.map((part) => unquoteCssString(part.trim()))
		.map((part) => part.replace(/^(?:normal|italic|oblique|small-caps|bold|bolder|lighter|[0-9]{3}|(?:xx?-)?(?:small|large)|medium)\s+/gi, ""))
		.map((part) => part.trim().toLowerCase())
		.filter(Boolean);
}

function buildFindingDetails(rule: ParsedCssRule, declaration: DeclarationInfo, selectorSensitive: boolean): string {
	const source = rule.type === "style" ? "CSS rule" : rule.type === "font-face" ? "@font-face rule" : "@import rule";
	const sensitivity = selectorSensitive ? " with sensitive selector signals" : declaration.usesAttributeSource || declaration.usesConditionalIf || declaration.usesStyleQuery ? " with declaration-level data-probe signals" : "";
	const urlCount = declaration.urls.filter((url) => url.isRemote).length;
	return `${source}${sensitivity} uses ${declaration.property} with ${urlCount} remote URL sink(s).`;
}

function byteLength(value: string): number {
	if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).length;
	return value.length;
}
