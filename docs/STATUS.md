# CSS Sentry — Implementation Status

Last Updated: 2026/06/19 14:14:45 -03

**Status document version:** 1.0.86

## 1.0.86 Status Update

`1.0.86` corrects the Turnstile and diagnostic semantics exposed by the deployed Test Lab. Turnstile is no longer treated as a per-button verification that resets after every session creation. The client renders Turnstile at page load with interaction-only appearance, sends a token when one is available, and the server promotes a successful Siteverify result into a signed first-party verification cookie. That cookie is scoped to the Test Lab origin, is HttpOnly, and lets later `/api/session.json` requests on the same browser session proceed without another widget reset until the cookie expires.

The session endpoint now strips the signed verification cookie from JSON responses and sends it only through `Set-Cookie`. This keeps the cookie as a browser/server verification state rather than a client-managed token.

The Test Lab diagnostic bridge now includes a session identifier derived from the active Test Lab run. The runner writes the active session to the document before injecting controlled CSS and ignores scan/report diagnostics that do not match the active session. This prevents a pre-run zero-finding scan from being paired with a later endpoint hit and shown as “Extension scanned but found no matching issue.”

## 1.0.84 Status Update

`1.0.84` completes the Test Lab Turnstile client path and corrects the deployed runner's dynamic-style scan timing. The website now renders the Cloudflare Turnstile widget when a public site key is present at build time, sends the generated token to `/api/session.json`, resets the widget after token use or validation failure, and keeps the server-side Siteverify path bound to the Test Lab action and request hostname. The GitHub Actions website workflow now passes `PUBLIC_TURNSTILE_SITE_KEY` to both website build jobs from repository variables or secrets named `PUBLIC_TURNSTILE_SITE_KEY` or `TURNSTILE_SITE_KEY`; the private `TURNSTILE_SECRET_KEY` remains a Cloudflare Worker runtime secret, not a client build value.

The release-Test-Lab “Extension scanned but found no matching issue” result was traced to the no-refresh dynamic CSS path. The runner appended an empty `<style>` node before setting `textContent`; CSS applied in the browser and reached the endpoint, but the content-script rescan could observe the empty style insertion and then miss the later text-node update. The runner now fills the dynamic style before appending it, and the document scan controller observes character-data mutations so existing style text changes also schedule rescans. This keeps the no-refresh UX while preserving extension scan coverage for dynamically injected selected checks.

Regression coverage was added for Turnstile validation, Turnstile build wiring, dynamic style-text rescan triggers, observer character-data coverage, and analyzer recognition of the generated known-detector Test Lab CSS.

**Package audited:** `css_sentry_1.0.84`
**Audit timestamp:** 2026/05/16 18:21:57 -03 (`America/Sao_Paulo`)

## 1.0.83 Status Update

`1.0.83` corrects the Firefox release-runtime recursion failure observed on the deployed Test Lab after clicking Start selected checks. The failure manifested as repeated `InternalError: too much recursion` exceptions from the minified content script while the page was injecting and scanning the selected controlled CSS. The fix removes recursive-prone global replacement from CSS comment stripping and CSS unescaping, bounds generated selector text before privacy redaction regexes run, and wraps the document scanner boundary so a runtime scanner exception becomes a bounded partial-analysis summary instead of an uncaught repeated content-script failure.

The Test Lab default selected run now excludes the large stylesheet stress fixture. The case remains available through manual selection and Run all checks, but the baseline Start selected checks flow now starts from ordinary detector coverage instead of including a large generated stylesheet by default.

Regression coverage was added for the scanner failure boundary, iterative CSS text helpers, bounded large-selector redaction, and the default selected-case boundary.

**Package audited:** `css_sentry_1.0.83`
**Audit timestamp:** 2026/05/16 17:42:32 -03 (`America/Sao_Paulo`)

## 1.0.82 Status Update

`1.0.82` corrects the public Cloudflare Worker Test Lab execution path after deployment succeeded but the `/tests/` runner still reported that diagnostics were unavailable and refreshed the page when starting selected checks. The diagnostic bridge now treats marked `css-sentry-test-lab.*.workers.dev` pages as the supported public Test Lab origin pattern while keeping arbitrary public origins unsupported. The automatic diagnostic payload remains sanitized: it contains mode, scan state, finding counts, reason codes, action codes, and report-save acknowledgement only; it still excludes selectors, fake values, destination URLs, and full finding objects.

The runner no longer reloads the page for the normal Start selected checks path. It creates a session, records the selected session/cases in browser history, injects the controlled stylesheet dynamically, and starts endpoint polling in place. Direct session URLs remain supported through the initial stylesheet path for deep links and reruns. This preserves endpoint-backed verification while avoiding the user-visible page refresh observed on the deployed Worker.

The active deployment workflow is now represented as `.github/workflows/website-cloudflare.yml`, matching the uploaded GitHub Actions file used for the current public deployment. The website keeps the Cloudflare adapter with null Astro session storage, so the deploy path does not require the unintended `SESSION` KV binding.

**Package audited:** `css_sentry_1.0.82`
**Audit timestamp:** 2026/05/16 17:02:07 -03 (`America/Sao_Paulo`)

## 1.0.81 Status Update

`1.0.81` corrects the source-level manifest permission guard alignment introduced during the `1.0.80` Firefox MV2 host-permission correction. The manifest behavior is unchanged: Firefox MV2 keeps `<all_urls>` in `permissions`, Manifest V3 targets keep `<all_urls>` in `host_permissions`, Chrome remains free of Firefox-only response-filter permissions, and the extension still does not request `activeTab`, `scripting`, or optional host permissions. The change keeps the permission expression text aligned with the existing project-structure regression guard so the manifest-permission source test validates the intended browser/version split instead of failing on formatter-expanded nested ternary text.

This package does not add a release-notes entry because it is a source/test-alignment maintenance correction for the `1.0.80` permission-placement update rather than a user-visible runtime change.

**Package audited:** `css_sentry_1.0.81`
**Audit timestamp:** 2026/05/16 15:05:43 -03 (`America/Sao_Paulo`)

## 1.0.80 Status Update

`1.0.80` corrects the Test Lab diagnostic transport after `1.0.79` still allowed the runner to time out with “CSS Sentry did not signal on this page.” The root cause was that the website could still depend on a single DOM event/listener timing path: the extension stored sanitized diagnostics on `data-css-sentry-test-lab-*` attributes, but the runner only read those attributes during initialization and did not observe later attribute writes. The diagnostic bridge now also posts a same-origin page message, and the runner accepts both the message channel and attribute mutations. This preserves the supported Test Lab diagnostic boundary while making the signal survive the normal content-script/page-script isolation and listener-order cases used by Firefox and Chromium extension runtimes.

`1.0.80` also corrects generated Firefox MV2 host coverage. MDN documents host permissions in the `permissions` manifest key for Manifest V2 and in `host_permissions` for Manifest V3 or higher; the WXT config now emits `<all_urls>` through `permissions` for Firefox MV2 while keeping `host_permissions` for MV3 targets. The intent is unchanged: CSS Sentry uses static content-script host coverage for page scanning and still does not request `activeTab`, `scripting`, or optional host permissions.

The website deployment shape from `1.0.78` remains unchanged: normal pages are static/prerendered, and only the live verification endpoints remain dynamic.

**Package audited:** `css_sentry_1.0.80`
**Audit timestamp:** 2026/05/16 14:56:26 -03 (`America/Sao_Paulo`)

## 1.0.79 Status Update

`1.0.79` corrects the local Test Lab diagnostic boundary after localhost endpoint checks could receive controlled requests while the runner still showed no CSS Sentry signal. The diagnostic bridge now stores sanitized local scan/report details on `data-css-sentry-test-lab-*` attributes so the static runner can recover diagnostics emitted before its page listener attaches. The content script also publishes a sanitized scan-disabled diagnostic when the extension is present but the effective mode for the origin disables scanning, allowing the website to distinguish missing site access or an incompatible build from Trusted, Paused, or Never scan / never sanitize policy state.

The change preserves the 1.0.78 website deployment shape: normal pages remain prerendered/static and only live verification endpoints remain dynamic. It does not add a release-notes entry.

