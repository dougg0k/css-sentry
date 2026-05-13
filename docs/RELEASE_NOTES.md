# Release Notes

Last Updated: 2026/05/13 01:54:22 -03

## 1.0.34 — Hono Inline-Style and Tandoor Stored-Style Advisory Coverage

Added executable advisory coverage for the remaining post-`1.0.33` traceability gaps. Hono CVE-2026-44458 is now represented by a rendered JSX SSR inline-style fixture that combines declaration-level `attr(value)` / `if(style(...))` probing with string-form `image-set(...)` remote sinks, plus a benign Hono-style presentation fixture that exercises the same declaration-level functions without a URL-bearing sink.

Completed fixture-backed coverage for Tandoor CVE-2026-35046. The new attack fixture represents stored recipe/rich-text `<style>` content that probes hidden CSRF state and reaches a remote `background-image` sink. The paired benign fixture preserves normal recipe presentation CSS as non-actionable.

PostCSS CVE-2026-41305 remains adjacent/out of scope for implementation because CSS Sentry does not stringify user CSS into HTML `<style>` tags. The existing extension-UI injection invariant and browser-visible CSS request scanner remain the relevant project boundaries.

## 1.0.33 — Postponed Advisory Coverage, Firefox Enhanced Large-CSS Inspection, and Tooltip Hover Correction

Added the postponed advisory coverage and implementation fixes after the `1.0.32` neutralization/DNR composition release. CSS Sentry now tracks Mermaid CSS-injection classes for scope escape and classDef-style breakout, justhtml custom-policy sanitizer bypass classes for preserved style/SVG resource behavior, and the XWiki CSS-injection exfiltration subset. These are represented by executable fixtures rather than package-version scanning. Pure JavaScript XSS, package vulnerability scanning, and UI-redress-only behavior remain outside CSS Sentry enforcement unless the CSS also produces selector/value-probing network exfiltration.

Fixed the Firefox enhanced stylesheet inspection path so oversized stylesheet responses are no longer discarded after the standard parser size threshold. The response is still passed through unchanged, and the collected stylesheet body is analyzed by the normal stylesheet analyzer, which chooses the large-source scanner when needed. This keeps the optional Firefox response-inspection feature aligned with the large-stylesheet full-source scanning invariant added earlier.

Corrected the viewport-clamped tooltip interaction. Tooltip content remains rendered at document root and clamped inside the popup viewport, but hover is again immediate and stable. Clicking the `?` now opens the tooltip without toggling it closed under the pointer, while outside click and Escape still close it.

## 1.0.32 — Neutralization/DNR Composition and E2E Regression Corrections

Corrected the interaction between content-level neutralization and finding-derived DNR rules. A high-confidence finding can now preserve `neutralized` as its primary page-changing action while also recording `rule_installed_dnr` as an additional mitigation action. This prevents the report from losing either part of the mitigation: CSS Sentry can show that page-visible CSS was neutralized and that a precise DNR rule was installed for reloads or later matching requests.

Updated popup, report, and false-positive sweep counting so a finding with both page neutralization and installed-rule mitigation is counted once as mitigated, counted as page-changing where relevant, and still visible as having an active precise DNR rule. This avoids double-counting and keeps the report text compatible with the DNR timing distinction added in earlier releases.

Corrected the e2e expectations introduced by content neutralization. Tests now distinguish the original page style from the CSS Sentry neutralization style instead of assuming only one `style` element can exist, and the same-origin POC mitigation test can observe the installed DNR rule even when neutralization is also active.

## 1.0.31 — Content Neutralization and Popup Tooltip Containment

Added an optional content-level CSS neutralization layer for confirmed high-confidence CSS exfil findings. When enabled, CSS Sentry injects precise override rules for network-capable CSS declarations that also have selector, declaration-level, or modeled font side-channel evidence. This makes page-visible computed styles neutral for safely targetable findings, instead of relying only on DNR request mitigation. The option is enabled by default and can be disabled from Compatibility and privacy if a site has a compatibility issue.

The neutralization path is intentionally bounded. It applies only to high or critical findings with a selector, a network-capable CSS property, a request-producing sink, and data-probe evidence. It does not rewrite arbitrary CSS, does not neutralize redacted selectors, and does not broaden to low-confidence layout or normal remote-font cases. Background processing preserves `neutralized` as a page-changing action rather than overwriting it with installed-rule status when DNR rules are also installed.

Replaced clipped local popup tooltips with a document-root, viewport-clamped tooltip component. Help bubbles now use fixed positioning, measure the trigger, clamp within the popup viewport, flip when needed, and remain scrollable when the popup is too small. This preserves the compact `?` UI while preventing explanations from being cut off by the browser-extension popup bounds.

## 1.0.30 — DNR Action Semantics and Popup Clarity Correction

Corrected the user-facing DNR action vocabulary after POC testing showed that the previous “future blocking” wording was technically accurate but confusing in the popup summary. New reports use `rule_installed_dnr` for finding-derived DNR rules installed after analysis. `blocked_dnr` remains reserved for already-active prevention semantics. Legacy `future_blocked_dnr` values are still recognized when older local reports are displayed.

The popup now separates `Mitigated`, `Prevented`, and `Rules active` instead of showing “Blocked 0” next to “Future rules 6”. `Prevented` means current-load prevention or page-changing mitigation. `Rules active` means precise finding-derived DNR rules were installed after analysis and protect reloads or later matching requests. `Mitigated` combines both. This keeps the UI honest without making users infer DNR timing behavior from implementation terms.

