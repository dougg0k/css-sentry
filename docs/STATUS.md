# CSS Sentry — Implementation Status

Last Updated: 2026/05/03 21:36:00 -03

**Status document version:** 1.0.21
**Package audited:** `css_sentry_1.0.21`
**Audit timestamp:** 2026/05/03 21:36:00 -03 (`America/Sao_Paulo`)
**Audience:** maintainers, reviewers, and release decision-makers  
**Related documents:** `README.md`, `docs/SPEC.md`, `docs/CVE_SPEC.md`, `docs/SECURITY.md`, `docs/PRIVACY.md`, `docs/PERMISSIONS.md`, `docs/RELEASE_CHECKLIST.md`, `docs/RELEASE_NOTES.md`, `docs/SELF_SECURITY.md`

## Purpose

`docs/STATUS.md` tracks what is implemented, what is tested, what is partially covered, and what remains before CSS Sentry can honestly move from pre-release packages to the next release candidate and then stable `1.0.0`.

This document is intentionally stricter than the README. Update it whenever implementation behavior, tests, parser coverage, mitigation behavior, UI behavior, privacy behavior, or release readiness changes.

## Status Vocabulary

| Label | Meaning |
|---|---|
| **Covered** | Implementation exists, automated tests cover the behavior, and no known release-blocking gap is identified. |
| **Covered for documented scope** | Implementation and tests cover CSS Sentry’s documented threat model, supported browser model, and current fixture/e2e corpus. This does not claim universal protection against every future CSS feature, browser side channel, sanitizer bug, or site-specific compatibility issue. |
| **Covered by current corpus** | Executable fixtures and tests cover the current known corpus; future CVEs, browser behavior, or user reports may add more fixtures. |
| **Mostly covered** | Main implementation and common tests exist, but edge cases, manual verification, or future corpus expansion remain. |
| **Partial** | Some implementation exists, but the requirement is incomplete or lacks the intended test/runtime coverage. |
| **Not implemented** | No meaningful implementation exists beyond documentation or placeholders. |
| **Not truly tested** | Code or fixtures exist, but the intended runtime/integration behavior is not proven. |
| **Documented only** | Described in docs, but not enforced by code or executable tests. |
| **Manual / policy** | Intentionally handled through manual verification, documentation, or project policy rather than automation. |
| **Out of scope** | Explicitly excluded from v1 or the project threat model. |

## Current Verification Snapshot


`1.0.21` is a large-stylesheet analysis hardening patch built from the passing `1.0.19` source line. It replaces the old size-skip behavior with a complete source scanner for oversized stylesheets, routes those rules through the same selector/declaration analyzer used by normal stylesheets, keeps large benign generated CSS non-actionable, and detects malicious remote imports, remote URL sinks, local/private-network destinations, and nested value-probing selectors even when they appear after large benign padding. It also changes finding collection so the analyzer continues scanning after the report cap is filled and keeps the highest-priority findings instead of stopping at the first capped set. Source URL canonicalization in report merging prevents duplicate stylesheet findings caused only by empty URL fragments.

`1.0.19` is a 250-site sweep-driven false-positive and popup clarity patch. It narrows selector sensitivity scoring for common UI class/data/type selectors, avoids Balanced-mode blocking for common remote font stylesheet imports, keeps unknown remote import sinks covered, adds action-state clarity to the popup, and expands false-positive sweep summary counters.

`1.0.18` is a development-script convenience patch built from the passing `1.0.17` source line. It adds `pnpm run audit:false-positives:all` for the full 250-site false-positive sweep with full report saving enabled, while preserving the existing configurable `audit:false-positives` script.

`1.0.17` is a false-positive sweep and noise-reduction patch built from the passing `1.0.16` source line. It expands the development false-positive sweep corpus to 250 sites, adds per-site report payload saving for actionable sweep results, accepts both package-manager argument forms for the audit script, keeps the root install-hygiene configuration and uploaded lockfile/package metadata synchronized, stops emitting standalone fixed-position `!important` CSS as actionable without an outbound leak path, suppresses same-origin decorative BODY/SVG resource findings, preserves explicit informational coverage notices for cross-origin frames/stylesheets, and keeps the standard partial-analysis compatibility control visible.

`1.0.14` is a runtime PNG asset correction patch built from the passing `1.0.13` source line. It replaces `src/assets/icon.png` with the newly provided corrected PNG after the previous patch inadvertently kept the older asset. It intentionally does not change README content, analyzer, parser, DNR, storage, Firefox enhanced mode, fixtures, e2e, popup, options, or report behavior.

`1.0.13` is a README and runtime PNG asset maintenance patch built from the passing `1.0.12` source line. It replaces the README introduction with the public-store oriented summary and Firefox Add-ons badge, keeps `Last Updated` metadata out of `README.md`, confirms date metadata belongs only in `docs/` documents, and refreshes `src/assets/icon.png` from the latest uploaded PNG asset. It intentionally does not change analyzer, parser, DNR, storage, Firefox enhanced mode, fixture, e2e, popup, options, or report behavior.

`1.0.12` is a release-blocking false-positive correction built from the passing `1.0.11` source line. It changes analyzer and DNR behavior so Balanced mode ignores common presentation-only CSS with no outbound leak path, does not block standalone remote fonts such as reCAPTCHA/Roboto, and keeps partial-analysis details as advanced diagnostics instead of normal findings. New benign regression fixtures cover YouTube-style player CSS, Gmail-like Material CSS, ChatGPT-like UI state CSS, and reCAPTCHA font CSS; a conditional remote-font fixture preserves true font-family exfil coverage. A development-only false-positive sweep script and 250-site seed list let maintainers test common websites, save actionable per-site reports, and cluster noisy report patterns before future releases.

`1.0.11` is an asset-only maintenance patch built from the passing `1.0.10` source line. It replaces `src/assets/icon.png` with the corrected uploaded PNG asset, keeps the SVG asset unchanged, and intentionally does not change analyzer, parser, DNR, storage, UI behavior, fixtures, permissions, or e2e behavior.

`1.0.10` implemented the optional advanced SVG image-document reporting/policy controls, real Firefox enhanced stylesheet response-inspection path, and clearer DNR diagnostics wording. These remain the latest functional changes before the `1.0.11` PNG correction.

`1.0.9` is an asset-only maintenance patch built from the passing `1.0.8` source line. It replaces the runtime SVG and PNG extension assets in `src/assets/` with the newly uploaded versions and intentionally does not change analyzer, parser, DNR, storage, UI behavior, fixtures, or e2e behavior.

`1.0.8` is a documentation-preserving status-wording and historical issue-comment coverage cleanup built from the passing `1.0.7` source line. `1.0.7` was a documentation and focused fixture-coverage patch built from the passing `1.0.6` source line. `1.0.6` was a documentation, asset, and UI-refactoring patch built from the passing `1.0.5` source line. `1.0.5` is a CVE traceability and fixture-coverage patch built from the passing `1.0.4` source line. `1.0.4` was a documentation-only corrective package built from the passing `1.0.3` source line. `1.0.3` corrected the documentation reduction and two test failures introduced during the `1.0.2` corrective pass:

- `cve-2026-35544-roundcube-fixed-position-important.html` did not produce the expected CSS-only actionable finding because css-tree declaration generation had dropped `!important`.
- The first-load destination blocklist e2e setup treated Chromium's notification-message "message port closed before a response was received" condition as fatal before the DNR synchronization poll could run.

`1.0.5` preserves the restored detailed documentation set, adds CVE-2026-40301 executable coverage, and updates project tracking documents additively so the changelog, status coverage, specification requirements, CVE traceability, self-security controls, and release checklist remain consistent.

Required local verification after extracting `1.0.21`:

```bash
pnpm install --frozen-lockfile
pnpm run verify:full
```

Browser artifact generation before public distribution remains optional and should be run only when producing installable browser archives:

```bash
pnpm run zip
pnpm run zip:firefox
```



## 1.0.19 Audit Note — Sweep-Driven Noise Reduction and Action-State UI

- Source line: passing `1.0.18`.
- Primary inputs: 250-site false-positive sweep with full reports.
- Analyzer change: non-secret class/data/type substring/exact selectors no longer become sensitive value-probing signals by themselves. Sensitive value, token, nonce, CSRF, and repeated sensitive probe shapes remain covered.
- Import handling: common font-provider imports from Google Fonts and Adobe Typekit are not Balanced-mode block candidates; unknown remote imports remain actionable and covered by attack fixtures.
- UI change: popup now distinguishes blocked/changed, logged-only, info-only, and coverage findings while keeping the current mode controls and report access.

## 1.0.18 Audit Note — Full False-Positive Sweep Script Alias

- Source line: passing `1.0.17`.
- Added `audit:false-positives:all` to `package.json` as a maintainer shortcut for `node scripts/false-positive-sweep.mjs --limit 250 --save-reports all`.
- No analyzer, parser, DNR, report UI, options UI, fixture, or runtime browser behavior changed.

## 1.0.17 Audit Note — False-Positive Sweep Expansion and Same-Origin Noise Reduction

- Source line: passing `1.0.16`.
- False-positive sweep: `scripts/false-positive-sites.txt` contains 250 common sites; `scripts/false-positive-sweep.mjs` can save full per-site reports with `--save-reports none|actionable|all` and accepts both `pnpm run audit:false-positives -- --limit 250` and `pnpm run audit:false-positives --limit 250`.
- Analyzer behavior: Balanced mode keeps fixed-position `!important` CSS non-actionable unless it has a real outbound leak path, and same-origin decorative BODY/SVG resources are suppressed as actionable findings while cross-origin and local/private-network coverage remains intact.
- Coverage behavior: browser-uninspectable cross-origin frame/stylesheet notices remain explicit informational findings, and the standard partial-analysis compatibility control remains visible.

## 1.0.14 Audit Note — Corrected Runtime PNG Asset Replacement

- Source line: passing `1.0.13`.
- Scope: replace only `src/assets/icon.png` with the newly provided corrected PNG, then track the correction in release/status docs.
- No analyzer, parser, DNR, Firefox enhanced mode, fixture, or UI logic changes were intended.

## 1.0.13 Audit Note — README Metadata and Runtime PNG Asset Maintenance

- Scope: README introduction, README metadata policy, and runtime PNG asset refresh.
- Source line: passing `1.0.12`.
- Corrected documentation policy: `README.md` must not contain `Last Updated` metadata; date metadata belongs only in documents under `docs/`.
- Runtime asset: `src/assets/icon.png` was refreshed from the latest uploaded PNG.
- No analyzer, parser, DNR, storage, Firefox enhanced mode, fixture, e2e, popup, options, or report behavior was intentionally changed.
- Local verification gate remains `pnpm run verify:full`.

## 1.0.12 Audit Note — Balanced False-Positive and DNR Safety Correction

- Scope: analyzer, DNR safety, diagnostics default, and benign fixture regression package.
- Source line: passing `1.0.11`.
- Corrected behavior: Balanced mode now requires an actual outbound leak path or CSS-only security issue before emitting actionable findings.
- Corrected behavior: standalone remote `@font-face` rules are no longer high-confidence block candidates. Selector-driven remote font-family usage remains covered by a dedicated attack fixture.
- Corrected behavior: YouTube-style player CSS, Gmail-like Material CSS, ChatGPT-like app-shell CSS, and reCAPTCHA/Roboto font CSS are benign regression classes.
- Local verification gate remains `pnpm run verify:full`.

## 1.0.11 Audit Note — Corrected Runtime PNG Asset

- Scope: asset-only maintenance package.
- Source line: passing `1.0.10`.
- Changed runtime asset: `src/assets/icon.png`.
- Unchanged runtime behavior: analyzer, parser, DNR, storage, content script, Firefox enhanced stylesheet reporting, popup, options, report UI, permissions, fixtures, and e2e behavior.
- Local verification gate remains `pnpm run verify:full`.

## Current Executive Summary

CSS Sentry is packaged as `1.0.17`, a false-positive sweep expansion and same-origin resource noise-reduction patch. The feature set is sufficient for the v1 threat model; `0.0.32` added the self-security implementation and `0.0.35` made the seven requested safeguards explicit in `docs/SELF_SECURITY.md`.

Implemented and tested areas include:

- Documentation preservation is now a release gate; detailed tracking documents must not be reduced to summaries without explicit user approval and preservation of the removed content.

- WXT + React + TypeScript extension structure.
- Popup, options, and report UI.
- Passive, Balanced, Strict, and advanced modes.
- Advanced UI gating.
- `css-tree` primary parser with lightweight fallback.
- CVE-named and expectation-driven fixtures.
- Browser-runtime e2e for extension page loading, report rendering, same-origin frame merging, cross-origin partial frame coverage, destination blocklist first-load protection, and complex benign/no-breakage pages.
- Destination allow/block DNR policy with exact-origin regular-expression filters.
- Local-only reports.
- Redaction for sensitive selector values, URL credentials, query values, hash values, and token-like path segments.
- Release-readiness documentation under `docs/`.
- Runtime-message schema and sender validation.
- Settings import size/schema/cap hardening.
- DNR status visibility in Options.
- Manifest permission minimization.
- Extension UI injection invariant tests.
- Report/frame/finding storage caps.
- Modern inline-style attack fixtures.

`1.0.8` is the current source package in this handoff. Remaining after `1.0.7`:

- Keep future-watch and manual-policy items below as documented v1 limitations rather than pretending universal coverage.
- Add new fixtures/tests when user reports, new CSS features, or new CVEs justify them.
- Generate Chrome and Firefox distribution artifacts only when publishing or sharing a browser-installable package.
- Cut a patch release only for confirmed bugs, documentation corrections, or compatibility fixes.


## Documentation Role Rules

`docs/RELEASE_NOTES.md` is the changelog home. It should contain release-to-release history, corrective packages, verification notes, and reconstruction boundaries.

`docs/STATUS.md` tracks the current implementation coverage, limitations, verification state, release gate state, and audit notes. It may include audit notes, but it should not be the primary changelog.