**Package audited:** `css_sentry_1.0.79`
**Audit timestamp:** 2026/05/16 14:35:57 -03 (`America/Sao_Paulo`)


## 1.0.78 Status Update

`1.0.78` changes the website deployment shape from server-rendering every normal page to statically prerendered pages with dynamic endpoint routes. The Test Lab still keeps live endpoint verification: `/api/session.json` creates sessions, `/api/controlled-css/[sessionId].css` generates selected controlled CSS from the shared protocol, hit endpoints record CSS-triggered requests, and result/reset endpoints remain dynamic. The extension runtime and detector behavior from `1.0.77` are intentionally unchanged.

**Package audited:** `css_sentry_1.0.78`
**Audit timestamp:** 2026/05/16 13:50:42 -03 (`America/Sao_Paulo`)


## 1.0.77 Status Update

`1.0.77` corrects the repeated late nested CSS regression by changing the normal analyzer path from append-only supplementation to priority supplementation. The source-scanned security-relevant nested rules are now analyzed before the large primary parser rule list, so analysis-budget checks cannot stop on thousands of benign padding rules before reaching the late selector probe.

The preserved invariant is that a late nested rule such as `& input[name="session_token"][value*="abc"] { mask-image: url(...) }` must produce `selector.attribute.substring_match`, `css.grouping_rule.nested`, and the remote destination finding even when the stylesheet contains a large benign prefix. The fix keeps the 1.0.73 through 1.0.74 rendered-text, scroll-state, and bounded font-side-channel coverage unchanged.

**Package audited:** `css_sentry_1.0.77`
**Audit timestamp:** 2026/05/15 23:51:18 -03 (`America/Sao_Paulo`)

## 1.0.76 Status Update

`1.0.76` corrects the remaining late nested CSS recovery failure by moving the recovery guarantee to the analyzer input boundary as well as the parser boundary. The normal analysis path now supplements primary parser output with source-scanned security-relevant nested rules when the stylesheet contains nested CSS and selector/request-risk evidence. This prevents a large primary parse from returning a partial rule set that omits the specific late nested selector probe while still reporting the analysis as complete.

The intended invariant is unchanged: a late nested rule such as `& input[name="session_token"][value*="abc"] { mask-image: url(...) }` must produce `selector.attribute.substring_match`, `css.grouping_rule.nested`, and the remote destination finding. The PortSwigger rendered-text, scroll-state, and bounded font-side-channel coverage added in `1.0.73` and corrected in `1.0.74` remains preserved.

**Package audited:** `css_sentry_1.0.76`
**Audit timestamp:** 2026/05/15 23:39:55 -03 (`America/Sao_Paulo`)

## 1.0.75 Status Update

`1.0.75` corrects the nested-rule recovery invariant after the rendered-text side-channel work exposed a regression in the normal parser supplementation path. The parser now source-scans for missing nested security rules even when the primary parser already emitted some nested-rule context, because a partial nested parse is not sufficient evidence that every late security-relevant nested selector was retained.

The fix preserves the bounded PortSwigger/fingerprinting additions from `1.0.73` and `1.0.74` while restoring the earlier large-but-below-threshold nested CSS guarantee: selector probes inside late nested CSS blocks must still produce `selector.attribute.substring_match`, `css.grouping_rule.nested`, and the remote destination finding.

**Package audited:** `css_sentry_1.0.75`
**Audit timestamp:** 2026/05/15 23:29:27 -03 (`America/Sao_Paulo`)

## 1.0.74 Status Update

`1.0.74` corrects the PortSwigger-style rendered-text side-channel implementation added in `1.0.73`. The experimental CSS fingerprinting guard now preserves scroll-state indicators for guarded overflow/content-visibility probes and aligns high-confidence rendered-text/font side-channel findings with the shared DNR eligibility authority used by runtime mitigation and fixture expectations.

The mitigation boundary remains narrow. CSS Sentry does not broadly block print/page/privacy indicators or normal remote fonts. A finding-derived request rule is eligible only when the advanced guard has produced a high-confidence rendered-text, text-node, or browser-specific text signal with a concrete request target and the normal severity/cross-origin eligibility gates are satisfied.

**Package audited:** `css_sentry_1.0.74`
**Audit timestamp:** 2026/05/15 23:13:42 -03 (`America/Sao_Paulo`)
**Audience:** maintainers, reviewers, and release decision-makers  
**Related documents:** `README.md`, `docs/SPEC.md`, `docs/CVE_SPEC.md`, `docs/SECURITY.md`, `docs/PRIVACY.md`, `docs/PERMISSIONS.md`, `docs/RELEASE_CHECKLIST.md`, `docs/RELEASE_NOTES.md`, `docs/SELF_SECURITY.md`


## 1.0.73 PortSwigger Rendered-Text and Bounded Font-Side-Channel Coverage

`1.0.73` extends the experimental CSS fingerprinting guard with the PortSwigger rendered-text and layout-side-channel families that were not represented as first-class executable coverage. The implementation remains bounded: these findings use `privacy.css_fingerprinting.*` reason codes and are reported only when the advanced `enableCssFingerprintingGuard` setting is enabled unless they also satisfy an existing Fontleak-style evidence model.

Executable coverage added in this release includes `::first-line` rendered-text probes, `::first-letter` rendered-text probes, overflow and scroll-state layout probes, CSS that makes script text nodes renderable and applies a remote unicode-range font, Firefox-style n-character rendered-text extraction, Firefox-style reversed-text extraction, and an additional bounded ligature/unicode-range Fontleak fixture. Safari-specific rendered-text/font quirks remain documented as unsupported browser-scope references because CSS Sentry does not currently support Safari as an extension target.

The parser source-scan relevance filter now retains rendered-text pseudo-element, text-node, overflow, scroll-state, and bidirectional-text rules so large-source recovery does not drop the same side-channel evidence that normal parsing can analyze. Documentation now states the limitation explicitly: CSS Sentry observes CSS selectors, declarations, URLs, remote-font references, and browser-visible request or measurement signals; it does not inspect crafted font binaries, prove ligature substitution tables are malicious, or claim universal prevention of every rendered-text or font metric side channel.

## 1.0.72 CSS Fingerprinting Guard and Defensive Canary Compatibility

`1.0.72` adds the first bounded implementation of the experimental CSS fingerprinting guard. The guard is off by default and is exposed only as an advanced compatibility/privacy setting. When enabled, the analyzer reports selected browser-visible conditional CSS remote-resource signals such as `@media print`, `@page`, `@supports`, and `@container` remote resources. These findings use `privacy.css_fingerprinting.*` reason codes so they remain separate from selector/value exfiltration findings.

The implementation deliberately avoids claiming universal CSS fingerprinting protection. The guard reports conditional CSS-triggered resource signals that CSS Sentry can observe from page CSS. It does not attempt to identify all environment probes, all visual deception, all browser fingerprinting, all email-client fingerprinting, or all extension-presence detection techniques.

This release also adds defensive CSS honeytoken compatibility coverage. A cloned-site/canary CSS callback that performs a remote `url(...)` request without a sensitive selector probe remains non-actionable by default. Strict mode compatibility guidance now treats defensive canary endpoints as allowlist candidates when a site intentionally depends on those callbacks.

Executable coverage added in this release includes benign defensive CSS canary fixtures, `@media print` CSS fingerprinting fixtures, `@page` CSS fingerprinting fixtures, parser coverage for `@page` declarations, policy normalization for the new advanced flag, reason-group coverage for fingerprinting reasons, and analyzer coverage proving the guard is disabled by default.

## 1.0.71 Firefox Runtime Report Acknowledgement Correction

`1.0.71` fixes the Firefox runtime e2e failure where the content script published an actionable Test Lab scan diagnostic but did not receive a successful report-save acknowledgement from the background path. The correction keeps the Firefox runtime test assertion meaningful: the background path must still persist the report and return a positive `css-sentry:test-lab-report` acknowledgement for actionable findings.

