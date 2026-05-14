# Release Checklist

Last Updated: 2026/05/14 18:19:34 -03

Use this checklist before publishing a release candidate or stable release.

## Preflight

- Do not reduce or summarize docs during release work. If a document is reorganized, preserve the full substantive content and update links.

- [ ] Confirm `package.json` version is correct for the release stage, such as `1.0.0` or a future `1.0.1-rc.1`.
- [ ] Confirm `README.md` claim language does not overpromise.
- [ ] Confirm `README.md` does not contain `Last Updated`; timestamp metadata belongs only in documents under `docs/`.
- [ ] Confirm `docs/STATUS.md` reflects the current package and verification state.
- [ ] Confirm `docs/CVE_SPEC.md` has no unresolved v1-blocking CVE-derived items.
- [ ] Confirm `docs/SECURITY.md`, `docs/PRIVACY.md`, and `docs/PERMISSIONS.md` are present and current.
- [ ] Confirm `docs/RELEASE_NOTES.md` is present, current for this release, and remains the changelog home.
- [ ] Confirm runtime message and import hardening tests pass.
- [ ] Confirm manifest permissions match `docs/PERMISSIONS.md`.
- [ ] Confirm DNR status appears in Options after a DNR operation.
- [ ] Confirm popup/report action labels distinguish already-blocked requests from finding-derived installed DNR rules.
- [ ] Confirm content-level neutralization remains optional, bounded to high-confidence findings, and does not apply to redacted selectors or low-confidence UI CSS.
- [ ] Confirm popup and Options help tooltips are viewport-clamped and readable inside the extension popup/window.
- [ ] Confirm Balanced mode installs installed DNR rules for high-confidence same-origin CSS exfil findings and does not label them as already prevented.
- [ ] Confirm destination-policy/blocklist tests still prove first-load prevention where policy rules exist before page analysis.
- [ ] For false-positive/noise-reduction releases, run or document `pnpm run audit:false-positives -- --limit 250 --save-reports actionable` and preserve any actionable per-site reports under `test-results/` only.
- [ ] Confirm `pnpm-workspace.yaml` remains at the repository root when pnpm build-script approval is needed.
- [ ] Confirm native-build helper dependencies requested for the release, such as `node-gyp`, are present in both `package.json` and `pnpm-lock.yaml` before running frozen installs.
- [ ] Confirm Fontleak ligature-feature tests cover parser-normalized active feature values such as `"liga"1` and disabled values such as `"liga" 0`.


## 1.0.67 Additional Website Guided Runner Checks

- [ ] Confirm `/tests/` is the primary Test Lab runner and individual `/tests/:caseId/` URLs redirect into `/tests/?cases=<caseId>`.
- [ ] Confirm the runner can start one selected check, a category selection, and all checks.
- [ ] Confirm selected controlled CSS is rendered in the initial document through `initial-test-style` after session reload.
- [ ] Confirm the runner receives `css-sentry:test-lab-scan` and `css-sentry:test-lab-report` separately when the extension is installed and scanning is enabled.
- [ ] Confirm detected extension mode is preferred and manual mode override remains a fallback, not the primary path.
- [ ] Confirm each selected check shows endpoint state, scanner/report diagnostic state, manual popup/report confirmation, and mode-specific interpretation.
- [ ] Confirm local history records selected cases, endpoint states, scan diagnostics, report acknowledgement, manual confirmation, and rerun links.
- [ ] Confirm `docs/website/TEST_LAB_COVERAGE_CONTROL.md` keeps coverage as controlled behavior completion and does not introduce a `/matrix/` route.
- [ ] Confirm `pnpm verify:website-source` and `pnpm website:build` pass after the website dependency graph is installed.

## 1.0.66 Additional Release Script Check

- [ ] Confirm `pnpm verify:full` matches the extension release-validation contract guarded by `tests/integration/project-structure.test.ts`.
- [ ] Run `pnpm verify:website-source` separately for website changes or website deployment preparation.

## 1.0.63 Additional Website Run-Flow Checks