The false-positive sweep output now reports installed-rule counts using `ruleInstalledCount`, while still treating legacy `future_blocked_dnr` reports as installed-rule findings.

## 1.0.29 — Fontleak Ligature Feature Evidence Correction

Corrected Fontleak ligature feature evidence extraction so active `font-feature-settings` values are recognized even after the CSS parser normalizes whitespace between the feature tag and numeric value. This keeps static generated-content ligature/container findings and animation-driven font-family-chain findings aligned with the documented Fontleak evidence model, while preserving the non-actionable behavior for disabled ligature values such as `"liga" 0`.

## 1.0.28 — Fontleak Container-Query Text-Exfil Tracking and Partial Enforcement

Expanded the Fontleak-side-channel model from the initial `1.0.27` remote-font plus container/keyframe sink detection into a more explicit partial-enforcement model for text-exfiltration shapes. CSS Sentry now tracks remote font measurement setup, generated-content probes, ligature feature usage, animation-driven font-family chaining, import-chain participation, and size-based container query sinks as separate reason-coded evidence. This keeps the enforcement authority tied to concrete CSS-triggered request paths instead of treating every remote webfont or every container query as suspicious.

Added static Fontleak-style ligature/container coverage for the pattern where a remote crafted font affects text width, generated `::before` content supplies the glyph/index input, and a container size query gates a remote URL sink. Added dynamic import-chain and animation/font-chain fixtures for the cases where remote imports or CSS animations cycle font state before a container query emits a request. Normal remote webfont usage with ordinary component container queries remains non-actionable.

Updated analyzer priority and DNR eligibility so Fontleak-side-channel findings are retained and mitigated when they contain the modeled evidence, while benign webfont/container UI remains below the actionable threshold. Updated specification, CVE traceability, release checklist, self-security traceability, fixture acceptance, and unit coverage to preserve the distinction between partial Fontleak enforcement and universal crafted-font binary analysis.

## 1.0.27 — Inline Conditional CSS and Font Side-Channel Hardening

Added declaration-level CSS exfiltration detection for modern inline-style patterns where the data source and branch condition live inside property values instead of selector predicates. CSS Sentry now recognizes `attr()` as a declaration-level data source, `if()` as CSS conditional branching, and `style(...)` as a style-query probe. High-confidence inline patterns such as `attr()` plus `if(style(...))` plus `url()` or string-form `image-set()` are now actionable even when the selector itself is not sensitive. Presentation-only `attr()` / `if()` usage without a network-capable sink remains non-actionable.

Improved `image-set()` extraction so nested function arguments are parsed with balanced parentheses instead of a shallow regular expression. URL functions inside `image-set()` are marked as image-set sinks, and string-form `image-set()` URLs nested inside conditional branches are extracted while non-URL condition strings are ignored.

Added partial Fontleak-style hardening for remote-font side-channel shapes that combine a remote `@font-face` with container-query or keyframe-controlled remote URL sinks. Normal remote fonts and ordinary unicode-range webfonts remain non-actionable unless paired with sensitive selectors or the modeled side-channel context.

Added CVE traceability for CVE-2026-39315 as a browser-decoded leading-zero numeric-entity protocol bypass that can feed a `data:text/css` stylesheet into the existing data stylesheet scanner. Documented CVE-2026-6861 as out of scope because it is an Emacs local SVG/CSS memory-corruption issue, not a browser-rendered CSS exfiltration pattern enforced by this extension.

Added attack fixtures for inline `attr()` / `if(style())` URL exfiltration, string-form `image-set()` conditional exfiltration, nested `if()` chains, CVE-2026-39315 data stylesheet decoding, Fontleak-style container-query URL sinks, and Fontleak-style keyframe URL sinks. Added benign fixtures for presentation-only inline `attr()` conditionals and same-origin decorative container-query UI CSS. Unit and integration coverage now protects the new analyzer, URL extraction, and DNR candidate behavior.

## 1.0.26 — Balanced POC Timing Regression Test Correction

Corrected the Balanced same-origin POC e2e regression so it accepts both valid browser-timing outcomes. If the initial CSS-triggered request reaches the fixture server before analysis completes, the report must show the finding-derived rule as future blocking and the matching request must be blocked on reload. If the request is already prevented on the first load, the test no longer treats that stronger mitigation outcome as a failure. Runtime mitigation behavior from `1.0.24` and the verification fixes from `1.0.25` are preserved.

## 1.0.25 — E2E Policy Synchronization and Report Locator Verification Fixes

Corrected the Playwright e2e policy synchronization helper so tests that intentionally use the default Balanced policy no longer wait for nonexistent policy DNR filters. The helper still waits for expected blocklist/allowlist filters when a policy supplies those origins, preserving the actual synchronization check for policy-rule tests.

Corrected the same-origin iframe report assertion to accept multiple legitimate visible occurrences of the same attacker origin in the report. This preserves the report rendering check without treating duplicate visible findings as a Playwright strict-locator failure. The runtime mitigation behavior from `1.0.24` is preserved.

## 1.0.24 — Balanced High-Confidence Mitigation and Accurate DNR Action Semantics