`docs/SPEC.md` tracks product requirements, architecture decisions, implementation constraints, historical issue-derived requirements, acceptance criteria, and regression rules. Version-labeled material is allowed only when it preserves requirements or acceptance criteria; release-history-only material belongs in `docs/RELEASE_NOTES.md`.

`docs/CVE_SPEC.md` tracks CVE-derived requirements, fixture mappings, adjacent CVE classes, explicit non-goals, and CVE/advisory release-checklist obligations.

`docs/SELF_SECURITY.md` tracks extension self-security controls and their implementation/test evidence.

Documentation changes must preserve the richest accepted content unless the user explicitly authorizes removal. A document is not considered corrected if it is made shorter by deleting tracking history, coverage evidence, or implementation context.

## Implementation Coverage Index

This index exists so implemented project behavior remains findable in at least one durable document.

| Implemented area | Primary tracking document | Supporting evidence |
|---|---|---|
| WXT + React + TypeScript extension structure | `docs/SPEC.md`; `docs/STATUS.md` | `package.json`, `wxt.config.ts`, project-structure tests |
| Manifest V3 baseline and MV3 limitation language | `README.md`; `docs/SPEC.md`; `docs/PERMISSIONS.md` | `wxt.config.ts`; README browser-support sections |
| Popup, Options, and Report UI | `docs/SPEC.md`; `docs/STATUS.md` | UI unit tests and e2e page exposure tests |
| Passive, Balanced, Strict, paused/trusted, and advanced modes | `docs/SPEC.md`; `docs/STATUS.md` | settings storage, UI tests, e2e report/policy behavior |
| Parser-backed CSS analysis | `docs/SPEC.md`; `docs/CVE_SPEC.md`; `docs/STATUS.md` | `src/core/css/parseCss.ts`; parser and fixture tests |
| Large-stylesheet source scanning | `docs/SPEC.md`; `docs/STATUS.md` | oversized stylesheet attack/benign fixtures and analyzer cap-priority tests |
| Lightweight parser fallback | `docs/SPEC.md`; `docs/STATUS.md` | parser tests and CVE/parser differential fixtures |
| Selector-risk and declaration-risk reason codes | `docs/SPEC.md`; `docs/STATUS.md` | analyzer tests and fixture expectations |
| Exact `[value]` selector handling without `[data-value]` false positive | `docs/SPEC.md`; `docs/STATUS.md` | historical issue criteria and fixture tests |
| Remote URL classification including `;base64,` path/fragment bypass | `docs/SPEC.md`; `docs/CVE_SPEC.md`; `docs/STATUS.md` | analyzer tests and CVE-derived fixtures |
| Data URL classification | `docs/SPEC.md`; `docs/STATUS.md` | analyzer tests |
| CSS custom-property URL sinks and fallback chains | `docs/SPEC.md`; `docs/CVE_SPEC.md`; `docs/STATUS.md` | CVE fixtures and analyzer tests |
| Nested grouping-rule traversal | `docs/SPEC.md`; `docs/CVE_SPEC.md`; `docs/STATUS.md` | nested-rule fixtures |
| Inline-style URL sink coverage | `docs/SPEC.md`; `docs/CVE_SPEC.md`; `docs/SELF_SECURITY.md`; `docs/STATUS.md` | inline-style fixtures and integration tests |
| SVG `<style>` CSS injection coverage | `docs/CVE_SPEC.md`; `docs/SPEC.md`; `docs/STATUS.md` | CVE-2026-40301 SVG style fixtures, SVG paint-property analyzer coverage, and spec-acceptance tests |
| Rendered webmail/helpdesk/markdown/comment fixture coverage | `docs/CVE_SPEC.md`; `docs/STATUS.md` | attack and benign fixture corpus |
| Rendered-resource scanner coverage for BODY background, SVG `feImage`, SVG animation URL-bearing attributes, local-network stylesheet links, and fixed-position `!important` indicators | `docs/SPEC.md`; `docs/CVE_SPEC.md`; `docs/STATUS.md` | CVE-derived rendered-resource fixtures and scanner files |
| Destination blocklist/allowlist DNR policy | `docs/SPEC.md`; `docs/STATUS.md`; `docs/PERMISSIONS.md` | DNR unit tests and first-load e2e |
| DNR status visibility | `docs/SELF_SECURITY.md`; `docs/STATUS.md` | options UI and storage/DNR unit tests |
| Local-only reports and no telemetry | `docs/PRIVACY.md`; `README.md`; `docs/STATUS.md` | storage code, privacy docs |
| Sensitive-value redaction | `docs/SPEC.md`; `docs/PRIVACY.md`; `docs/CVE_SPEC.md`; `docs/STATUS.md` | redaction tests and storage/export sanitization |
| Frame/iframe report merging and partial-coverage notices | `docs/SPEC.md`; `docs/STATUS.md` | e2e frame tests and report UI tests |
| Benign no-breakage e2e corpus | `docs/SPEC.md`; `docs/STATUS.md` | carousel, embedded map, large page, webmail theme, Tailwind-like, CSS Modules-like, and inert code fixtures |
| Runtime-message sender/schema validation | `docs/SELF_SECURITY.md`; `docs/STATUS.md` | runtime-message security unit tests |
| Settings import hardening | `docs/SELF_SECURITY.md`; `docs/STATUS.md` | storage-and-DNR unit tests |
| Permission minimization | `docs/PERMISSIONS.md`; `docs/SELF_SECURITY.md`; `docs/STATUS.md` | manifest and project-structure tests |
| Extension UI injection invariant | `docs/SELF_SECURITY.md`; `docs/STATUS.md` | project-structure sink checks |
| Report/frame/finding storage caps | `docs/SELF_SECURITY.md`; `docs/STATUS.md` | storage and runtime-message tests |
| Documentation regression prevention | `docs/SPEC.md`; `docs/STATUS.md`; `docs/SELF_SECURITY.md`; `docs/RELEASE_CHECKLIST.md` | project-structure documentation-depth tests |
| Security reporting policy | `docs/SECURITY.md`; `README.md` | release checklist and project-structure tests |
| Release checklist and release artifact boundary | `docs/RELEASE_CHECKLIST.md`; `docs/STATUS.md`; `docs/RELEASE_NOTES.md` | package scripts and docs |
| Release history/changelog | `docs/RELEASE_NOTES.md` | reconstructed release history and package notes |
| Historical issue-derived requirements | `docs/SPEC.md`; `docs/STATUS.md` | historical issue matrix, acceptance criteria, and compatibility/non-goal sections |

## Historical Issue Coverage Tracking

The historical issue inventory is not copied for repository branding or unrelated project specifics. It is used as a regression-source inventory: each relevant issue class becomes a requirement, test, manual release check, explicit non-goal, or documented limitation.

Additional issue classes represented by the current document set include:

| Historical issue class | Current tracking / disposition |
|---|---|
| Incidental protection by another content-blocking or local-resource extension | Tracked as compatibility context; CSS Sentry does not claim that another extension's incidental blocking is equivalent protection. |
| User-facing detection alert / notification requests | Tracked as local report, popup, badge, and report UI behavior rather than intrusive alerting. |
| Unverified site-specific false positives | Tracked through benign fixture expansion and user-reported compatibility workflow. |
| Theme/background-image breakage in webmail and complex sites | Tracked through benign webmail theme, background-image redaction/remote-resource handling, and no-breakage e2e fixtures. |
| Default form-control styling disruption | Tracked under breakage-minimization and Firefox manual validation. |
| Cross-domain `@import` relative URL resolution | Tracked under parser/URL normalization and cross-origin partial-state requirements. |
| Production debug logging | Tracked as self-security/privacy/release-hygiene expectation; production packages should not emit noisy debug logs. |
| Firefox tab crash/high CPU and large-page load issues | Tracked under performance budgets, bounded mitigation, and large-page no-breakage tests. |
| uBlock Origin/uMatrix/content-blocker bypass by extension-origin requests | Tracked as a hard requirement: no default extension-context remote CSS fetching. |
| Chrome CORS/MV3 platform changes | Tracked as MV3-first architecture and explicit limitation wording. |
| Missing host permission noise | Tracked as partial/failure state behavior rather than unhandled console noise. |
| `:has()` and value-selector risk | Tracked in threat model and fixture expectations. |
| Inline/internal/external CSS user confusion | Tracked in README risk explanations and source-type handling. |
| Legacy XUL/Pale Moon/Waterfox support requests | Tracked as explicit out-of-scope. |
| Store publication / unofficial distribution questions | Tracked under release checklist and supported-distribution wording. |

## Coverage Matrix

| Area | Current status | Notes |
|---|---:|---|
| Project structure | Covered | WXT + React + TypeScript with non-README docs under `docs/`. |
| Root docs layout | Covered | Root keeps README; SPEC/CVE_SPEC/STATUS/SECURITY/PRIVACY/PERMISSIONS/RELEASE_CHECKLIST live under `docs/`. |
| Core analyzer | Covered for documented scope | Parser, selector risk, sink risk, URL classification, and findings are implemented and tested. |
| Parser hardening | Covered by current corpus | `css-tree` primary parser plus fallback and CVE/parser-differential fixtures. Future CSS syntax can expand fixtures. |
| CVE_SPEC traceability | Covered for current known in-scope set | Named fixtures and docs exist; future CVE monitoring is manual. |
| Fixture expectations | Covered | Fixtures use `.expected.json` metadata. |
| Browser-runtime e2e | Covered for current test plan | Runtime detection/report tests, frame tests, destination blocklist e2e, and complex benign/no-breakage e2e exist. |
| Destination blocklist first-load protection | Covered | Global DNR exact-origin regex policy rules are used before page navigation. |
| Destination allowlist/blocklist precedence | Covered for documented scope | Blocklist priority is higher than allowlist. More edge cases can be added as reports arrive. |
| Redaction/privacy | Covered for documented scope | Strong redaction exists in findings/storage/export paths. Future reports can expand redaction patterns. |
| Frame/iframe behavior | Covered for current supported scope | Same-origin iframe merging, child-frame preservation, cross-origin partial coverage, popup notice, and report frame metadata have tests. |
| No-breakage behavior | Covered by current benign corpus | E2E covers carousel-like UI, embedded-map-like UI, large static pages, benign webmail themes, inert markdown/code blocks, Tailwind-like output, and CSS Modules-like output. |
| Compatibility with other extensions | Manual / policy | Maintainer plans regular usage primarily with Firefox + uBlock Origin. Other extension conflicts are user/community-reported. |
| Firefox baseline | Manual / policy | Firefox build command exists. Manual loading remains part of release validation when publishing artifacts. |
| Release documentation | Covered | `docs/SECURITY.md`, `docs/PRIVACY.md`, `docs/PERMISSIONS.md`, and `docs/RELEASE_CHECKLIST.md` added. |
| Release notes | Covered | `docs/RELEASE_NOTES.md` is the changelog home and tracks reconstructed release history from `0.0.1` through `1.0.4`, with an explicit boundary where per-version evidence is unavailable. |
| Self-security traceability | Covered | `docs/SELF_SECURITY.md` explicitly maps the seven pre-v1 self-security safeguards plus documentation-regression prevention to code, tests, and docs. |
| Extension self-security | Covered | Runtime messages, settings import, UI injection invariants, permission minimization, DNR status, and storage caps are now tested. |
| Modern inline-style and SVG-style fixtures | Covered by current corpus | Current fixtures cover inline `url()`, inline custom-property URL indirection, `image-set(url(...))`, SVG `<style>` `url()` paint sinks, and SVG `<style>` `@import`. Future browser support can expand this corpus. |
| Mixed-case `data:text/css` stylesheet links | Covered by current corpus | `1.0.7` adds Unhead-derived mixed-case data CSS link fixture coverage and scans data CSS stylesheet links without logging raw data URL contents. |
| Escaped CSS `@import` sanitizer bypass class | Covered by current corpus | `1.0.7` adds lxml_html_clean-derived CSS Unicode escape `@import` recovery and fixture coverage. |

## Partial Meaning by Context

| Context | Meaning |
|---|---|
| **Parser robustness** | `css-tree` is primary and fallback parser remains. This is strong enough for v1 scope, but future CSS syntax/bypasses may require new fixtures. |
| **CSS variables** | Direct custom properties and fallback chains are handled best-effort. Full browser-equivalent cascade/computed-value resolution is not claimed. |
| **Nested rules** | Common grouping/nesting cases are walked. Future syntax edge cases can expand the corpus. |
| **Inline styles** | Inline `style=""` URL sinks are scanned, but every known inline-style exfil class is not claimed. |
| **Iframe handling** | Current same-origin and cross-origin partial behavior is tested. Deep/niche embedding cases can be added later. |
| **Strict mode** | Strict policy and DNR hooks exist. Strict can still break sites and is intentionally opt-in. |
| **Compatibility** | Design avoids default extension-origin remote CSS fetching. Broad extension interoperability is handled through reports, not exhaustive pre-v1 testing. |
| **Breakage prevention** | E2E corpus is broad enough for v1 but cannot prove every website. Real-site reports should expand fixtures. |
| **Redaction** | Known sensitive selector/URL patterns are redacted. New token shapes may require future redaction fixtures. |


## Full Search Triage — 1.0.7

This section records the current search triage so future work is not lost. The search covered current CVE/advisory records, the deprecated CSS Exfil Protection issue tracker, and CSS/sanitizer research terms.