- [ ] Confirm `pnpm-workspace.yaml` allows the `workerd` build dependency required by Cloudflare local build tooling.
- [ ] Confirm starting selected Test Lab checks creates a session and reloads the page with `session` and `cases` query parameters.
- [ ] Confirm the active Test Lab page renders the selected controlled CSS in the initial document through `initial-test-style`.
- [ ] Confirm CSS Sentry reports the selected Test Lab cases after page load in an enabled scanning mode.
- [ ] Confirm endpoint results are interpreted against CSS Sentry's popup/report output rather than treated as a standalone safe/unsafe verdict.
- [ ] Confirm `pnpm verify:website-source` passes before website build or deployment.

## 1.0.59 Additional Analyzer Structure Check

- [ ] Confirm `tests/integration/project-structure.test.ts` passes the analyzer/parser budget authority guard.
- [ ] Confirm `src/core/analyzer/analyzeStylesheet.ts` contains `securityCriticalRulesFromBudgetedParse` and still checks `parseResult.budgetExceeded`.
- [ ] Confirm oversized nested stylesheet analysis still reports selector substring-probe, nested-rule, and remote destination findings when budget limits are reached.

## 1.0.58 Additional Type-Surface Check

- [ ] Confirm `tests/unit/browser/firefox-enhanced-inspection.test.ts` can import `FilterResponseData`, `FirefoxWebRequest`, and `WebRequestDetails` from `src/browser/firefox/enhancedStylesheetInspection.ts`.
- [ ] Confirm Firefox response-filter capability detection and structural browser API casts remain isolated in `src/browser/platform/firefoxWebRequestApi.ts`.

## 1.0.56 Additional UI Lifecycle Refactor Checks

- [ ] Confirm `src/entrypoints/content.ts` remains wiring-only and does not re-own `MutationObserver`, debounce scheduling, or scan lifecycle state.
- [ ] Confirm `documentScanController` still sends the neutralized final summary, not the pre-neutralization scan summary.
- [ ] Confirm popup quick-mode buttons still reflect the active derived mode before and after policy loading.
- [ ] Confirm Options origin-list, compatibility, advanced-mode, import/export, retention, and per-origin override flows still save through normalized policy persistence.
- [ ] Confirm popup, options, and report pages mount through the checked shared root boundary and do not use unchecked `document.getElementById("root")!` assertions.

## 1.0.57 Additional Analyzer and Cross-Cutting Refactor Checks

- [ ] Confirm oversized nested stylesheet analysis still reports selector substring-probe, nested-rule, and remote destination findings when the parser/analyzer reaches the performance budget.
- [ ] Confirm `src/shared/reasonGroups.ts` remains the shared authority for repeated reason-group decisions in DNR, content neutralization, finding priority, display filtering, and report merging.
- [ ] Confirm optional browser API checks remain isolated under `src/browser/platform/` and are not reintroduced as local structural casts in DNR, Firefox enhanced inspection, or background orchestration.
- [ ] Confirm injected clocks remain available for analyzer timing, parser budgets, report timestamps, DNR status timestamps, retention checks, and partial-coverage summaries while default runtime behavior still uses the system clock.

## Required Verification

```bash
pnpm install --frozen-lockfile
pnpm run compile
pnpm run test
pnpm run build
pnpm run verify:website-source
pnpm run test:e2e
pnpm run build:firefox
```

Full manual gate:

```bash
pnpm run verify:full
```

Optional AI/debug report:

```bash
pnpm run test:ai
```

## Artifact Generation

```bash
pnpm run zip
pnpm run zip:firefox
```

## Manual Browser Checks

Chrome/Chromium:

- [ ] load `.output/chrome-mv3` as an unpacked extension;
- [ ] popup opens;
- [ ] options page opens;
- [ ] report page opens;
- [ ] Passive/Balanced/Strict mode buttons work;
- [ ] advanced options show/hide correctly;
- [ ] local reports can be cleared;
- [ ] report retention still prunes stale reports after saving reports and after lowering the retention policy;
- [ ] report export does not reveal known test secrets;
- [ ] destination blocklist works on a local test page.

Firefox:

- [ ] build with `pnpm run build:firefox`;
- [ ] load the Firefox build in a fresh profile or temporary extension environment;
- [ ] popup/options/report pages open;
- [ ] normal browsing with uBlock Origin does not show obvious breakage in regular usage.

