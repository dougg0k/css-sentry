# Self-Security Hardening Traceability

Last Updated: 2026/06/19 14:14:45 -03

## Purpose

This document tracks extension self-security controls that protect CSS Sentry itself from becoming a weak point while it analyzes attacker-influenced page CSS, selectors, URLs, frame metadata, and local reports.

These controls are not all CSS-detection features. Some protect the extension trust boundary, storage, UI rendering, DNR failure visibility, and configuration import path. The extension UI injection invariant is included for this reason: it is not CSS-specific, but it is required because the UI displays report data derived from potentially hostile CSS and page metadata.

This document is intentionally separate from `docs/CVE_SPEC.md`. `docs/CVE_SPEC.md` tracks CSS/CVE-derived detection requirements. This document tracks extension self-security requirements that are required for the stable v1 package.

## Current Status

All seven pre-v1 self-security suggestions are implemented or explicitly represented in code, tests, and documentation as of `0.0.35`, carried into `1.0.0-rc.2`, included in stable `1.0.0`, and preserved through the current `1.0.86` package. `SS-008` tracks documentation regression prevention after the documentation-reduction issue corrected in `1.0.3` and `1.0.4`.

The stable package still uses the normal local verification gate before publishing or distributing release artifacts.

## Traceability Matrix

| ID | Requirement | Status | Implementation evidence | Test evidence | Notes |
|---|---|---:|---|---|---|
| SS-001 | Privileged runtime-message abuse prevention | Covered | `src/browser/runtime/messageSecurity.ts`; `src/entrypoints/background.ts` validates messages before dispatch. | `tests/unit/browser/runtime-message-security.test.ts` | Content scripts may send scan-complete only. Extension UI contexts are required for privileged policy/report messages. |
| SS-002 | Settings import hardening | Covered | `parseImportedSitePolicy()` and `normalizePolicy()` in `src/browser/storage/reports.ts`; `POLICY_LIMITS` in `src/shared/constants.ts`. | `tests/unit/browser/report-storage.test.ts`; `tests/unit/browser/dnr-rules.test.ts` | Import size, object shape, origin lists, per-origin modes, modes, retention days, and compatibility booleans are capped or normalized. |
| SS-003 | DNR failure-state visibility | Covered | DNR status storage through `STORAGE_KEYS.dnrStatus`; Options UI status display in `src/entrypoints/options/OptionsApp.tsx`. | `tests/unit/browser/report-storage.test.ts`; `tests/unit/browser/dnr-rules.test.ts` | DNR failures should not be silent. Status is local diagnostic state, not telemetry. |
| SS-004 | Permission minimization audit | Covered | `wxt.config.ts`; `docs/PERMISSIONS.md`. | `tests/integration/project-structure.test.ts` | Current v1 manifest permissions are `storage`, `declarativeNetRequest`, `webNavigation`, and host access. `activeTab`, `scripting`, and optional host permissions are intentionally not requested. |
| SS-005 | Extension UI injection invariant | Covered | React UI avoids HTML injection and dynamic-code execution sinks. | `tests/integration/project-structure.test.ts` | This is not CSS-specific. It is included because extension UI renders attacker-influenced report data such as selectors, URLs, and frame metadata. |
| SS-006 | Modern inline-style exfil fixture coverage | Covered by current corpus | Inline-style extraction in fixture tests and analyzer paths. | `tests/fixtures/attacks/inline-style-*.html`; `tests/integration/fixtures.test.ts`; `tests/integration/spec-acceptance.test.ts` | Current coverage includes inline `url()`, inline custom-property URL indirection, `image-set(url(...))`, and SVG `<style>` `url()` / `@import` fixtures for CVE-2026-40301. Future CSS functions can expand the corpus. |
| SS-007 | Report retention and size caps | Covered | `REPORT_LIMITS` in `src/shared/constants.ts`; report capping in `src/browser/storage/reports.ts`; runtime summary capping in `messageSecurity.ts`. | `tests/unit/browser/report-storage.test.ts`; `tests/unit/browser/dnr-rules.test.ts`; `tests/unit/browser/runtime-message-security.test.ts` | Caps limit retained reports, frames per report, findings per frame, findings per report, and oversized runtime summaries. |

## Release Candidate Gate

Before publishing or distributing a release package, run:

```bash
pnpm install --frozen-lockfile
pnpm run verify:full
```

Then generate artifacts only after the gate passes:

```bash
pnpm run zip
pnpm run zip:firefox
```

## Scope Boundary

These safeguards improve the extension's own security posture. They do not change the public claim boundary: CSS Sentry detects and reduces risk from known high-signal CSS-based data exfiltration patterns. It does not claim complete prevention of every CSS side channel, browser platform limitation, future CSS feature abuse, or malicious extension scenario.

## Documentation Regression Safeguard

The seven self-security safeguards must remain traceable in this file. Release work must not replace this document with a shorter summary or remove implementation/test evidence. Any future self-security control must be added as a new traceability item rather than merged into an ambiguous summary.

## SS-008 — Documentation regression prevention

Status: Covered by project-structure test and release checklist.

