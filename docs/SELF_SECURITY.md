# Self-Security Hardening Traceability

Last Updated: 2026/05/03 21:36:00 -03

## Purpose

This document tracks extension self-security controls that protect CSS Sentry itself from becoming a weak point while it analyzes attacker-influenced page CSS, selectors, URLs, frame metadata, and local reports.

These controls are not all CSS-detection features. Some protect the extension trust boundary, storage, UI rendering, DNR failure visibility, and configuration import path. The extension UI injection invariant is included for this reason: it is not CSS-specific, but it is required because the UI displays report data derived from potentially hostile CSS and page metadata.

This document is intentionally separate from `docs/CVE_SPEC.md`. `docs/CVE_SPEC.md` tracks CSS/CVE-derived detection requirements. This document tracks extension self-security requirements that are required for the stable v1 package.

## Current Status

All seven pre-v1 self-security suggestions are implemented or explicitly represented in code, tests, and documentation as of `0.0.35`, carried into `1.0.0-rc.2`, included in stable `1.0.0`, and preserved through the current `1.0.5` CVE traceability patch. `SS-008` tracks documentation regression prevention after the documentation-reduction issue corrected in `1.0.3` and `1.0.4`.

The stable package still uses the normal local verification gate before publishing or distributing release artifacts.

## Traceability Matrix

| ID | Requirement | Status | Implementation evidence | Test evidence | Notes |
|---|---|---:|---|---|---|
| SS-001 | Privileged runtime-message abuse prevention | Covered | `src/browser/runtime/messageSecurity.ts`; `src/entrypoints/background.ts` validates messages before dispatch. | `tests/unit/browser/runtime-message-security.test.ts` | Content scripts may send scan-complete only. Extension UI contexts are required for privileged policy/report messages. |
| SS-002 | Settings import hardening | Covered | `parseImportedSitePolicy()` and `normalizePolicy()` in `src/browser/storage/reports.ts`; `POLICY_LIMITS` in `src/shared/constants.ts`. | `tests/unit/browser/storage-and-dnr.test.ts` | Import size, object shape, origin lists, per-origin modes, modes, retention days, and compatibility booleans are capped or normalized. |
| SS-003 | DNR failure-state visibility | Covered | DNR status storage through `STORAGE_KEYS.dnrStatus`; Options UI status display in `src/entrypoints/options/OptionsApp.tsx`. | `tests/unit/browser/storage-and-dnr.test.ts` | DNR failures should not be silent. Status is local diagnostic state, not telemetry. |
| SS-004 | Permission minimization audit | Covered | `wxt.config.ts`; `docs/PERMISSIONS.md`. | `tests/integration/project-structure.test.ts` | Current v1 manifest permissions are `storage`, `declarativeNetRequest`, `webNavigation`, and host access. `activeTab`, `scripting`, and optional host permissions are intentionally not requested. |
| SS-005 | Extension UI injection invariant | Covered | React UI avoids HTML injection and dynamic-code execution sinks. | `tests/integration/project-structure.test.ts` | This is not CSS-specific. It is included because extension UI renders attacker-influenced report data such as selectors, URLs, and frame metadata. |
| SS-006 | Modern inline-style exfil fixture coverage | Covered by current corpus | Inline-style extraction in fixture tests and analyzer paths. | `tests/fixtures/attacks/inline-style-*.html`; `tests/integration/fixtures.test.ts`; `tests/integration/spec-acceptance.test.ts` | Current coverage includes inline `url()`, inline custom-property URL indirection, `image-set(url(...))`, and SVG `<style>` `url()` / `@import` fixtures for CVE-2026-40301. Future CSS functions can expand the corpus. |
| SS-007 | Report retention and size caps | Covered | `REPORT_LIMITS` in `src/shared/constants.ts`; report capping in `src/browser/storage/reports.ts`; runtime summary capping in `messageSecurity.ts`. | `tests/unit/browser/storage-and-dnr.test.ts`; `tests/unit/browser/runtime-message-security.test.ts` | Caps limit retained reports, frames per report, findings per frame, findings per report, and oversized runtime summaries. |

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

Advanced optional features must be off by default, documented, tested, and scoped narrowly. SVG image-document reporting must not claim full internal inspection. Firefox enhanced stylesheet response inspection must not fetch remote CSS from the extension context, must pass responses through unchanged, and must fail closed to no extra behavior when unsupported.


## 1.0.15 Install-Hygiene Note

`pnpm-workspace.yaml` is intentionally kept at the repository root to record approved pnpm build dependencies used by the toolchain. Development false-positive sweep reports are generated under `test-results/` and remain excluded from source and runtime packages.

## SS-013 — Large Stylesheet Analysis Bypass Prevention

CSS Sentry must not treat large available stylesheet text as safe or unscanned merely because it exceeds the normal parser size threshold. Large stylesheet handling must continue to inspect the source, route recovered rules through the normal risk analyzer, and retain high-priority findings even when report caps are reached.