The implementation isolates badge API compatibility behind `src/browser/platform/actionApi.ts`. Chromium-compatible MV3 runtimes can continue using `browser.action`, while Firefox MV2 runtimes can use `browser.browserAction`. Badge updates are now treated as a non-critical UI side effect, so a missing or rejected badge update cannot convert an already-saved report into a failed report acknowledgement. Runtime message validation also accepts Firefox tab-bound content-script messages that omit `sender.frameId`, defaulting the saved frame to the top frame while preserving the rule that privileged policy messages cannot come from tab-bound content scripts.

## 1.0.70 Parser-Boundary Nested CSS Recovery Correction

`1.0.70` fixes a core analyzer regression where a late nested CSS selector probe could be missed when the stylesheet was large enough to stress the primary parser path but still below the configured large-stylesheet byte threshold. The correction is applied at the parser boundary: when the primary parser output has no nested-style-rule context, the parser supplements missing security-relevant nested source rules from the source scanner before import recovery and analyzer scoring.

This preserves the existing performance-budget recovery branch for genuinely budget-exceeded parsing while covering the separate normal-parser omission path. Focused parser coverage now asserts that source-scanned nested security rules are present, and analyzer coverage continues to assert substring selector, nested-rule, and remote destination findings for the reported regression case.

## 1.0.69 Firefox Runtime E2E Verification Gate Correction

`1.0.69` corrects the Firefox runtime e2e package after local TypeScript validation exposed a socket data type mismatch in `tests/e2e/firefox-extension-runtime.spec.ts`. The Firefox remote-debugging client now normalizes socket data before packet parsing, preserving the binary packet parser while satisfying Node's typed socket data event contract.

The normal extension release gate now includes the Playwright browser installation step before running the e2e suite. `pnpm verify:full` remains the single strict release-validation command and now covers both Chromium extension e2e behavior and the Firefox runtime e2e path added in `1.0.68`, instead of requiring a separate targeted Firefox e2e command after the full gate.

## 1.0.68 Firefox Runtime E2E Coverage

`1.0.68` closes the Firefox runtime e2e coverage gap for the extension without introducing Selenium or a browser-driver stack outside Playwright. The new `tests/e2e/firefox-extension-runtime.spec.ts` launches a Playwright-controlled Firefox persistent context, installs the built `.output/firefox-mv2` extension as a temporary add-on through Firefox's remote debugging add-on actor, and verifies runtime behavior through the extension's local Test Lab diagnostic events.

The test does not require discovering the temporary `moz-extension://` UUID. Instead, it uses a localhost fixture marked with the CSS Sentry Test Lab metadata, installs a fake token selector probe, and asserts that Firefox receives both `css-sentry:test-lab-scan` and `css-sentry:test-lab-report` diagnostics with actionable findings and expected reason codes. This proves that the Firefox build loads into a real Firefox runtime, that the content script scans a browser page, and that the background report-save path acknowledges the scan.

The e2e setup command installs both Chromium and Firefox for Playwright-backed browser validation. Starting with `1.0.69`, `verify:full` runs that setup before the e2e suite so the Firefox runtime e2e path is part of the normal full release gate. The project-structure guard checks that the Firefox runtime e2e file remains tied to `.output/firefox-mv2`, uses Playwright's Firefox launcher, exercises both diagnostic events, and does not introduce Selenium/WebDriver dependencies.

## 1.0.67 Website Test Lab Guided Runner Completion

`1.0.67` completes the Test Lab website overhaul that was not downloadable in the previous chat. The website now uses a guided `/tests/` runner as the primary user surface. Individual `/tests/:caseId/` URLs redirect into the runner with that case selected, preserving deep links while preventing duplicated report instructions, endpoint interpretation, mode controls, and troubleshooting copy.

The runner renders selected controlled CSS in the initial document, supports one check, category checks, and all-check execution, polls endpoint results per selected check, records manual popup/report confirmation per check, and stores local run history that can rerun the same case selection.

The extension diagnostic path now separates scanner completion from background report-save acknowledgement through local Test Lab events. This lets the website distinguish these states: no extension signal, scanned with zero findings, scanned with findings, report saved, report not acknowledged, endpoint received, endpoint not received, and manual popup/report not yet checked.

The website coverage model is documented as controlled coverage completion, not as a page named matrix. The implemented public checks cover setup smoke behavior, exact/prefix/suffix/substring selector probes, repeated selector probes, `:has()` representation, background/mask/image-set sinks, `@import`, `@supports`, `@media`, nested CSS, `@layer`, large stylesheet late selector, large import recovery representation, custom property URL indirection, `var()` fallback chains, attr/if representation, remote font signals, and font measurement indicators.

Remaining release validation for the website is dependency-backed and deployment-backed: install dependencies with an updated lockfile, run the Astro build, run the website source verifier, exercise the runner in a browser with CSS Sentry installed, and validate the Cloudflare Worker deployment and WAF/rate-limit configuration before treating the public website as deployment-complete.

## 1.0.66 Release Validation Script Correction

`1.0.66` corrects the root release-validation command after the website work added `verify:website-source` to `verify:full`. The project-structure test intentionally keeps `verify:full` focused on extension release gates: build, Firefox build, zip creation, Firefox zip creation, manifest verification, release artifact verification, AI report verification, source CSS verification, compile, unit/integration tests, and e2e tests.

Website source verification remains available through `pnpm verify:website-source` and is still used by the disabled website deployment workflow. It is not part of the strict extension `verify:full` command because that command is guarded as the extension release contract.

No extension runtime behavior changes are introduced by `1.0.66`. The localhost Test Lab diagnostic behavior remains the behavior added in `1.0.65`; users must run or install a build containing that diagnostic path to see the Test Lab extension signal. General content-script scanning already targets `<all_urls>` through the existing content-script match and host-permission model.

## 1.0.62 Website Runtime and Readability Correction

`1.0.62` fixes the website session endpoint and Test Lab layout issues found during local visual testing. The session endpoint no longer reads the removed `Astro.locals.runtime` API and now imports Worker environment bindings from `cloudflare:workers`, which is the current Astro Cloudflare adapter path for environment variables and secrets. This prevents the live session API from rendering an Astro runtime error page when the user starts selected checks.

The Test Lab UI now uses readable full-width test-case cards, compact summaries, expandable mode-specific interpretation sections, and a horizontally bounded result table. This replaces the cramped per-card mode tables that made endpoint/report/meaning content unreadable at normal browser widths.

The live CSS injection path now keeps `@import` rules before normal CSS rules, preserving the imported-probe test when multiple cases are selected. The remote-font representation now uses a dedicated `.woff2` hit endpoint, and selected cases move from `pending` to `not received` after polling completes. A website source verification script was added to guard these invariants. The disabled website workflow now runs the verifier before build and uses a non-frozen install until a regenerated website lockfile importer is committed.

## 1.0.61 Website Workspace and Test-Lab Interpretation Correction

`1.0.61` fixes the website package installation path for pnpm users. The repository already had a root `pnpm-workspace.yaml`, but the website package was not listed under `packages`, so pnpm treated only the root extension package as part of the workspace. In that state, running `pnpm install` from `website/` could report that the workspace was already up to date while no website `node_modules` directory or `astro` binary existed. The workspace now explicitly includes the root package and `website`, and the root package exposes `website:dev`, `website:build`, `website:preview`, and `website:astro` scripts using `pnpm --filter css-sentry-website`.

The website content also now includes per-case report expectations and a Passive/Balanced/Strict/Trusted/Paused interpretation table. This reduces ambiguity in the live Test Lab: a received endpoint hit is not interpreted as one universal failure, and a missing endpoint hit is not interpreted as a complete security proof. The disabled Cloudflare workflow under `_.github` was updated to install and build through pnpm workspace commands after activation.

## 1.0.60 Website Test Lab Foundation

`1.0.60` adds a separate Astro website foundation under `website/` for a CSS Sentry Test Lab. The website uses fake sentinel values and controlled same-origin endpoints to let users compare live endpoint results with CSS Sentry popup and report behavior in the selected protection mode. The website is explicitly not a complete security guarantee and is documented as a behavior verification surface rather than a vulnerable/not-vulnerable badge.