Balanced mode now installs precise finding-derived DNR rules for high-confidence CSS exfiltration shapes, including same-origin sensitive value-probing selectors paired with network-capable CSS sinks. This closes the default-mode gap where the public CSS Exfil Protection POC could be detected but not mitigated unless Strict mode was selected. Strict mode still adds stronger policy behavior for sensitive origins, while Balanced now provides the baseline mitigation expected for confirmed exfil shapes.

Finding-derived DNR action reporting was corrected so the extension no longer labels a finding as already `blocked_dnr` merely because a rule was installed after CSS analysis. New `future_blocked_dnr` action state records that a precise DNR rule was installed and will block matching later requests. The popup and report now distinguish already-prevented requests from future blocking rules, which explains the observed dev-build behavior where an initial POC request can complete before analysis but a refresh can become safe after the rule exists.

The false-positive sweep output now separates future-blocked findings from logged-only and already-blocked findings. E2E coverage was extended with a same-origin POC timing regression: the first Balanced load may hit the leak endpoint before analysis, but the installed finding-derived rule must block the same matching request on reload.

## 1.0.23 — Verification Fixes and Native Build Tooling Declaration

Added `node-gyp` as an explicit development dependency and updated the pnpm lockfile so frozen installs include the native-build helper requested for the local toolchain. Corrected the popup status copy so logged-only findings explicitly state that no request was blocked, matching the intended action-state UI contract. Corrected the iframe-report e2e assertion to accept multiple legitimate visible occurrences of the same attacker origin instead of failing on Playwright strict locator ambiguity. Reduced redundant report sanitization during frame-report storage so the report cap test completes within the normal unit-test timeout while preserving the same stored redaction boundary.

## 1.0.22 — Strict-Mode POC Enforcement and Modern Sink Hardening

Implemented the strict-mode correction for the public CSS Exfil Protection POC and the related Issue #1 failure. Strict mode now treats a sensitive value-probing selector combined with any network-capable CSS sink as a finding-derived DNR block candidate even when the destination is same-origin. Balanced mode remains conservative and does not block same-origin POC-style findings by default unless a destination policy, cross-origin sink, or local/private-network sink requires blocking.

Finding-derived DNR rules now use the raw internal request URL while reports continue to store/export redacted URLs. Rules are generated as precise URL regex filters with URL fragments removed, rather than broad hostname-only rules, so a POC fix does not overblock unrelated same-host resources. URL fragments no longer produce `sink.svg_reference`; SVG-reference evidence is now limited to actual `.svg` resource paths. The popup and full report wording now distinguish finding-based rules installed after analysis from policy rules that may prevent matching requests before analysis.

Added regression coverage for all six public POC classes: `;base64,` fragment URLs, `;base64,` path URLs, CSS variable URL indirection, fallback-variable URL indirection, nested `@supports`, and nested `@media`. Added modern sink coverage for string-form `image-set()` / `-webkit-image-set()` URLs and targeted unicode-range font request oracles when a remote font family is applied under a sensitive selector. Added benign fixtures to keep decorative `image-set()` and normal remote unicode-range webfonts non-actionable.

## 1.0.21 — Full Large-Stylesheet Source Scan and Scan-Cap Hardening

Implemented the large-stylesheet correction from the passing `1.0.19` source line instead of carrying forward the earlier `1.0.20` fallback package. Oversized stylesheets now use a complete source scanner and the normal analyzer/scoring path, so they are not reported as `analysis.skipped.too_large` and malicious rules placed after large benign padding are still evaluated. Large stylesheet size now selects a lower-allocation parsing strategy; it does not disable analysis.

The analyzer also continues scanning after the report cap is filled and retains the highest-priority findings instead of stopping at the first `maxFindings` matches. This prevents padded stylesheets from filling the report with earlier lower-priority findings before a later local-network, import, SVG, or sensitive selector sink. Nested rules inside oversized stylesheets are also scanned, DNR rule generation prioritizes stronger candidates when the dynamic rule cap is reached, and merged reports canonicalize stylesheet source URLs for deduplication so `file.css` and `file.css#` do not create duplicate finding rows.

Added regression fixtures for oversized benign generated CSS, oversized remote `@import`, oversized value-probing remote URL sinks, and oversized nested value-probing CSS. Added unit coverage for full large-stylesheet scanning and finding-cap prioritization.

## 1.0.19 — Sweep-Driven False-Positive Reduction and Popup Action Clarity

Implemented the next compatibility hardening pass from the 250-site false-positive sweep. CSS Sentry now avoids treating common UI substring selectors such as icon/theme class selectors, non-secret `data-*` state selectors, and decorative `input[type=password]` / `input[type=email]` styling as sensitive value-probing patterns. Common third-party font stylesheet imports from Google Fonts and Adobe Typekit are no longer treated as high-confidence Balanced-mode block candidates, while unknown remote `@import` sinks remain covered by the existing attack fixtures.

The popup UI now makes the effect of findings explicit without removing the existing controls: it shows whether the page was blocked/changed, logged-only, info-only, or coverage-only, and each finding row carries an action badge explaining whether CSS Sentry changed page behavior or only recorded a local report. The false-positive sweep summary also records logged-only, info-only, coverage, and changed counts so future site sweeps are easier to triage.

## 1.0.18 — Full False-Positive Sweep Script Alias

