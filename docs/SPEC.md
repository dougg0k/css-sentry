# CSS Sentry — SPEC.md

Last Updated: 2026/05/03 21:36:00 -03

## 1. Project Summary

**CSS Sentry** is a browser extension that detects and reduces risk from CSS-based data exfiltration attacks. It is a fresh implementation, not a fork or direct reuse of prior CSS exfiltration extensions.

The extension is designed for modern Chrome/Chromium and Firefox using a WXT + React + TypeScript architecture. It uses a shared browser-independent detection core, with browser-specific wrappers for content scripts, extension APIs, network blocking, permissions, and UI.

CSS Sentry is a defense-in-depth tool. It does not claim to prevent every possible CSS side channel, browser leak, CSS injection attack, or future CSS exfiltration technique.

## 2. Core Goal

Detect and mitigate high-risk CSS patterns where hostile or untrusted CSS combines:

1. selector-based probing of page state, attributes, DOM structure, or sensitive fields; and
2. CSS-triggered outbound network requests that can encode extracted data to an attacker-controlled endpoint.

Conceptually:

```text
selector/probe capability + network/output sink + sensitive context = risk
```

## 3. Non-Goals

CSS Sentry does not attempt to guarantee protection against:

- all CSS-based side channels;
- all XS-Leaks;
- all browser implementation bugs;
- all timing, layout, rendering, or cache-based leaks;
- all malicious browser extensions;
- all compromised websites;
- all CSS injection vulnerabilities;
- arbitrary response-body rewriting on Chrome Manifest V3;
- complete inspection of every cross-origin stylesheet;
- future CSS features not yet modeled by the detector.

The extension must be transparent about these limits in the README, options page, popup, and warning UI.

## 4. Target Users

Primary users:

- security-conscious browser users;
- developers testing whether their pages are exposed to CSS-exfil patterns;
- security researchers;
- administrators who want extra protection on sensitive web applications.

Secondary users:

- privacy-focused users already using content blockers;
- users of webmail, cloud consoles, admin panels, banking, identity providers, password managers, and internal dashboards.

## 5. Browser Targets

### 5.1 Chrome / Chromium

Chrome support must be Manifest V3-first.

Expected primitives:

- content scripts;
- manifest-declared content scripts;
- `chrome.storage`;
- `chrome.declarativeNetRequest`;
- `chrome.webNavigation` for early policy application;
- dynamic/session DNR rules for high-confidence blocking and destination policy.

Chrome limitations are architectural constraints, not bugs:

- no dependency on Manifest V2;
- no arbitrary blocking `webRequest`-style response rewriting;
- no guarantee of full stylesheet body inspection before application;
- DNR is rule-based, not a full runtime CSS firewall.

### 5.2 Firefox

Firefox should support the same baseline behavior as Chrome.

Optional enhanced mode may use Firefox-specific APIs when available, including stronger request/response handling, but the core product must not require Firefox-only capabilities.

### 5.3 Unsupported Platforms

Unless a future maintainer explicitly adds support, the following are out of scope:

- Chrome Manifest V2;
- XUL extensions;
- Pale Moon;
- Waterfox Classic;
- legacy Firefox versions that lack the required WebExtension APIs.

## 6. Implementation Platform

Project setup assumption:

```text
WXT
React
TypeScript
Manifest V3 baseline
```

Recommended package layout:

```text
src/
  entrypoints/
    background.ts
    content.ts
    popup/
      App.tsx
    options/
      App.tsx
  core/
    analyzer/
      analyzeStylesheet.ts
      analyzeRule.ts
      analyzeSelector.ts
      analyzeDeclaration.ts
      riskScore.ts
    css/
      parseCss.ts
      walkCssAst.ts
      resolveCustomProperties.ts
      normalizeUrl.ts
    findings/
      Finding.ts
      FindingStore.ts
    policy/
      SitePolicy.ts
      defaultPolicy.ts
  browser/
    dnr/
      chromeDnr.ts
    permissions/
      hostPermissions.ts
    tabs/
      tabState.ts
  shared/
    constants.ts
    messages.ts
    types.ts
  tests/
    fixtures/
      attacks/
      benign/
    unit/
    integration/
    e2e/
```

## 7. Extension Modes

### 7.1 Passive Mode

Default-safe detection-only mode.

Behavior:

- detect suspicious CSS patterns;
- log findings locally;
- show badge count or popup warning;
- avoid page-breaking mitigations unless confidence is high and user policy permits it;
- do not fetch remote CSS from extension context solely for analysis.

### 7.2 Balanced Mode

Recommended general mode after maturity.

Behavior:

- detect suspicious CSS;
- block high-confidence network sinks;
- warn on medium-confidence patterns;
- allow user to trust or restrict a site;
- minimize false positives.

### 7.3 Strict Mode

Opt-in per-site mode for sensitive domains.

Behavior:

- treat suspicious CSS as fail-closed;
- block third-party stylesheet imports unless allowed;
- block third-party CSS-triggered image/font/resource requests unless allowed;
- warn on uninspectable cross-origin stylesheets;
- surface clear breakage controls.

Recommended strict-mode contexts:

- banking;
- identity providers;
- webmail;
- password managers;
- crypto exchanges;
- cloud consoles;
- admin panels;
- internal dashboards;
- healthcare or legal portals.

### 7.4 Compatibility and Bypass Modes

The policy model must distinguish these behaviors even if the UI labels are simplified:

```text
Default
Passive
Balanced
Strict
Always Scan / Never Sanitize
Never Scan / Never Sanitize
Paused
Trusted
```

## 8. Threat Model

### 8.1 In-Scope Attacker Capabilities

The attacker can introduce CSS into a page through one or more of:

- stored or reflected CSS injection;
- unsanitized user-generated HTML/CSS;
- malicious third-party stylesheet;
- compromised third-party CSS dependency;
- dangerous custom theme feature;
- rendered email or document content;
- injected `<style>` element;
- injected `style=""` attribute;
- CSS generated by a vulnerable web component or markdown renderer.

The attacker may not need JavaScript.

### 8.2 In-Scope Targets

The attacker may attempt to infer or exfiltrate:

- input values;
- hidden field values;
- tokens rendered into DOM attributes;
- URLs;
- DOM structure;
- presence or absence of elements;
- user state encoded into attributes/classes;
- autofilled field values where exposed to CSS selectors;
- application state reflected into markup.

### 8.3 Out-of-Scope Attacker Capabilities

The extension does not defend against:

- attacker-controlled JavaScript with full page access;
- compromised browser or browser profile;
- malicious extensions with broader permissions;
- server-side compromise;
- malware on the host;
- phishing;
- direct credential theft by form submission;
- network attacker modifying traffic outside HTTPS guarantees.

## 9. Detection Model

### 9.1 Rule Risk Components

Each CSS rule should be scored using independent signals.

```text
risk = selectorRisk + sinkRisk + contextRisk + obfuscationRisk - benignSignals
```

### 9.2 Selector Risk

High-risk selectors include:

- attribute prefix matching: `[value^="a"]`;
- attribute suffix matching: `[value$="z"]`;
- attribute substring matching: `[value*="token"]`;
- exact matching against sensitive attributes;
- case-insensitive attribute matching where relevant;
- selectors targeting `input`, `textarea`, `select`, `option`;
- selectors targeting hidden fields;
- selectors targeting authentication, CSRF, token, email, password, session, or ID-like names;
- relational selectors such as `:has()` when combined with sensitive descendants;
- selector lists that enumerate many possible values;
- generated brute-force selector patterns.

Medium-risk selectors include:

- `[data-*]` selectors when combined with outbound sinks;
- `[aria-*]` selectors when combined with outbound sinks;
- class/id probing where names appear sensitive;
- structural selectors used with sensitive forms.

Lower-risk selectors include:

- ordinary layout selectors;
- theming selectors;
- selectors without outbound sinks;
- attribute selectors clearly unrelated to sensitive state.

### 9.3 Declaration / Sink Risk

High-risk sinks include CSS properties or at-rules that can trigger external requests:

- `background`;
- `background-image`;
- `border-image`;
- `list-style`;
- `list-style-image`;
- `cursor`;
- `content` where URL-capable;
- `mask`;
- `mask-image`;
- `clip-path` when URL-capable;
- `filter` when URL-capable;
- `src` in `@font-face`;
- `@import`;
- SVG references through `url()`;
- any declaration containing a remote `url()`.

The sink analyzer must parse declarations structurally and avoid substring-only decisions.

### 9.4 URL Risk

Risk should increase when URLs are:

- absolute remote URLs;
- protocol-relative URLs;
- cross-origin URLs;
- newly observed domains;
- high-entropy paths or query strings;
- dynamically constructed through CSS variables;
- repeated across many selector probes;
- embedded in generated attack-like rule sets.

Risk should decrease when URLs are:

- same-origin static assets;
- extension-generated safe placeholders;
- known local assets;
- data URLs that cannot create outbound requests.

Important: URL classification must parse the URL and context properly. It must not treat the presence of a substring such as `;base64,` as sufficient proof of a safe data URL.

### 9.5 Custom Properties

CSS custom properties can hide or separate selector probes from network sinks.

The analyzer must:

- collect custom property definitions;
- resolve `var()` references best-effort;
- support fallback chains such as `var(--missing, var(--link))`;
- track unresolved `var()` usage in risky declarations;
- increase risk when a suspicious rule uses unresolved variables in URL-capable properties;
- avoid infinite recursion through cyclic custom properties.

### 9.6 Nested Rules

The analyzer must recursively walk nested/grouping rules including:

- `@media`;
- `@supports`;
- `@layer`;
- `@container`;
- nested CSS syntax where parser support exists.

Missing nested rules is a security-relevant bug.

### 9.7 Inline Styles

Inline style analysis should:

- inspect `style=""` attributes;
- detect remote `url()` sinks;
- detect custom-property definitions that feed risky rules;
- avoid claiming full coverage of inline-style exfiltration techniques that do not require conventional selectors.

### 9.8 Dynamic DOM and CSS Changes

A content script should use `MutationObserver` to watch for:

- added `<style>` elements;
- added `<link rel="stylesheet">` elements;
- changes to existing style text;
- changes to `style` attributes;
- changes to sensitive form attributes where relevant;
- added shadow roots where observable.

The observer must be rate-limited and resilient against performance abuse.

## 10. Analysis State Model

The extension must never silently report complete protection when analysis is incomplete.

Required states:

```text
analysis.complete
analysis.partial
stylesheet.pending
stylesheet.cross_origin_uninspectable
stylesheet.failed_permission
stylesheet.failed_csp_or_platform
analysis.skipped.too_large
analysis.skipped.performance_budget
```

The popup and report must show when protection is partial because a stylesheet was unavailable, cross-origin restricted, blocked by permissions, too large, or still loading.

## 11. Finding Severity

Severity levels:

```text
info
low
medium
high
critical
```

Example mapping:

**Critical**

- suspicious selector probing sensitive input values;
- remote URL sink to third-party domain;
- repeated alphabet/brute-force patterns;
- active request observed or blocked.

**High**

- sensitive attribute selector plus remote URL sink;
- `:has()` probing sensitive descendants plus remote URL sink;
- nested or obfuscated rule with remote sink.

**Medium**

- attribute probing plus same-origin sink;
- remote URL sink with unresolved custom properties;
- suspicious third-party stylesheet in strict mode.

**Low**

- URL sink without sensitive selector;
- suspicious selector without outbound sink;
- uninspectable stylesheet on non-strict site.

**Info**

- detection-only notes;
- compatibility warnings;
- permissions limitations.

## 12. Mitigation Actions

Available actions:

- log only;
- warn user;
- inject local CSS override;
- remove suspicious style node;
- disable suspicious stylesheet;
- block destination URL using DNR/session rule;
- block third-party stylesheet in strict mode;
- request additional host permission;
- recommend site-side fixes.

Chrome mitigation should prefer:

- local page-level neutralization for known suspicious declarations;
- DNR session rules for known suspicious destination URLs;
- user-visible warnings when full inspection is impossible.

Chrome must not claim to rewrite all CSS responses.

Firefox should use the same baseline as Chrome. Optional enhanced response filtering may be implemented only if stable, maintainable, and separately tested.

## 13. Network and Fetch Policy

CSS Sentry must not fetch remote CSS from the extension context by default.

Remote fetch analysis may only be added if all are true:

- the user explicitly enables it;
- UI explains that requests originate from the extension context;
- browser permissions and extension CSP support it;
- request logs clearly identify extension-origin fetches;
- compatibility with uBlock Origin, uBO Lite, NoScript, JShelter, and browser tracking protection is tested;
- failures degrade to transparent partial analysis.

## 14. Privacy Model

CSS Sentry is local-first.

Requirements:

- no telemetry by default;
- no remote analysis service;
- no upload of CSS, URLs, page contents, selectors, or findings;
- no remote fetching of stylesheets by the extension unless explicitly enabled;
- logs stored locally only;
- easy log clearing;
- no account system.

If telemetry is ever considered, it must be opt-in, documented, minimal, and disabled by default.

## 15. Permissions Model

Current v1 permissions:

- `storage`;
- `declarativeNetRequest` for Chrome blocking;
- `webNavigation` for early tab-policy application;
- host permissions for `<all_urls>` so manifest-declared content scripts can inspect pages under the user-enabled extension scope.

`activeTab`, `scripting`, and optional host permissions are not requested in the current v1 scope because the extension does not programmatically inject scripts.

The UI must explain:

- why host access is needed;
- what works without host access;
- what improves after host access is granted;
- how to revoke access.

Missing permissions must produce explicit UI state and handled logs, not unhandled console errors.

## 16. User Interface

### 16.1 Popup

The popup is the primary current-site control surface. It must be concise and must not expose duplicate controls for the same state.

The popup should show:

- current site status;
- current origin or a clear fallback such as `No active web origin`;
- protection mode;
- number of findings;
- highest severity;
- blocked destinations when available;
- whether analysis is complete, partial, or waiting for the first scan;
- stat tooltips explaining every displayed metric;
- quick actions:
  - set Passive mode;
  - set Balanced mode;
  - enable Strict mode;
  - open full report;
  - clear findings.

Popup mode-selection requirements:

- the popup must not show both a select/dropdown and buttons for the same protection-mode decision;
- standard view must show only the primary global modes as buttons: Passive, Balanced, and Strict;
- advanced-only global modes such as Always Scan / Never Sanitize and Never Scan / Never Sanitize must appear in the popup only when advanced options are enabled. Trusted and Paused are site-specific modes and belong in advanced origin rules, not the popup global mode control;
- the visually selected mode must always match the effective saved mode immediately after the user changes it;
- changing a mode from the popup must update the same global policy mode used by the Options page and must not depend on a delayed runtime-message round trip before the UI reflects the saved state;
- the popup must never render raw `null`, `undefined`, or equivalent placeholder values;
- when there is no report yet, the popup should show a waiting/empty state rather than misleading findings data.

### 16.2 Options Page

The options page should include a persistent **advanced mode** toggle inside the Compatibility and privacy section. Standard view must show common controls only. Advanced mode must reveal low-level origin rules, destination allow/block lists, exact per-origin mode overrides, all advanced Settings global modes, advanced popup modes, and experimental compatibility/privacy controls. Trusted and Paused must remain available in Settings when advanced mode is enabled, even though they must not appear as popup global-mode buttons. Turning advanced mode on must not weaken protection by itself; it only changes settings visibility. The default global protection mode must be Balanced, and both popup and settings must reflect the same effective mode. Origin inputs and stored policy data must reject null-like or invalid origins such as `null`, `undefined`, or `https://null`.

The options page should include:

- global mode selection;
- per-site rules;
- strict-mode domains;
- allowlisted domains;
- blocklisted domains;
- log retention settings;
- compatibility settings;
- import/export settings;
- test page link;
- explanation of limitations.

### 16.3 Finding Report

Each finding should include:

- severity;
- page URL origin;
- stylesheet origin if known;
- selector summary;
- sink property;
- destination URL origin;
- action taken;
- confidence;
- reason codes;
- timestamp;
- whether the full stylesheet was inspectable.