## Structure Checks

The source package should not include:

- [ ] `node_modules/`;
- [ ] `.output/`;
- [ ] `test-results/`;
- [ ] Playwright traces;
- [ ] `json-report.json`;
- [ ] root `SPEC.md`, `CVE_SPEC.md`, `STATUS.md`, `SECURITY.md`, `PRIVACY.md`, `PERMISSIONS.md`, or `RELEASE_CHECKLIST.md`.

The source package should include:

- [ ] `README.md`;
- [ ] `docs/SPEC.md`;
- [ ] `docs/CVE_SPEC.md`;
- [ ] `docs/STATUS.md`;
- [ ] `docs/SECURITY.md`;
- [ ] `docs/PRIVACY.md`;
- [ ] `docs/PERMISSIONS.md`;
- [ ] `docs/RELEASE_CHECKLIST.md`;
- [ ] `docs/RELEASE_NOTES.md`;
- [ ] `docs/SELF_SECURITY.md`;
- [ ] `src/`;
- [ ] `tests/`;
- [ ] `package.json`;
- [ ] `pnpm-lock.yaml`;
- [ ] `pnpm-workspace.yaml`.

## v1 Release Criteria

A stable `1.0.0` release requires:

- [ ] release candidate verification passed;
- [ ] no known release-blocking bug remains;
- [ ] known limitations documented;
- [ ] `docs/STATUS.md` has no v1-blocking `Partial`, `Not implemented`, or `Not truly tested` item;
- [ ] release notes written;
- [ ] source and browser-extension artifacts generated cleanly.

## Release Candidate Promotion

Promote a pre-release package to the next release candidate only after the full manual gate passes and `docs/STATUS.md` has no unresolved v1-blocking item.

Promote a release candidate to stable only after a manual usage period finds no release-blocking issue, release notes are updated, and browser artifacts are generated cleanly.


## Documentation Role and Coverage Checks

Before packaging a source release:

- [ ] Confirm `docs/RELEASE_NOTES.md` contains changelog/release history and does not replace status/specification content.
- [ ] Confirm `docs/STATUS.md` contains current coverage, limitations, verification state, and audit notes.
- [ ] Confirm `docs/SPEC.md` contains requirements, accepted implementation decisions, historical issue-derived requirements, and regression rules.
- [ ] Confirm `docs/CVE_SPEC.md` contains CVE-derived requirements, fixture mappings, adjacent CVE classes, explicit non-goals, and CVE/advisory release-checklist obligations.
- [ ] Confirm `docs/SELF_SECURITY.md` maps extension self-security safeguards to implementation and test evidence.
- [ ] Confirm each implemented capability is tracked in at least one durable document.
- [ ] Confirm no document was shortened by deleting tracking history, rationale, coverage evidence, or limitation context.

## Documentation Regression Guard

Project documentation is part of the release safety system. Do not replace detailed documents with shortened summaries during release preparation.

Before publishing or packaging a release, verify that these documents remain substantive and are not accidentally reduced:

- `docs/SPEC.md`
- `docs/CVE_SPEC.md`
- `docs/STATUS.md`
- `docs/SELF_SECURITY.md`
- `docs/SECURITY.md`
- `docs/PERMISSIONS.md`
- `docs/PRIVACY.md`
- `docs/RELEASE_NOTES.md`

Additive updates are allowed. Destructive condensation, "normalization" by removing tracking history, or replacement with thin summaries is not allowed unless the user explicitly requests a shorter document and the removed content is preserved elsewhere.

## CVE / Advisory Search and Triage

Before a stable release:

1. Search current CVE/advisory sources for CSS injection, CSS exfiltration, HTML style sanitizer, rendered email, webmail sanitizer, SVG remote-resource, and browser-rendered remote-resource classes.
2. Triage each relevant result into:
   - implemented detector and fixture;
   - fixture-only regression because existing logic already covers it;
   - documented limitation;
   - explicit non-goal / out-of-scope item.
3. Confirm `docs/CVE_SPEC.md` includes the triage result.
4. Confirm `docs/STATUS.md` reflects the actual implementation and verification state.
5. Confirm no new CVE-derived requirement is silently omitted.