- Added `pnpm run audit:false-positives:all` as a convenience script for the full 250-site false-positive sweep with full report saving enabled.
- Kept the existing `pnpm run audit:false-positives` script for custom sweep arguments and lighter summary/actionable runs.

## 1.0.17 — False-Positive Sweep Expansion and Noise Reduction

- Expanded the development false-positive sweep seed list from 100 to 250 common sites.
- Added full per-site report saving to `scripts/false-positive-sweep.mjs` with `--save-reports none|actionable|all`; actionable reports are saved by default under `test-results/false-positive-sweep/reports/`.
- Made the sweep CLI accept both package-manager argument forms: `pnpm run audit:false-positives -- --limit 250` and `pnpm run audit:false-positives --limit 250`.
- Reduced Balanced-mode common-site noise by keeping standalone fixed-position `!important` CSS non-actionable without an outbound leak path and suppressing same-origin decorative BODY/SVG resource findings while preserving cross-origin and local/private-network coverage.
- Preserved explicit informational coverage notices for browser-uninspectable cross-origin frames and stylesheets, and kept the standard compatibility control for partial-analysis findings visible.

## 1.0.14 — Corrected Runtime PNG Asset Replacement

Replaced `src/assets/icon.png` with the newly provided corrected PNG after `1.0.13` carried forward the previous asset by mistake. No runtime behavior, detection logic, DNR policy, UI logic, fixtures, or advanced-mode behavior changed in this patch.


## 1.0.13 — README Intro and Runtime PNG Asset Cleanup

- Replaced the README introduction with the public-store oriented project summary, Firefox Add-ons badge, AI-build note, and Chrome local-install note.
- Removed `Last Updated` metadata from `README.md`; date metadata belongs only in documents under `docs/`.
- Refreshed `src/assets/icon.png` from the latest uploaded PNG asset.
- No analyzer, parser, DNR, storage, Firefox enhanced mode, fixture, e2e, popup, options, or report behavior was intentionally changed.

## 1.0.12 — Balanced False-Positive and DNR Safety Correction

- Fixed Balanced-mode analyzer gating so presentation-only CSS with zero remote URL sinks is no longer emitted as an actionable finding.
- Tightened `selector.repeated_probe_pattern` so long framework/player class names do not count as repeated probing. Repeated probing now requires repeated attribute-probe structure rather than long identifiers.
- Reduced `:has()` from a standalone sensitive signal to contextual evidence. `:has(:hover)` and `:has(:active)` UI selectors no longer become findings without sensitive attribute probes and outbound sinks.
- Stopped treating unresolved custom properties on non-network presentation properties as actionable security evidence.
- Stopped treating standalone remote `@font-face` rules as high-confidence Balanced-mode threats. Remote fonts are actionable only when a sensitive selector conditionally applies a remote font family or when the user explicitly enables Strict/resource policy blocking.
- Added DNR safety gating so high/critical findings must still contain a real sink class before tab-scoped finding rules are installed.
- Changed partial-analysis finding notices to be advanced/off-by-default. Coverage counts remain tracked; per-stylesheet/per-frame limitation findings can be enabled for diagnostics.
- Added benign regression fixtures for YouTube/player CSS, reCAPTCHA/Roboto fonts, Gmail-like Material CSS, and ChatGPT/app-shell state selectors.
- Added a conditional remote-font attack fixture so actual selector-driven font-family exfiltration remains covered.
- Added a development-only false-positive sweep script (`pnpm run audit:false-positives`) plus a 250-site seed list so maintainers can test common websites for noisy Balanced-mode reports before publication. The sweep output is written under `test-results/` and is not part of runtime behavior.


## 1.0.11 — Corrected Runtime PNG Asset

- Replaced `src/assets/icon.png` with the corrected uploaded PNG asset.
- Kept `src/assets/icon.svg` unchanged.
- No analyzer, parser, DNR, storage, fixture, e2e, popup, options, report, or permission behavior was intentionally changed.
- Updated status tracking so the asset-only maintenance package is recorded without treating it as a feature/security change.

## 1.0.10 — Advanced SVG, Firefox, and Diagnostics Options

- Added optional advanced reporting for externally loaded SVG image documents as partial coverage.
- Added optional Strict-mode DNR handling for third-party SVG image-document resources.
- Implemented Firefox enhanced stylesheet response inspection as an off-by-default Firefox-only pass-through reporting path when `webRequest.filterResponseData` is available.
- Clarified DNR status wording so zero tab-scoped rules is reported as a normal successful state rather than a confusing empty installation.
- Updated specification/status/CVE tracking to distinguish partial coverage, destination-policy handling, and out-of-scope full internal SVG image inspection.



Last Updated: 2026/05/13 01:54:22 -03


## Document Role


`docs/RELEASE_NOTES.md` is the changelog home for CSS Sentry. It records release-to-release changes, corrective packages, verification notes, and reconstruction boundaries. It must not replace `docs/STATUS.md`, `docs/SPEC.md`, or `docs/CVE_SPEC.md`.


Document roles:


- `docs/STATUS.md` tracks current coverage, limitations, verification state, and audit notes.
- `docs/SPEC.md` tracks product requirements, implementation decisions, accepted constraints, and regression rules.
- `docs/CVE_SPEC.md` tracks CVE-derived requirements, fixture mappings, adjacent CVE classes, explicit non-goals, and CVE release-checklist obligations.
- `docs/SELF_SECURITY.md` tracks extension self-security safeguards.