Sensitive values must be redacted unless they are already part of the CSS source and needed for debugging.

## 17. Reason Codes

Findings should be explainable through stable reason codes.

Example codes:

```text
selector.attribute.prefix_match
selector.attribute.substring_match
selector.attribute.sensitive_name
selector.relational.has
selector.repeated_probe_pattern
sink.remote_url
sink.import_remote
sink.font_remote
sink.svg_reference
url.cross_origin
url.high_entropy
css.custom_property.unresolved
css.custom_property.url_sink
css.grouping_rule.nested
stylesheet.cross_origin.uninspectable
stylesheet.pending
stylesheet.failed_permission
policy.strict.third_party_stylesheet
```

## 18. Compatibility Requirements

CSS Sentry should coexist with common blockers and hardening tools.

Important compatibility targets:

- uBlock Origin;
- uBlock Origin Lite;
- NoScript;
- JShelter;
- Firefox Enhanced Tracking Protection;
- Chrome Safe Browsing;
- enterprise-managed extension policies.

Design rules:

- do not fetch remote CSS from the extension context by default;
- do not rely on page JavaScript;
- do not pollute page globals;
- minimize page-visible artifacts;
- avoid fixed page-visible marker names;
- document expected interactions with other blockers.

## 19. Anti-Detection Requirements

The extension should not unnecessarily expose itself to websites.

Avoid:

- fixed CSS class names;
- fixed injected element IDs;
- page-visible global variables;
- predictable marker styles;
- console logs in production;
- externally visible resources unless required.

Any unavoidable page-visible behavior must be documented.


### 19.5 No-breakage Browser E2E Baseline

The browser-runtime e2e suite must include benign pages that exercise normal UI and rendered-content patterns without creating high/critical findings or DNR blocks in normal modes. Required benign browser-e2e coverage includes carousel-like UI, embedded map-like UI, large static pages, benign webmail themes, inert markdown/code-block content, Tailwind-like generated output, and CSS Modules-like generated output. These tests are a v1 release gate because CSS Sentry must avoid normal browsing breakage while still reducing CSS-exfiltration risk.

Destination-policy DNR rules used for first-load protection should use exact-origin matching where possible so localhost, IP, and port-specific test origins are handled reliably without relying only on hostname-level matching.


## 20. Performance Requirements

The extension must be safe to run on large pages.

Requirements:

- analyze incrementally;
- debounce mutation handling;
- cap per-page analysis time;
- cap maximum stylesheet size for synchronous analysis;
- avoid blocking the main thread for long periods;
- cache stylesheet analysis by content hash where possible;
- avoid repeated analysis of unchanged nodes;
- fail gracefully with `analysis.skipped.too_large` or `analysis.skipped.performance_budget`.

Load-blocking mitigation must be bounded:

- apply mitigation only when needed;
- apply mitigation once per lifecycle phase;
- remove mitigation deterministically;
- avoid global selectors that force recalculation across very large DOMs;
- impose DOM size and stylesheet size budgets;
- support user-controlled per-site bypass modes;
- ensure pause/disabled mode exits before DOM interaction.

## 21. Historical Issue Requirements Audit

This section converts the public CSS Exfil Protection issue tracker into explicit requirements for CSS Sentry. CSS Sentry is a fresh implementation, but the old issue tracker is treated as a regression source and product-risk inventory.

### 21.1 Scope of Historical Issue Audit

The following issues must be represented in implementation requirements, test fixtures, or explicit non-goals:

```text
Open issues reviewed: #43, #41, #38, #35, #32, #31, #29, #21, #9, #3
Closed issues reviewed: #40, #39, #37, #36, #34, #33, #30, #28, #26, #25, #24, #23, #4, #1
```

Issues that are not directly applicable to a WXT + React + TypeScript fresh implementation still produce documentation, compatibility, release, or non-goal requirements.

### 21.2 Historical Issue Matrix

| Issue | Historical problem | CSS Sentry requirement |
|---|---|---|
| #43 | Chrome Web Store warning about Manifest V3 compatibility. | Chrome build must be Manifest V3-first. No Manifest V2 dependency is allowed. Build, store metadata, and README must explain Chrome MV3 limitations. |
| #41 | Vulnerability disclosure: URL/base64 matching bypass, CSS variable bypass, nested `@supports` / `@media` rule bypass. | Use structural CSS parsing, URL normalization, recursive rule traversal, and custom-property analysis. Add regression tests for all disclosed bypass classes. |
| #40 | Firefox-only Google Maps embed breakage. | Mitigations must be scoped and reversible. Add per-site pause, trust, and strict-mode controls. Maintain compatibility fixtures for complex embedded third-party widgets. |
| #39 | User confusion about inline, internal, and external CSS risk. | README and UI must explain CSS risk by source type: inline style attributes, `<style>` elements, external stylesheets, injected themes, and rendered user content. |
| #38 | Failure when NoScript or JShelter is enabled in Firefox. | Do not depend on page JavaScript. Do not expose or require page globals. Add compatibility tests with NoScript and JShelter where feasible. |
| #37 | Concern that browser/spec-level mitigation may be needed, especially with `:has()` and value selectors. | Treat browser-level prevention as out of scope, but include `:has()` and sensitive value-attribute selectors in the threat model and tests. README must not claim browser-equivalent protection. |
| #36 | Tester result changed when another styling extension was enabled, despite CSS Exfil Protection not being installed. | Test corpus must distinguish extension protection from incidental third-party style interference. Findings must explain whether a result is caused by CSS Sentry, another extension, or unknown environmental interference when detectable. |
| #35 | Firefox console error: missing host permission for tab or iframes. | Missing host permissions must be treated as expected states, not noisy errors. Current v1 uses manifest-declared host access and clear partial/failure states rather than optional host permission prompts. |
| #34 | User asked whether project was abandoned. | Publish maintenance status, support policy, release cadence expectations, and security disclosure policy. README must make current project status obvious. |
| #33 | Unofficial Edge Store publication of the same Chrome version. | Store distribution must be controlled and documented. Edge/Chromium support must be explicit; unofficial redistributions are unsupported unless authorized. |
| #32 | False positive caused by substring check for `value`, including `[data-value='0']`. | Use selector parsing, not substring matching. Attribute names must be parsed exactly; `[data-value]` is not equivalent to `[value]`. Add false-positive regression tests. |
| #31 | Cross-domain CSS showed vulnerable on first load, then passed after reload. | Model first-load races explicitly. Findings must include `analysis.partial`, `stylesheet.pending`, or `stylesheet.uninspectable` states. Cross-origin handling must be deterministic and tested. |
| #30 | CSP error when attempting XHR/fetch of external CSS. | Extension-origin stylesheet retrieval must not be default behavior. If optional remote fetch analysis is added, it must use correct extension CSP, permissions, user opt-in, and error reporting. |
| #29 | Behind-the-scenes connections bypassed or conflicted with uMatrix/uBlock expectations. | Do not fetch remote CSS from the extension context by default. Prefer observing browser-loaded resources and DNR/session blocking. Document compatibility with content blockers. |
| #28 | DNSSEC request for the old test domain. | CSS Sentry must not depend on a single external tester domain. Test pages should be local, reproducible, and optionally self-hostable. Public demo domains should use HTTPS and documented domain security posture. |
| #26 | High CPU usage on very large pages; discussion identified repeated load-blocking CSS application/removal, 12–13 MB HTML, disabled-mode behavior, and per-domain scan/sanitize settings. | Analyzer must be incremental, debounced, bounded by page/style size budgets, and disabled before any page interaction when paused. Add per-site modes: Always Scan/Never Sanitize, Never Scan/Never Sanitize, Strict, Balanced, Passive. Add large-document performance tests. |
| #25 | Chrome 85 CORS changes affected cross-site CSS filtering. | Cross-origin stylesheet handling must be designed around current extension APIs, not page XHR assumptions. Chrome and Firefox strategies must be separated where platform behavior differs. |
| #24 | User asked whether Firefox should integrate protections internally and whether alternatives exist. | README must state what CSS Sentry can and cannot do compared with browser-native mitigations and site-side mitigations. Browser-native protection remains outside extension control. |
| #23 | Waterfox Classic + uBlock Origin conflict allowed fonts.googleapis.com despite uBO rule. | Legacy Waterfox/XUL support is out of scope. For supported browsers, compatibility testing must verify CSS Sentry does not create extension-context network requests that bypass other blockers. |
| #21 | Request for a list of sites that trigger the extension. | Provide a local finding report and optional user-exportable diagnostic bundle. Do not maintain a public list of user-triggering sites unless privacy-reviewed. |
| #9 | Feature request for XUL/Pale Moon support. | XUL and Pale Moon are out of scope. README must state supported browsers and unsupported legacy extension platforms. |
| #4 | Amazon.ca carousel/layout breakage when extension enabled alongside other add-ons. | Mitigation must avoid broad layout disruption. Add reversible mitigation, per-site pause, and compatibility mode. Regression fixtures should include dynamic carousels and third-party content modules. |
| #3 | Fixed marker `__css_exfil_protection_filtered_styles` made the add-on detectable. | Do not use fixed page-visible marker IDs/classes/globals. Any page-visible artifacts must be randomized, minimized, and documented. |
| #1 | JavaScript `indexOf()` truthiness bug around `background` detection. | Avoid truthiness checks for sentinel values. Prefer typed parsing and explicit comparisons. Add lint rules and unit tests for all parser predicates. |

