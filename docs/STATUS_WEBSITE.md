# CSS Sentry Website Coverage Status

**Status document version:** 1.0.83
**Website package audited:** `website/` from `css_sentry_1.0.83`
**Target deployment model:** Astro static/prerendered pages with dynamic Cloudflare Worker endpoints through the Astro Cloudflare adapter
**Deployment shape:** static pages plus dynamic endpoints
**Audience:** maintainers, release reviewers, security reviewers, and future website implementers

## 1. Purpose

The website exists to make CSS Sentry's behavior understandable and verifiable through controlled, fake-data test cases. It must not become a generic vulnerability badge and must not claim that passing the page proves every CSS-based data leak is impossible. Its correct role is a behavior verification lab: a user can run harmless CSS exfiltration-style cases, inspect whether a controlled endpoint was reached, and compare that endpoint result with CSS Sentry's popup and report output in the selected protection mode.

The website must preserve this boundary:

```text
Controlled test case + fake sentinel value + known endpoint + mode-specific expectation = useful verification signal.
Controlled endpoint not reached = not automatically proof of complete safety.
Controlled endpoint reached = not automatically proof of extension failure unless the current mode and test expectation require blocking or neutralization.
```

## 2. Current Implementation State

The first website implementation is present under `website/` and replaces the default Astro starter page with a CSS Sentry Test Lab. The implementation includes:

1. statically prerendered Astro pages using the Cloudflare adapter only for on-demand routes;
2. controlled live test-case definitions;
3. a guided `/tests/` runner for selected behavior checks;
4. short-lived endpoint-generated session identifiers;
5. controlled hit endpoints that set short-lived cookies when a CSS-triggered request reaches the server;
6. result endpoints that compare the current session identifier with the hit cookies;
7. reset endpoint support;
8. optional Turnstile validation for session creation when a Worker secret is configured;
9. a Cloudflare Workers `wrangler.jsonc` baseline;
10. an active GitHub Actions workflow under `.github/workflows/website-cloudflare.yml` for Cloudflare Worker deployment.

The current website is an implementation foundation with corrected local runtime, readability, guided-runner, and diagnostic separation work, not the final complete public website. It is sufficient to begin local and deployed behavior validation, but the status below tracks the additional content, security, and verification work that remains before treating the website as a polished public diagnostic surface.

### 2.1 Workspace installation status

The website is intentionally part of the root pnpm workspace. This is required because the repository already has a root `pnpm-workspace.yaml`; pnpm uses that file to identify the workspace root, and pnpm 11 includes only the root package when the `packages` field is omitted. The website package is now listed explicitly under `packages`, so `pnpm install` can install the Astro and Cloudflare adapter dependencies used by `css-sentry-website`.

Supported commands:

```text
pnpm install --no-frozen-lockfile
pnpm --filter css-sentry-website build
pnpm website:build
```

The root lockfile must be regenerated locally or in CI after dependency resolution is available, because the prior lockfile did not contain a `website` importer.

## 2.2 1.0.62 Website Runtime and Readability Correction

`1.0.62` corrects the first local website validation issues found from the Test Lab page. The session endpoint no longer reads the removed `Astro.locals.runtime` API and now uses the Cloudflare Workers module import path for environment bindings. This keeps the optional Turnstile secret lookup aligned with the current Astro Cloudflare adapter runtime model and prevents the session creation API from producing the Astro runtime error page.

The Test Lab page layout was also changed from dense per-card mode tables to readable full-width test-case cards with expandable mode-specific interpretation. This addresses the cramped columns, broken word wrapping, and difficult-to-read mode text visible in the first website screenshots. Result tables now have a horizontal overflow boundary on narrow screens instead of compressing every column.

The CSS injection path now places `@import` rules before normal style rules so the imported-probe test remains valid when multiple checks are selected. The remote-font representation now uses a dedicated `.woff2` hit endpoint instead of sending a font request to the SVG image endpoint. The live result polling now marks selected cases as `not received` after the polling window rather than leaving them indefinitely as pending.

A source-level website verifier was added as `pnpm verify:website-source`. It guards the runtime API migration, readable layout replacement, import-order invariant, remote-font endpoint, and obsolete mode-table removal. The disabled workflow runs this verifier before the website build. Because this source package may not contain a regenerated `website` importer in `pnpm-lock.yaml`, the disabled workflow currently uses `pnpm install --no-frozen-lockfile`; after committing a regenerated lockfile, that install step should be changed back to a frozen lockfile gate.