| Finding | Decision | Rationale / tracking |
|---|---|---|
| CVE-2026-31873 — Unhead mixed-case `DATA:text/css` link injection | Added | Directly maps to CSS-loaded data stylesheet behavior and CSS attribute-selector exfiltration. `1.0.7` adds fixture and data-stylesheet scanning. |
| CVE-2026-28348 — `lxml_html_clean` CSS Unicode escape bypass for `@import` / `expression()` filters | Added for `@import`; `expression()` remains documented legacy-adjacent | The escaped `@import` class maps to CSS Sentry's remote stylesheet/import detection. Legacy IE `expression()` execution is not a modern browser-extension target, but the advisory stays documented as sanitizer-bypass context. |
| CVE-2026-41305 — PostCSS stringifier does not escape `</style>` | Adjacent / out of scope | CSS Sentry does not parse and re-stringify user CSS into HTML `<style>` tags. The relevant project invariant is already “no extension UI HTML injection.” Track in CVE_SPEC as dependency/tooling adjacent, not a fixture target. |
| CVE-2026-41240 — DOMPurify `FORBID_TAGS` / `ADD_TAGS` inconsistency | Watchlist / conditional | Not CSS-specific by itself. Add fixtures only if a concrete surviving tag path produces CSS remote-resource behavior. |
| CVE-2026-2441 — Chrome CSS use-after-free | Out of scope | Browser engine memory corruption/RCE must be fixed by browser updates. CSS Sentry can document the boundary but cannot remediate engine UAFs. |
| SiYuan / Angular / generic SVG JavaScript-XSS sanitizer CVEs | Mostly out of scope unless CSS remote-resource behavior appears | Existing SVG animate/resource-sink coverage handles CSS-adjacent remote-resource classes. Pure SVG JavaScript execution remains sanitizer/browser/app responsibility. |
| Original CSS Exfil Protection user reports | Covered or tracked | The issue-derived classes remain mapped in `SPEC.md` and `STATUS.md`: brittle string checks, variables, nested rules, first-load behavior, compatibility with blockers, no extension-origin CSS fetching, site breakage, host-permission noise, and anti-detection. |

## SPEC Issue Criteria

| Issue-derived item | Status |
|---|---:|
| `[data-value]` false positive | Covered |
| Remote `;base64,` URL path/fragment bypass | Covered |
| Data URL not treated as remote HTTP(S) | Covered |
| CSS variable URL sink | Covered |
| CSS variable fallback-chain sink | Covered |
| Nested `@media` / `@supports` / grouping rules | Covered |
| `:has()` + sensitive selector | Covered |
| Missing host permission handling | Covered for documented scope |
| Pause/disable avoids modification | Covered for documented scope |
| Large-page loop prevention | Covered for documented scope |
| Cross-origin stylesheet/frame state | Covered for current supported scope |
| No default extension-origin remote CSS fetch | Covered |
| uBO/uBO Lite/NoScript/JShelter compatibility | Manual / policy |
| No fixed old detectable marker | Covered |
| Carousel/map-like benign fixtures | Covered |
| Strict blocks visible/reversible | Covered for documented scope |
| Local fixtures | Covered |

## CVE_SPEC Coverage

| CVE_SPEC item | Current status |
|---|---:|
| CVE-2024-29384 parser/rule-walker class | Covered by current corpus |
| CVE-2024-33436 CSS variables | Covered for direct and fallback-chain cases |
| CVE-2024-33437 nested CSS rules | Covered for current fixture set |
| Comments/escapes/whitespace hiding `url()` / `@import` | Covered by current corpus |
| Remote `;base64,` misclassification | Covered |
| Data URL scheme classification | Covered |
| Rendered webmail/helpdesk/markdown/comment contexts | Covered by current fixture corpus |
| Nonce/token/CSRF probes | Covered for documented scope |
| Sensitive value redaction | Covered for documented scope |
| Same-origin iframe scanning | Covered for current supported scope |
| Cross-origin iframe reporting | Covered for current supported scope |
| README limitations | Covered |
| Release CVE checklist and search log | Manual / policy |

## Milestone Coverage

| Milestone | Current status |
|---|---:|
| Milestone 1 — Core Analyzer | Covered for documented scope |
| Milestone 2 — Browser Baseline | Covered for documented scope |
| Milestone 3 — Mitigation | Covered for documented scope |
| Milestone 4 — Hardening | Covered for documented scope |
| Milestone 5 — Release | Manual / policy for artifact generation |

## Remaining Work Before v1 Candidate

The v1 implementation line has already reached stable patch packages. This section is retained as a release-safety checklist rather than as a claim that `0.0.x` work remains.

Current required steps for `1.0.10`:

1. Run `pnpm run verify:full` locally after extracting the package.
2. Confirm the maintenance patch preserves runtime behavior except for intentional UI-component refactoring.
3. Confirm `docs/RELEASE_NOTES.md` contains the changelog history and does not replace status/specification documents.
4. Confirm `docs/STATUS.md` tracks current coverage and known limitations.
5. Confirm `docs/SPEC.md` still contains requirement detail and historical issue-derived requirements.
6. Confirm `docs/CVE_SPEC.md` still contains CVE-derived traceability and explicit non-goals.
7. Generate browser artifacts only when publishing or sharing an installable browser package.

## Future Feature Candidates

These are candidates after v1. They are not required for v1 unless explicitly moved into scope.

| Candidate | Notes |
|---|---|
| Per-site onboarding prompts | Suggest Strict Mode for sensitive-looking sites, with careful wording. |
| Import/export policy profiles | Useful for power users or teams. |
| Managed enterprise policy | Useful for organizations, not needed for initial release. |
| Optional Firefox enhanced stylesheet response inspection | Implemented as an advanced, off-by-default Firefox-only option. When Firefox exposes `filterResponseData`, CSS Sentry can inspect stylesheet response bodies for reporting while passing the original response through unchanged. Chrome MV3 ignores the option because the required API is unavailable. |
| Public demo/test page | Useful for user trust and bug reporting. |
| Richer report explainability | “Why this was risky,” “what was probed,” “what was blocked,” and “how to fix.” |
| uBlock/uBO rule export | Nice-to-have for advanced users. |
| Site-side remediation guidance | CSP/sanitizer guidance for developers. |
| Versioned community test corpus | Useful post-v1 if bypass reports grow. |
| Badge severity options | Post-v1 UI customization for changing how the extension badge displays severity or counts. The current badge/status behavior is enough for v1; extra badge modes would be preference polish rather than a detection or mitigation improvement. |
| SVG image-document policy handling | Implemented as advanced, off-by-default reporting and Strict-mode destination-policy handling. Inline/rendered SVG DOM content remains fully in scope; externally loaded SVG image-document internals are still not claimed inspectable. |
| Additional sanitizer-specific fixture packs | Active future-watch item, not a blanket out-of-scope item. Add fixtures when an advisory maps to CSS-triggered remote-resource behavior, selector probing, CSS imports, inline style leaks, or rendered-content CSS injection. Keep pure JavaScript-XSS/package-version scanning out of scope. |


## 1.0.21 Exploit-Resistance Review

The large-stylesheet issue was a real bypass risk because a malicious stylesheet could exceed the configured full-parser size threshold and avoid the normal selector/declaration risk pipeline. `1.0.21` changes that threshold from a skip decision into a parser-strategy decision: large stylesheets avoid full AST allocation, but the file is still scanned from start to finish and detected rules are analyzed through the same risk engine as normal CSS.

Additional implementation review findings handled in this patch:

- **Early report-cap termination:** `analyzeParsedRules` previously stopped scanning once `maxFindings` was reached. A padded stylesheet could place lower-priority detections before a later higher-risk rule. The analyzer now keeps scanning and retains the highest-priority findings within the cap.
- **Nested oversized CSS:** large-source scanning now descends into nested rule bodies so nested value-probing selectors do not become a large-file blind spot.
- **Duplicate stylesheet source URLs:** report merging canonicalizes stylesheet source URLs for deduplication so an empty fragment variant such as `file.css#` does not duplicate the same finding as `file.css`.
- **DNR dynamic-rule cap ordering:** finding-based DNR mitigation now sorts high-confidence candidates by severity and high-risk reasons before applying the dynamic rule cap, so later local-network or import candidates are not omitted only because lower-priority candidates appeared first.

Remaining limitations after review:

- Cross-origin stylesheets whose `cssRules` are blocked by the browser remain browser-uninspectable unless a browser-specific response-inspection path is available and explicitly enabled. CSS Sentry reports this as coverage, not as a safe result.
- The analyzer still uses report caps to keep local reports bounded, but scanning continues after the cap and stronger later findings can replace weaker earlier findings.
- The complete source scanner is intentionally simpler than the normal css-tree AST path. It is used for oversized stylesheets to avoid the prior skip behavior while preserving compatibility and avoiding extension-origin remote CSS fetching.

## Features Avoided

These should not be added before v1 because they increase risk, maintenance burden, or user distrust.

| Avoided feature | Reason |
|---|---|
| Cloud analysis | Adds privacy risk and infrastructure burden. |
| Telemetry | Conflicts with local-first privacy posture. |
| Automatic remote CSS fetching by the extension | Can bypass user blockers and recreate old extension compatibility issues. |
| ML-based classification | Hard to audit and not needed for the known threat model. |
| Legacy XUL/Pale Moon/Waterfox Classic support | Out of scope. |
| Broad page rewriting | High breakage risk. |
| Aggressive default blocking on every site | High false-positive and breakage risk. |
| Claiming complete CSS exfil prevention | Not true under browser API and future-CSS limitations. |

## Breakage-Minimization Principle

CSS Sentry should prevent breakage as much as possible while still doing what it is supposed to do.

Practical implications:

- Default to Balanced, not Strict.
- Prefer detection and targeted DNR mitigation over broad CSS rewriting.
- Make Strict explicit and reversible.
- Keep advanced/breakage-prone controls behind advanced mode.
- Use exact-origin destination rules for policy-driven blocking.
- Keep local reports explanatory so users can understand and reverse breakage.
- Treat benign complex-page e2e tests as a release gate before v1.

## Supposed / Known Limitations To Preserve

These limitations are part of the tracked project state and should remain visible unless implementation or browser capabilities change. They are not automatically bugs.

| Limitation | Current decision |
|---|---|
| Complete prevention of every CSS exfiltration technique | Not claimed. CSS Sentry reduces risk for known high-signal classes and keeps fixtures current. |
| Chrome MV3 response-body rewriting | Out of scope for the common Chrome baseline because MV3 does not provide arbitrary stylesheet response rewriting. |
| Cross-origin frame and stylesheet internals | Report partial coverage when the browser prevents inspection. Do not claim full coverage for inaccessible frames/stylesheets. |
| Externally loaded SVG image documents | Inline/rendered SVG `<style>` in the DOM is analyzed. SVG loaded as an image document may not be DOM-inspectable; rely on destination policy where possible and document the boundary. |
| Future CSS syntax and browser behavior | Keep adding fixtures as browser support and research evolve. Parser coverage is strong for current corpus but not a proof of all future CSS. |
| Strict-mode breakage | Strict mode can break sites. It must remain explicit, reversible, and documented. |
| Extension interoperability | Firefox + uBlock Origin regular usage is the current manual baseline; broader extension conflicts are handled by reports unless prioritized. |
| Application-side sanitization | CSS Sentry is defense-in-depth. It does not replace patching vulnerable sanitizers or deploying CSP/output sanitization in applications. |

## Manual Compatibility Stance

The maintainer currently plans to verify normal usage primarily with Firefox and uBlock Origin. Other extension interoperability issues, including uBO Lite, NoScript, JShelter, enterprise policies, and other privacy/security extensions, are expected to be user/community-reported unless later prioritized.

This is acceptable for v1 if documented clearly and if CSS Sentry avoids known harmful behavior such as default extension-origin remote CSS fetching.

## Release Claim Guidance

Acceptable current claim:

> CSS Sentry detects and reduces risk from known high-signal CSS exfiltration patterns, with local reports, parser-backed analysis, and DNR-based mitigation for high-confidence cases and destination policies.

Do not claim:

> CSS Sentry prevents all CSS exfiltration.

For future stable releases, the latest release candidate should pass verification, have no known release-blocking bug, and generate artifacts cleanly before promotion.

## Change Log / Audit Notes

### 2026-04-28 23:55:00 -03 — 1.0.0 stable package

- Promoted the verified `1.0.0-rc.2` line to stable `1.0.0` after the maintainer reported `pnpm run verify:full` passing.
- No analyzer, parser, DNR, runtime-message, storage, popup, options, report, fixture, or e2e behavior was intentionally changed.
- Stable `1.0.0` keeps the v1 claim boundary: CSS Sentry detects and reduces risk from known high-signal CSS-based data exfiltration patterns; it does not claim complete prevention of every CSS side channel or browser-platform limitation.

### 2026-04-28 23:45:00 -03 — 1.0.0-rc.2 release-candidate package

- Promoted the verified `0.0.35` self-security traceability line to `1.0.0-rc.2`.
- No runtime behavior was intentionally changed in this release-candidate packaging pass.
- Stable `1.0.0` depended on `1.0.0-rc.2` passing the full manual gate and usage validation without release-blocking issues.

This section is intentionally kept at the end so historical notes do not interrupt the current roadmap and scope sections.

### 2026-04-28 23:27:52 -03 — 0.0.35 self-security traceability completion

- Added `docs/SELF_SECURITY.md` to explicitly map the seven pre-v1 extension self-security suggestions to implementation, test, and documentation evidence.
- Updated README documentation links and project-structure tests so the self-security traceability document is required under `docs/`.
- Reframed the current package as a pre-RC traceability package rather than a stable release candidate.
- No runtime analyzer, parser, DNR, runtime-message, storage, popup, options, report, fixture, or e2e behavior was intentionally changed.

### 2026-04-28 23:18:30 -03 — 1.0.0-rc.1 release-candidate package

- Promoted the latest passing `0.0.34` state to `1.0.0-rc.1`.
- Added `docs/RELEASE_NOTES.md`.
- Updated README, release checklist, and status documentation for release-candidate validation.
- No runtime analyzer, parser, DNR, runtime-message, storage, popup, options, report, fixture, or e2e behavior was intentionally changed.

### 2026-04-28 23:12:00 -03 — 0.0.34 hidden-input fixture expectation fix

- Fixed hidden-input selector detection for same-compound selectors such as `input[name="csrf_token"][type="hidden"]`.
- Updated `verify:full` to run commands sequentially with semicolons as requested.

### 2026-04-28 23:35:00 -03 — 0.0.32 extension self-security hardening