### 21.3 Requirements Derived from Issue Discussions

#### 21.3.1 No brittle substring detection

The analyzer must not use raw substring checks as enforcement logic for selectors, properties, or URLs.

Forbidden patterns include:

```text
indexOf('value') as a proxy for a value attribute selector
indexOf('background') as a predicate without explicit comparison
indexOf(';base64,') as a proxy for safe data URLs
indexOf('//') as the sole remote URL detector
```

Required approach:

- parse selectors structurally;
- parse declarations structurally;
- parse and normalize URLs;
- classify data URLs by scheme, MIME type, and whether they can create outbound requests;
- use explicit boolean predicates with tests.

#### 21.3.2 Recursive stylesheet traversal is mandatory

The analyzer must recursively traverse all inspectable rule containers, including:

- `@media`;
- `@supports`;
- `@layer`;
- `@container`;
- nested CSS syntax where the selected parser supports it.

Security-relevant style rules hidden inside grouping rules must not be skipped.

#### 21.3.3 Custom-property analysis is mandatory

CSS variables and fallback chains must be treated as first-class inputs to the risk model.

Required behavior:

- collect custom property definitions from applicable scopes where feasible;
- resolve `var()` references best-effort;
- support fallback chains such as `var(--missing, var(--link))`;
- flag unresolved variables in URL-capable properties;
- cap recursion depth and detect cycles;
- add explicit `css.custom_property.unresolved` and `css.custom_property.url_sink` reason codes.

#### 21.3.4 First-load and cross-origin races must be explicit states

The extension must not silently report a page as safe when analysis is incomplete.

Required states:

```text
analysis.complete
analysis.partial
stylesheet.pending
stylesheet.cross_origin_uninspectable
stylesheet.failed_permission
stylesheet.failed_csp_or_platform
```

The popup and report must show when protection is partial because a stylesheet was unavailable, cross-origin restricted, blocked by permissions, or still loading.

#### 21.3.5 Extension-context network requests are restricted

CSS Sentry must not fetch remote CSS from the extension context by default.

Remote fetch analysis may only be added if all are true:

- user explicitly enables it;
- UI explains that requests originate from the extension context;
- browser permissions and CSP support it;
- request logs clearly identify extension-origin fetches;
- compatibility with uBlock Origin, uBO Lite, NoScript, JShelter, and Firefox tracking protection is tested;
- failures degrade to transparent partial analysis.

#### 21.3.6 Load-blocking mitigation must be bounded

The old extension discussion identified load-blocking CSS as a source of high CPU and rendering problems on very large pages.

CSS Sentry must not use broad page-level blocking CSS without safeguards.

Required safeguards:

- apply mitigation only when needed;
- apply mitigation once per lifecycle phase;
- remove mitigation deterministically;
- avoid global selectors that force recalculation across very large DOMs;
- impose DOM size and stylesheet size budgets;
- support user-controlled per-site bypass modes;
- ensure pause/disabled mode exits before DOM interaction.

#### 21.3.7 Per-site controls are required

The following per-site modes are required:

```text
Default
Passive
Balanced
Strict
Always Scan / Never Sanitize
Never Scan / Never Sanitize
Paused
Trusted
```

The implementation may simplify labels in the UI, but the internal policy model must represent these behaviors distinctly.

#### 21.3.8 Compatibility must be tested, not assumed

Compatibility tests or manual release checks must cover:

- uBlock Origin;
- uBlock Origin Lite;
- NoScript;
- JShelter;
- browser tracking protection;
- large static pages;
- dynamic carousels;
- embedded maps;
- extension-altered pages;
- same-origin and cross-origin stylesheets;
- missing host permissions;
- iframes.

#### 21.3.9 Test/demo infrastructure must not be a single point of failure

CSS Sentry should ship local fixtures and reproducible test pages. Public demos are optional.

Required:

- local attack fixtures;
- local benign fixtures;
- browser integration test pages;
- documented manual test procedure;
- no required dependency on an external tester domain.

### 21.4 Issue-Derived Acceptance Criteria

Before beta release, the project must pass the following checks:

```text
ISSUE-001: [data-value='0'] does not trigger value-attribute exfil detection by itself.
ISSUE-002: url('https://example.test/;base64,pwned.png') is treated as a remote URL, not a safe data URL.
ISSUE-003: url('https://example.test/a.png#;base64,') is treated as a remote URL, not a safe data URL.
ISSUE-004: data:image/png;base64,... is not treated as an outbound remote request.
ISSUE-005: var(--link) containing a remote url() is detected when used in a suspicious rule.
ISSUE-006: var(--missing, var(--link)) fallback chains are analyzed best-effort.
ISSUE-007: suspicious rules inside nested @supports and @media blocks are detected.
ISSUE-008: suspicious rules using :has() are detected when combined with sensitive selectors and remote sinks.
ISSUE-009: missing host permissions produce UI state, not unhandled console errors.
ISSUE-010: disabling or pausing a site prevents CSS Sentry from modifying that page.
ISSUE-011: large HTML pages do not receive repeated global blocking CSS application/removal loops.
ISSUE-012: cross-origin stylesheets produce deterministic complete/partial/uninspectable states.
ISSUE-013: CSS Sentry does not issue extension-context remote CSS fetches unless the user explicitly enables that mode.
ISSUE-014: uBlock Origin/uBO Lite blocking expectations are not bypassed by CSS Sentry default behavior.
ISSUE-015: NoScript and JShelter compatibility is tested on Firefox where feasible.
ISSUE-016: no fixed page-visible marker equivalent to __css_exfil_protection_filtered_styles is present.
ISSUE-017: Amazon-like carousel and map-like embedded widget fixtures remain usable in Passive and Balanced mode.
ISSUE-018: Strict mode may break pages, but every strict-mode block must be visible, reversible, and attributable.
ISSUE-019: README explicitly states MV3 Chrome limitations and unsupported legacy platforms.
ISSUE-020: local test fixtures work without an external demo domain.
```

### 21.5 Traceability Requirement

Every historical issue-derived requirement must map to at least one of:

- a unit test;
- an integration test;
- a manual release checklist item;
- a README statement;
- an explicit non-goal;
- a UI state;
- a policy option.

No historical issue may remain only as informal background knowledge.


### 21.6 Supplemental Historical Issue Coverage

This subsection preserves additional historical issue classes that were present in the broader issue inventory but were not all enumerated in the original issue matrix. These entries are retained as product-risk coverage requirements, not as dependency on the older project.

