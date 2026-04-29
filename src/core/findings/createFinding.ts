import type { Finding, MitigationAction, ReasonCode, Severity, SourceKind, AnalysisState } from "../../shared/types";
import { getOrigin, stableHash } from "../../shared/url";
import { redactSensitiveText, redactSensitiveUrl } from "../privacy/redaction";

interface CreateFindingInput {
  severity: Severity;
  confidence: number;
  pageUrl: string;
  frameUrl?: string | null;
  sourceKind: SourceKind;
  sourceUrl: string | null;
  selector?: string | null;
  property?: string | null;
  destinationUrl?: string | null;
  action?: MitigationAction;
  state: AnalysisState;
  reasons: ReasonCode[];
  details: string;
}

export function createFinding(input: CreateFindingInput): Finding {
  const timestamp = Date.now();
  const stablePayload = [input.pageUrl, input.frameUrl ?? "", input.sourceUrl ?? "", input.selector ?? "", input.property ?? "", input.destinationUrl ?? "", input.reasons.join(",")].join("|");
  return {
    id: `finding-${stableHash(stablePayload)}-${timestamp}`,
    severity: input.severity,
    confidence: input.confidence,
    pageUrl: input.pageUrl,
    pageOrigin: getOrigin(input.pageUrl),
    frameUrl: input.frameUrl ?? null,
    frameOrigin: getOrigin(input.frameUrl ?? input.pageUrl),
    sourceKind: input.sourceKind,
    sourceUrl: input.sourceUrl,
    sourceOrigin: getOrigin(input.sourceUrl),
    selector: input.selector ? redactSensitiveText(input.selector, 140) : null,
    property: input.property ?? null,
    destinationOrigin: getOrigin(input.destinationUrl),
    destinationUrl: redactSensitiveUrl(input.destinationUrl),
    action: input.action ?? "logged",
    state: input.state,
    reasons: [...new Set(input.reasons)],
    timestamp,
    details: redactSensitiveText(input.details, 240)
  };
}