This control was added after a release-preparation pass incorrectly reduced detailed tracking documents. Documentation is part of the project safety system because it records threat model boundaries, CVE-derived requirements, status labels, limitations, release gates, and self-security expectations.

Required behavior:

- Detailed documents must not be replaced by thin summaries.
- Additive updates are preferred.
- If content is reorganized, the full substantive content must be preserved elsewhere and linked.
- `tests/integration/project-structure.test.ts` must keep minimum documentation-depth checks.


## SS-009 — Tracking and limitation preservation

Status: Covered by documentation requirements and release checklist.

This control records the project decision that implementation history, todo candidates, post-v1 features, avoided features, and known limitations are safety-relevant tracking data. They must not be deleted during cleanup or release preparation.

Evidence:

- `docs/SPEC.md` records the document-tracking role.
- `docs/STATUS.md` records future candidates, avoided features, and known limitations.
- `docs/RELEASE_CHECKLIST.md` requires checks for documentation role and limitation preservation.

## 1.0.6 Additional Self-Security / Maintainability Controls

### SS-010 — UI composition and documentation asset tracking

Status: Covered for documented scope.

Reasoning:

CSS Sentry renders attacker-influenced findings, origins, selectors, frame URLs, and destination metadata inside extension UI. Keeping UI files small and separating repeated presentational components improves reviewability and reduces the chance that future UI changes reintroduce unsafe rendering patterns, duplicate state controls, or unexplained option regressions.

Implementation evidence:

- Shared tooltip primitive: `src/shared/components/InfoTooltip.tsx`.
- Options components: `src/entrypoints/options/components.tsx`.
- Popup components: `src/entrypoints/popup/components.tsx`.
- UI injection invariant remains enforced by project-structure tests.

Documentation evidence:

- `docs/SPEC.md` defines clean code for this project and records the current UI composition rule.
- `docs/STATUS.md` tracks the refactor as part of `1.0.6`.
- `docs/RELEASE_CHECKLIST.md` includes maintenance checks for UI composition and documentation assets.


## SS-011 — Search Triage and Scope Preservation

Status: **Covered by documentation and fixture-growth process**

`1.0.7` adds explicit tracking for search-derived CVE/advisory findings so that newly discovered issues are not silently ignored and are not over-implemented outside the project scope.

Rules:

- Add implementation and fixtures when the issue maps to CSS-triggered remote-resource behavior, selector probing, CSS imports, inline style leaks, SVG CSS paint/resource sinks, or rendered-content CSS injection.
- Track as watchlist when the issue may allow CSS-bearing content but no concrete CSS exfil path is identified.
- Track as out of scope when the issue is JavaScript-only XSS, browser-engine memory corruption, package-version scanning, or publication process work.
- Do not erase future candidates or non-goals during documentation cleanup.

## 1.0.8 — Status and historical tracking preservation

The documentation self-security rule also applies to status labels and historical issue-derived requirements. Cleanup must not remove tracked behavior classes, user-reported breakage classes, privacy tradeoffs, or explicit non-goals. If wording changes from milestone-specific coverage wording to `Covered for documented scope`, it is a clarification only and must not be used to reduce fixture, e2e, CVE, or compatibility tracking.

## SS-012 — Advanced optional feature containment

Advanced optional features must be off by default, documented, tested, and scoped narrowly. SVG image-document reporting must not claim full internal inspection. Firefox enhanced stylesheet response inspection must not fetch remote CSS from the extension context, must pass responses through unchanged, and must leave browsing behavior unchanged when unsupported.


## 1.0.15 Install-Hygiene Note

`pnpm-workspace.yaml` is intentionally kept at the repository root to record approved pnpm build dependencies used by the toolchain. Development false-positive sweep reports are generated under `test-results/` and remain excluded from source and runtime packages.

## SS-013 — Large Stylesheet Analysis Bypass Prevention

CSS Sentry must not treat large available stylesheet text as safe or unscanned merely because it exceeds the normal parser size threshold. Large stylesheet handling must continue to inspect the source, route recovered rules through the normal risk analyzer, and retain high-priority findings even when report caps are reached.


## SS-010 — Raw mitigation URL isolation

Status: Covered by `1.0.22` DNR and storage changes.

Finding-derived DNR mitigation requires the raw request URL because redacted report URLs cannot safely or precisely match browser requests. `Finding.requestUrl` is therefore internal mitigation state, not report data. Storage/export sanitization must clear it, while DNR rule generation may use it before storage. This prevents two failure classes: underblocking caused by redacted request paths and overblocking caused by replacing precise rules with hostname-wide rules.


## SS-011 — Verification contract preservation

Status: Covered by `1.0.23` verification fixes and release checklist update.

CSS Sentry's UI action-state wording and e2e report assertions are part of the verification contract because they determine whether maintainers can distinguish logged-only findings from requests that were actually blocked. Verification fixes must preserve the implemented security behavior and correct the failing invariant directly instead of weakening the relevant tests.

## SS-011 — DNR action-state truthfulness

Status: Covered by `1.0.24` action-state correction, popup/report wording, false-positive sweep counters, and e2e timing regression coverage.