| Historical issue class | CSS Sentry requirement or disposition |
|---|---|
| Other extensions appear to incidentally block CSS exfil test traffic | Do not treat incidental third-party blocking as CSS Sentry coverage. UI and documentation must distinguish CSS Sentry findings from environmental interference when possible. |
| Request for alerting when a technique is detected | Provide local popup/report/badge visibility without adding telemetry or intrusive alerting by default. |
| Unverified site-specific false positives | Keep benign fixtures expandable and require minimized reproductions before changing detection logic. |
| Webmail theme and background-image breakage | Include benign webmail/theme fixtures and avoid broad background-image removal. High-risk remote-resource findings must be attributable and reversible. |
| Default Firefox form-control styling disruption | Treat form-control styling as compatibility-sensitive. Mitigation must not depend on broad page-level CSS overrides. |
| Cross-domain stylesheet imports with relative paths | URL normalization must resolve relative imports against the stylesheet/source context where available and must fall back to partial-state reporting when source context is unavailable. |
| Production debug logging | Production builds must not rely on noisy debug logs as user feedback. Diagnostics should be local, explicit, and user-visible through reports/options where needed. |
| Firefox crash/high CPU reports on large pages | Maintain bounded scanning, debouncing, size caps, and no-breakage fixtures for large/static pages. |
| Content blocker conflicts caused by extension-origin requests | Default behavior must not fetch remote CSS from the extension context. This is both compatibility and privacy-sensitive. |
| Chrome CORS/MV3 changes affecting cross-site CSS filtering | Chrome behavior must be designed around Manifest V3 and declarative/session rules, not legacy response rewriting assumptions. |
| Missing host permissions and iframe access failures | Missing or restricted access must produce explicit partial/failure states, not unhandled errors. |
| `:has()` value-selector risk | Treat `:has()` combined with sensitive selectors and remote sinks as in-scope for detection where parser support permits. |
| Inline, internal, and external CSS user confusion | README and report text should explain source types and limitation boundaries. |
| Legacy XUL/Pale Moon/Waterfox support requests | Remain explicit non-goals unless the support matrix changes. |
| Store publication and unofficial redistribution questions | Release checklist and README must distinguish source validation, browser artifact generation, and distribution/publishing. |

### 21.7 Historical Issue Preservation Requirement

Historical issue-derived requirements are part of the regression model. They must not be removed from `docs/SPEC.md` merely because the implementation has reached a stable version. If any entry is moved, the new location must preserve the requirement, its rationale, and its disposition.

## 22. Test Strategy

### 22.1 Test Corpus

Maintain public fixtures for:

```text
tests/fixtures/
  attacks/
    classic-value-prefix-url.css
    value-substring-url.css
    css-vars-url-bypass.css
    nested-media-rule.css
    nested-supports-rule.css
    has-selector-exfil.css
    font-face-exfil.css
    import-exfil.css
    inline-style-url.html
    cross-origin-stylesheet.html
  benign/
    data-value-selector.css
    common-framework-selectors.css
    design-system-attribute-selectors.css
    same-origin-assets.css
    icon-fonts.css
    css-modules.css
    tailwind-like-output.css
    large-static-html-no-css.html
    embedded-map-widget.html
    amazon-like-carousel.html
```

### 22.2 Required Test Types

- unit tests for selector scoring;
- unit tests for declaration sink detection;
- unit tests for URL normalization;
- unit tests for custom property resolution;
- recursive nested-rule tests;
- integration tests against sample HTML pages;
- browser tests in Chrome;
- browser tests in Firefox;
- false-positive regression tests;
- performance tests on large CSS and large DOM files;
- compatibility checks with common blockers where feasible;
- expectation-driven fixture tests where every active fixture has a matching `.expected.json` file defining expected reason codes, severity bounds, destination-origin behavior, partial coverage, and block-candidate expectations.

## 23. Security Review Checklist

Before release:

- review extension permissions;
- review all content-script injection points;
- ensure no remote code execution path;
- ensure no `eval` / dynamic code compilation;
- ensure logs do not store sensitive extracted data unnecessarily;
- ensure no telemetry by default;
- ensure DNR rules are scoped and removable;
- ensure strict mode can be disabled per-site;
- ensure user allowlists cannot be silently modified by pages;
- ensure parser failures are safe and logged;
- ensure issue-derived acceptance criteria are mapped to tests or documented non-goals.

## 24. Release Criteria

### 24.1 Alpha

- WXT project structure complete;
- content script scans inline and same-origin styles;
- basic selector + sink scoring;
- popup shows findings;
- local logs;
- no network blocking yet.

### 24.2 Beta

- Chrome MV3 DNR blocking for high-confidence remote sinks;
- strict mode;
- options page;
- recursive nested-rule support;
- custom-property best-effort support;
- public test corpus;
- browser integration tests;
- historical issue acceptance criteria implemented or explicitly deferred.

### 24.3 Stable

- Chrome and Firefox packages;
- documented browser differences;
- compatibility notes;
- false-positive controls;
- import/export settings;
- polished README;
- threat model finalized;
- release signing/publishing workflow;
- security disclosure process documented.

## 25. README Requirements

The README must not include `Last Updated` metadata. Date metadata belongs in documents under `docs/` only, so the public-facing README remains stable for store/repository presentation.

The README must clearly state:

- the extension is defense-in-depth;
- it does not guarantee full prevention;
- what attack patterns it detects;
- what browser limitations exist;
- why permissions are needed;
- how strict mode works;
- what data is stored locally;
- how to report bypasses responsibly;
- how to run tests;
- how to build for Chrome and Firefox;
- which legacy platforms are unsupported;
- how historical CSS Exfil Protection issue classes are addressed.

## 26. Open Design Questions

- Should balanced mode block high-confidence findings by default or only warn at first?
- Should strict mode block all third-party stylesheets or only untrusted/new ones?
- Should Firefox enhanced mode be shipped initially or after Chrome baseline stabilizes?
- Which CSS parser should be used for robust modern CSS support?
- How much custom-property resolution is enough before diminishing returns?
- Should findings include raw selector text or a redacted normalized form?
- Should import/export settings include per-site findings or only policies?
- Should remote stylesheet fetch analysis remain permanently out of default scope?

## 27. Suggested Initial Milestones

### 27.1 Tooling and E2E Setup Rules

The project uses pnpm. Documentation and scripts should use pnpm consistently.

The default unit/integration test command must remain human-readable:

```bash
pnpm run test
```

JSON output for AI/debug review must remain isolated to:

```bash
pnpm run test:ai
```

Playwright browser installation must be available through:

```bash
pnpm run setup:e2e:browser
```

This command must wrap `pnpm exec playwright install chromium`.

Playwright system dependency installation is platform-specific. Debian/Ubuntu may use Playwright's `install-deps` helper. Arch Linux / Manjaro users should use pacman to install the required shared-library packages instead of relying on the Debian-oriented helper.

### Milestone 1 — Core Analyzer

- parse stylesheet text;
- walk rules recursively;
- classify selectors;
- classify sinks;
- normalize URLs;
- produce findings.

### Milestone 2 — Browser Baseline

- WXT content script;
- scan document styles;
- observe mutations;
- popup display;
- local storage.

### Milestone 3 — Mitigation

- high-confidence neutralization;
- Chrome DNR session rules;
- strict mode;
- per-site controls.

### Milestone 4 — Hardening

- compatibility testing;
- performance limits;
- anti-detection cleanup;
- false-positive tuning;
- historical issue acceptance criteria;
- documentation.

### Milestone 5 — Release

- Chrome package;
- Firefox package;
- signed builds;
- public test page;
- responsible disclosure policy.


## Implementation Status Tracking

Implementation coverage, verification status, partial-completion definitions, and release gates are tracked in `docs/STATUS.md`. Maintainers must update `docs/STATUS.md` whenever implementation, testing, UI behavior, mitigation behavior, or release readiness changes.


## Test Reporting Policy

The default `pnpm run test` command must keep human-readable Vitest output. JSON reporting for AI/debug review must be isolated to `pnpm run test:ai`, which writes `json-report.json`. Do not configure the default Vitest reporter to JSON-only.


## Playwright E2E Host Notes