## 2.3 1.0.67 Guided Runner and Diagnostic Completion

`1.0.67` changes the website from a duplicated per-check-page model to a guided `/tests/` runner. Individual `/tests/:caseId/` URLs now redirect into `/tests/?cases=<caseId>`, preserving deep links while keeping the user-facing flow in one place. The runner supports selecting one check, selecting a category, running all checks, adding selected controlled CSS for the active session without refreshing the page, polling per-check endpoint results, auto-detecting the CSS Sentry mode from diagnostics, and recording manual popup/report confirmation per check.

The extension diagnostic model now separates scanner completion from background report persistence. Automatic diagnostic events are restricted to supported Test Lab origins so arbitrary public websites cannot expose extension mode or finding-summary state by copying the Test Lab marker. Marked localhost pages and the official Cloudflare Worker Test Lab origin pattern can receive:

```text
css-sentry:test-lab-scan
css-sentry:test-lab-report
```

The scan event reports sanitized mode, analysis state, finding counts, reason codes, actions, and partial-analysis counts. `1.0.79` also lets the content script publish a sanitized scan-disabled diagnostic when the extension is present on a supported Test Lab page but the effective mode for the origin is Trusted, Paused, or Never scan / never sanitize. `1.0.80` corrects the remaining diagnostic-transport gap: diagnostic details are stored on safe `data-css-sentry-test-lab-*` attributes, observed through attribute mutation, and also posted through a same-origin `window.postMessage` bridge so the static runner can recover signals emitted before or after its page listeners attach. The report event reports whether the background path acknowledged report storage after `saveFrameReport`. Neither event includes selectors, raw destination URLs, fake values, or full finding objects.

Public Cloudflare Worker deployments using the `css-sentry-test-lab.*.workers.dev` origin pattern can receive the same sanitized diagnostic bridge as localhost. Other public origins remain manual-confirmation-only unless a future release adds an explicit allowlist entry.

The website coverage data was expanded to include exact, prefix, suffix, substring, repeated-probe, `:has()`, `background-image`, `mask-image`, `image-set()`, `@import`, `@supports`, `@media`, nested CSS, `@layer`, large late selector, large import representation, custom property URL, `var()` fallback, attr/if representation, remote font, and font measurement/container indicators. Coverage is documented as behavior completion, not as a separate route named matrix.

## 2.4 1.0.83 Public Test Lab Runtime Recursion Correction

`1.0.83` fixes the public Firefox release-runtime failure where clicking Start selected checks could produce repeated `InternalError: too much recursion` exceptions from the content script. The correction is split across the extension scanner and the website runner boundary:

1. CSS comment stripping and CSS unescaping now use explicit iterative scanners instead of global regular-expression replacement in hot stylesheet analysis paths.
2. Privacy redaction now bounds generated selector text before applying redaction regular expressions, preserving the existing output cap while avoiding unbounded generated selector processing.
3. The document scan controller converts scanner runtime exceptions into a bounded partial-analysis summary so the content script can report a controlled partial state rather than repeatedly throwing.
4. The large stylesheet resilience case remains available, but it is no longer part of the default selected Test Lab run. Users can still select it directly or use Run all checks for stress validation after the baseline path works.

This keeps the Test Lab's large-stylesheet coverage intact without making the first public Start selected checks action depend on the stress fixture.

## 2.4 1.0.84 Turnstile Completion and Dynamic Style Rescan Correction

`1.0.84` completes the missing client half of the optional Turnstile setup. The session endpoint already supported server-side Siteverify validation when `TURNSTILE_SECRET_KEY` was present, but the runner did not previously render a widget or submit a token. The `/tests/` runner now renders Cloudflare Turnstile through explicit rendering when `PUBLIC_TURNSTILE_SITE_KEY` is available at build time, stores the generated token, submits it as `turnstileToken` to `/api/session.json`, and resets the widget after success, expiry, validation failure, or token use.

The public site key is a build-time Astro value. The GitHub Actions workflow passes it to both website build jobs from repository variables or secrets named `PUBLIC_TURNSTILE_SITE_KEY` or `TURNSTILE_SITE_KEY`. The private secret remains a Cloudflare Worker runtime secret named `TURNSTILE_SECRET_KEY`; setting it only in GitHub Actions does not configure the deployed Worker runtime.