At introduction time, the implementation used Astro server output for Cloudflare Workers, a Worker-oriented `wrangler.jsonc`, optional server-side Turnstile validation for test-session creation, controlled hit/result/reset endpoints, and a disabled Cloudflare Workers deployment workflow under `_.github/workflows/` so it could not run until intentionally renamed to `.github`. The active deployment shape was later changed in `1.0.78` to prerender normal pages and keep only the live verification endpoints dynamic. Website coverage and remaining requirements are tracked in `docs/STATUS_WEBSITE.md`.

## 1.0.59 Analyzer Budget Structure Guard Correction

`1.0.59` corrects the project-structure regression exposed by `tests/integration/project-structure.test.ts` after the analyzer budget-resilience refactor. The analyzer behavior from `1.0.57` and `1.0.58` remains unchanged: when parser or analyzer budget limits are reached, `analyzeStylesheet()` still builds a performance-budget summary that includes recovered remote imports and security-critical source-scanned non-import rules.

The correction preserves the structure guard's intended helper boundary by naming the analyzer helper `securityCriticalRulesFromBudgetedParse`. That helper is the local analyzer bridge between `BudgetedParseResult` and budget-resilient source-rule analysis; parsing-phase budget checks remain inside `src/core/css/parser/`, while the analyzer only consumes `parseResult.budgetExceeded` and prepares security-critical rules for summary construction.

## 1.0.58 Firefox Enhanced-Inspection Type Surface Correction

`1.0.58` corrects the TypeScript public type-surface regression exposed by `tests/unit/browser/firefox-enhanced-inspection.test.ts` after the 1.0.57 platform optionality isolation. The 1.0.57 refactor correctly moved Firefox response-filtering shape definitions into `src/browser/platform/firefoxWebRequestApi.ts`, but `src/browser/firefox/enhancedStylesheetInspection.ts` stopped re-exporting `FilterResponseData`, `FirefoxWebRequest`, and `WebRequestDetails`. Existing test and internal import paths therefore failed under `tsc --noEmit` even though runtime behavior did not change.

The correction keeps platform optionality isolated in `src/browser/platform/firefoxWebRequestApi.ts` while restoring the stable import path from `src/browser/firefox/enhancedStylesheetInspection.ts` through type-only re-exports. This preserves the intended refactor boundary and avoids forcing callers to know the platform module path merely to type test doubles for `inspectFirefoxStylesheetResponse()`.

## 1.0.57 Analyzer Regression and Cross-Cutting Refactor Follow-Up

`1.0.57` corrects the analyzer regression reported after the UI lifecycle package. The affected path was the normal parser/analyzer performance-budget branch for a large, nested, selector-sensitive rule near the end of a long stylesheet. Previously, when the budget path was reached, `analyzeStylesheet()` preserved only recovered `@import` rules in the performance-budget summary. That was insufficient for nested selector probes with remote sinks. The analyzer now runs a budget-resilient source scan for security-relevant rules before producing the performance-budget summary, allowing actionable nested findings to remain visible alongside the informational budget finding.

The fallback source parser relevance filter was also corrected so CSS value functions such as `attr()`, `if()`, `style()`, and `var()` use literal regular-expression word boundaries. This preserves the intended large-source scanning behavior for modern CSS value-based exfiltration patterns.

Reason-code grouping is now centralized in `src/shared/reasonGroups.ts`. DNR eligibility, content neutralization candidate selection, finding priority, partial-analysis display filtering, and frame-partial report merging now use the shared reason group helpers instead of repeating local prefix and membership checks. This keeps security-relevant reason semantics in one authority while preserving existing finding reason strings.

Browser optional API detection is now routed through `src/browser/platform/`. DNR session-rule availability, Firefox response filtering availability, optional navigation/storage event surfaces, and aggregate browser capability reads are isolated from the policy, DNR, Firefox enhanced-inspection, and background orchestration modules.

Targeted clock injection now covers analyzer timing, parser budget checks, finding timestamps, report timestamps, DNR diagnostic timestamps, report-retention timestamps, and partial-coverage summaries. Defaults still use the system clock, while tests and deterministic callers can inject a clock at the behavior-bearing boundary.

## 1.0.56 UI Lifecycle and State Authority Refactor Package

`1.0.56` completes the UI lifecycle refactor package. The content-script entrypoint now loads policy and mode, then delegates lifecycle ownership to `src/browser/scanner/documentScanController.ts`. That controller owns initial scans, DOMContentLoaded/load rescans, mutation-observer setup, debounced mutation rescans, scan-complete sending, content neutralization application, last-summary tracking, and disposal. `src/entrypoints/content.ts` is intentionally kept as wiring rather than a mixed lifecycle authority.

Popup and Options now separate rendering from state/effect ownership. Options policy loading, DNR status loading, save-state timing, policy normalization, and policy persistence live in `useOptionsState()`. Pure policy update helpers live in `optionsPolicyActions.ts`, covering normalized origin-list additions/removals, compatibility toggles, advanced-mode visibility, and per-origin mode overrides. Popup tab/report/policy loading, clear-report/open-page effects, quick-mode persistence, and saved-mode timing live in `usePopupState()`. Derived popup display state, including visible/hidden partial findings, mitigation counts, installed-rule counts, coverage findings, highest severity, current origin, status text, and visible mode order, lives in `popupDerivedState.ts`; finding-action classification lives in `popupFindingState.ts`.

The release also adds `src/shared/mountReactRoot.tsx`, so popup, options, and report entrypoints share a checked root-mount boundary and no longer repeat unchecked `document.getElementById("root")!` assertions. The Options page local reports/settings card structure was corrected so the section is not malformed or nested by an accidental duplicated opener. Focused tests now cover the document scan controller, options policy actions, and popup derived state, while project-structure checks guard against re-accumulating lifecycle/state responsibilities inside UI entrypoints.

## 1.0.55 Analyzer and Parser Authority Refactor Package

`1.0.55` completes the analyzer/parser refactor package and fixes the large-stylesheet import regression reported after `1.0.54`. The parser public entrypoint remains `src/core/css/parseCss.ts`, but implementation authority is now separated under `src/core/css/parser/`: parser budget state and checks live in `parseBudget.ts`, css-tree adaptation lives in `cssTreeAdapter.ts`, source fallback parsing lives in `fallbackCssParser.ts`, import recovery lives in `importRecovery.ts`, and grouping at-rule constants live in `cssParserConstants.ts`.

The important behavior correction is that recovered `@import` rules are no longer dependent on the sequential full-source scan reaching the end of an oversized stylesheet before the time budget is reached. The import-recovery path scans the source independently, deduplicates imports already parsed by css-tree or source parsing, and allows recovered remote imports to be analyzed even when the final summary state is `analysis.skipped.performance_budget`. This preserves partial-analysis transparency while preventing a late remote import from being lost under heavy test/runtime load.

The analyzer is also split into named authorities: `analyzeStylesheet.ts` owns high-level orchestration and performance-budget summary construction, `stylesheetRuleAnalysis.ts` owns per-rule finding construction, `stylesheetRiskContext.ts` owns remote font and side-channel context, `findingPriority.ts` owns capped-finding replacement, and `findingDetails.ts` owns diagnostic detail text. `findingForDeclaration()` now returns a `Finding | null` instead of mutating the finding array directly; capped insertion remains centralized in `findingPriority.ts`.

Validation added or preserved for this package includes parser-focused tests for budget-independent import recovery, analyzer performance-budget summaries that still include recovered remote-import findings, malformed nested/unmatched-string recovery, the full fixture corpus including `large-stylesheet-full-source-scan-import.css`, analyzer unit coverage, and project-structure checks for the new parser/analyzer authority split.

## 1.0.54 Storage and Policy Authority Refactor Package

`1.0.54` completes the next refactor package after the DNR authority split. The public storage entrypoint remains `src/browser/storage/reports.ts` so existing popup, options, report page, background, content, and test imports keep the same stable API. The implementation responsibilities are now separated into named authorities: `reportCapping.ts` owns stored-report, frame-report, and summary caps; `reportMerging.ts` owns frame upsert and partial-frame deduplication; `reportRetention.ts` owns stale/count-based removal selection and the browser-storage removal effect; `policyStore.ts` owns settings persistence; `policyNormalization.ts` owns policy schema normalization, mode validation, origin-list cleanup, allow/block precedence, and compatibility flag filtering; and `settingsImport.ts` owns import-size and JSON-object validation before normalization.