Release history must not be deleted or collapsed into summaries unless the removed detail is preserved in another project document and the move is explicitly recorded here.
## 1.0.9

Maintenance asset refresh from the passing `1.0.8` source line.

Changed:

- Replaced `src/assets/icon.svg` with the newly uploaded SVG asset.
- Replaced `src/assets/icon.png` with the newly uploaded PNG asset.
- Bumped `package.json` to `1.0.9`.
- Updated `docs/STATUS.md` and `docs/RELEASE_NOTES.md` so asset-only maintenance packages remain traceable.

No analyzer, parser, DNR, storage, fixture, e2e, popup, options, or report behavior was intentionally changed.


## 1.0.8 — Status wording and historical issue-comment coverage cleanup

`1.0.8` is a documentation-preserving cleanup release. It does not intentionally change runtime behavior.

Changes:

- Replaced stale milestone-specific coverage wording with `Covered for documented scope` to avoid stale milestone wording while preserving conservative scope boundaries.
- Added a historical issue-comment coverage ledger to `docs/STATUS.md`.
- Recorded that old issue bodies and comment threads are used as behavior/failure-class sources, not as product branding or dependency scope.
- Clarified that `Mostly covered` should only remain when implementation or test evidence is actually incomplete.
- Confirmed CI workflow remains outside implementation tracking under the manual release-gate policy.
- Preserved existing post-v1/future-watch and out-of-scope boundaries.

## 1.0.7

Focused search-triage, documentation wording, and fixture-coverage patch from the passing `1.0.6` line.

Changed:

- Renamed `old avoided-features heading` to `Features Avoided` in `docs/STATUS.md`.
- Removed automated workflow from implementation/status tracking; manual release verification remains documented as the chosen process.
- Clarified optional Firefox enhanced mode as a possible Firefox-only response-filtering/rewrite capability that is intentionally not in the baseline because it would add browser-specific permissions, code paths, and tests.
- Clarified badge severity options as optional UI preference polish, not a detection or mitigation requirement.
- Clarified SVG image-document policy handling as post-v1/future-watch work because externally loaded SVG image documents may not be DOM-inspectable by content scripts.
- Clarified sanitizer-specific fixture packs as conditional future work: add fixtures when advisories map to CSS-triggered remote-resource behavior; do not turn CSS Sentry into a dependency vulnerability scanner.
- Added CVE-2026-31873 / Unhead-style mixed-case `DATA:text/css` stylesheet link fixture coverage.
- Added CVE-2026-28348 / `lxml_html_clean` escaped `@import` sanitizer-bypass fixture coverage.
- Added adjacent/out-of-scope tracking for CVE-2026-41305 / PostCSS stringifier `</style>` XSS because CSS Sentry does not stringify user CSS into HTML style tags.
- Preserved all previous documentation tracking sections.

Runtime behavior changed only for the new executable coverage classes: data CSS stylesheet links are analyzed without storing the raw data URL, and escaped `@import` rules are recovered as import findings.


## 1.0.6

Maintenance, documentation, assets, and UI refactor patch from the passing `1.0.5` line.

Changed:

- Added `test-results` and `json-report.json` to `.gitignore`.
- Added Chrome Web Store and Firefox Add-ons badge/logo assets under `docs/`:
  - `docs/chrome-extension-logo.png`
  - `docs/firefox-addon-logo.svg`
- Refactored popup/options UI into smaller component modules:
  - `src/shared/components/InfoTooltip.tsx`
  - `src/entrypoints/options/components.tsx`
  - `src/entrypoints/popup/components.tsx`
- Preserved popup/options behavior while reducing entrypoint component size and duplication.
- Added clean-code rules to `docs/SPEC.md` and release checks to `docs/RELEASE_CHECKLIST.md`.
- Added adjacent CVE/out-of-scope tracking for sanitizer/SVG JavaScript-XSS classes that are not direct CSS Sentry implementation targets unless they involve CSS-triggered remote-resource behavior.
- Reclassified `Mostly covered` rows in `docs/STATUS.md` into more precise v1-scope, current-corpus, manual-policy, limitation, or out-of-scope states.
- Removed store-publication artifacts from the implementation coverage matrix because store submission is a publication operation, not a required source-package capability.

No analyzer, parser, DNR, storage, fixture, or e2e behavior was intentionally changed.


## 1.0.5

### Scope

`1.0.5` adds CVE-2026-40301 traceability and executable fixture coverage for SVG `<style>` CSS injection through unfiltered `url()` and `@import` directives in rendered SVG content. It also records the project decision that tracking documents must continue to preserve todo candidates, post-v1 ideas, non-goals, and limitations rather than only describing already-implemented behavior.

### Implemented

- Added CVE-2026-40301 to `docs/CVE_SPEC.md` as a DOMSanitizer SVG `<style>` CSS injection / rendered SVG remote-resource class.
- Added attack fixtures for SVG `<style>` `url()` and SVG `<style>` `@import` behavior.
- Added expectation files for the new fixtures so the coverage is enforced by `tests/integration/fixtures.test.ts`.
- Added the new fixture names to `tests/integration/spec-acceptance.test.ts`.
- Extended SVG CSS paint-property detection so remote `fill`, `stroke`, and marker URL sinks are classified as SVG paint remote sinks.
- Updated `docs/STATUS.md`, `docs/SPEC.md`, `docs/CVE_SPEC.md`, `docs/RELEASE_CHECKLIST.md`, and `docs/SELF_SECURITY.md` additively to keep implemented coverage, future candidates, avoided features, and limitations traceable.