## Source Package vs Browser Artifact

`pnpm run verify:full` is the required source verification gate. `pnpm run zip` and `pnpm run zip:firefox` are release-artifact generation commands and are only required when preparing installable browser extension archives.


## 1.0.5 Additional Tracking Checks

Before packaging future releases, also verify:

- [ ] CVE-2026-40301 fixtures remain present with matching expectation files.
- [ ] SVG `<style>` `url()` and `@import` behavior remains covered by fixture tests.
- [ ] `docs/STATUS.md` still preserves future candidates, avoided features, and known limitations.
- [ ] `docs/SPEC.md` still states that project documents are tracking artifacts, not only release summaries.
- [ ] Externally loaded SVG image-document limitations remain documented unless implementation coverage changes.

## 1.0.6 Additional Maintenance Checks

Before packaging a release after `1.0.6`, confirm:

- `.gitignore` excludes generated Playwright/Vitest outputs, including `test-results` and `json-report.json`.
- `docs/chrome-extension-logo.png` and `docs/firefox-addon-logo.svg` remain present if referenced by documentation or store-readiness notes.
- Popup and Options entrypoints remain composed from smaller components rather than accumulating repeated presentational functions in one file.
- `src/shared/components/InfoTooltip.tsx` remains the shared tooltip primitive unless intentionally replaced.
- `docs/STATUS.md` classifies v1-scope items as `Covered for documented scope`, `Covered by current corpus`, `Manual / policy`, `Documented limitation`, or `Out of scope` instead of using vague partial language.
- Store-publication screenshots, store copy, and actual submissions are not treated as required source-package implementation unless a future release explicitly chooses to publish.
- Adjacent sanitizer/SVG CVEs that do not involve CSS-triggered remote-resource behavior are tracked as watchlist or out-of-scope items with reasons, not silently ignored.


## 1.0.7 Additional Search and Fixture Checks

Before packaging after `1.0.7`, confirm:

- `docs/STATUS.md` uses `Features Avoided`, not `old avoided-features heading`.
- automated workflow is not listed as an implementation coverage gap.
- CVE-2026-31873 and CVE-2026-28348 fixture names are present in `tests/integration/spec-acceptance.test.ts`.
- Data CSS stylesheet links are scanned without storing the raw data URL as a source URL.
- Escaped `@import` recovery is covered by a fixture.
- Adjacent/out-of-scope search results remain documented in `docs/CVE_SPEC.md` and `docs/STATUS.md`.
- Future sanitizer-specific fixture packs are only added when advisories map to CSS-triggered remote-resource behavior, selector probing, CSS imports, inline style leaks, or rendered-content CSS injection.

## 1.0.8 Documentation Scope Check

Before future releases, confirm that status wording does not imply either under-coverage or universal coverage:

- Use `Covered for documented scope` for implemented/tested behavior within CSS Sentry's stated threat model.
- Use `Covered by current corpus` for parser/CVE/fixture classes that may expand as new advisories appear.
- Use `Manual / policy` for deliberate manual validation areas such as broad extension compatibility.
- Use `Out of scope` only when the item is not part of CSS Sentry's threat model or source package.
- Do not reintroduce CI workflow as an implementation gap unless the maintainer explicitly changes release policy.
- Do not delete historical issue-derived coverage material during cleanup; move it to a better tracking section if necessary.

## 1.0.10 Advanced Option Checks

- [ ] Advanced SVG image-document reporting is off by default.
- [ ] Strict SVG image-document DNR policy is off by default.
- [ ] Firefox enhanced stylesheet response inspection is off by default and degrades safely outside Firefox or without `filterResponseData`.
- [ ] DNR status text treats zero tab-scoped rules as a successful no-op, not an error.
- [ ] Documentation states that externally loaded SVG image-document internals are not fully inspectable.

## 1.0.12 False-Positive Release Checks

Before publishing a release after `1.0.12`, confirm:

- [ ] Balanced mode does not emit actionable findings for presentation-only CSS with zero remote URL sinks.
- [ ] Standalone remote `@font-face` loads such as reCAPTCHA/Roboto are not DNR-blocked in Balanced mode.
- [ ] YouTube/player, Gmail-like Material, ChatGPT-like UI, and reCAPTCHA font benign fixtures remain present.
- [ ] Selector-driven CSS exfil fixtures with sensitive attributes plus remote sinks still produce actionable findings.
- [ ] `pnpm run audit:false-positives -- --limit 100 --save-reports actionable` can be run as a development-only common-site sweep when preparing a publication candidate. Its output remains under `test-results/` and is not committed as runtime data.

## 1.0.21 Large-Stylesheet Release Gate

Before release, verify that oversized stylesheet fixtures do not emit `analysis.skipped.too_large`, that oversized benign generated CSS has zero actionable findings, that oversized remote import and value-probing URL fixtures are actionable, that capped finding collection still retains stronger later findings, and that DNR rule-cap selection keeps stronger candidates.


## 1.0.22 Release Gate Additions

Last Updated: 2026/05/13 01:54:22 -03

Before distributing a package that includes the strict-mode POC enforcement work, verify all of the following:

- The six public POC fixtures are present and expectation-driven.
- URL fragments do not produce `sink.svg_reference` unless the resource path is an actual SVG resource.
- Balanced mode does not block same-origin sensitive-selector URL sinks by default.
- Strict mode does install finding-derived DNR rules for same-origin sensitive-selector URL sinks.
- Finding-derived DNR rules use raw internal request URLs, but stored/exported reports have `requestUrl: null`.
- Finding-derived rules are precise URL rules with fragments stripped, not host-wide rules.
- String-form `image-set()` URLs and targeted unicode-range font request-oracle cases are covered without making benign decorative image sets or normal webfonts actionable.
- Fontleak-style coverage distinguishes remote-font presence from actionable evidence: generated-content probes, ligature features, size container queries, animation font chains, import chains, and remote URL sinks must be tested without making ordinary remote webfonts/container UI actionable.


## 1.0.27 Additional Release Checks

Before releasing a package containing the `1.0.27` hardening work, verify the following:

- Inline `attr()` plus `if(style(...))` fixtures produce actionable findings only when a network-capable sink is present.
- String-form `image-set()` URLs nested inside conditional function arguments are extracted, while condition strings such as `"admin"` are not misclassified as URLs.
- Remote font plus container-query/keyframe remote sink fixtures remain actionable.
- Normal remote fonts and presentation-only inline `attr()` / `if()` usage remain non-actionable.
- CVE-2026-39315 is represented by an executable fixture and CVE-2026-6861 remains documented as out of scope.
- `pnpm run test`, `pnpm run compile`, `pnpm run build`, and `pnpm run build:firefox` must pass before packaging; `pnpm run verify:full` remains the local release gate when e2e browser execution is available.


## 1.0.33 Advisory and UI Interaction Checks

- [ ] Confirm Mermaid CSS injection fixtures cover scope-escape and classDef-style breakout into selector/value probing plus remote request sinks.
- [ ] Confirm justhtml advisory fixtures cover preserved style `@import`, preserved style remote sinks, and preserved SVG `filter="url(...)"` resource behavior.
- [ ] Confirm XWiki CVE-2026-26000 is documented as UI-redress-adjacent while the exfil-only subset remains fixture-backed.
- [ ] Confirm Firefox enhanced stylesheet response inspection does not return without analysis only because the response exceeds `maxStyleTextBytes`.
- [ ] Confirm tooltip help opens immediately on hover/focus and remains viewport-clamped inside popup/options pages.



## 1.0.38 Browser Navigation Partial-Frame Coverage Checks

- [ ] Confirm the background script records cross-origin subframe partial coverage from browser `webNavigation` subframe events.
- [ ] Confirm failed cross-origin subframe navigations can still produce a stored partial-frame report without relying on remote CSS or frame fetches from the extension context.
- [ ] Confirm same-origin iframe analysis remains controlled by content-script scanning rather than the browser-navigation fallback.
- [ ] Confirm report summary aggregation deduplicates parent-scan and navigation-event partial coverage for the same frame URL.
- [ ] Confirm the cross-origin iframe e2e test shows `Partial frame coverage` by default and shows `frame.cross_origin.uninspectable` after enabling `Show partial-analysis findings`.