The package preserves existing behavior: reports are still redacted before storage, frame reports still merge by frame ID, aggregate findings and frame counts remain capped by `REPORT_LIMITS`, lowering retention still prunes stale reports after policy save, explicit pruning still works, imported settings still reject non-object JSON and remove obsolete/unknown compatibility fields, and blocklisted destinations still remove matching allowlist entries. Focused unit coverage now verifies the split authorities directly while broad report-storage integration tests remain in place for storage/browser interaction. Navigation-frame partial-coverage behavior was moved to a direct scanner test so report-storage tests no longer own that scanner-only behavior.

Validation status: source-level strict TypeScript checks passed for the storage source modules and new focused storage tests using local declarations for unavailable environment modules. Compiled CommonJS runtime assertions passed for policy normalization, settings import, report merging, capping, retention selection, retention effects with a browser-storage mock, and the public `saveFrameReport` / `saveSitePolicy` orchestration. `node scripts/verify-source-css-format.mjs` and `node scripts/verify-ai-report-config.mjs` were attempted and passed in this environment. Full `npm run compile` and Vitest execution remain environment-blocked in this extracted package because dependencies and generated WXT config are not installed here; the user reported the prior local package test line passing before this continuation.

## 1.0.53 DNR Canonicalization and Timer-State Refactor Correction

`1.0.53` corrects the package-2 test failure without weakening the production DNR target preparation path. Browser URL parsing canonicalizes an IDN host such as `exämple.test` to the ASCII hostname `xn--exmple-cua.test`; DNR initiator-domain and request-target preparation should preserve that canonical hostname instead of treating the original Unicode input as an unsupported domain. The focused DNR target-preparation test now asserts canonical IDN output, still ignores unsupported opaque origins such as `null` and `about:blank`, and adds coverage for IDN request targets and policy-origin normalization.

This package also finishes the remaining low-risk timer-state extraction from the refactor safety harness: `InfoTooltip` no longer owns the delayed-close timer inline and instead delegates disclosure timing to `useTooltipDisclosure()`. The hook has direct fake-timer tests for immediate opening, delayed close, reopen cancellation, and unmount cleanup. The oversized-stylesheet analyzer regression test was also made deterministic by freezing `Date.now()` inside that test, preventing environment speed from converting a large-source scanning assertion into a performance-budget assertion.

## 1.0.52 DNR Authority Refactor Package

`1.0.52` completes the next production refactor package after the safety harness. The public DNR API remains in `src/browser/dnr/chromeDnr.ts`, but the underlying responsibilities are now separated into named authorities: `dnrRuleAllocation.ts` owns session-rule ID selection and tab-scoped rule discovery, `dnrTargetPreparation.ts` owns URL parsing, fragment removal, ASCII and length rejection, policy-origin target normalization, and initiator-domain derivation, `dnrRuleBuilder.ts` owns DNR rule construction and policy rule ordering, `dnrRuleUpdate.ts` owns `updateSessionRules` batching and salvage behavior, and `dnrStatus.ts` owns diagnostic status persistence and skipped-target reason summaries.

The refactor is intended to preserve behavior while reducing mixed responsibilities in the security-relevant DNR path. Added unit coverage checks the new authorities directly: allocation reuse and range scoping, exact request URL normalization, unsupported and unsafe target rejection, policy-origin normalization, initiator-domain derivation, policy rule priority/order, strict third-party/SVG rule construction, and update salvage after a batch failure. Broad DNR browser-integration coverage remains in place.

## 1.0.51 Test-Isolation Assertion Correction

`1.0.51` corrects the unavailable package line that could not be downloaded from the previous chat. The stale project-structure assertion still expected the old direct `beforeEach(() => { __resetBrowserMock(); });` source string even though the intended setup resets the aliased `wxt/browser` mock instance through `resetAliasedBrowserMock()`. The guard now checks the aliased reset contract, React Testing Library cleanup, before/after reset symmetry, absence of relative `./browser-mock` setup imports, and absence of generated JavaScript setup artifacts. This is test-support-only and preserves extension runtime behavior.

## 1.0.49 Refactor Harness Test-Isolation Correction

`1.0.49` corrects the test isolation boundary introduced during the refactor safety harness work. The previous reset hook imported the browser mock through a relative setup-file path, while runtime code and React/DNR tests use the `wxt/browser` alias. In Vitest/Vite module resolution, those paths can be treated as different module instances, so mock storage, DNR session rules, and UI policy state could still leak between tests. The setup file now resets the aliased `wxt/browser` mock instance before and after each test, while React Testing Library cleanup remains after each test. This is a test-support correction only and does not change extension runtime behavior.

## 1.0.47 Refactor Harness Type-Safety Correction

`1.0.47` corrects the typed DNR mock helper introduced during the `1.0.46` refactor safety harness work. The update preserves the helper boundary while typing mocked `addRules` values as mock DNR rules instead of `unknown[]`, allowing tests that inspect generated DNR regex filters to remain type-safe without local casts. No runtime extension behavior changes are introduced by this correction.

## 1.0.46 Refactor Safety Harness

`1.0.46` starts the code-quality refactor sequence with the safety harness work required before splitting production authorities. DNR tests were separated from report/storage coverage and now use typed DNR mock helpers instead of direct mock-private casts in test bodies. The content-script mutation rescan debounce moved into a named document scan scheduler with fake-timer coverage for debounce, cancellation, immediate flush, iframe/style/subtree rescan detection, and mutation-storm coalescing. Popup and Options saved-state timers now use a shared transient-value hook with cleanup coverage, reducing unowned UI timers. Source CSS files were expanded from minified one-line source into reviewable CSS and a source-CSS verification script was added to `verify:full`. The extension e2e policy synchronization helper now uses Playwright polling instead of fixed sleep loops.

## 1.0.42 Firefox, DNR, Performance, Advisory, and Artifact Hardening

`1.0.42` addresses the remaining high-priority implementation gaps identified after the `1.0.41` DNR reporting correction. Firefox enhanced stylesheet inspection now has browser-target manifest permissions aligned with its response-filter dependency, generated manifests are verified after build, and Chrome-target output must remain free of Firefox-only permissions.

DNR rule ownership now uses live session-rule state rather than modulo tab buckets. Finding-derived and tab-policy rules allocate rule IDs from non-overlapping ranges, tab cleanup removes actual tab-scoped session rules, and DNR target preparation strips fragments, rejects unsupported targets before rule creation, applies initiator-domain scoping when source origin data is available, and salvages valid rules when a mixed batch contains a rejected rule.

Firefox enhanced stylesheet inspection is bounded. It still writes response bytes through unchanged, but retained analysis bytes are capped by the configured stylesheet byte budget. Oversized or failed response analysis now records `analysis.skipped.performance_budget` partial coverage rather than silently omitting coverage or buffering without a bound. The analyzer also exposes a performance-budget partial state for long-running stylesheet analysis.

FreeScout CVE-2026-40497 is now fixture-backed with a rendered helpdesk/mailbox attack fixture and a benign support-signature fixture. Release hardening now includes generated-manifest verification and release-artifact verification, including a no-sourcemap packaged-artifact policy.

## 1.0.41 DNR effective-request URL reporting correction

`1.0.41` corrects the diagnostic output from finding-derived DNR rule installation. The DNR rule matcher already removed URL fragments before generating exact regex filters, because fragments are not part of browser network requests. The result object now reports the same effective request URL for installed and policy-blocked finding-derived rules instead of preserving the raw CSS/SVG reference with `#fragment`. This keeps runtime behavior, test expectations, and report-facing diagnostics aligned with the actual DNR enforcement target.

The correction preserves the `1.0.39` shared DNR eligibility authority and the `1.0.40` SVG remote-resource sink expansion. The previous fixture failures were fixed by broadening eligibility for valid SVG sink classes; this update fixes the separate regression-test mismatch where fragment-bearing SVG URLs were eligible and installed but reported with a fragment that DNR itself cannot match.