### Runtime Behavior

Runtime analyzer behavior changed only for SVG CSS paint properties: remote URL sinks in `fill`, `stroke`, and marker properties are now treated as network-capable SVG paint sinks.

### Verification

Run locally after extraction:

```bash
pnpm install --frozen-lockfile
pnpm run verify:full
```

## 1.0.4

### Scope

`1.0.4` is a documentation-only corrective package built from the passing `1.0.3` source line. It preserves the detailed documents restored in `1.0.3`, then updates them additively so the project can continue tracking what has been implemented from the start without reducing the documents to short summaries.

### Changed

- Expanded this file into the release-history and changelog home.
- Added a reconstruction boundary for older pre-`0.0.23` history where the uploaded materials preserve only consolidated detail.
- Updated `docs/STATUS.md` with an implementation coverage index, document role rules, historical issue coverage tracking, and `1.0.4` package state.
- Updated `docs/SPEC.md` additively with document/history preservation requirements and missing historical issue-derived requirement rows from the CSS Exfil Protection issue inventory.
- Updated `docs/CVE_SPEC.md` with an explicit preservation rule for CVE mappings, fixture mappings, release-checklist additions, and out-of-scope CVE classifications.
- Updated `docs/RELEASE_CHECKLIST.md` so release validation checks that changelog history, implementation coverage, historical issue coverage, CVE traceability, and document depth have not regressed.
- Updated README documentation-role guidance.
- Updated project-structure tests to verify release-note coverage and documentation role markers.

### Runtime Behavior

No runtime behavior was intentionally changed from `1.0.3`.

This package does not intentionally change:

```text
analyzer
parser
DNR behavior
runtime-message validation
storage/report logic
popup UI
options UI
report UI
fixtures
e2e behavior
```

### Verification

Run locally after extraction:

```bash
pnpm install --frozen-lockfile
pnpm run verify:full
```

## 1.0.3

### Scope

The documentation restoration is intentionally additive: detailed tracking documents are restored, and new traceability is appended rather than replacing prior content.

`1.0.3` is a corrective release that restores detailed project documentation, reapplies `1.0.2` CVE/rendered-resource traceability additively, and fixes two test issues found after `1.0.2`.

### Fixed

- Restored detailed `SPEC.md`, `CVE_SPEC.md`, `STATUS.md`, `RELEASE_NOTES.md`, `SECURITY.md`, `PERMISSIONS.md`, and `SELF_SECURITY.md` content instead of keeping shortened summaries.
- Added documentation regression rules so project docs are not condensed or cleared during future release work.
- Preserved `!important` in css-tree declaration extraction so the `cve-2026-35544-roundcube-fixed-position-important.html` fixture produces the expected actionable CSS-only finding.
- Made the first-load blocklist e2e policy-update helper tolerate Chromium notification-message no-response behavior while still requiring DNR rule polling to succeed.

### Verification

Run:

```bash
pnpm run verify:full
```

## 1.0.2

### Scope

`1.0.2` was a corrective CVE/rendered-resource and documentation-traceability package. Its documentation rewrite was later corrected by `1.0.3` because several detailed tracking files were reduced too aggressively.

### Implemented

- Added CVE/rendered-resource traceability for newer Roundcube/webmail classes including HTML style sanitizer information disclosure, CSS comment mishandling, local/private-network stylesheet links, SVG `feImage`, BODY `background`, SVG animation URL-bearing attributes, fixed-position `!important` sanitizer bypass indicators, and SVG animation fill/filter/stroke URL-bearing attributes.
- Added scanner coverage for BODY background remote-resource attributes.
- Added scanner coverage for SVG `feImage` remote-resource references.
- Added scanner coverage for SVG animation URL-bearing attributes where feasible.
- Added detection for stylesheet links to local/private-network hosts.
- Added CSS fixed-position `!important` sanitizer-bypass indicators.
- Added attack fixtures and expectation files for the above classes.
- Explicitly classified browser-engine CSS memory-safety CVEs as out of scope for CSS Sentry enforcement because they must be remediated by browser vendors.

### Corrected Later

`1.0.3` restored the full documentation depth after `1.0.2` replaced several detailed documents with shorter summaries.

## 1.0.1

### Scope

`1.0.1` was a patch package for first-load destination blocklist e2e synchronization after `1.0.0` exposed a timing/path issue in the policy setup test.

### Fixed

- Updated the e2e policy setup path so the test exercises the trusted extension-page sender path instead of relying on direct worker evaluation.
- Waited for DNR session rules through callback-safe Chrome APIs.
- Improved failure diagnostics by including installed filters in timeout errors.
- Removed duplicate DNR `updatedAt` status data.

## 1.0.0

`1.0.0` is the stable v1 package promoted from `1.0.0-rc.2` after the maintainer reported the full local verification gate passing.

### Scope

- Promoted the latest passing release-candidate line to stable `1.0.0`.
- Kept `docs/SELF_SECURITY.md` as the explicit seven-item self-security traceability document.
- Kept the package script layout with `test:e2e` as `playwright test`, no standalone `verify` script, and `verify:full` as the full manual gate.
- Did not intentionally change analyzer, parser, DNR, runtime-message, storage, UI, fixture, or e2e behavior.