## 1.0.37 Iframe Mutation Rescan Checks

- [ ] Confirm the content script rescan trigger selector includes `iframe[src]`.
- [ ] Confirm the content script mutation attribute filter includes `src` and `data`.
- [ ] Confirm the cross-origin iframe e2e test passes with partial-analysis finding rows hidden by default and shown only after enabling the option.

## 1.0.36 Partial-Analysis and Fixture-Corpus Checks

- [ ] Confirm the cross-origin iframe e2e test asserts default partial-frame coverage visibility without requiring hidden detailed partial-analysis reason rows.
- [ ] Confirm enabling `Show partial-analysis findings` makes the stored `frame.cross_origin.uninspectable` reason row visible in the report.
- [ ] Confirm `tests/integration/fixtures.test.ts` still enumerates every active attack and benign `.css` / `.html` fixture and rejects missing or orphan expectation files.

## 1.0.35 Settings Surface Checks

- [ ] Confirm `Show partial-analysis findings` changes popup and report finding-row visibility without deleting stored report evidence.
- [ ] Confirm partial frame counts, partial stylesheet counts, and analysis state remain visible when partial-analysis finding rows are hidden.
- [ ] Confirm Options no longer exposes `Never fetch remote CSS from the extension` as a checkbox.
- [ ] Confirm Options still states the no extension-context remote stylesheet fetch invariant as privacy/compatibility text.
- [ ] Confirm imported legacy settings that contain `neverFetchRemoteCssFromExtension` are accepted but normalized without preserving the removed key.
- [ ] Confirm source-level tests still reject extension-context remote CSS fetch code.

## 1.0.34 Hono and Tandoor Advisory Coverage Checks

- [ ] Confirm `tests/fixtures/attacks/cve-2026-44458-hono-jsx-ssr-inline-style.html` and its expectation file remain present and executable through the fixture corpus.
- [ ] Confirm `tests/fixtures/benign/benign-hono-jsx-ssr-style-object-presentation.html` remains present so style-object presentation state without remote sinks stays non-actionable.
- [ ] Confirm `tests/fixtures/attacks/cve-2026-35046-tandoor-stored-recipe-style.html` and its expectation file remain present and executable through the fixture corpus.
- [ ] Confirm `tests/fixtures/benign/benign-tandoor-recipe-presentation-style.html` remains present so benign recipe/rich-text presentation CSS stays non-actionable.
- [ ] Confirm `docs/CVE_SPEC.md`, `docs/SPEC.md`, `docs/STATUS.md`, and `docs/RELEASE_NOTES.md` keep Hono and Tandoor as browser-visible CSS behavior coverage, not package-version scanning.
- [ ] Confirm PostCSS CVE-2026-41305 remains adjacent/out of scope unless a future browser-visible CSS request fixture is intentionally added.


## 1.0.39 Release Hardening Checks

- [ ] Confirm Chrome generated manifest does not include `webRequest`.
- [ ] Confirm Firefox generated manifest includes `webRequest` only for enhanced stylesheet response inspection.
- [ ] Confirm Chrome generated manifests do not include `webRequest`, `webRequestBlocking`, or `webRequestFilterResponse`.
- [ ] Confirm Firefox generated manifests include the response-filter permissions required for the generated manifest version.
- [ ] Confirm `verify:full` uses fail-fast chaining and `verify:full:diagnose` is the only continue-after-failure full diagnostic script.
- [ ] Confirm dependency declarations do not use `latest`.
- [ ] Confirm report retention input is normalized to policy limits before save and stale reports are pruned after report/settings saves.
- [ ] Confirm fixture DNR block-candidate assertions use runtime DNR eligibility logic.
- [ ] Confirm Firefox enhanced response inspection behavior tests cover disabled policy, unsupported filter API, pass-through writes, close, saved findings, filter error handling, and analyzer failure containment.



## 1.0.40 DNR Eligibility Regression Checks