The server validator now binds accepted tokens to the Test Lab action and the request hostname. This preserves the optional nature of Turnstile when the Worker secret is absent while preventing a token from another action or hostname from authorizing session creation when Turnstile is enabled.

`1.0.84` also corrects the no-refresh dynamic CSS scan timing exposed by the deployed Test Lab result “Extension scanned but found no matching issue.” The runner had been appending an empty dynamic `<style>` element and then assigning `textContent`. The browser could apply the later CSS and reach the endpoint, while the content-script mutation observer could schedule a rescan for the empty style insertion and miss the later text-node change. The runner now sets dynamic CSS before appending a new style element, and the content scan controller observes style character-data changes so existing style text updates schedule rescans.

## 3. Deployment and Abuse-Control Model

Cloudflare should be treated as a layered control surface. The website implementation can reduce low-effort abuse at the application layer, but infrastructure-level controls still belong at Cloudflare.

### 3.1 Selected deployment model

Selected model: Astro prerendered pages plus dynamic Cloudflare Worker endpoints.

Reason:

1. the site needs live endpoints for test sessions, selected controlled CSS, hit recording, reset, and optional Turnstile validation;
2. normal pages do not need request-time rendering and should be prerendered for lower Worker invocation pressure;
3. Astro 6 with the current Cloudflare adapter supports on-demand routes on Cloudflare Workers, so Workers remain the correct Cloudflare target for the dynamic endpoint layer;
4. Workers deployment matches the need for backend-only Turnstile validation and controlled endpoint behavior.

### 3.2 Application-layer controls implemented

Implemented controls:

1. only known test-case identifiers are accepted by the hit and result endpoints;
2. session identifiers must match the expected UUID-like format;
3. hit state is short-lived and stored in per-case cookies rather than persistent server storage;
4. endpoint responses use `Cache-Control: no-store`;
5. the session endpoint can require Turnstile validation when `TURNSTILE_SECRET_KEY` is configured in the Worker environment;
6. the runner submits a Turnstile token generated with `PUBLIC_TURNSTILE_SITE_KEY` when the public site key is present at build time;
7. the Turnstile secret is never exposed to client-side code;
8. malformed hit or result requests return bounded errors rather than allocating persistent state;
9. reset clears all known hit cookies.

### 3.3 Infrastructure controls still required

Cloudflare WAF/rate limiting remains required for public deployment because application checks do not prevent request volume abuse by themselves. The recommended Cloudflare zone rules are:

1. rate-limit `/api/session.json` by IP and path, with a low threshold because it creates new test sessions;
2. rate-limit `/api/hit/*` by IP and path, with a higher threshold because one live test session intentionally triggers multiple CSS resource requests;
3. rate-limit `/api/result/*` by IP and path, with a moderate threshold because the browser polls results;
4. challenge or block obvious non-browser automation against `/api/session.json`;
5. keep static page requests separate from API limits so normal documentation browsing is not affected by test endpoint limits;
6. monitor 4xx and 429 response patterns after launch and adjust thresholds conservatively.

Turnstile is useful for session creation, not for every CSS resource hit. Applying a challenge directly to image/CSS/font hit endpoints would break the test because CSS resource requests cannot complete an interactive challenge. The correct placement is before session creation or before enabling high-volume optional cases.

## 4. Test Case Coverage Control

Coverage is tracked as behavior completion, not as a route named matrix. The implementation surface is `website/src/data/testCases.ts`, `website/src/lib/testProtocol.ts`, `website/src/pages/tests/index.astro`, and the extension diagnostic bridge.

| Coverage group | Current status | Included checks | Remaining work |
| --- | --- | --- | --- |
| Setup check | Implemented | Known detector smoke check | Validate with installed extension on local and deployed origins. |
| Basic selector probes | Implemented | Exact, prefix, suffix, substring, repeated selector, `:has()` relational selector | Confirm exact report wording across modes. |
| Remote request sinks | Implemented | `background-image`, `mask-image`, `image-set()` | Browser-specific endpoint behavior must be validated. |
| Stylesheet delivery | Implemented / partial | Same-origin `@import`, large import representation | Add optional cross-origin companion endpoint. |
| Modern CSS syntax | Implemented | `@supports`, `@media`, nested CSS, `@layer` | Confirm browser syntax support notes after deployed testing. |
| Large stylesheet resilience | Implemented | Large late selector and advanced large import representation | Tune generated size after real browser validation. |
| Declaration indirection | Implemented / manual explanation | Custom property URL, `var()` fallback, attr/if representation | Fixture tests remain authoritative for attr/if details. |
| Side-channel indicators | Implemented / manual explanation | Remote font signal, font measurement/container indicator | Keep wording as risk indicator, not full exploit proof. |