CSS Sentry must not claim a request was blocked merely because a finding-derived DNR rule was installed after analysis. `blocked_dnr` is reserved for already-active prevention semantics. Finding-derived post-analysis mitigation uses `rule_installed_dnr`, which tells the user that a precise rule was installed after analysis without claiming current-load prevention. Older local reports that contain `future_blocked_dnr` retain the same installed-rule semantics when displayed. This avoids misleading security status on fast-loading POC pages and development builds where CSS-triggered requests can occur before analysis completes.


## SS-013 — Declaration-Level Inline CSS Exfiltration Coverage

Status: Covered by `1.0.27` analyzer and fixture coverage.

CSS Sentry must recognize inline-style exfiltration where the sensitive data source and branch condition are inside declaration values rather than selectors. The analyzer tracks `attr()`, `if()`, and `style(...)` signals, including custom-property style queries that reference an `attr()`-derived custom property. It must only create actionable findings when these signals are paired with a network-capable sink such as `url()` or `image-set()`; presentation-only usage remains non-actionable.

Evidence: `tests/fixtures/attacks/inline-style-attr-if-url.html`, `tests/fixtures/attacks/inline-style-attr-if-image-set-string.html`, `tests/fixtures/attacks/inline-style-nested-if-chain-url.html`, `tests/fixtures/benign/benign-inline-attr-presentation.html`, `tests/unit/core/analyzer.test.ts`, and `tests/integration/fixtures.test.ts`.

## SS-014 — Font Side-Channel Scope Boundary

Status: Partially covered by targeted `1.0.27` fixtures and bounded as a documented side-channel class.

CSS Sentry must not block ordinary remote fonts by default. It must, however, retain focused coverage for font request oracles and modeled Fontleak-style shapes where remote fonts combine with container queries or keyframes that trigger remote URL sinks. Full prevention of every crafted-font, ligature, metric, container-query, animation, or generated-content text extraction technique is not claimed. Future coverage must remain fixture-driven and must avoid broad blocking of normal webfont usage.

Evidence: `tests/fixtures/attacks/font-face-unicode-range-sensitive.css`, `tests/fixtures/attacks/fontleak-container-query-url.css`, `tests/fixtures/attacks/fontleak-keyframes-url.css`, `tests/fixtures/attacks/fontleak-static-ligature-container.css`, `tests/fixtures/attacks/fontleak-import-chain-container.css`, `tests/fixtures/attacks/fontleak-font-chaining-animation.css`, `tests/fixtures/benign/benign-font-face-unicode-range.css`, `tests/fixtures/benign/benign-remote-font-container-card.css`, `tests/fixtures/benign/benign-ligature-webfont-no-network-sink.css`, and `tests/fixtures/benign/recaptcha-remote-font-face.css`.


## SS-015 — Bounded content neutralization

Status: Covered by implementation and unit tests.

Content-level neutralization is a page-changing mitigation, so it must remain bounded. It may only inject override CSS for confirmed high-confidence CSS exfil findings with a concrete selector, network-capable CSS property, request-producing sink, and data-probe evidence. It must not rewrite arbitrary stylesheet content, must not apply to redacted selectors, must remain controlled by a compatibility setting, and must not use a fixed page-visible element ID, class, data attribute, or global marker for the injected neutralization style.

Evidence:

- `src/browser/scanner/contentNeutralization.ts` implements the bounded neutralization rules.
- `src/entrypoints/content.ts` applies the neutralization result before sending the scan report.
- `tests/unit/browser/content-neutralization.test.ts` covers neutralization, disabled-setting cleanup, fixed-marker avoidance, and redacted-selector refusal.

## SS-016 — Viewport-contained popup help

Status: Covered by implementation and UI test.

Popup help text must remain readable inside the extension popup viewport. Tooltip content is rendered through a document-level portal and clamped to the visible viewport instead of being clipped inside local card layout.

Evidence:

- `src/shared/components/InfoTooltip.tsx` implements root-level fixed-position tooltip placement.
- `src/entrypoints/popup/style.css` and `src/entrypoints/options/style.css` provide the viewport-clamped tooltip styles.
- `tests/unit/ui/popup-options.test.tsx` verifies the tooltip is rendered through the document-level portal.


## SS-015 — Advisory Intake and Optional-Path Regression Control

CSS Sentry must not add advisory coverage as package-version scanning. Advisory-derived work is valid only when it produces browser-observable CSS request behavior, selector/value probing, rendered-content CSS injection, SVG resource loading, or a modeled CSS side channel. Optional implementation paths must preserve the same core security invariants as the baseline path. In particular, Firefox enhanced stylesheet response inspection must not silently skip large stylesheet bodies when the baseline stylesheet analyzer would inspect them with the large-source scanner. Popup and Options explanatory controls must remain usable through both hover/focus and click/touch interactions because security-state explanations are part of the user-facing trust boundary.


## 1.0.45 Stream and Budget Safety Update

Firefox enhanced stylesheet response inspection must preserve page behavior when stream filtering fails. Write failures disconnect the optional filter and suppress analysis for that response rather than throwing through the browser event path. Parser and analyzer budget enforcement must produce partial coverage instead of unbounded processing.