### Verification

The maintainer reported `pnpm run verify:full` passing on the release-candidate line before this stable promotion. For a fresh checkout, run:

```bash
pnpm install --frozen-lockfile
pnpm run verify:full
```

Generate browser artifacts only when publishing or sharing installable extension packages:

```bash
pnpm run zip
pnpm run zip:firefox
```

### Claim Boundary

CSS Sentry detects and reduces risk from known high-signal CSS-based data exfiltration patterns. It does not claim complete prevention of every CSS exfiltration technique, browser side channel, future CSS feature abuse, or browser-extension platform limitation.

## 1.0.0-rc.2

`1.0.0-rc.2` is the release-candidate package cut after the verified `0.0.35` self-security traceability pass.

### Scope

- Promoted the latest passing pre-RC line to `1.0.0-rc.2`.
- Kept `docs/SELF_SECURITY.md` as the explicit seven-item self-security release gate.
- Kept the package script layout with `test:e2e` as `playwright test` and no standalone `verify` script.
- Did not intentionally change analyzer, parser, DNR, runtime-message, storage, UI, fixture, or e2e behavior.

### Stable `1.0.0` Criterion

Stable `1.0.0` should only be tagged after `1.0.0-rc.2` passes manual usage without a release-blocking issue. If a blocker is found, fix it in another release-candidate package before stable release.

## 1.0.0-rc.1

`1.0.0-rc.1` was the first release-candidate package for CSS Sentry. It is superseded by `1.0.0-rc.2`, which includes the completed self-security traceability gate.

### Release Candidate Scope

This release candidate included the v1 feature set and hardening work completed through the `0.0.x` implementation series:

- WXT + React + TypeScript browser-extension structure.
- Popup, Options, and Report UI.
- Passive, Balanced, Strict, and advanced protection modes.
- Parser-backed CSS analysis using `css-tree` with a conservative fallback parser.
- Selector-risk, declaration-sink, URL-normalization, custom-property, nested-rule, and inline-style analysis.
- CVE-named and expectation-driven fixture corpus.
- Browser-runtime e2e coverage for extension pages, report rendering, frame reporting, destination blocklist first-load behavior, and benign no-breakage pages.
- Destination allow/block DNR policy enforcement.
- Local-only reports with sensitive-value redaction.
- Runtime-message sender/schema validation.
- Settings-import validation and caps.
- DNR status visibility in Options.
- Manifest permission minimization.
- Extension UI injection invariant tests.
- Report, frame, and finding storage caps.
- Release-readiness documentation under `docs/`.

### Claim Boundary

This release candidate was superseded by `1.0.0-rc.2`. It should not be promoted directly to stable.

## 0.0.35

`0.0.35` is a pre-release traceability package created before the next release candidate. It keeps the latest passing implementation line and adds explicit documentation/test coverage for the seven pre-v1 extension self-security suggestions.

### Scope

- Added `docs/SELF_SECURITY.md`.
- Updated README and `docs/STATUS.md` so self-security hardening is explicit rather than only implied by scattered tests and implementation files.
- Updated project-structure tests to require `docs/SELF_SECURITY.md`.
- Did not intentionally change analyzer, parser, DNR, runtime-message, storage, UI, fixture, or e2e behavior.

## 0.0.34

### Scope

- Fixed hidden-input selector detection for same-compound selectors such as `input[name="csrf_token"][type="hidden"]`.
- Updated `verify:full` to run commands sequentially with semicolons as requested.

## 0.0.33

### Scope

- Fixed TypeScript narrowing for `css-sentry:clear-current-report` runtime-message validation by copying `message.tabId` into a local `number`-checked variable before constructing the validated runtime message.
- Added a runtime-message security regression test proving `clear-current-report` is accepted only from extension contexts and only with a non-negative integer `tabId`.
- No runtime policy, parser, DNR, UI, or fixture behavior was intentionally changed.

## 0.0.32

### Scope

`0.0.32` was the extension self-security hardening pass.

### Implemented

- Runtime-message schema and sender validation.
- Settings import schema, size, origin-list, mode, compatibility, and retention caps.
- DNR status recording and Options-page visibility for the latest DNR operation.
- Manifest permission minimization by removing unused `activeTab`, `scripting`, and optional host permissions.
- Project-structure tests for extension UI injection and dynamic-code sinks.
- Report/frame/finding retention caps.
- Modern inline-style fixtures for inline URL sinks, custom-property URL indirection, and `image-set(url(...))`.

## 0.0.31

### Scope

`0.0.31` was the release-readiness documentation pass.

### Implemented

- Added `docs/SECURITY.md`.
- Added `docs/PRIVACY.md`.
- Added `docs/PERMISSIONS.md`.
- Added `docs/RELEASE_CHECKLIST.md`.
- Updated README project-documentation links.
- Updated project-structure tests so security/privacy/permissions/release-checklist docs must live under `docs/` and not at repository root.
- No runtime analyzer, parser, DNR, report UI, popup UI, or options UI behavior was changed.

## 0.0.30

### Scope

- Fixed the benign embedded map fixture so the map surface has explicit dimensions and accessible content instead of being an empty zero-sized element.
- Strengthened the e2e assertion to verify the map heading, image role, and zoom control remain visible/clickable.

## 0.0.29