- `pnpm run test:e2e` must not require `pnpm exec playwright install-deps` on Arch/Manjaro. That Playwright helper is apt-based and intended for Debian/Ubuntu-like hosts.
- On Arch-based systems, prefer the distro Chromium package and set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=$(command -v chromium)`.
- `pnpm run setup:e2e:browser` downloads Playwright Chromium for supported hosts.
- `pnpm run setup:e2e:arch` prints Arch-specific setup guidance.

## 28. E2E Runtime Coverage Requirements

Browser-runtime e2e tests should verify that the built extension works as an integrated browser extension, not only as isolated modules.

Current required e2e coverage includes:

- loading the built Chrome MV3 extension into Chromium;
- resolving the extension id from the MV3 background service worker;
- serving fixtures over local HTTP instead of relying on `file://` extension permissions;
- verifying popup, options, and report pages are reachable;
- verifying an attack fixture is scanned by the content script and rendered in the extension report page;
- verifying same-origin iframe findings are merged into the local report.

Current required e2e coverage also includes first-load destination blocklist prevention and complex benign/no-breakage rendering checks. Future e2e additions should be driven by bug reports, new bypass classes, or newly discovered breakage patterns rather than by adding unrelated product features.

## 29. Mitigation and Policy Hardening Requirements

### 29.1 Early Strict-Mode DNR

Strict-mode protection must be installed as early as the browser extension platform allows.

Requirements:

- background must listen for top-frame navigation start/commit events;
- when a top-frame URL belongs to an origin whose effective mode is Strict, tab-scoped Strict DNR rules must be installed before relying on content-script scan results;
- Strict-mode DNR rules must be removed when the tab closes;
- policy changes must refresh DNR rules for currently open tabs;
- first-load Strict blocking must be covered by e2e tests before v1.

### 29.2 Destination Policy Precedence

Destination allow/block policy must be deterministic.

Required precedence:

```text
blocklisted destination > allowlisted destination > finding-based mitigation > strict third-party policy
```

Behavior:

- blocklisted destination origins are blocked through tab-scoped DNR rules;
- allowlisted destination origins receive higher-priority allow rules than finding-based and strict rules;
- blocklist rules have higher priority than allowlist rules;
- finding-based DNR must not block allowlisted destinations;
- finding-based DNR must block blocklisted destinations when matched;
- Strict mode must still respect explicit allowlist and blocklist precedence.

### 29.3 DNR Lifecycle

DNR rules must be tab-scoped and removable.

Requirements:

- finding-based rules, policy rules, and strict third-party rules must use distinct ID ranges;
- repeated scans must replace previous finding rules for the tab;
- policy refresh must replace previous policy/strict rules for the tab;
- closing a tab must remove all CSS Sentry tab-scoped DNR rules for that tab.

### 29.4 Verification Commands

The project uses pnpm. `pnpm dev` is for live development only, not release verification.

Required commands:

```bash
pnpm install --frozen-lockfile
pnpm run compile
pnpm run test
pnpm run test:ai
pnpm run build
pnpm run build:firefox
pnpm run test:e2e
pnpm run verify:full
```

`pnpm run test` must remain human-readable. `pnpm run test:ai` is the only JSON-reporting test command.


## Breakage-minimization principle

CSS Sentry must minimize normal browsing breakage while still reducing CSS-exfiltration risk. Balanced mode should remain the safe default; Strict mode and advanced controls may be more aggressive but must be opt-in, documented, visible, and reversible. Mitigation changes that affect network behavior, third-party resources, layout, or rendering must have fixture coverage or browser e2e coverage before being considered release-ready.

## Destination Policy DNR Reliability Requirements

Destination allow/block policy must have both global and tab-scoped enforcement paths.

- Global policy DNR rules are required for first-load destination blocklist/allowlist enforcement before a content-script scan completes.
- Tab-scoped policy DNR rules are required for per-tab Strict behavior and lifecycle cleanup.
- Destination precedence remains: blocklisted destination > allowlisted destination > finding-based mitigation > Strict third-party policy.
- Policy changes must refresh global DNR rules and open-tab DNR rules.
- Tests must prove that a blocklisted destination can be blocked before the first CSS-triggered request reaches the destination server.

## Sensitive Selector Redaction Requirements

Findings, local reports, popup/report UI, and exported diagnostics must not expose sensitive selector values.

- Attribute selector values for `value`, sensitive attribute names, and token-like values must be redacted.
- Redaction must preserve enough selector shape to debug the issue, for example `[value^="[redacted]"]`.
- Redaction must not remove reason codes or destination origins needed for mitigation/debugging.

## 0.0.24 Privacy / Redaction Requirements

CSS Sentry must treat its own local reports as potentially sensitive because CSS exfiltration payloads can encode probed values in selectors, destination paths, destination queries, URL fragments, or diagnostic details.

### Requirements

- Findings must redact sensitive selector attribute values while preserving enough selector structure for debugging.
- Findings must redact destination URL credentials, query values, fragments, and token-like path segments.
- Destination origins may remain visible for explainability and DNR/domain-policy behavior.
- Stored tab reports must be sanitized before writing to `browser.storage.local`.
- Report JSON exports must sanitize reports again as defense-in-depth.
- Popup/report UI must render only sanitized stored report data.
- DNR mitigation must not depend on retaining sensitive URL path/query values in stored report objects.

### Regression tests

The test suite must include privacy tests proving that token-like values do not appear in serialized findings, stored reports, or exported report objects.

## 0.0.26 Frame/iframe Reporting Requirements

The popup and report surfaces must make frame coverage explicit:

- same-origin iframe findings must be preserved as separate frame reports and must not overwrite top-frame findings;
- top-frame findings and child-frame findings must remain visible when both exist on the same tab;
- cross-origin frames that cannot be inspected must produce partial-coverage findings with `frame.cross_origin.uninspectable`;
- the popup must show a partial-frame coverage notice when `summary.partialFrames > 0`;
- the report page must show frame URL, parent frame id, frame analysis state, stylesheet analyzed/partial counts, frame analyzed/partial counts, and per-frame findings;
- browser e2e tests must cover same-origin iframe merging, top-frame plus child-frame preservation, and cross-origin partial-frame reporting.

## 0.0.31 Release-Readiness Documentation Requirements

Release-readiness documentation must live under `docs/` so the repository root remains limited to `README.md` and project/configuration files.

Required release-readiness documents:

- `docs/SECURITY.md` — supported versions, report scope, safe reproduction guidance, and disclosure handling expectations.
- `docs/PRIVACY.md` — local-first privacy model, report storage, redaction boundaries, export behavior, remote-fetching stance, and telemetry stance.
- `docs/PERMISSIONS.md` — permissions rationale for storage, content scripts, host access, DNR, webNavigation, omitted permissions, and store-listing language.
- `docs/RELEASE_CHECKLIST.md` — manual release gate, browser checks, artifact generation, structure checks, and v1 release criteria.

The root repository must not contain `SECURITY.md`, `PRIVACY.md`, `PERMISSIONS.md`, or `RELEASE_CHECKLIST.md` unless the docs layout is intentionally changed and `README.md`, `docs/STATUS.md`, and project-structure tests are updated in the same change.

`docs/STATUS.md` remains the source of truth for current coverage and release decision state. Historical notes must stay in the final changelog/audit section, not mixed into future-feature or v1-scope sections.

## 0.0.32 Extension Self-Security Requirements

`0.0.32` adds hardening for CSS Sentry as a browser extension, not only for CSS detection.

### Runtime message validation

- Background runtime message handling must validate the complete message shape.
- `css-sentry:scan-complete` must be accepted only from tab-bound content-script senders.
- Settings-changing messages must be accepted only from extension UI/service-worker contexts, not page content scripts.
- Unknown `css-sentry:*` message types must be ignored.
- Oversized summaries must be rejected or capped before storage.

### Settings import hardening

- Imported settings must be JSON objects.
- Imported settings must respect size limits.
- Origin lists, per-origin modes, modes, compatibility booleans, and retention days must be normalized and capped.
- Malformed imports must show an import error and must not partially apply invalid settings.

### DNR failure visibility

- DNR policy operations must record a local status object.
- The Options page must expose the latest DNR status so fail-open behavior is not silent.
- DNR status is diagnostic-only and must not become telemetry.

### Permission minimization