## 5. User-Facing Content Coverage

The website must include these content sections before it is treated as complete:

1. what CSS Sentry protects against;
2. what the test lab does;
3. what the test lab does not prove;
4. how to prepare the extension before testing;
5. how to interpret Default, Passive, Balanced, Strict, Trusted, Paused, Always scan / never sanitize, and Never scan / never sanitize mode results;
6. how to compare endpoint results with the popup and report page;
7. why an endpoint hit can still be expected in Passive mode;
8. why no endpoint hit is not a complete security proof;
9. how other extensions, browser settings, cache state, DNS filtering, and network filtering can change results;
10. what data the website stores;
11. what data the website intentionally does not collect;
12. what abuse controls exist;
13. how to report a mismatch or suspected bypass.

Current coverage: partial. The page includes the main boundary, live-check interpretation, per-case report expectations, mode-specific interpretation tables, and a run-flow explanation for what happens after a live session starts. Full user guidance, privacy/security copy, screenshots, and deployed-mode walkthroughs still need to be expanded.

## 6. Privacy and Data Handling Requirements

The website must never ask users to enter real secrets, real session tokens, real account data, real personal data, or production application values. All test values must be generated by the site or hardcoded as fake sentinels.

Current data model:

1. fake sentinel inputs are hidden in the page;
2. a short-lived test session identifier is generated by the server;
3. a hit endpoint sets a short-lived cookie containing only the session identifier when a controlled CSS resource request reaches the server;
4. the result endpoint compares cookies to the session identifier;
5. no persistent database is configured;
6. no user account system exists;
7. optional Turnstile validation sends the Turnstile token to Cloudflare Siteverify only from the backend when configured.

Future privacy requirements:

1. publish a website-specific privacy note;
2. disclose that standard hosting logs may include IP address, user agent, path, and timestamp;
3. avoid query parameters that encode anything except case identifier and generated session identifier;
4. avoid long-lived identifiers;
5. avoid analytics by default unless explicitly documented and privacy-reviewed.

## 7. Security and Anti-Abuse Requirements

The website's API endpoints are intentionally reachable by browsers. They must remain narrowly scoped.

Required controls:

1. known-case allowlist for all hit endpoints;
2. bounded session identifier format;
3. no request body accepted on hit or result endpoints;
4. no persistent writes without a storage design and retention policy;
5. no reflected arbitrary CSS, URL, or HTML from request parameters;
6. no unbounded server-side state keyed by attacker-controlled values;
7. no Turnstile secret in client code;
8. no interactive challenge on CSS resource endpoints;
9. no permissive CORS on API endpoints unless a specific cross-origin companion test is designed;
10. no endpoint that can be used as an arbitrary redirect or request forwarder;
11. Cloudflare WAF/rate-limiting rules for session, hit, and result endpoint paths;
12. conservative cache headers on dynamic endpoints.

Current coverage: partial to implemented. The code implements allowlisted cases, session validation, short-lived cookies, no-store responses, and optional Turnstile validation for session creation. Cloudflare dashboard/API WAF rules are not represented in source and must be configured externally before public launch.

## 8. Cloudflare Configuration Requirements

Source-controlled baseline:

1. `website/astro.config.mjs` keeps the Cloudflare adapter but does not enable server output for every page;
2. `website/wrangler.jsonc` sets the Worker name and compatibility date;
3. `.github/workflows/website-cloudflare.yml` provides the active Cloudflare Worker deployment workflow.

Cloudflare account configuration still required outside source:

1. Worker project and route/custom domain;
2. `CLOUDFLARE_ACCOUNT_ID` GitHub secret;
3. `CLOUDFLARE_API_TOKEN` GitHub secret scoped to Workers deployment;
4. optional `TURNSTILE_SECRET_KEY` Worker secret;
5. optional `PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SITE_KEY` repository variable or secret for the client widget build;
6. WAF/rate limiting rules for API paths;
7. log/analytics review according to the project's privacy posture.

## 9. GitHub Actions Coverage

The active workflow under `.github/workflows/website-cloudflare.yml` builds the website and deploys the Worker from the `website` directory after Cloudflare secrets are configured.