## 1.0.40 DNR eligibility correction

`1.0.40` corrects the shared DNR eligibility authority introduced in `1.0.39`. The 1.0.39 refactor correctly moved fixture block-candidate checks onto the same pure decision module used by runtime DNR mitigation, but the extracted Balanced-mode predicate was too narrow for direct SVG remote-resource sinks. Cross-origin SVG `feImage`, SVG animation URL, SVG paint/reference, and generic SVG resource-attribute findings are now treated as finding-derived future-block DNR candidates when they satisfy severity and URL requirements.

The fixture expectations remain authoritative for these advisory classes. They were not weakened because the failures showed a regression in the extracted eligibility rule, not a stale fixture contract. A targeted storage/DNR regression test now exercises the scanner-to-DNR path for SVG remote-resource findings so the shared eligibility rule cannot omit those sink classes without failing behavior coverage.

## 1.0.39 Release hardening

`1.0.39` separates browser-target manifest permissions so Chrome builds do not request Firefox-only `webRequest`, makes report retention normalization and pruning immediate through the storage/settings authority, shares DNR finding eligibility between runtime mitigation and fixture expectations, adds behavioral Firefox enhanced response-inspection tests, changes `verify:full` to a strict fail-fast release gate, pins the moving `@vitejs/plugin-react` declaration, and updates stale Firefox-enhanced documentation wording.

## Purpose

`docs/STATUS.md` tracks what is implemented, what is tested, what is partially covered, and what remains before CSS Sentry can honestly move from pre-release packages to the next release candidate and then stable `1.0.0`.

This document is intentionally stricter than the README. Update it whenever implementation behavior, tests, parser coverage, mitigation behavior, UI behavior, privacy behavior, or release readiness changes.




## 1.0.38 Audit Note — Browser Navigation Partial-Frame Coverage Correction

`1.0.38` corrects the incomplete `1.0.37` cross-origin iframe fix. The previous mutation-rescan path was not sufficient in the browser e2e environment because the top-frame DOM scan can still miss or fail to persist the cross-origin frame partial summary. The background script now records cross-origin subframe partial coverage from browser `webNavigation` subframe events, including failed subframe navigations, before the report page needs to render the coverage metadata.

The browser-level fallback is deliberately narrow: it records only non-top-frame HTTP-like navigations whose origin differs from the current top-level tab origin and only while the effective mode still scans the page. Same-origin frames are left to normal content-script analysis. Stored report summary aggregation now deduplicates parent-scan and navigation-event partial coverage for the same frame URL so the fallback does not inflate partial-frame counts when both evidence paths observe the same frame.

## 1.0.37 Audit Note — Iframe Mutation Rescan Correction

`1.0.37` corrects the cross-origin iframe partial-coverage regression exposed by the browser e2e test after partial-analysis finding rows became hidden by default. The content script now treats inserted `iframe[src]` elements and `src` / `data` attribute changes as rescan triggers, so a page whose document-start scan runs before iframe markup exists can still produce the stored partial-frame coverage summary used by the report page.

The correction keeps the display option contract from `1.0.35` and `1.0.36`: detailed `frame.cross_origin.uninspectable` rows remain optional, but the report must still receive and show partial-frame coverage metadata by default. A source-level regression check now protects the content-script rescan selector and attribute filter from losing iframe coverage triggers.

## 1.0.36 Audit Note — Partial-Analysis E2E Alignment and Fixture-Corpus Verification Clarification

`1.0.36` corrects the browser e2e expectation introduced by the real `Show partial-analysis findings` implementation. Cross-origin frame partial coverage remains visible by default through the report's partial-frame coverage summary, frame metadata, and hidden partial-analysis finding notice. The detailed `frame.cross_origin.uninspectable` reason row is now asserted only after the partial-analysis display option is enabled, matching the actual settings contract.

The fixture corpus remains executable through `tests/integration/fixtures.test.ts`. That test file enumerates every active `.css` and `.html` fixture in both attack and benign fixture folders, requires a matching `.expected.json` file for each active fixture, rejects orphan expectation files, and runs each fixture against its expected reason, severity, destination, block-candidate, and partial-coverage assertions. The compact Vitest reporter shows this as one test file with many tests instead of printing every generated fixture case by default.

## 1.0.35 Audit Note — Partial-Analysis Display Option and Remote-CSS Privacy Invariant

`1.0.35` corrects the settings surface after the `1.0.34` advisory coverage package. The `Show partial-analysis findings` setting now changes popup and report presentation behavior: informational partial-analysis finding rows are hidden by default and shown when the option is enabled. The underlying report evidence remains stored and exportable, and analysis completeness indicators such as partial frame and stylesheet counts remain visible.

The previous `Never fetch remote CSS from the extension` checkbox is removed because CSS Sentry does not have an extension-context remote stylesheet fetch feature to toggle. The underlying requirement remains covered as a hard privacy and compatibility invariant: ordinary analysis must not fetch remote CSS from the extension context. The Options page now presents this as explanatory privacy text rather than a no-op checkbox, and source-level tests continue to reject extension-context CSS fetch code.

## 1.0.34 Audit Note — Hono Inline-Style and Tandoor Stored-Style Advisory Coverage

`1.0.34` closes the known post-`1.0.33` advisory traceability gaps without adding a new detector class. Hono CVE-2026-44458 is now represented by a rendered JSX SSR inline-style fixture with declaration-level data probing and remote string-form `image-set(...)` sinks, plus a benign style-object presentation fixture. Tandoor CVE-2026-35046 is now fixture-backed with stored recipe/rich-text `<style>` selector-probe coverage and a benign recipe presentation fixture. PostCSS CVE-2026-41305 remains adjacent/out of scope because CSS Sentry does not stringify user CSS into HTML style tags.

## 1.0.33 Audit Note — Postponed Advisory Coverage and Tooltip Hover Correction

`1.0.33` completes the postponed advisory and implementation items that were intentionally left out of the neutralization/tooltip containment work. Mermaid CSS injection is now represented by fixtures for scope-escape selector probing and classDef-style breakout into a remote `background-image` sink. justhtml custom-policy sanitizer bypass coverage is represented by preserved `<style>` exfiltration and preserved SVG `filter="url(...)"` remote-resource fixtures. XWiki CVE-2026-26000 is tracked as a CSS-injection watchlist item with executable exfil-only coverage; UI-redress-only click manipulation remains adjacent/out of scope unless it also includes CSS request-based exfiltration.

The optional Firefox enhanced stylesheet response-inspection path no longer reintroduces the previous large-stylesheet skip class. It writes the original response through unchanged, collects the response body, and analyzes it through the same stylesheet analyzer used by the baseline path. Large response bodies therefore use the large-source scanner rather than returning without analysis after the standard text-size threshold.

The popup/options tooltip implementation remains viewport-clamped, but hover behavior has been restored to immediate open semantics. The `?` control opens on hover/focus/click, the tooltip remains available while moving from the trigger into the bubble, and outside click/Escape close it.

## 1.0.32 Audit Note — Neutralization/DNR Composition and E2E Regression Corrections

`1.0.32` corrects the mitigation composition model exposed by `1.0.31`. Content-level neutralization and finding-derived DNR mitigation are not mutually exclusive. A high-confidence finding may need a page-visible neutralization rule so computed styles no longer expose a dangerous request-producing declaration, while also needing a precise DNR rule so reloads and later matching requests are blocked at the network boundary.

Findings can now carry an additional mitigation action when a page-changing primary action also receives an installed DNR rule. Popup, report, and false-positive sweep logic inspect the full mitigation action set instead of looking only at the primary action. `Mitigated` remains a unique-finding count and does not double-count a finding that was both neutralized and backed by a DNR rule.

The e2e regression expectations were also corrected to account for the neutralization style element injected by CSS Sentry. Tests now count the original page style separately from the extension-injected neutralization style without depending on a fixed page-visible marker, and preserve the report assertion that a same-origin POC finding records installed-rule mitigation even when content neutralization is enabled.

## 1.0.31 Audit Note — Content Neutralization and Tooltip Containment

