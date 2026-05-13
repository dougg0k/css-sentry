import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { clearAllReports, parseImportedSitePolicy } from "../../browser/storage/reports";
import { POLICY_LIMITS } from "../../shared/constants";
import type { CompatibilitySettings, ExtensionMode } from "../../shared/types";
import { DefinitionRow, InfoTooltip, ModeOption, OriginListCard, SectionTitle, type OriginListKey } from "./components";
import {
  ADVANCED_MODE_EXPLANATION,
  ADVANCED_SETTINGS_GLOBAL_MODE_ORDER,
  COMPATIBILITY_DEFINITIONS,
  GLOBAL_MODE_ORDER,
  LOGS_EXPLANATION,
  MODE_DEFINITIONS,
  ORIGIN_LIST_DEFINITIONS,
  ORIGIN_MODE_ORDER,
  getModeDefinition,
} from "../../shared/uiMetadata";
import {
  policyWithAddedOrigin,
  policyWithAdvancedMode,
  policyWithCompatibilityFlag,
  policyWithOriginModeOverride,
  policyWithRemovedOrigin,
  policyWithoutOriginModeOverride,
  type OriginModeDraft,
} from "./optionsPolicyActions";
import { useOptionsState } from "./useOptionsState";
import "./style.css";

const DEFAULT_ORIGIN_MODE_DRAFT: OriginModeDraft = { origin: "", mode: "balanced" };