Current workflow behavior after activation:

1. build job runs on push or pull request when `website/**` changes;
2. deploy job runs only on push to `main`;
3. deployment uses Cloudflare's Wrangler GitHub Action;
4. Cloudflare account ID and API token are read from GitHub secrets;
5. workflow uses the `website` working directory.

Remaining workflow work:

1. decide whether pull requests should build only or also create preview deployments;
2. add dependency caching that matches the final package manager decision;
3. keep the website integrated into the root pnpm workspace and regenerate the root lockfile after dependencies are resolvable;
4. add source validation and accessibility checks when website tests exist;
5. add deployment environment protection if the repository uses protected environments.

## 10. Design and UX Requirements

The website should avoid a generic default template. It should present a clear security-lab interface without overstating the meaning of results.

Required UX properties:

1. clear page title and explanation;
2. visible warning that the test is not a complete safety proof;
3. explicit selected test cases;
4. per-case expected behavior summary;
5. live endpoint result table;
6. accessible controls with visible focus states;
7. responsive layout without overlapping components;
8. light and dark mode support through system preference;
9. no decorative effects that obscure interpretation;
10. no user-entered secret fields.

Current coverage: implemented foundation. The session start flow now creates a session, updates the URL state through browser history, injects selected controlled CSS dynamically, and polls endpoint results without refreshing the page. Direct session URLs still render the initial stylesheet path for deep links and reruns. Additional visual polish, deployed validation, and report-correlation content remain.

## 11. Validation Requirements

Website validation must include:

1. Astro build;
2. Astro preview or Cloudflare local preview;
3. endpoint request tests for session, hit, result, and reset;
4. browser test that confirms injected CSS can reach the endpoint without CSS Sentry;
5. browser test that confirms expected behavior with CSS Sentry installed in each protection mode;
6. accessibility checks for the page and controls;
7. no-secret static scan for Turnstile and Cloudflare tokens;
8. zip/artifact checks excluding build output and installed dependencies;
9. workflow syntax review before enabling `.github`.

Current validation status: source-level only in this artifact. The source verifier now checks Cloudflare build-script approval, initial-document CSS rendering, run-flow reload behavior, import ordering, result-polling syntax, and readable layout invariants. Dependency-backed Astro build and Cloudflare preview require installing website dependencies.

## 12. Remaining Implementation Queue

1. Run `pnpm install --no-frozen-lockfile` with registry access so the root lockfile gains the `website` importer and Astro/Cloudflare dependency graph, including the approved `workerd` build dependency; after committing that regenerated lockfile, restore frozen-lockfile installs in CI.
2. Run `website` build and preview validation.
3. Add a client-visible Turnstile widget only if the Worker secret is configured and the test lab requires abuse gating before session creation.
4. Validate the implemented mode expectation tables against real extension output in Passive, Balanced, Strict, Trusted, and Paused modes.
6. Expand the current report-correlation copy with exact report examples or screenshots after deployed browser validation.
7. Add optional cross-origin companion endpoint design.
8. Add frame/iframe test pages.
9. Add SVG/image-document test only if the extension has supported behavior for that path.
10. Add endpoint tests for malformed case IDs, malformed session IDs, reset behavior, and result reads.
11. Add Playwright website smoke tests.
12. Add accessibility validation.
13. Preserve website deployment through the root pnpm workspace unless a later repository split is explicitly chosen.
14. Review the final public copy for precision and non-overclaiming.

## 13. 1.0.63 Run-Flow Correction

The live session start behavior was corrected after local manual testing showed that a session could be created while the extension did not detect the controlled cases. The root cause was that the page updated the text of an existing empty style element after the first scan. CSS Sentry's mutation rescan path observes added style elements and relevant attribute changes, but it does not rely on character-data updates inside an already-present style element.

The corrected behavior is:

1. the Start selected checks button creates a short-lived session;
2. the page navigates to the same route with the generated session and selected allowlisted cases;
3. the runner injects selected controlled CSS for the active session and direct session URLs still support the initial stylesheet path;
4. CSS Sentry receives the same kind of page-scan opportunity it receives on normal pages;
5. the website polls the result endpoint and updates the endpoint result table;
6. users compare endpoint status with CSS Sentry's popup and report output.

This does not convert endpoint results into a complete security verdict. Endpoint hits still need to be interpreted against the selected CSS Sentry mode, browser timing, other extensions, browser cache state, and the extension report.