### Scope

- Fixed a TypeScript compile error in `tests/e2e/extension-smoke.spec.ts` caused by an unescaped `https://` inside a regular-expression literal.

## 0.0.28

### Scope

`0.0.28` completed the no-breakage e2e suite for the v1 source package.

### Implemented

- Added expectation-driven benign fixtures for large static pages, benign webmail themes, Tailwind-like generated output, and CSS Modules-like generated output.
- Expanded browser e2e no-breakage coverage for embedded map-like UI, large static pages, benign webmail theme rendering, Tailwind-like output, and CSS Modules-like output.

## 0.0.27

### Scope

- Stabilized first-load destination blocklist e2e behavior by switching policy DNR matching to exact-origin regular-expression filters and waiting for those filters before navigation.
- Added browser e2e no-breakage checks for benign carousel-style UI and inert rendered markdown/code-block content.

## 0.0.26

### Scope

`0.0.26` completed the frame/iframe e2e and reporting pass.

### Implemented

- Changed `test:e2e` to `playwright test`.
- Removed the standalone `verify` script.
- Added same-origin iframe attack fixture coverage.
- Added e2e coverage for same-origin iframe findings being merged into the local report.
- Added e2e coverage proving top-frame and iframe findings remain separate.
- Added cross-origin iframe partial-coverage reporting.
- Expanded report UI frame metadata.
- Expanded popup UI with partial-frame notices.
- Added UI unit coverage for popup partial-frame notice and report frame metadata.

## 0.0.25

### Scope

`0.0.25` fixed early redaction/DNR regressions and reorganized `docs/STATUS.md`.

### Implemented

- Preserved structural selector values such as `input[name="csrf_token"]` while redacting probed values.
- Changed destination-policy DNR rules away from request-domain-only behavior so localhost/IP/port origins are handled more reliably.
- Reorganized `docs/STATUS.md` so changelog/audit notes no longer interrupt future-feature or v1-scope sections.

## 0.0.24

### Scope

`0.0.24` was the redaction and privacy hardening pass.

### Implemented

- Added `src/core/privacy/redaction.ts`.
- Redacted selector attribute values where they are sensitive rather than structural.
- Redacted token-like values, URL credentials, URL query values, URL fragments, and token-like URL path segments.
- Sanitized reports before storage.
- Sanitized report exports as defense in depth.
- Preserved `destinationOrigin` for DNR/diagnostic usefulness while redacting sensitive destination URL details.
- Added unit tests for redaction and storage/DNR behavior.

## 0.0.23

### Scope

`0.0.23` was the parser and CVE_SPEC hardening pass built from the last passing `0.0.22` baseline.

### Implemented

- Added `css-tree` as the primary parser dependency and retained the lightweight parser as fallback.
- Reworked CSS extraction for style rules, `@import`, `@font-face`, grouping rules, and parser-supported nested style rules.
- Normalized escaped CSS property names before declaration classification.
- Preserved conservative comment stripping before parsing so comment-hidden `url()` forms remain detectable.
- Added CVE-named and parser-differential fixtures for parser bypass, CSS variables, fallback chains, nested rules, comment-hidden URLs, escaped functions, mixed-case imports, namespace sanitizer bypasses, and malformed recovery.
- Updated `docs/CVE_SPEC.md`, `docs/STATUS.md`, and acceptance tests for the parser/CVE fixture set.

## 0.0.18 through 0.0.22

### Reconstruction Boundary

The uploaded materials identify `0.0.22` as the last passing baseline before the `0.0.23` parser/CVE pass. Exact per-version release notes for `0.0.18` through `0.0.22` are not present in the uploaded source packages or chat export, so this section preserves only the consolidated implementation state available from the recovered documents.

### Consolidated Implemented State

- Expectation-driven fixtures existed before the parser/CVE pass.
- Browser-runtime e2e coverage existed before the later frame/no-breakage expansions.
- Mitigation and destination-policy hardening were already in progress.
- Non-README project documentation had been moved under `docs/`.
- The project already had a v1-focused implementation plan, status tracking, and local verification workflow.

## 0.0.1 through 0.0.17

### Reconstruction Boundary

Exact per-version changelog entries for `0.0.1` through `0.0.17` are not present in the uploaded `1.0.0`, uploaded `1.0.3`, or provided chat-export materials. This section therefore records the foundation capabilities that were present by the recovered `0.0.22`/`0.0.23` transition without inventing unsupported per-version deltas.

### Foundation Capabilities Preserved by Later Releases

- Browser-extension source layout using WXT, React, TypeScript, Vitest, and Playwright.
- Core CSS analysis model with selector risk, declaration sink risk, URL risk, custom-property handling, nested-rule handling, inline-style handling, findings, severities, and reason codes.
- Popup, options, and report user-interface foundations.
- Passive, Balanced, Strict, and advanced control modes.
- Local-only report and privacy model foundations.
- Historical CSS Exfil Protection issue audit translated into project requirements.
- V1 release criteria, test strategy, and documentation structure foundations.

## Changelog Preservation Rule

Release history must remain available in this file or in a clearly referenced successor. If a future release reorganizes this file, it must preserve:

- every version heading that exists at the time of the edit;
- the runtime/no-runtime distinction for each release;
- known reconstruction boundaries;
- references to corrective releases and why they were needed;
- the relationship between release notes and coverage/status/specification documents.