export default function OptionsApp() {
  const { policy, saved, dnrStatus, updatePolicy } = useOptionsState();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [originModeDraft, setOriginModeDraft] = useState<OriginModeDraft>(DEFAULT_ORIGIN_MODE_DRAFT);
  const [importError, setImportError] = useState<string | null>(null);

  const visibleCompatibilityDefinitions = useMemo(() => {
    if (!policy) return [];
    return policy.advancedModeEnabled ? COMPATIBILITY_DEFINITIONS : COMPATIBILITY_DEFINITIONS.filter((definition) => !definition.advanced);
  }, [policy]);

  const visibleOriginDefinitions = useMemo(() => {
    if (!policy) return [];
    return policy.advancedModeEnabled ? ORIGIN_LIST_DEFINITIONS : ORIGIN_LIST_DEFINITIONS.filter((definition) => definition.requiredForMostUsers);
  }, [policy]);

  function addOrigin(list: OriginListKey) {
    if (!policy) return;
    const result = policyWithAddedOrigin(policy, list, drafts[String(list)]);
    if (!result) return;
    void updatePolicy(result.policy);
    setDrafts({ ...drafts, [String(list)]: "" });
  }

  function removeOrigin(list: OriginListKey, origin: string) {
    if (!policy) return;
    void updatePolicy(policyWithRemovedOrigin(policy, list, origin));
  }

  function updateCompatibility(event: ChangeEvent<HTMLInputElement>) {
    if (!policy) return;
    const key = event.currentTarget.name as keyof CompatibilitySettings;
    void updatePolicy(policyWithCompatibilityFlag(policy, key, event.currentTarget.checked));
  }

  function updateAdvancedMode(event: ChangeEvent<HTMLInputElement>) {
    if (!policy) return;
    void updatePolicy(policyWithAdvancedMode(policy, event.currentTarget.checked));
  }

  function addOriginModeOverride() {
    if (!policy) return;
    const result = policyWithOriginModeOverride(policy, originModeDraft);
    if (!result) return;
    void updatePolicy(result.policy);
    setOriginModeDraft(DEFAULT_ORIGIN_MODE_DRAFT);
  }

  function removeOriginModeOverride(origin: string) {
    if (!policy) return;
    void updatePolicy(policyWithoutOriginModeOverride(policy, origin));
  }

  async function exportSettings() {
    if (!policy) return;
    const blob = new Blob([JSON.stringify(policy, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "css-sentry-settings.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importSettings(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      setImportError(null);
      await updatePolicy(parseImportedSitePolicy(await file.text()));
    } catch {
      setImportError("Could not import settings. The selected file is too large, malformed, or outside CSS Sentry policy limits.");
    } finally {
      event.currentTarget.value = "";
    }
  }

  if (!policy) return <main className="page"><p>Loading options…</p></main>;

  const currentMode = getModeDefinition(policy.mode);
  const globalModeOrder = policy.advancedModeEnabled ? ADVANCED_SETTINGS_GLOBAL_MODE_ORDER : GLOBAL_MODE_ORDER;

  return <main className="page">
    <header className="top">
      <p className="eyebrow">CSS Sentry</p>
      <h1>Options</h1>
      <p className="muted">Configure the default protection mode, site-specific rules, compatibility behavior, and local reports.</p>
      {saved ? <span className="saved">Saved</span> : null}
    </header>

    <section className="card" aria-labelledby="default-mode-heading">
      <SectionTitle id="default-mode-heading" title="Default protection mode" tooltip="This is the mode used by sites that do not have their own site-specific override. Balanced is the recommended default." />
      <div className="modeGrid" role="radiogroup" aria-label="Default protection mode">
        {globalModeOrder.map((mode) => {
          const definition = getModeDefinition(mode);
          return <ModeOption
            key={definition.mode}
            selected={policy.mode === definition.mode}
            label={definition.label}
            summary={definition.summary}
            tooltip={`${definition.details} Recommended use: ${definition.recommendedUse}`}
            onClick={() => void updatePolicy({ ...policy, mode: definition.mode })}
          />;
        })}
      </div>
      <p className="muted"><strong>Current default:</strong> {currentMode.label}. {currentMode.summary}</p>
      {!policy.advancedModeEnabled && !GLOBAL_MODE_ORDER.includes(policy.mode)
        ? <p className="warningText">The current default mode is an advanced mode. Enable advanced options in Compatibility and privacy to change or review all available modes.</p>
        : null}
      <details className="detailsBlock">
        <summary>Mode explanations</summary>
        <p className="muted">Passive, Balanced, and Strict cover normal use. Advanced modes exist for compatibility, testing, and explicit edge-case behavior.</p>
        <div className="definitionList">
          {MODE_DEFINITIONS.filter((definition) => definition.mode !== "default").map((definition) => (
            <DefinitionRow
              key={definition.mode}
              title={definition.label}
              body={<div className="definitionBody"><span>{definition.summary}</span><span>{definition.details}</span><span><strong>Use when:</strong> {definition.recommendedUse}</span></div>}
            />
          ))}
        </div>
      </details>
    </section>

    <section className="card" aria-labelledby="origins-heading">
      <SectionTitle id="origins-heading" title="Origin rules" tooltip="Origin rules are site-specific exceptions. Standard view shows common site rules. Advanced mode adds destination lists and exact per-origin overrides." />
      <p className="muted">You do not need to fill every origin list. Add a site only when it needs a persistent exception or stricter protection.</p>
      <div className="grid compactGrid">
        {visibleOriginDefinitions.map((definition) => <OriginListCard key={definition.key} definition={definition} policy={policy} drafts={drafts} setDrafts={setDrafts} addOrigin={addOrigin} removeOrigin={removeOrigin} />)}
      </div>

      {policy.advancedModeEnabled ? <details className="detailsBlock compactDetails">
        <summary>Exact per-origin mode overrides</summary>
        <p className="muted smallText">Advanced control for assigning any supported mode to a specific origin. Popup quick actions are easier for common cases.</p>
        <div className="originInput modeOverrideInput">
          <input
            aria-label="Origin for mode override"
            placeholder="https://example.com"
            value={originModeDraft.origin}
            onChange={(event) => setOriginModeDraft({ ...originModeDraft, origin: event.currentTarget.value })}
          />
          <select aria-label="Mode override" value={originModeDraft.mode} onChange={(event) => setOriginModeDraft({ ...originModeDraft, mode: event.currentTarget.value as ExtensionMode })}>
            {ORIGIN_MODE_ORDER.filter((mode) => mode !== "default").map((mode) => <option key={mode} value={mode}>{getModeDefinition(mode).label}</option>)}
          </select>
          <button onClick={addOriginModeOverride}>Add</button>
        </div>
        <ul className="originList">
          {Object.entries(policy.perOriginModes).sort(([a], [b]) => a.localeCompare(b)).map(([origin, mode]) => <li key={origin}><span>{origin} — {getModeDefinition(mode).label}</span><button onClick={() => removeOriginModeOverride(origin)}>Remove</button></li>)}
        </ul>
        {Object.keys(policy.perOriginModes).length === 0 ? <p className="muted smallText">No exact origin overrides configured.</p> : null}
      </details> : <p className="muted smallText">Enable advanced options in Compatibility and privacy to show never-scan origins, destination allow/block lists, and exact per-origin mode overrides.</p>}
    </section>

    <section className="card" aria-labelledby="compat-heading">
      <SectionTitle id="compat-heading" title="Compatibility and privacy" tooltip="These options control settings visibility, mitigation behavior, and reporting. Defaults avoid unexpected network behavior and keep reports local." />
      <div className={dnrStatus?.ok === false ? "dnrStatus dnrStatusError" : "dnrStatus"} aria-live="polite">
        <strong>{policy.advancedModeEnabled ? "Network rule diagnostics:" : "Network rules:"}</strong> {dnrStatus ? `${dnrStatus.ok ? "OK" : "Needs attention"} — ${dnrStatus.message}` : "No network-rule operation recorded yet."}
      </div>
      <label className="checkCard advancedToggle">
        <input
          name="advancedModeEnabled"
          type="checkbox"
          checked={policy.advancedModeEnabled}
          onChange={updateAdvancedMode}
        />
        <span className="checkText">
          <span className="checkTitle">Show advanced options <InfoTooltip text={ADVANCED_MODE_EXPLANATION} /></span>
          <span className="muted smallText">{policy.advancedModeEnabled ? "Advanced controls are visible." : "Standard view is active. Advanced controls are hidden but preserved."}</span>
        </span>
      </label>
      <p className="muted">The defaults are recommended. Each option has fast help text explaining what it means and when to change it.</p>
      <p className="muted smallText">Privacy invariant: CSS Sentry does not fetch remote stylesheets from the extension context for analysis. It analyzes CSS already exposed through the page, stylesheet APIs, rendered content, or supported browser response-inspection APIs.</p>
      <div className="settingsGrid">
        {visibleCompatibilityDefinitions.map((definition) => (
          <label className="checkCard" key={definition.key}>
            <input name={definition.key} type="checkbox" checked={policy.compatibility[definition.key]} onChange={updateCompatibility} />
            <span className="checkText">
              <span className="checkTitle">{definition.label} <InfoTooltip text={definition.tooltip} /></span>
              <span className="muted smallText">{definition.summary} Recommended: {definition.recommendedValue ? "on" : "off"}. {definition.advanced ? "Advanced option." : ""}</span>
            </span>
          </label>
        ))}
      </div>
      {!policy.advancedModeEnabled ? <p className="muted smallText">Enable advanced options to show experimental compatibility switches and advanced site controls.</p> : null}
    </section>

    <section className="card" aria-labelledby="logs-heading">
      <SectionTitle id="logs-heading" title="Local reports and settings" tooltip={LOGS_EXPLANATION} />
      <p className="muted">{LOGS_EXPLANATION}</p>
      <label className="fieldLabel">Report retention days <input type="number" min={POLICY_LIMITS.minLogRetentionDays} max={POLICY_LIMITS.maxLogRetentionDays} value={policy.logRetentionDays} onChange={(event) => void updatePolicy({ ...policy, logRetentionDays: Number(event.currentTarget.value) })}/></label>
      <div className="actions">
        <button onClick={() => void clearAllReports()}>Clear local reports</button>
        <button onClick={() => void exportSettings()}>Export settings</button>
        <label className="buttonLike">Import settings<input type="file" accept="application/json" hidden onChange={(event) => void importSettings(event)}/></label>
      </div>
      {importError ? <p className="errorText">{importError}</p> : null}
    </section>

    <section className="card">
      <SectionTitle title="Limitations" tooltip="CSS Sentry is a browser-side defense-in-depth layer. It reports coverage gaps when the browser prevents inspection." />
      <p className="muted">CSS Sentry reports partial analysis when the browser prevents inspection of a stylesheet or frame. It does not replace server-side sanitization, CSP, dependency review, or safe rendering of user content.</p>
    </section>
  </main>;
}