- [ ] Confirm fixture corpus tests pass for the Roundcube and justhtml SVG advisory fixtures that require `mustBeBlockCandidate`.
- [ ] Confirm runtime DNR mitigation and fixture tests import the same DNR eligibility authority.
- [ ] Confirm Balanced-mode DNR eligibility includes cross-origin direct SVG remote-resource sinks: `sink.svg_reference`, `sink.svg_paint_remote`, `sink.svg_resource_remote`, `sink.svg_feimage_remote`, and `sink.svg_animate_remote`.
- [ ] Confirm a scanner-to-DNR regression test installs finding-derived future-block rules for cross-origin SVG resource findings.


## 1.0.41 DNR Effective-Request URL Checks

- [ ] Confirm SVG fragment-bearing remote-resource findings still install Balanced-mode finding-derived DNR rules.
- [ ] Confirm `ruleInstalledUrls` reports fragmentless effective request URLs for installed DNR rules.
- [ ] Confirm generated exact DNR regex filters do not include URL fragments.
- [ ] Confirm fixture block-candidate expectations still use the shared runtime DNR eligibility authority.

## 1.0.42 Firefox, DNR, Performance, Advisory, and Artifact Checks

- [ ] Run `pnpm build`, `pnpm build:firefox`, `pnpm zip`, and `pnpm zip:firefox` before generated-manifest and release-artifact verification.
- [ ] Run `pnpm verify:manifests` and confirm Chrome and Firefox generated manifests match the documented browser-target permission sets.
- [ ] Run `pnpm verify:release-artifacts` and confirm packaged output does not include sourcemaps, dependency folders, generated runtime state, Playwright reports, or test-result folders.
- [ ] Confirm Firefox enhanced response inspection passes response chunks through unchanged and records `analysis.skipped.performance_budget` when retained analysis bytes exceed the configured budget.
- [ ] Confirm analyzer performance-budget tests produce partial coverage rather than silently skipping or hanging on over-budget analysis.
- [ ] Confirm DNR tab-scoped rule IDs do not collide for tabs whose IDs would collide under modulo allocation.
- [ ] Confirm clearing one tab's DNR rules does not clear another live tab's rules.
- [ ] Confirm finding-derived DNR rules use initiator-domain scoping when source origin data is available.
- [ ] Confirm mixed DNR update failures salvage valid prepared rules and report partial success/failure correctly.
- [ ] Confirm imported and edited destination allow/block conflicts normalize to blocklist precedence.
- [ ] Confirm FreeScout CVE-2026-40497 attack and benign fixtures are present and exercised by the fixture corpus.

## 1.0.43 Additional Checks

- Run `pnpm compile` or `tsc --noEmit` to verify DNR nullable URL guards compile under project TypeScript settings.
- Run the browser storage/DNR unit suite to verify malformed destination-policy origins are ignored before DNR rule creation.
- Run project-structure tests to verify the explicit `isHttpUrl` predicate remains the DNR URL narrowing authority.


## 1.0.44 Additional Checks

- Confirm Firefox enhanced stylesheet response inspection uses one injected completion timestamp for merged summary fallback timestamps and saved report `updatedAt`.
- Confirm the finding-save unit test does not require ambient `Date.now()` output and asserts the explicit frame report fields.
- Confirm DNR nullable URL guard coverage from 1.0.43 remains present.


## 1.0.45 Additional Release Checks

- Run `pnpm verify:ai-report` before release to ensure the AI/debug JSON reporter lane still writes `json-report.json`.
- Confirm parser budget tests cover both post-parse analyzer deadlines and source-parser budget deadlines.
- Confirm Firefox enhanced inspection tests cover pass-through, bounded retention, write failure, close failure, filter error, and analyzer failure.
- Confirm DNR skipped-target diagnostics are covered for invalid prepared targets and rule-update failures.
- Confirm Strict mode UI copy uses literal behavior wording and does not reintroduce unclear shortcut wording in user-facing summaries.


## 1.0.47 Type-Safety Correction Checks

- Run `tsc --noEmit` to confirm the DNR salvage regression test no longer passes `unknown` values into DNR rule helper functions.
- Run the unit test suite to confirm the typed DNR mock helper still supports rule-update failure simulation.
- Confirm this correction remains test/support-only and does not change extension runtime behavior.

## 1.0.46 Refactor Safety Harness Checks