- Added runtime message shape/sender validation so content scripts cannot trigger privileged settings/report actions.
- Added settings-import schema, size, origin-list, mode, compatibility, and retention caps.
- Added DNR status recording and Options-page visibility for the latest DNR operation.
- Removed unused `activeTab`, `scripting`, and optional host permissions from the manifest.
- Added project-structure tests for UI injection/dynamic-code sinks and manifest permission drift.
- Added report/frame/finding retention caps.
- Added modern inline-style fixtures for inline URL sinks, custom-property URL indirection, and `image-set(url(...))`.

### 2026-04-28 22:55:00 -03 — 0.0.31 release-readiness documentation

- Added `docs/SECURITY.md`, `docs/PRIVACY.md`, `docs/PERMISSIONS.md`, and `docs/RELEASE_CHECKLIST.md`.
- Updated README project-documentation links.
- Updated project-structure tests so security/privacy/permissions/release-checklist docs must live under `docs/` and not at repository root.
- No runtime analyzer, parser, DNR, report UI, popup UI, or options UI behavior was changed.

### 2026-04-28 22:40:00 -03 — 0.0.30 embedded map no-breakage fixture visibility fix

- Fixed the benign embedded map fixture so the map surface has explicit dimensions and accessible content instead of being an empty zero-sized element.
- Strengthened the e2e assertion to verify the map heading, image role, and zoom control remain visible/clickable.

### 2026-04-28 22:30:00 -03 — 0.0.29 e2e TypeScript regex compile fix

- Fixed a TypeScript compile error in `tests/e2e/extension-smoke.spec.ts` caused by an unescaped `https://` inside a regular-expression literal.

### 2026-04-28 22:20:00 -03 — 0.0.28 no-breakage e2e completion

- Added expectation-driven benign fixtures for large static pages, benign webmail themes, Tailwind-like generated output, and CSS Modules-like generated output.
- Expanded browser e2e no-breakage coverage for embedded map-like UI, large static pages, benign webmail theme rendering, Tailwind-like output, and CSS Modules-like output.

### 2026-04-28 21:58:00 -03 — 0.0.27 no-breakage e2e and first-load blocklist stabilization

- Fixed the first-load destination blocklist e2e regression by switching policy DNR matching to exact-origin regular-expression filters and waiting for those filters before navigation.
- Added browser e2e no-breakage checks for benign carousel-style UI and inert rendered markdown/code-block content.

### 0.0.18 through 0.0.26 summary

- Added expectation-driven fixtures.
- Added browser-runtime e2e.
- Added mitigation and destination-policy hardening.
- Moved non-README markdown files into `docs/`.
- Added parser/CVE hardening with `css-tree`.
- Added redaction/privacy hardening.
- Added frame/iframe e2e and reporting completion.

### 2026-04-28 23:08:00 -03 — 0.0.33 compile-safety fix

- Fixed TypeScript narrowing for `css-sentry:clear-current-report` runtime-message validation by copying `message.tabId` into a local `number`-checked variable before constructing the validated runtime message.
- Added a runtime-message security regression test proving `clear-current-report` is accepted only from extension contexts and only with a non-negative integer `tabId`.
- No runtime policy, parser, DNR, UI, or fixture behavior was intentionally changed.

### 2026-04-29 00:58:00 -03 — 1.0.3 documentation restoration and CVE fixture fix

`1.0.3` restores the full detailed documentation set after `1.0.2` incorrectly reduced several tracking documents to shorter summaries.

Corrective actions:

- Restored detailed versions of `docs/SPEC.md`, `docs/CVE_SPEC.md`, `docs/STATUS.md`, `docs/RELEASE_NOTES.md`, `docs/SECURITY.md`, `docs/PERMISSIONS.md`, and `docs/SELF_SECURITY.md` from the last detailed release line.
- Re-applied the newer Roundcube/webmail rendered-resource CVE traceability as additive sections instead of replacing the existing documents.
- Added explicit documentation regression rules: no future change may reduce documentation depth or remove tracking history unless the user explicitly asks and the content is preserved elsewhere.
- Fixed the CVE-2026-35544 fixed-position `!important` fixture path by preserving `!important` when css-tree declarations are converted back into analyzer declaration text.
- Adjusted the e2e policy-update helper so notification-style `css-sentry:policy-updated` messages do not fail solely because Chromium reports that no response payload was sent. The DNR rule polling remains the synchronization authority.

Current local verification requirement:

```bash
pnpm run verify:full
```


### 2026-04-29 03:18:00 -03 — 1.0.4 documentation role and coverage-tracking correction

`1.0.4` is a documentation-only corrective package from the passing `1.0.3` line.

Corrective actions:

- Preserved the restored detailed documentation instead of rewriting it into summaries.
- Expanded `docs/RELEASE_NOTES.md` into the changelog home for reconstructed release history from `0.0.1` through `1.0.4`.
- Added documentation role rules so changelog, status, requirements, CVE traceability, self-security controls, and release checklist obligations have separate homes.
- Added an implementation coverage index so every implemented major capability has at least one durable tracking location.
- Added supplemental historical issue coverage tracking without importing unrelated repository identity as product scope.
- Updated the release checklist and project-structure tests to guard against documentation depth regressions.
- No analyzer, parser, DNR, runtime-message validation, storage/report logic, popup UI, options UI, report UI, fixture, or e2e runtime behavior was intentionally changed.

Current local verification requirement:

```bash
pnpm run verify:full
```


### 2026-04-29 11:35:00 -03 — 1.0.5 CVE-2026-40301 SVG style coverage and tracking update

`1.0.5` adds executable coverage for CVE-2026-40301, a DOMSanitizer SVG `<style>` CSS injection class involving unfiltered `url()` and `@import` directives in rendered SVG content.

Implemented/tracked additively:

- Added SVG `<style>` `url()` and SVG `<style>` `@import` attack fixtures with expectation files.
- Added SVG CSS paint-property remote sink detection for `fill`, `stroke`, and marker properties.
- Updated `docs/CVE_SPEC.md` with CVE-2026-40301 as a rendered SVG / sanitizer-bypass class and documented the externally loaded SVG image boundary.
- Updated `docs/SPEC.md`, `docs/STATUS.md`, `docs/SELF_SECURITY.md`, `docs/RELEASE_CHECKLIST.md`, and `docs/RELEASE_NOTES.md` so todo candidates, post-v1 features, avoided features, and limitations remain tracked rather than erased after implementation.

Verification required after extraction remains:

```bash
pnpm run verify:full
```

### 2026-04-29 11:55:00 -03 — 1.0.6 maintenance, assets, UI refactor, and out-of-scope tracking

`1.0.6` is a maintenance and tracking patch from the passing `1.0.5` line.

Implemented/tracked additively:

- Added `test-results` and `json-report.json` to `.gitignore` so Playwright/Vitest generated output is not accidentally committed.
- Added Chrome Web Store and Firefox Add-ons badge/logo assets under `docs/` for future documentation/store-readiness use without making store submission part of the source-package release gate.
- Refactored popup/options UI components into smaller component modules to keep entrypoints readable and easier to maintain.
- Added clean-code tracking rules: entrypoint files should orchestrate state and page flow; repeated/presentational UI belongs in small components; shared widgets such as tooltips should live under `src/shared/components/`.
- Reclassified many previous `Mostly covered` rows into `Covered for documented scope`, `Covered by current corpus`, or `Manual / policy`. Remaining uncertainty is now tracked as explicit limitations or future-watch work rather than vague partiality.
- Removed store publication artifacts from the implementation coverage matrix. Store submission screenshots/copy are publication operations, not required source-package capabilities.
- Added explicit adjacent-CVE/out-of-scope tracking for sanitizer/SVG JavaScript XSS classes that are relevant for awareness but not direct CSS exfiltration coverage unless they introduce CSS-triggered remote-resource behavior.

Verification required after extraction remains:

```bash
pnpm run verify:full
```


### 2026-04-29 12:35:00 -03 — 1.0.7 search triage, fixture expansion, and status wording cleanup

`1.0.7` is a focused patch from the passing `1.0.6` line.

- Renamed `old avoided-features heading` to `Features Avoided` because the section describes durable non-goals, not only pre-v1 choices.
- Removed automated workflow from implementation/status tracking; manual release gates remain documented where relevant.
- Clarified optional Firefox enhanced mode and badge severity options.
- Reclassified SVG image-document policy handling and sanitizer-specific fixture packs as future-watch items with explicit boundaries.
- Added executable coverage for CVE-2026-31873 mixed-case `DATA:text/css` stylesheet links.
- Added executable coverage for CVE-2026-28348 escaped `@import` sanitizer-bypass class.
- Documented CVE-2026-41305, CVE-2026-41240, CVE-2026-2441, and SVG JavaScript-XSS sanitizer classes as adjacent/out-of-scope/watchlist items according to project scope.

## 1.0.8 Historical Issue Comment Audit and Status Wording Cleanup

`1.0.8` is documentation-preserving. It does not remove or normalize away prior tracking material. It changes stale milestone-specific wording to `Covered for documented scope` while preserving the original conservative intent: coverage is measured against CSS Sentry's documented threat model, supported browser model, and current executable corpus, not against every possible future CSS/browser/sanitizer behavior.

`Mostly covered` remains available only for future rows where implementation exists but the intended test/runtime/documentation evidence is incomplete. Existing rows should be classified more precisely as `Covered for documented scope`, `Covered by current corpus`, `Manual / policy`, `Future-watch`, or `Out of scope`.

### Historical issue-comment coverage ledger

The useful material from the earlier issue tracker is the behavior class, user expectation, reproduction note, linked URL, or design tradeoff. The old project identity is not product scope.

| Issue/comment-derived class | CSS Sentry disposition |
|---|---|
| `indexOf` / substring bugs and `[data-value]` false positives | Covered by parser-backed property/selector handling, benign `[data-value]` fixtures, and no substring-only security decisions. |
| Fixed page-visible extension markers | Covered by absence of the old marker and UI injection/anti-detection invariants. |
| Amazon carousel/load-blocking breakage and icon disabled-state feedback | Covered by no broad page-wide CSS rewriting, per-site modes, advanced scan-only/never-scan controls, no-breakage e2e, and UI mode visibility rules. |
| Inoreader alternate stylesheet breakage | Covered by avoiding old stylesheet disable/re-enable sanitization and using report/DNR-based mitigation. |
| Gmail/background image and default form-control styling disruption | Covered by breakage-minimization requirements and benign theme fixtures; future reports can add focused fixtures. |
| Cross-domain relative `@import` handling after extension-side CSS fetching | Covered by no default extension-context remote CSS fetching and explicit cross-origin limitation tracking. |
| Production debug logging concerns | Covered by local-only reports, redaction, no telemetry, and no production debug logging requirement. |
| Huge pages / high CPU / Firefox tab crash reports | Covered by bounded analysis/storage caps, large-page no-breakage fixtures, and per-site advanced modes. Automated resource-usage switching remains future/likely impractical unless browser APIs make it feasible. |
| uBO/uMatrix/Privacy Badger behind-the-scenes connection reports | Covered by no default extension-origin remote CSS fetching. Broad blocker compatibility remains manual/user-reported. |
| Chrome CORS/MV3 and browser-platform limitations | Covered by MV3-first architecture, DNR-based mitigation, documented Chrome MV3 limits, and optional Firefox enhanced mode kept post-v1. |
| First-load cross-domain leak timing and CanvasBlocker-style interactions | Covered by first-load destination blocklist e2e and global DNR destination policy rules; extension-combination timing remains user-report expandable. |
| `:has()` selector probing and browser/CSP standard ideas | Covered by selector-risk handling; browser standard/CSP changes are outside extension implementation scope. |
| NoScript/JShelter/CanvasBlocker conflicts | Manual / policy. The project avoids known bad patterns but does not certify every extension combination. |
| Inline/internal/external style confusion | Covered by README/SPEC source-type explanations, inline-style fixtures, SVG-style fixtures, and active-style scanning. |
| Embedded map breakage | Covered by embedded-map no-breakage e2e and breakage-minimization policy. |
| Vulnerability disclosure classes: `;base64,`, CSS variables/fallback chains, nested grouping rules | Covered by CVE-named fixtures, css-tree parser hardening, custom-property handling, nested-rule traversal, and expectation-driven tests. |
| Edge/store/unofficial distribution questions | Not source implementation. Publication/support work is not tracked as a source-package gap. |
| DNSSEC for the old test domain | Out of scope for this source package. A future CSS Sentry demo site can track domain security separately. |
| Legacy XUL / Pale Moon / Waterfox Classic support | Out of scope. Current supported build model is modern Chromium/Firefox WebExtensions. |

No new required implementation was identified from the historical issue-comment classes. Remaining work is limited to user-reported regressions, new in-scope CVEs/advisories, future corpus expansion, additional sanitizer-specific fixtures that map to CSS remote-resource behavior, and broader manual compatibility checks if the maintainer chooses to add them.

## 1.0.10 Advanced SVG, Firefox, and Diagnostics Options

`1.0.10` converts several previously documented future-watch items into optional advanced behavior without weakening the default posture. These controls are off by default and visible only with advanced options enabled.

- **External SVG image-document reporting** is implemented as optional partial-coverage reporting for SVG resources loaded through image-like/document-like elements. CSS Sentry still does not claim to inspect the internals of externally loaded SVG image documents.
- **Strict SVG image-document DNR policy** is implemented as an optional Strict-mode network rule for third-party SVG image-document resources. It is separate from broad third-party resource blocking so users can choose a narrower policy.
- **Firefox enhanced stylesheet response inspection** is implemented as an optional Firefox-only response-body inspection path when Firefox exposes `webRequest.filterResponseData`. It writes the original response through unchanged and records findings for reporting; it does not fetch remote CSS from the extension context and does not claim Chrome support.
- **DNR status wording** now uses user-facing network-rule diagnostics language. A zero-rule result means the operation succeeded and no tab-specific network rule was needed for the current page.

These additions keep the default behavior conservative. They are designed for users who explicitly enable advanced compatibility/security controls.
