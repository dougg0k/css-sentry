import type { AnalysisSummary, SitePolicy } from "./types";

export const STORAGE_KEYS = {
  settings: "cssSentry:settings",
  dnrStatus: "cssSentry:dnrStatus",
  reportsPrefix: "cssSentry:tabReport:"
} as const;

export const POLICY_LIMITS = {
  maxImportedSettingsBytes: 128_000,
  maxOriginsPerList: 250,
  maxPerOriginModes: 250,
  maxOriginLength: 512,
  minLogRetentionDays: 1,
  maxLogRetentionDays: 90,
} as const;

export const REPORT_LIMITS = {
  maxReportsRetained: 50,
  maxFramesPerReport: 40,
  maxFindingsPerFrame: 250,
  maxFindingsPerReport: 500,
} as const;

export const DEFAULT_SITE_POLICY: SitePolicy = {
  mode: "balanced",
  advancedModeEnabled: false,
  trustedOrigins: [],
  blockedOrigins: [],
  strictOrigins: [],
  allowlistedOrigins: [],
  blocklistedOrigins: [],
  perOriginModes: {},
  logRetentionDays: 14,
  compatibility: {
    enableDnrMitigation: true,
    enableStrictThirdPartyBlocking: true,
    showPartialAnalysisFindings: false,
    enableFirefoxEnhancedMode: false,
    reportExternalSvgImageDocuments: false,
    enableSvgImageDnrPolicy: false,
    enableContentNeutralization: true
  }
};

export const ANALYSIS_LIMITS = {
  maxStyleTextBytes: 512_000,
  maxInlineStyleElements: 2_000,
  maxFindingsPerPage: 500,
  mutationDebounceMs: 400,
  maxAnalysisMsPerDocument: 350,
  maxObservedMutationsPerBatch: 200
} as const;

export const EMPTY_ANALYSIS_SUMMARY: AnalysisSummary = {
  state: "analysis.complete",
  findings: [],
  analyzedStylesheets: 0,
  partialStylesheets: 0,
  analyzedFrames: 0,
  partialFrames: 0,
  startedAt: 0,
  finishedAt: 0
};

export const STRICT_PRESET_LABELS = [
  "webmail",
  "banking",
  "identity provider",
  "password manager",
  "crypto exchange",
  "cloud console",
  "admin panel",
  "CMS dashboard",
  "helpdesk",
  "ticketing system",
  "markdown renderer"
] as const;