Before release, run `pnpm verify:source-css` or `pnpm verify:full` to confirm source CSS remains reviewable. DNR-related tests should use the typed mock helper boundary in `tests/setup/dnr-test-helpers.ts`; avoid reintroducing direct mock-private casts in individual DNR behavior tests. E2E policy synchronization should use observable polling rather than fixed sleep loops.


## 1.0.49 test isolation checklist

- Confirm Vitest setup imports the browser mock through `wxt/browser`, not `./browser-mock`, so setup resets the same module instance used by source and tests.
- Confirm Vitest setup resets browser mock state before and after each test.
- Confirm React Testing Library cleanup runs after each test.


## 1.0.50 Additional Check

- Run `tsc --noEmit` after project-structure guard changes to ensure helper functions used by tests are declared and typed.
- Treat extension zip byte size as informational unless a content or manifest verification check fails.

## 1.0.51 Test Setup Isolation Checks

- Confirm `tests/setup/vitest.setup.ts` imports the browser mock through `wxt/browser`, not `./browser-mock`.
- Confirm browser mock reset runs before each test and after React Testing Library cleanup.
- Confirm generated JavaScript setup artifacts are absent from `tests/setup/`.
- Confirm the project-structure test no longer expects the stale direct `beforeEach(() => { __resetBrowserMock(); });` source string.

## 1.0.52 DNR Refactor Package Checks

- Confirm `src/browser/dnr/chromeDnr.ts` remains the public DNR orchestration surface and does not regain URL parsing, raw status persistence, rule ID allocation internals, or direct salvage-loop internals.
- Confirm `dnrRuleAllocation.ts`, `dnrTargetPreparation.ts`, `dnrRuleBuilder.ts`, `dnrRuleUpdate.ts`, and `dnrStatus.ts` exist and each owns one durable DNR responsibility.
- Run the DNR unit tests covering rule allocation, target preparation, rule building, update/salvage behavior, and broad DNR browser integration.
- Confirm finding-derived exact request regexes still strip fragments, destination blocklists still override allowlists, invalid DNR targets still produce skipped-target diagnostics, and rejected batch updates still salvage valid rules.
- Confirm the full verification chain after dependencies and WXT-generated TypeScript config are available.


## 1.0.53 DNR Canonicalization and Timer-State Checks

- [ ] Confirm DNR target-preparation tests assert browser-canonical ASCII hostnames for valid IDN request targets and initiator origins.
- [ ] Confirm unsupported or opaque initiator origins remain ignored instead of creating invalid DNR initiator-domain conditions.
- [ ] Confirm tooltip disclosure opens immediately and only delayed close uses the grace timer.
- [ ] Confirm tooltip delayed-close timers are cleared on reopen and unmount.
- [ ] Confirm oversized-stylesheet scanning tests control the analysis clock when they are not testing performance-budget behavior.


## 1.0.55 Additional Release Checks

- Run the parser/analyzer unit tests and fixture corpus to confirm oversized stylesheet import, nested-rule, and value-probe fixtures still produce expected findings under grouped Vitest execution.
- Confirm `src/core/css/parseCss.ts` remains the public parser import surface while parser implementation details stay under `src/core/css/parser/`.
- Confirm recovered `@import` rules are not gated by `isParseBudgetExceeded` and remain represented in performance-budget partial summaries.
- Confirm `analyzeStylesheet.ts` remains orchestration-focused and per-rule finding construction, stylesheet risk context, finding priority, and finding detail text stay in separate analyzer modules.

## Website test-lab validation

- [ ] Run `pnpm verify:website-source` before publishing website changes.
- [ ] Confirm the session endpoint does not use `Astro.locals.runtime`.
- [ ] Confirm selected live checks render in readable cards at desktop and narrow widths.

## 1.0.64 Website Release Check

- Verify `pnpm verify:website-source`.
- Run `pnpm website:build` after the website lockfile/dependencies are installed.
- Manually validate at least one guided check with CSS Sentry active and confirm that endpoint state and extension-result interpretation remain distinct.


## 1.0.65 Website diagnostic update

- The earlier individual guided check pages are superseded by the 1.0.67 guided `/tests/` runner; local history and troubleshooting remain supporting pages.
- The known detector smoke check remains the first validation step inside the guided runner for diagnosing why nothing appears in CSS Sentry.
