import type { DeclarationInfo, Finding, ParsedCssRule, ReasonCode } from "../../shared/types";
import type { Now } from "../../shared/clock";
import { systemNow } from "../../shared/clock";
import { ANALYSIS_LIMITS } from "../../shared/constants";
import { analyzeDeclaration, collectCustomProperties, mergeCustomProperties, parseDeclarations } from "../css/declarations";
import { createFinding } from "../findings/createFinding";
import { analyzeDeclarationRisk } from "./analyzeDeclaration";
import { analyzeSelector } from "./analyzeSelector";
import { buildFindingDetails } from "./findingDetails";
import { addCappedFinding } from "./findingPriority";
import { confidenceFromScore, severityFromScore } from "./riskScore";
import {
	collectStylesheetRiskContext,
	fontSideChannelScoreForContext,
	hasFontSideChannelContextForRule,
	isContainerSizeQuery,
	parseImportUrls,
	remoteFontReferenceDeclaration,
	type StylesheetRiskContext,
} from "./stylesheetRiskContext";

export interface AnalyzeParsedRulesOptions {
	enforceBudget?: boolean;
	now?: Now;
}

export function analyzeParsedRules(
	rules: ParsedCssRule[],
	maxFindings: number = ANALYSIS_LIMITS.maxFindingsPerPage,
	startedAt = systemNow(),
	options: AnalyzeParsedRulesOptions = {},
): Finding[] {
	const enforceBudget = options.enforceBudget !== false;
	const now = options.now ?? systemNow;
	const findings: Finding[] = [];
	let inheritedCustomProperties = new Map<string, string>();
	const { remoteFontFaces, stylesheetRiskContext } = collectStylesheetRiskContext(rules);

	for (const rule of rules) {
		if (enforceBudget && analysisBudgetExceeded(startedAt, now)) break;
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
			const finding = findingForDeclaration(rule, selectorAnalysis, importDeclaration, stylesheetRiskContext, now);
			if (finding) addCappedFinding(findings, finding, maxFindings);
			continue;
		}

		// Standalone @font-face declarations are common and not CSS exfiltration by themselves.
		// Remote font URLs are considered again only when a sensitive selector conditionally
		// references a remote font-family declared in the same stylesheet.
		if (rule.type === "font-face") continue;

		for (const declaration of declarations) {
			if (enforceBudget && analysisBudgetExceeded(startedAt, now)) break;
			const analyzed = analyzeDeclaration(declaration, rule.context.sourceUrl ?? rule.context.pageUrl, customProperties);
			const finding = findingForDeclaration(rule, selectorAnalysis, analyzed, stylesheetRiskContext, now);
			if (finding) addCappedFinding(findings, finding, maxFindings);

			const fontReference = remoteFontReferenceDeclaration(declaration, remoteFontFaces);
			if (fontReference) {
				const fontFinding = findingForDeclaration(rule, selectorAnalysis, fontReference, stylesheetRiskContext, now);
				if (fontFinding) addCappedFinding(findings, fontFinding, maxFindings);
			}
		}
	}
	return findings;
}

export function analysisBudgetExceeded(startedAt: number, now: Now = systemNow): boolean {
	return now() - startedAt > ANALYSIS_LIMITS.maxAnalysisMsPerDocument;
}

function findingForDeclaration(
	rule: ParsedCssRule,
	selectorAnalysis: ReturnType<typeof analyzeSelector> | null,
	declaration: DeclarationInfo,
	stylesheetRiskContext: StylesheetRiskContext,
	now: Now,
): Finding | null {
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

	if (isStandaloneFontFace) return null;
	if (!hasRemoteSink) return null;
	if (!isImportRule && !hasCssOnlyRisk && !hasSensitiveSelectorSignals && !hasLocalNetworkSink && !hasDeclarationDataProbe && !hasFontSideChannelContext) return null;

	const selectorScore = selectorAnalysis?.score ?? (isImportRule ? 1 : 0);
	const nestedScore = rule.context.atRuleStack.length > 0 ? 1 : 0;
	const declarationProbeScore = hasDeclarationDataProbe ? 4 : 0;
	const fontSideChannelScore = hasFontSideChannelContext ? fontSideChannelScoreForContext(stylesheetRiskContext, hasContainerSizeQueryContext, hasKeyframesContext) : 0;
	const score = selectorScore + declarationRisk.score + nestedScore + declarationProbeScore + fontSideChannelScore;
	if (score < 3) return null;

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
	return createFinding({
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
		timestamp: now(),
	});
}