## 14. 1.0.64 Guided Verification Overhaul

The website diagnostic model was reworked after screenshot review showed that the page remained too abstract and did not explain why a user should expect CSS Sentry to detect anything. The root usability failure was that endpoint state was presented more clearly than the security mechanism, extension report check, and mode-specific interpretation. A received or missing endpoint hit is not sufficient by itself; the user must also know what fake value was targeted, which CSS rule caused the request, which CSS Sentry reasons should appear, and whether the selected mode expects report-only behavior or stronger mitigation.

The implementation now uses guided test walkthroughs instead of compact case cards. Each test shows the plain-language question, fake data, CSS snippet, controlled request path, expected CSS Sentry report terms, endpoint timeline, manual extension-result controls, mode-aware interpretation, troubleshooting guidance, and technical notes. The page also includes a mode selector and a diagnostic state panel so results are interpreted against Passive, Balanced, Strict, Trusted, Paused, or unknown mode rather than against a misleading global pass/fail assumption.

The canonical plan for this redesign is documented in `docs/website/TEST_LAB_OVERHAUL_PLAN.md`. That document owns the full website completion model for the guided lab experience, while this status file tracks implementation status and remaining coverage.

Current coverage after this change:

1. implemented guided explanation for all current live checks;
2. implemented mode-aware manual interpretation;
3. implemented explicit “CSS Sentry shows nothing” troubleshooting flow;
4. implemented visible fake data, CSS snippets, endpoint paths, and report terms;
5. preserved the live endpoint polling foundation;
6. preserved the non-overclaiming boundary that endpoint results are not global safety proof.

Remaining coverage after this change:

1. automated endpoint tests;
2. Playwright website smoke tests;
3. deployed browser validation with CSS Sentry installed;
4. additional test cases for exact/prefix/suffix selector probes, additional sink properties, iframe coverage, same-origin stylesheet files, and cross-origin companion endpoints;
5. report screenshots or exact report examples after real extension validation;
6. accessibility validation;
7. production Cloudflare WAF/rate-limit configuration.

## 1.0.65 Test Lab redesign and diagnostic status

Status: implemented as a source-level redesign; deployed browser validation with the extension installed remains required.

The 1.0.65 Test Lab restructure introduced overview, individual checks, local history, and troubleshooting. The 1.0.67 runner supersedes the individual check page as the primary interaction model while preserving deep links into `/tests/?cases=<caseId>`. The known detector smoke check remains the first recommended check, because a user must first confirm that CSS Sentry can scan the Test Lab origin before interpreting more advanced CSS cases.

The website now separates endpoint result, extension diagnostic signal, and manual CSS Sentry report confirmation. This is required because an endpoint request only proves that the browser made a controlled request. It does not by itself prove whether CSS Sentry passed, failed, was paused, lacked site access, was trusted for the site, or did not match the detector.

Current implemented pages:

1. `website/src/pages/index.astro` — overview, recommended flow, and check index.
2. `website/src/pages/tests/index.astro` — primary guided runner for one check, category checks, and all checks.
3. `website/src/pages/tests/[caseId].astro` — compatibility redirect into the runner.
4. `website/src/pages/history/index.astro` — local browser history for diagnostic states.
5. `website/src/pages/troubleshooting/index.astro` — explanation for missing CSS Sentry results.

Current implemented diagnostic support:

1. supported-origin scan diagnostic event from the content script when the page has the `css-sentry-test-lab` meta marker;
2. supported-origin report-save acknowledgement after the background report path responds;
3. minimal diagnostic payload with finding counts, actions, reason codes, mode, analysis state, and report-save state;
4. no selector text, URLs, or page data exposed in the diagnostic payload;
5. website-side recovery of sanitized diagnostic attributes emitted before the runner listener attaches;
6. website-side mutation observation for sanitized diagnostic attributes written after the runner listener attaches;
7. same-origin `window.postMessage` diagnostic transport for content-script to page-script isolation cases;
8. website-side timeout state for no local diagnostic signal;
9. website-side distinction between local diagnostic failure, scan-disabled local mode, and expected public-deployment manual confirmation;
10. website-side classification for endpoint received plus zero extension findings.

Remaining validation:

1. run the website with the extension installed and verify the known detector smoke check;
2. verify that missing site access produces the no-signal state;
3. verify that a detected check records a local history item;
4. run `pnpm website:build` after lockfile regeneration;
5. add browser-level website tests once website dependencies are available.
