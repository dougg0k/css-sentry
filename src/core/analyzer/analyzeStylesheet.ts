import type { AnalysisSummary, DeclarationInfo, Finding, ParsedCssRule, ReasonCode, SourceKind } from "../../shared/types";
import { ANALYSIS_LIMITS } from "../../shared/constants";
import { analyzeDeclaration, collectCustomProperties, mergeCustomProperties, parseDeclarations } from "../css/declarations";
import { extractImportUrls } from "../css/normalizeUrl";
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

		for (const declaration of declarations) {
			if (findings.length >= maxFindings) break;
			const analyzed = analyzeDeclaration(declaration, rule.context.sourceUrl ?? rule.context.pageUrl, customProperties);
			pushFindingForDeclaration(findings, rule, selectorAnalysis, analyzed);
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
	if (!declarationRisk.hasAnyUrlSink && !declaration.usesUnresolvedVar && !declarationRisk.hasCssOnlyRisk) return;

	const hasCrossOriginUrl = declaration.urls.some((url) => url.isCrossOrigin);
	const hasCssOnlyRisk = declarationRisk.hasCssOnlyRisk;
	const hasSensitiveSelectorSignals = selectorAnalysis?.isSensitive ?? false;
	const isNetworkOnlyAtRule = rule.type === "font-face" || rule.type === "import";
	if (!hasCrossOriginUrl && !hasSensitiveSelectorSignals && !declaration.usesUnresolvedVar && !isNetworkOnlyAtRule && !hasCssOnlyRisk) return;

	const selectorScore = selectorAnalysis?.score ?? (isNetworkOnlyAtRule ? 1 : 0);
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
