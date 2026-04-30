import type { AnalysisSummary, CssUrlAnalysis, DeclarationInfo, Finding, ParsedCssRule, ReasonCode, SourceKind } from "../../shared/types";
import { ANALYSIS_LIMITS } from "../../shared/constants";
import { analyzeDeclaration, collectCustomProperties, mergeCustomProperties, parseDeclarations, type RawDeclaration } from "../css/declarations";
import { extractImportUrls } from "../css/normalizeUrl";
import { splitTopLevel, unquoteCssString } from "../css/text";
import { parseCss } from "../css/parseCss";
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
	if (byteLength(input.cssText) > ANALYSIS_LIMITS.maxStyleTextBytes) {
		return {
			state: "analysis.skipped.too_large",
			findings: [
				createFinding({
					severity: "info",
					confidence: 100,
					pageUrl: input.pageUrl,
					frameUrl: input.frameUrl ?? null,
					sourceKind: input.sourceKind,
					sourceUrl: input.sourceUrl,
					state: "analysis.skipped.too_large",
					reasons: ["analysis.skipped.too_large"],
					details: "Stylesheet exceeded the configured analysis size limit.",
				}),
			],
			analyzedStylesheets: 0,
			partialStylesheets: 1,
			analyzedFrames: 0,
			partialFrames: 0,
			startedAt,
			finishedAt: Date.now(),
		};
	}

	const rules = parseCss(input);
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

export function analyzeParsedRules(rules: ParsedCssRule[], maxFindings: number = ANALYSIS_LIMITS.maxFindingsPerPage): Finding[] {
	const findings: Finding[] = [];
	let inheritedCustomProperties = new Map<string, string>();
	const remoteFontFaces = collectRemoteFontFaces(rules);

	for (const rule of rules) {
		if (findings.length >= maxFindings) break;
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
			pushFindingForDeclaration(findings, rule, selectorAnalysis, importDeclaration);
			continue;
		}

		// Standalone @font-face declarations are common and not CSS exfiltration by themselves.
		// Remote font URLs are considered again only when a sensitive selector conditionally
		// references a remote font-family declared in the same stylesheet.
		if (rule.type === "font-face") continue;

		for (const declaration of declarations) {
			if (findings.length >= maxFindings) break;
			const analyzed = analyzeDeclaration(declaration, rule.context.sourceUrl ?? rule.context.pageUrl, customProperties);
			pushFindingForDeclaration(findings, rule, selectorAnalysis, analyzed);

			const fontReference = remoteFontReferenceDeclaration(declaration, remoteFontFaces);
			if (fontReference) pushFindingForDeclaration(findings, rule, selectorAnalysis, fontReference);
		}
	}
	return findings;
}

function parseImportUrls(rule: ParsedCssRule) {
	const baseUrl = rule.context.sourceUrl ?? rule.context.pageUrl;
	return extractImportUrls(rule.declarationsText, baseUrl);
}

function pushFindingForDeclaration(
	findings: Finding[],
	rule: ParsedCssRule,
	selectorAnalysis: ReturnType<typeof analyzeSelector> | null,
	declaration: DeclarationInfo,
): void {
	const declarationRisk = analyzeDeclarationRisk(declaration, rule.type);
	const hasSensitiveSelectorSignals = selectorAnalysis?.isSensitive ?? false;
	const isImportRule = rule.type === "import";
	const isStandaloneFontFace = declarationRisk.isStandaloneFontFace;
	const hasRemoteSink = declarationRisk.hasRemoteSink;
	const hasLocalNetworkSink = declaration.urls.some((url) => url.isLocalNetwork);
	const hasCssOnlyRisk = declarationRisk.hasCssOnlyRisk;

	if (isStandaloneFontFace) return;
	if (!hasRemoteSink) return;
	if (!isImportRule && !hasCssOnlyRisk && !hasSensitiveSelectorSignals && !hasLocalNetworkSink) return;

	const selectorScore = selectorAnalysis?.score ?? (isImportRule ? 1 : 0);
	const nestedScore = rule.context.atRuleStack.length > 0 ? 1 : 0;
	const score = selectorScore + declarationRisk.score + nestedScore;
	if (score < 3) return;

	const reasons = new Set<ReasonCode>([
		...(selectorAnalysis?.reasons ?? []),
		...declarationRisk.reasons,
	]);
	if (rule.context.atRuleStack.length > 0) reasons.add("css.grouping_rule.nested");

	const primaryUrl = declaration.urls.find((url) => url.isRemote) ?? declaration.urls[0] ?? null;
	findings.push(
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
	);
}

function collectRemoteFontFaces(rules: ParsedCssRule[]): Map<string, CssUrlAnalysis[]> {
	const fonts = new Map<string, CssUrlAnalysis[]>();
	for (const rule of rules) {
		if (rule.type !== "font-face") continue;
		const declarations = parseDeclarations(rule.declarationsText);
		const fontFamily = declarations.find((declaration) => declaration.property === "font-family");
		const src = declarations.find((declaration) => declaration.property === "src");
		if (!fontFamily || !src) continue;
		const analyzedSrc = analyzeDeclaration(src, rule.context.sourceUrl ?? rule.context.pageUrl, new Map());
		const remoteUrls = analyzedSrc.urls.filter((url) => url.isRemote);
		if (remoteUrls.length === 0) continue;
		for (const family of fontFamilyNames(fontFamily.value)) {
			const existing = fonts.get(family) ?? [];
			fonts.set(family, [...existing, ...remoteUrls]);
		}
	}
	return fonts;
}

function remoteFontReferenceDeclaration(declaration: RawDeclaration, fonts: Map<string, CssUrlAnalysis[]>): DeclarationInfo | null {
	if (fonts.size === 0 || !(declaration.property === "font-family" || declaration.property === "font")) return null;
	const urls: CssUrlAnalysis[] = [];
	for (const family of fontFamilyNames(declaration.value)) {
		const matches = fonts.get(family);
		if (matches) urls.push(...matches);
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
	const sensitivity = selectorSensitive ? " with sensitive selector signals" : "";
	const urlCount = declaration.urls.filter((url) => url.isRemote).length;
	return `${source}${sensitivity} uses ${declaration.property} with ${urlCount} remote URL sink(s).`;
}

function byteLength(value: string): number {
	if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).length;
	return value.length;
}