`1.0.31` adds an optional content-level neutralization layer for confirmed high-confidence CSS exfil findings. This complements DNR mitigation by injecting precise override CSS for safely targetable request-producing declarations, so page-visible computed style checks can stop seeing the dangerous sink value where the selector and property are known. The feature is enabled by default but remains a compatibility setting because it changes page CSS for confirmed high-confidence findings.

Neutralization is bounded to avoid repeating prior false-positive classes. It requires high or critical severity, a selector, a network-capable CSS property, a remote destination, a sink reason, and data-probe evidence from sensitive selectors, declaration-level `attr()` / `if()` / `style()` logic, or modeled font-side-channel findings. It does not neutralize redacted selectors or arbitrary low-confidence layout CSS.

The popup tooltip implementation was replaced with a viewport-clamped root-level tooltip. The help text remains accessible through the compact `?` controls, but the bubble is fixed-positioned and clamped inside the popup viewport instead of being clipped inside each card.

## 1.0.30 Audit Note — DNR Action Semantics and Popup Clarity Correction

`1.0.30` corrects the popup/report wording around finding-derived DNR mitigation. The implementation introduced `rule_installed_dnr` as the current action for precise DNR rules installed after CSS analysis. `blocked_dnr` remains reserved for already-active prevention semantics. Older reports using `rule_installed_dnr` are still displayed as installed-rule findings for compatibility, but new reports no longer use the “future” action label.

The popup summary now uses `Mitigated`, `Prevented`, and `Rules active`. `Prevented` is intentionally zero when no already-active policy or page-changing mitigation is known to have prevented the current load. `Rules active` counts high-confidence findings for which precise DNR rules were installed after analysis. `Mitigated` combines already-prevented findings and installed-rule findings so the user does not see a misleading “Blocked 0” as the primary protection signal.

## 1.0.29 Audit Note — Fontleak Ligature Feature Evidence Correction

`1.0.29` corrects the Fontleak ligature-feature evidence path introduced in `1.0.28`. The analyzer now recognizes active `font-feature-settings` values when parser normalization removes the whitespace between a feature tag and its numeric value, such as `"liga"1`. The correction preserves the intended evidence model: active ligature features can contribute to Fontleak-style generated-content and font-chain findings, while disabled values such as `"liga" 0` do not contribute `css.font_ligature_feature`.

## 1.0.28 Audit Note — Fontleak Container-Query Text-Exfil Tracking and Partial Enforcement

`1.0.28` extends the `1.0.27` Fontleak-side-channel work with more precise evidence modeling. The analyzer now distinguishes remote font presence from actionable Fontleak evidence. Remote `@font-face` alone remains non-actionable. A container query alone remains non-actionable. Actionable Fontleak-style findings require a network-capable sink plus modeled evidence such as remote-font measurement setup, generated-content probing, ligature feature activation, animation-driven font-family chaining, remote import-chain participation, or a size-based container query that gates the request.

New executable coverage includes static ligature/container text-exfiltration, remote-import-chain container exfiltration, animation-based font-family chaining, normal remote webfont plus component-container UI, and normal remote ligature font usage without a network exfil sink. This preserves the project boundary: CSS Sentry partially detects and mitigates observable CSS-triggered Fontleak request paths, but it does not inspect crafted font binaries or claim universal prevention of every font metric side channel.

## 1.0.27 Audit Note — Inline Conditional CSS and Font Side-Channel Hardening

`1.0.27` extends CSS Sentry beyond selector-only sensitivity by adding declaration-level data-probe detection. Inline style attacks can now be actionable when `attr()` supplies an element attribute value, `if()` branches on CSS state, `style(...)` queries a custom property, and a network-capable sink such as `url()` or string-form `image-set()` can trigger a request. This closes the gap where a modern inline-style exfiltration chain could avoid attribute-selector scoring because the sensitive test happened inside the declaration value rather than in the selector.

The release also hardens modern side-channel coverage around image and font primitives. `image-set()` extraction now uses balanced-function parsing so nested `if(style(...))` branches are inspected correctly, while non-URL condition strings are not misclassified as image URLs. Remote `@font-face` combined with container-query or keyframe-controlled remote URL sinks is now modeled as a Fontleak-style side-channel shape; normal remote fonts remain non-actionable unless paired with sensitive selectors or the modeled side-channel context.

CVE tracking now includes CVE-2026-39315 as a conditional CSS-relevant Unhead numeric-entity decoding case, with an executable fixture proving that browser-decoded `data:text/css` links reach the data stylesheet scanner. CVE-2026-6861 is documented as out of scope because it describes local GNU Emacs SVG/CSS memory corruption rather than browser-side CSS exfiltration behavior that CSS Sentry can enforce.

## 1.0.26 Audit Note — Balanced POC Timing Regression Test Correction

`1.0.26` preserves the `1.0.24` Balanced mitigation model and the `1.0.25` verification fixes while correcting the same-origin POC e2e expectation. The test no longer requires the first load to leak before the finding-derived DNR rule is installed, because current Chromium timing can legitimately allow CSS Sentry to analyze the inline high-confidence exfil rule and install mitigation before the background-image request reaches the fixture server. The regression still verifies the important invariant: if the first request leaks, the report must label the mitigation as installed-rule rather than already-prevented; after analysis, a reload must not reach the leak endpoint.

## 1.0.25 Audit Note — E2E Policy Synchronization and Locator Corrections

`1.0.25` preserves the `1.0.24` Balanced mitigation and DNR action semantics while correcting verification-surface defects reported by the local `verify:full` gate. The e2e policy helper no longer waits for policy DNR filters when the supplied policy has no blocklisted or allowlisted origins; it still validates expected filters for blocklist/allowlist tests. The same-origin iframe report assertion now accepts multiple visible occurrences of the same attacker origin instead of failing due Playwright strict locator ambiguity.

## 1.0.24 Audit Note — Balanced Mitigation and DNR Action Semantics

`1.0.24` corrects the default protection model and the action vocabulary exposed to users. Balanced mode now installs precise finding-derived DNR rules for high-confidence CSS exfiltration findings even when the destination is same-origin, provided the finding has a sensitive selector/value-probing signal and a network-capable CSS sink. This means the default mode no longer treats confirmed same-origin POC-style exfil shapes as log-only.

The release also fixes the misleading `blocked_dnr` action assignment. A finding-derived DNR rule installed after analysis is now recorded as `rule_installed_dnr`, not as an already-blocked request. `blocked_dnr` remains reserved for cases where an already-active network rule or page-changing mitigation prevented matching requests. The popup, full report, and false-positive sweep now expose this distinction so users can understand why a dev-mode first load may still show a website-side request while a refresh is protected by the installed rule.

Regression coverage now includes a same-origin POC timing e2e case: Balanced may observe an initial request before analysis, then must install a installed-rule rule and block the same matching request on reload. This documents the browser timing boundary while ensuring the default mode still mitigates confirmed high-confidence exfil shapes after detection.

## 1.0.23 Audit Note — Verification Fixes and Native Build Tooling

`1.0.23` is a maintenance and verification-correction package. It adds `node-gyp` as an explicit development dependency with lockfile coverage, preserves the `1.0.22` strict-mode enforcement behavior, and fixes the verification failures reported by `pnpm run verify:full`: popup copy now includes the exact no-blocking statement expected by the action-state UI contract, the same-origin iframe e2e check no longer fails when the report legitimately renders the same attacker destination origin in more than one visible finding row, and frame-report storage avoids redundant report-wide re-sanitization after frame-level sanitization so report cap tests complete within the normal unit-test timeout.

## 1.0.22 Audit Note — Strict POC Enforcement and Non-Proxy Blocking

Issue #1 and the strict-mode report showed that CSS Sentry detected the public POC exfil patterns but left most same-origin findings as `logged`; only the fragment case was marked blocked because the URL fragment was incorrectly classified as `sink.svg_reference`. `1.0.22` fixes the enforcement model rather than special-casing the POC: Strict mode blocks sensitive selector/value-probe plus network-capable sink findings regardless of destination origin, while Balanced mode remains conservative for same-origin findings.

The DNR integration now uses raw internal request URLs for rule installation but stores/exports redacted report URLs. Finding-derived rules are precise URL rules with fragments removed instead of broad host-only rules. This prevents both underblocking caused by redaction and overblocking caused by hostname-wide rules.