- Manifest permissions must remain limited to the documented set required for v1.
- `activeTab`, `scripting`, optional host permissions, and other unused permissions must not be reintroduced without updating `docs/PERMISSIONS.md`, `docs/STATUS.md`, and project-structure tests.

### Extension UI injection invariant

- Extension UI code must not use `dangerouslySetInnerHTML`, direct `.innerHTML` assignment, `insertAdjacentHTML`, `eval`, or `new Function`.
- This is not a CSS-exfil detection rule. It is extension self-security because report UI renders attacker-influenced findings derived from page CSS and URLs.

### Report retention and storage caps

- Stored reports must cap frame count and finding count.
- Report retention must cap total report count.
- Older reports should be removed first when the cap is exceeded.

### Modern inline-style coverage

- The test corpus must include inline-style URL sink fixtures on sensitive form controls.
- Current v1 coverage includes inline `url()`, inline custom-property URL indirection, and inline `image-set(url(...))`.
- Future browser support for newer conditional/style-query CSS functions can expand this fixture set.



## Self-Security Traceability Requirement

`docs/SELF_SECURITY.md` is the authoritative traceability document for extension self-security safeguards, including runtime-message validation, settings import hardening, DNR status visibility, permission minimization, UI injection invariants, modern inline-style fixture coverage, and report/storage caps. Any future change to those safeguards must update `docs/SELF_SECURITY.md`, `docs/STATUS.md`, and the relevant tests.

## Documentation and Regression Preservation Requirements

The project documents are functional guardrails for implementation, test coverage, release scope, known limitations, and future work. They must not be reduced to summaries merely because a release version has been reached.

### No regression rule

A change is not acceptable if it regresses any of the following without an explicit, documented reason:

- detection behavior;
- mitigation behavior;
- parser coverage;
- redaction/privacy behavior;
- runtime-message trust boundaries;
- UI safety invariants;
- fixture coverage;
- browser e2e coverage;
- documentation depth and traceability.

### Documentation preservation rule

`SPEC.md`, `CVE_SPEC.md`, `STATUS.md`, `SELF_SECURITY.md`, `RELEASE_CHECKLIST.md`, `RELEASE_NOTES.md`, `SECURITY.md`, `PRIVACY.md`, and `PERMISSIONS.md` must be updated additively unless the user explicitly requests content removal. Version-specific historical notes may be reorganized only if the full substantive content is preserved in an appropriate document.

### New rendered-resource scanner requirements

CSS Sentry also tracks high-signal rendered-content remote-resource patterns that commonly appear in webmail and sanitizer bypass CVEs. The scanner must detect or explicitly classify:

- HTML BODY `background` remote resources;
- SVG `feImage` remote references;
- SVG animation attributes that introduce URL-bearing values;
- stylesheet links to local/private-network destinations in rendered content;
- fixed-position `!important` CSS-only UI integrity indicators.

These findings do not mean CSS Sentry remediates the underlying server-side sanitizer vulnerability. They are browser-side risk indicators and mitigation inputs within the extension's stated threat model.



## Document Role and History Preservation

`docs/SPEC.md` is a requirements and accepted-implementation-decision document. It may contain version-labeled sections when those sections preserve requirements, acceptance criteria, regression rules, or implementation constraints that still govern the project.

Version-labeled sections must not be used as a substitute changelog. Changelog-only material belongs in `docs/RELEASE_NOTES.md`. Current status, coverage labels, and release decision state belong in `docs/STATUS.md`.

Requirement-preservation rule:

- Do not delete historical issue-derived requirements after they are implemented.
- Do not collapse accepted design decisions into vague summaries.
- Do not remove acceptance criteria merely because tests currently pass.
- When a requirement is superseded, preserve the supersession reason and the replacement requirement.
- When a capability is implemented, ensure it remains tracked in at least one durable document, preferably `docs/SPEC.md` for requirements and `docs/STATUS.md` for current coverage.


## 1.0.5 Tracking and Limitation Preservation Addendum

This section is additive. It preserves product decisions and project-tracking rules that must not be removed during future documentation cleanup.

### Documents are tracking artifacts

Project documents are not only post-implementation summaries. They also function as:

- requirement records;
- implementation decision records;
- regression guards;
- current-status and coverage trackers;
- todo and future-candidate lists;
- non-goal and limitation records;
- release-gate checklists.

A future release must not remove a decision, limitation, todo candidate, avoided-feature rationale, or historical issue-derived requirement merely because the current version is stable. If content is moved, the destination must preserve the substance and the move must be recorded.

### CVE-2026-40301 rendered SVG style decision

CSS Sentry treats inline/rendered SVG `<style>` content as active CSS when it is present in the DOM. This is required for CVE-2026-40301-style sanitizer bypasses where SVG `<style>` text can contain remote `url()` or `@import` directives.

Required behavior:

- Active SVG `<style>` blocks must be analyzed by the same stylesheet analyzer used for regular `<style>` blocks.
- SVG CSS paint properties `fill`, `stroke`, `marker`, `marker-start`, `marker-mid`, and `marker-end` are URL-capable network sinks when they reference remote URLs.
- Remote `@import` inside SVG `<style>` remains an actionable remote stylesheet sink.
- Findings must preserve destination-origin evidence while redacting sensitive values.
- Externally loaded SVG images are a documented browser-platform boundary unless they are handled by destination policy / DNR.

### Post-v1 features and avoided features stay tracked

`docs/STATUS.md` remains the durable home for possible future features and avoided features. `docs/SPEC.md` may reference those decisions when they affect architecture, permissions, privacy posture, or breakage risk.

Features explicitly avoided before v1 remain avoided unless intentionally moved into scope with tests and documentation:

- cloud analysis;
- telemetry;
- automatic remote CSS fetching from the extension context;
- ML-based classification;
- legacy XUL/Pale Moon/Waterfox Classic support;
- broad page rewriting;
- aggressive default blocking on every site;
- claims of complete CSS exfiltration prevention.

### Limitation preservation

Known limitations must remain visible in `docs/STATUS.md`, `README.md`, or a clearly linked successor document. Current durable limitations include browser API limits for cross-origin inspection, Chrome MV3 response-body rewriting limits, strict-mode breakage risk, externally loaded SVG image inspection limits, extension interoperability limits, and future-CSS uncertainty.

## 1.0.6 Clean Code, UI Composition, and Scope-Tracking Addendum

This addendum is additive. It clarifies maintenance rules after the `1.0.6` refactor and must not be used as a reason to delete earlier implementation history.

### Clean code definition for CSS Sentry

In this project, clean code means code that remains easy to audit as a security extension:

- Entry-point React files should orchestrate page state, browser API calls, and high-level layout only.
- Repeated or presentational UI should live in small component modules near the entrypoint or under `src/shared/components/` when reused.
- Shared UI primitives, such as tooltip rendering, should not be duplicated across popup/options/report code.
- Security-relevant logic should stay outside React components where possible and remain covered by unit/integration tests.
- TypeScript types should describe policy, findings, reports, and browser-message boundaries explicitly rather than being hidden behind broad `any` values.
- Refactors must preserve UI behavior, accessible names, option visibility, and existing tests. A refactor is not successful if it only makes files shorter while changing behavior.

### Current UI refactor decision

`1.0.6` splits popup/options presentational code as follows:

- `src/shared/components/InfoTooltip.tsx` contains the shared tooltip primitive.
- `src/entrypoints/options/components.tsx` contains options-page UI building blocks such as section titles, mode option cards, definition rows, and origin-list cards.
- `src/entrypoints/popup/components.tsx` contains popup header, summary-card, finding-item, and severity helper logic.
- `OptionsApp.tsx` and `popup/App.tsx` remain responsible for state loading/saving, browser calls, and page composition.

This is the preferred pattern for future UI changes unless a different structure is explicitly justified in `docs/STATUS.md`.

### Store badge and documentation assets

Documentation/store-related image assets may live in `docs/` when they are used for README/store-readiness documentation. Adding these assets does not mean store publication itself is part of the source-package release gate.

Current documentation assets:

- `docs/chrome-extension-logo.png`
- `docs/firefox-addon-logo.svg`

### Adjacent vulnerability scope rule