Additional coverage added in this release includes the six public POC cases, string-form `image-set()` URLs, unicode-range font request oracles under sensitive selectors, benign decorative `image-set()`, and benign normal unicode-range webfont usage.

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


`1.0.28` is a Fontleak/container-query text-exfil tracking and partial-enforcement patch built from the passing `1.0.27` source line. It adds explicit reason-coded evidence for remote-font measurement setup, generated-content probes, ligature feature activation, animation-driven font-family chaining, remote import-chain participation, and size-based container query sinks. It also adds attack and benign fixtures to keep ordinary remote webfonts and ordinary component container queries non-actionable.

`1.0.27` is an analyzer and fixture hardening patch built from the passing `1.0.26` source line. It adds declaration-level inline `attr()` / `if(style())` exfiltration detection, nested `image-set()` extraction, CVE-2026-39315 data stylesheet fixture coverage, and partial Fontleak-style container/keyframe side-channel modeling while preserving the `1.0.26` Balanced POC timing behavior.

`1.0.26` is an e2e regression-correction patch built from the `1.0.25` source line. It updates the Balanced same-origin POC timing assertion so a stronger first-load prevention outcome is not treated as a failure while preserving the requirement that matching requests must be blocked after analysis. It does not change analyzer, DNR, storage, popup, report, or policy behavior.

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

Required local verification after extracting `1.0.30`:

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
- Coverage behavior: browser-uninspectable cross-origin frame/stylesheet notices remain stored as explicit informational findings, and the standard partial-analysis compatibility control now determines whether those finding rows are shown in popup/report views while completeness counters remain visible.

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
| Parser-backed CSS analysis | `docs/SPEC.md`; `docs/CVE_SPEC.md`; `docs/STATUS.md` | `src/core/css/parseCss.ts`; `src/core/css/parser/*`; parser and fixture tests |
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
| Modern inline-style and SVG-style fixtures | Covered by current corpus | Current fixtures cover inline `url()`, inline custom-property URL indirection, `image-set(url(...))`, declaration-level `attr()` plus `if(style(...))`, nested conditional string-form `image-set()`, SVG `<style>` `url()` paint sinks, and SVG `<style>` `@import`. Future browser support can expand this corpus. |
| Mixed-case `data:text/css` stylesheet links | Covered by current corpus | `1.0.7` adds Unhead-derived mixed-case data CSS link fixture coverage and scans data CSS stylesheet links without logging raw data URL contents. |
| Escaped CSS `@import` sanitizer bypass class | Covered by current corpus | `1.0.7` adds lxml_html_clean-derived CSS Unicode escape `@import` recovery and fixture coverage. |

## Partial Meaning by Context

| Context | Meaning |
|---|---|
| **Parser robustness** | `css-tree` is primary and fallback parser remains. This is strong enough for v1 scope, but future CSS syntax/bypasses may require new fixtures. |
| **CSS variables** | Direct custom properties and fallback chains are handled best-effort. Full browser-equivalent cascade/computed-value resolution is not claimed. |
| **Nested rules** | Common grouping/nesting cases are walked. Future syntax edge cases can expand the corpus. |
| **Inline styles** | Inline `style=""` URL sinks, custom-property URL chains, `image-set()` sinks, and declaration-level `attr()` / `if(style(...))` probes are scanned. This still does not claim universal coverage for every future CSS conditional or side-channel primitive. |
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
| CVE-2026-44458 — Hono JSX SSR style-object CSS declaration injection | Added | Maps to browser-rendered inline `style` attributes when injected declaration values/property names create data-probe plus remote CSS resource behavior. `1.0.34` adds attack and benign fixtures without package-version scanning. |
| CVE-2026-35046 — Tandoor stored CSS injection through recipe instructions | Fixture-backed | Stored rendered recipe/rich-text `<style>` content maps to CSS Sentry only when the browser-visible CSS contains selector/value probing plus a request-producing remote sink. `1.0.34` adds attack and benign recipe fixtures. |
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
| No extension-origin remote CSS fetch invariant | Covered |
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
| Rendered webmail/helpdesk/markdown/comment contexts | Covered by current fixture corpus, including Tandoor-style recipe/rich-text stored style coverage |
| Hono CVE-2026-44458 inline-style declaration injection | Covered by current corpus |
| Tandoor CVE-2026-35046 stored recipe/rich-text style injection | Fixture-backed in current corpus |
| Nonce/token/CSRF probes | Covered for documented scope |
| Sensitive value redaction | Covered for documented scope |
| Same-origin iframe scanning | Covered for current supported scope |
| Cross-origin iframe reporting | Covered for current supported scope |
| README limitations | Covered |
| PostCSS CVE-2026-41305 stringifier `</style>` breakout | Adjacent / out of scope |
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
| Automatic remote CSS fetching by the extension | Can bypass user blockers and recreate old extension compatibility issues. It remains a hard invariant, not a user-facing checkbox, unless a future dedicated opt-in fetch feature is designed and tested. |
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
| Chrome CORS/MV3 and browser-platform limitations | Covered by MV3-first architecture, DNR-based mitigation, documented Chrome MV3 limits, and optional Firefox enhanced mode implemented as a Firefox-only advanced option. |
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

## 1.0.43 status update - DNR nullable URL guard correction

- Fixed the DNR origin-target normalization guard so parsed URLs are narrowed through an explicit `isHttpUrl` predicate before protocol, origin, or hostname access.
- Added malformed destination-policy origin regression coverage and a source-structure guard against unsafe nullable URL property access.


## 1.0.44 status update - Firefox enhanced inspection deterministic summary timing

- Corrected Firefox enhanced stylesheet response inspection so merged response summaries use the injected inspection completion timestamp instead of falling back to ambient `Date.now()` inside summary merging.
- Preserved the frame report contract by keeping `frameUrl`, `frameOrigin`, `frameId`, and `parentFrameId` explicit in saved reports.
- Added regression expectation coverage for deterministic `startedAt`, `finishedAt`, and `updatedAt` values in the Firefox enhanced inspection finding-save path.
- Preserved the 1.0.43 DNR nullable URL guard and null-safe DNR target preparation changes.

## 1.0.45 Audit-Hardening Implementation

`1.0.45` completes the post-`1.0.44` hardening items that remained after the local test-clean line. The CSS parser now receives the same analysis deadline as the analyzer and checks that budget while walking source text, brace matching, top-level token scanning, recovered import handling, and large-source parsing. Firefox enhanced response inspection now treats stream filter write/close errors as pass-through safety events: write failure disconnects the filter and suppresses analysis for that response, while close failure is contained without throwing through the browser event path. DNR skipped-target diagnostics are now preserved in the finding-derived DNR result and DNR status, including unsupported URLs, overlong effective request URLs, oversized regex filters, non-ASCII targets, and rule-update failures. The AI JSON reporter lane is now verified by a source-level script and included in the strict verification chain, while `test:ai` remains part of the diagnostic sweep. The Strict-mode summary no longer uses vague unclear shortcut wording; it now states the actual user-visible behavior: stronger blocking on sensitive sites.


## 1.0.49 test isolation correction

- Vitest setup resets the aliased `wxt/browser` browser mock instance before and after each test. This prevents storage, DNR session rule, navigation-listener, and tab-listener state from leaking through the module instance that source and tests actually import. React Testing Library cleanup is run after each test to prevent mounted UI state from leaking between UI tests.

## 1.0.64 Status Update

- Website Test Lab usability overhaul implemented. Historical per-test walkthrough pages are superseded by the 1.0.67 guided runner, while endpoint results remain separated from user-confirmed CSS Sentry results.
- `docs/website/TEST_LAB_OVERHAUL_PLAN.md` now records the complete public diagnostic-site model and remaining website coverage requirements.


## 1.0.65 Website diagnostic update

- The earlier individual guided check pages are superseded by the 1.0.67 guided `/tests/` runner; local history, troubleshooting, and supported-origin diagnostics remain supporting behavior.
- The known detector smoke check is now the first validation step for diagnosing why nothing appears in CSS Sentry.