The project should keep tracking adjacent sanitizer/SVG/browser-rendering issues, including issues that are ultimately out of scope. Out-of-scope entries are useful because they prevent repeated rediscovery and clarify why CSS Sentry does not implement unrelated XSS, package-vulnerability, or browser-engine mitigations.

A newly found issue should be placed into one of these categories:

1. implemented fixture/detector coverage;
2. already covered by an existing fixture or detector;
3. watchlist/post-v1 candidate;
4. documented limitation;
5. explicit out of scope.

Out-of-scope is acceptable only when the reason is written down. Typical reasons include browser API limits, JavaScript-only XSS, server-side sanitizer patch responsibility, uploaded-file handling outside the browser extension, or browser-engine memory safety.


## 1.0.7 Scope, Search Triage, and Fixture-Growth Addendum

This addendum is additive. It records decisions from the post-`1.0.6` search pass and must not be used to remove earlier issue-derived requirements.

### Scope clarifications

- **Features Avoided** is the durable non-goal section title. It should not be limited to “for v1” because many avoided features remain avoided after v1 unless the threat model changes.
- CI is not tracked as an implementation gap. Manual release gates are acceptable for this project because updates are infrequent.
- Optional Firefox enhanced stylesheet response inspection is implemented as an advanced, off-by-default Firefox-only feature. It may use `webRequest.filterResponseData` where available to inspect stylesheet response bodies for reporting while passing the response through unchanged. It must not be enabled silently, must not fetch remote CSS from the extension context, and must degrade safely when unsupported.
- Badge severity options mean user-configurable badge display behavior, such as alternate count/severity styles. They are UI preference polish and not core detection/mitigation work.
- SVG image-document policy handling is implemented for reporting and destination policy only. Inline/rendered SVG DOM content is in scope. Externally loaded SVG image-document internals remain browser-inaccessible to normal content-script DOM inspection and must be reported as partial coverage, not as fully inspected.
- Additional sanitizer-specific fixture packs are future-watch work. Add them when they map to CSS remote-resource behavior, selector probing, CSS imports, inline style leaks, SVG style/resource behavior, or rendered-content CSS injection; do not turn CSS Sentry into a package vulnerability scanner.

### New executable coverage requirements

- `link rel="stylesheet"` with `data:text/css` must be inspected when the CSS payload is directly available in the URL, including mixed-case schemes such as `DATA:text/css`.
- Data stylesheet scanning must not store the raw data URL as the source URL.
- Escaped `@import` recovery must detect CSS Unicode escape sanitizer-bypass classes such as `@\69mport`.

### Current search result handling

- CVE-2026-31873 is in scope and represented by an executable fixture.
- CVE-2026-28348 is in scope for escaped `@import`; legacy `expression()` is tracked as adjacent.
- CVE-2026-41305 is adjacent/out of scope because it is about CSS stringification into HTML, not CSS Sentry behavior.
- CVE-2026-41240 is watchlist/conditional because it is not CSS-specific by itself.
- CVE-2026-2441 remains out of scope because browser-engine memory corruption is remediated through browser updates, not CSS Sentry detection.

## 1.0.8 Status Wording and Historical Issue-Comment Preservation

`Covered for documented scope` is the preferred post-`1.0.x` status wording for implemented/tested behavior. It replaces stale milestone-specific coverage wording without reducing coverage. The intended meaning is: implemented and tested for CSS Sentry's documented threat model, supported browser model, and current executable corpus. It does not imply universal protection against every future CSS feature, all browser side channels, all sanitizer bugs, or every possible compatibility combination.

Historical issue comments from the prior CSS-exfil extension ecosystem remain a requirements source. They should be tracked as behavior classes and design constraints, not as old-project branding. Examples include load-blocking CSS breakage, alternate stylesheet handling, extension-context cross-domain CSS fetching, first-load timing, `:has()` selector risk, `;base64,` URL bypasses, CSS variables/fallback chains, nested grouping rules, and extension-detectable markers.

Future documentation cleanup must not delete these issue-derived requirements. If a requirement is no longer implemented directly, it must be moved to a documented limitation, future-watch item, post-v1 candidate, or explicit out-of-scope section with rationale.

## 1.0.12 False-Positive Controls and Development Sweep

Balanced mode must use a threat-shape gate rather than additive weak evidence. Presentation-only declarations with zero remote URL sinks must not become actionable findings just because a selector contains `:has()`, ARIA state, hover/active state, long framework class chains, or unresolved custom properties. Standalone remote `@font-face` is common CSS and must not be blocked in Balanced mode unless it is conditionally applied through sensitive selector probing or matched by explicit user policy.

Partial-analysis notices such as cross-origin-uninspectable stylesheets, cross-origin frames, and too-large stylesheets are coverage diagnostics. They should remain available to advanced users but must not inflate normal threat counts.

The development-only false-positive sweep (`pnpm run audit:false-positives`) is a maintainer tool, not runtime functionality. It loads a built development extension, visits a seed list of common sites, exports local report summaries to `test-results/false-positive-sweep/`, and clusters reasons/properties/destinations that may indicate noisy detection. The script exists to find patterns before publication; it must not add telemetry, remote reporting, or bundled site-specific allowlists to the extension.

## 1.0.10 Advanced Optional Coverage Requirements

- Advanced compatibility options may add stricter or deeper coverage, but they must be off by default and must not change the default Balanced behavior.
- External SVG image-document reporting must produce partial-coverage findings, because CSS Sentry cannot promise to inspect the internal SVG DOM/CSS when the SVG is loaded as an image resource.
- Strict SVG image-document DNR policy must be separate from broad Strict third-party blocking so users can choose narrower breakage risk.
- Firefox enhanced stylesheet response inspection must be Firefox-only, optional, and pass-through. It may inspect response bodies for reporting, but it must not rewrite stylesheet responses until a separate, fully tested filtering design exists.
- DNR diagnostics shown in the UI must explain zero-rule outcomes as normal: no tab-scoped rule was needed.

### 22.7 False-Positive Sweep and Same-Origin Resource Noise Rule

Development false-positive sweeps should use `scripts/false-positive-sweep.mjs` with the maintained 250-site seed list in `scripts/false-positive-sites.txt`. The sweep is audit tooling only: outputs belong under `test-results/` and must not be bundled into runtime packages. The script may save full per-site reports for actionable cases to support triage and must accept package-manager argument delimiters such as `pnpm run audit:false-positives -- --limit 250 --save-reports actionable`.

Actionable findings require an outbound leak path or a policy-relevant network destination. Standalone fixed-position `!important` CSS is documented as adjacent sanitizer/UI-integrity context but must not become an actionable CSS Sentry finding by itself. Same-origin decorative BODY background, SVG `feImage`, and SVG animation resources should not produce actionable findings; cross-origin and local/private-network destinations remain in scope.

## 1.0.21 Large-Stylesheet Source Scan Requirement

Large stylesheet size must never be treated as an analysis bypass. The configured stylesheet size threshold may select a lower-allocation parsing strategy, but it must not return `analysis.skipped.too_large` for stylesheet content that is available to the extension.

Required behavior:

- Oversized available stylesheet text must be scanned from start to finish.
- Rules recovered from oversized stylesheets must be passed through the same selector, declaration, URL, custom-property, import, SVG paint, and font-reference risk analysis used for normal stylesheets.
- Oversized benign generated CSS must remain non-actionable when it has no sensitive selector/probe plus outbound sink shape.
- Oversized malicious CSS must remain detectable when `@import`, URL-bearing declarations, local/private-network destinations, or sensitive value-probing selectors appear after large benign padding.
- Nested rules inside oversized stylesheets must be inspected so CSS nesting does not become a large-file evasion path.
- Report caps must bound retained findings, not terminate scanning. After the cap is filled, later higher-priority findings must be able to replace earlier lower-priority findings.
- Finding-based DNR rule caps must prioritize stronger high-confidence candidates before selecting rules to install.
- Merged reports should deduplicate equivalent stylesheet source URLs that differ only by an empty fragment marker.

Acceptance coverage for this requirement lives in oversized attack and benign fixtures plus unit tests for large-source scanning and finding-cap prioritization.
