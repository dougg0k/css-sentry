# CSS Sentry — CVE_SPEC.md

Last Updated: 2026/04/29 12:35:00 -03

## Purpose

`CVE_SPEC.md` tracks CVE-derived requirements for CSS Sentry.

These requirements are intentionally separated from `SPEC.md` so the main product specification stays focused on architecture, behavior, UX, browser support, and implementation scope. The main `SPEC.md` should only mention that CVE-derived requirements are tracked in this file.

This document does **not** make CSS Sentry a vulnerability scanner for every affected product. Its purpose is to ensure that the extension’s design, tests, and documentation account for vulnerability classes that have received CVEs in the CSS exfiltration, CSS injection, CSS sanitizer, rendered email, rendered markdown, and CSS filtering space.

## 1. CSS Exfil Protection CVEs

The previous CSS Exfil Protection extension has three relevant CVEs mapped to the public vulnerability disclosure in issue #41.

| CVE | Product / scope | Vulnerability class | CSS Sentry requirement |
|---|---|---|---|
| CVE-2024-29384 | CSS Exfil Protection 1.1.0 | Sensitive information exposure through `content.js` / `parseCSSRules` logic. | Replace ad hoc CSSOM/string logic with a typed parser pipeline, rule walker, reason-coded findings, and regression tests for parser bypasses. |
| CVE-2024-33436 | CSS Exfil Protection 1.1.0 | Missing support for CSS variables. | Implement custom-property collection, `var()` resolution, fallback-chain handling, cycle limits, unresolved-variable risk scoring, and dedicated tests. |
| CVE-2024-33437 | CSS Exfil Protection 1.1.0 | Missing support for nested CSS style rules / grouping rules. | Recursively traverse nested CSS rule containers, including `@media`, `@supports`, `@layer`, `@container`, and parser-supported nested syntax. |

These CVEs are release-blocking regression classes. A beta release must not ship without explicit tests for each class.

## 2. Adjacent CSS Injection and CSS Filtering CVEs

The following external CVEs are not vulnerabilities in CSS Sentry, but they represent real-world contexts where CSS injection, CSS sanitizer bypasses, email rendering, rendered HTML, or insufficient CSS filtering caused security impact. CSS Sentry should use them as threat-model and fixture sources.

| CVE | Representative context | Design lesson for CSS Sentry |
|---|---|---|
| CVE-2019-17016 | Firefox CSS sanitizer rewrite issue involving pasted `<style>` content and `@namespace`, leading to possible data exfiltration. | Include namespace/at-rule sanitizer-bypass fixtures. Do not rely on naive at-rule rewriting or token removal. |
| CVE-2024-24510 | SOGo mail component XSS/import path with references to CSS injection research. | Treat webmail/rendered email as a first-class sensitive context. Strict mode should be easy to enable for webmail domains. |
| CVE-2024-34697 | FreeScout stored HTML injection in incoming email rendering, with possible CSS-injection data exfiltration. | Rendered email/helpdesk content is in scope as a risk context. Include fixtures for attacker-controlled email HTML rendered in application origin. |
| CVE-2024-42010 | Roundcube `mod_css_styles` insufficient CSS token filtering in rendered email messages, allowing information disclosure. | Avoid regex/blocklist-only CSS filtering. Include fixtures with comments, whitespace, escapes, nested constructs, and token-boundary bypasses around `url()` / `@import`. |
| CVE-2024-8760 | WordPress Stackable plugin CSS injection in comments, with possible nonce exfiltration. | Treat comment/rendered user-content CSS as in-scope. Include fixtures for nonce-like hidden fields and admin-token-like DOM state. |
| CVE-2026-35046 | Tandoor stored CSS injection through recipe instructions / markdown-rendered content. | Treat markdown-to-HTML rendering and API-delivered rich text as in-scope content sources. Include fixtures for stored `<style>` in rendered markdown-like content. |
| CVE-2026-40301 | DOMSanitizer SVG `<style>` CSS injection through unfiltered `url()` and `@import` directives. | Treat SVG `<style>` text as active CSS when rendered into a trusted page. Include fixtures for SVG style `url()` paint sinks and SVG style `@import`. Document externally loaded SVG-image inspection limits. |

## 3. CVE-Derived Design Requirements

### 3.1 Avoid regex-only CSS security decisions

CSS Sentry must not use regex-only blocklists for security-critical CSS classification.

Required:

- parse CSS with a maintained parser;
  - Current implementation note: `0.0.23` uses `css-tree` as the primary parser and retains the lightweight parser as a conservative fallback;
- keep raw text fallback only for diagnostics or secondary detection;
- handle comments, escapes, whitespace, case folding, nested rules, and malformed-but-browser-accepted syntax;
- test bypass variants for `url`, `u\72l`, comments inside tokens, whitespace splitting, and nested at-rules.

### 3.2 Treat rendered-content applications as high-risk contexts

The following page/application types must be eligible for one-click strict mode presets:

- webmail;
- helpdesk/shared inboxes;
- admin comment moderation pages;
- CMS dashboards;
- markdown preview/rendering applications;
- documentation systems with user comments;
- internal ticketing systems;
- any app that renders untrusted HTML, email HTML, markdown, or rich text.

### 3.3 Detect nonce/token exfiltration patterns

The detector must explicitly recognize selector probes and DOM contexts involving:

- CSRF tokens;
- admin nonces;
- anti-forgery tokens;
- OAuth tokens;
- session-like identifiers;
- hidden inputs;
- fields or attributes containing names such as `nonce`, `csrf`, `token`, `auth`, `session`, `state`, `code`, `secret`, `api`, `key`.

These should raise context risk even when the value itself is not logged.

### 3.4 Webmail and iframe handling

Rendered email contexts often involve nested frames, isolated documents, sanitizers, and third-party resources.

Required:

- scan same-origin iframes when permissions allow;
- report when frame scanning is unavailable;
- model each frame as a separate analysis scope;
- include frame origin and analysis completeness in findings;
- provide strict-mode presets for webmail and helpdesk applications;
- avoid claiming protection for frames that could not be inspected.

### 3.5 Tokenization and parser differential tests

The test suite must include parser-differential fixtures inspired by CSS sanitizer CVEs:

- comments inside or around dangerous functions;
- escaped function names;
- mixed-case at-rules and function names;
- whitespace and newline splitting;
- namespace-related constructs;
- malformed constructs accepted by browsers;
- nested `@media` / `@supports` / `@layer` cases;
- custom-property indirection;
- `url()` inside fallback chains;
- remote URL fragments containing misleading safe-looking substrings.

### 3.6 CVE monitoring process

Before each stable release, maintainers should search for newly published CVEs and advisories involving:

```text
CSS injection
CSS exfiltration
CSS filtering
CSS sanitizer
CSS token sequences
rendered email CSS
webmail CSS information disclosure
style tag injection
style attribute injection
markdown CSS injection
```

Any relevant CVE must be triaged into one of:

- covered by existing tests;
- requires new fixture;
- requires new detection logic;
- requires README limitation note;
- out of scope with explicit rationale.

## 4. CVE-Derived Acceptance Criteria

Before beta release:

```text
CVE-001: CVE-2024-29384 class has parser and rule-walker regression tests.
CVE-002: CVE-2024-33436 class has CSS variable, fallback-chain, and unresolved-var tests.
CVE-003: CVE-2024-33437 class has nested @media/@supports/@layer tests.
CVE-004: CSS comments/escapes/whitespace cannot hide url() or @import from sink classification.
CVE-005: remote URL fragments or paths containing ';base64,' are not misclassified as safe data URLs.
CVE-006: data: URLs are classified by parsed scheme and MIME context, not substring matching.
CVE-007: webmail/helpdesk/rendered-email fixtures are included in strict-mode test pages.
CVE-008: nonce/token/CSRF hidden-field probes raise context risk and redact sensitive values in logs.
CVE-009: same-origin iframe scanning is tested, and unscannable frames are reported as partial coverage.
CVE-010: markdown/rendered-rich-text fixtures with stored <style> blocks are included.
CVE-011: README documents that CSS Sentry reduces risk in rendered-content apps but does not replace server-side sanitization.
CVE-012: release checklist includes CVE/advisory search and triage.
```

## 5. CVE Traceability

Every CVE-derived requirement must map to at least one of:

- an attack fixture;
- a benign fixture;
- a unit test;
- a browser integration test;
- a strict-mode preset;
- a README limitation;
- an explicit non-goal;
- a release checklist item.

CVE-derived work must not remain only in documentation. At minimum, the specific CSS Exfil Protection CVE classes must have executable regression tests before beta.

## 6. Additional Test Fixtures Required

These fixtures are required in the project test corpus. The parser/CVE fixtures listed below are present as of `0.0.23`; remaining fixture additions or renames must preserve expectation files.

```text
tests/fixtures/
  attacks/
    cve-2024-29384-parser-bypass.css
    cve-2024-33436-css-vars-url.css
    cve-2024-33436-css-vars-fallback-chain.css
    cve-2024-33437-nested-style-rules.css
    css-comments-hidden-url.css
    css-escaped-function-url.css
    css-mixed-case-import.css
    namespace-sanitizer-bypass.css
    rendered-email-style-exfil.html
    rendered-helpdesk-email-css.html
    wordpress-comment-nonce-exfil.html
    markdown-rendered-style-tag.html
    same-origin-iframe-rendered-email.html
    cross-origin-iframe-uninspectable.html
  benign/
    benign-css-custom-properties.css
    benign-nested-media-supports.css
    benign-data-url-image.css
    benign-data-value-attribute.css
    benign-webmail-theme.css
    benign-markdown-rendered-code-block.html
```

## 7. Release Checklist Additions

Before every stable release:

```text
[ ] Search newly published CVEs and advisories for CSS injection/exfiltration/filtering/sanitizer terms.
[ ] Triage any relevant new CVE into fixture, detector, README, or non-goal.
[ ] Re-run CSS Exfil Protection CVE regression tests.
[ ] Re-run parser-differential tests for comments, escapes, whitespace, and nested rules.
[ ] Re-run rendered-email and rendered-markdown fixtures.
[ ] Re-run iframe partial-coverage reporting tests.
[ ] Confirm no regex-only security decisions were introduced.
[ ] Confirm sensitive token/nonce values are redacted from findings.
```

## 8. Relationship to SPEC.md

`SPEC.md` should only contain this cross-reference:

> CVE-derived requirements are maintained separately in `CVE_SPEC.md`. Release planning must treat `CVE_SPEC.md` as normative for CVE-derived regression tests, fixtures, and release checklist items.

The main `SPEC.md` should not duplicate CVE tables, CVE-specific acceptance criteria, or advisory tracking details.



## 9. 0.0.23 Parser/CVE Traceability Note

As of `0.0.23`, the parser hardening pass maps the core parser-related CVE_SPEC requirements to executable coverage:

| Requirement | Executable coverage added or confirmed |
|---|---|
| CVE-2024-29384 parser/rule-walker class | `cve-2024-29384-parser-bypass.css`; unit test for namespace noise, escaped property, and escaped `url()`. |
| CVE-2024-33436 CSS variables | `cve-2024-33436-css-vars-url.css`; `cve-2024-33436-css-vars-fallback-chain.css`. |
| CVE-2024-33437 nested rules | `cve-2024-33437-nested-style-rules.css`; unit test for parser-supported nested style rules. |
| Comment-hidden URL sinks | `css-comments-hidden-url.css`; existing comment-hidden fixture retained. |
| Escaped URL function sinks | `css-escaped-function-url.css`; unit test for escaped `url()` syntax. |
| Mixed-case imports | `css-mixed-case-import.css`. |
| Namespace sanitizer-bypass class | `namespace-sanitizer-bypass.css`. |
| Malformed-but-recoverable syntax | `parser-differential-malformed-recovery.css`; unit test for missing declaration semicolon recovery. |

This does not mean CSS Sentry is a universal CSS parser or sanitizer. The parser remains a security-relevant dependency and future CSS syntax changes should still be triaged into new parser-differential fixtures.

## 0.0.24 Redaction / Privacy Hardening Addendum

CSS exfiltration findings can themselves become sensitive if they preserve selector attribute values or leak destination query strings. CVE-derived regression coverage therefore requires report data to be sanitized before local storage or export.

### Normative requirements

- Selector values for `value`, CSRF, nonce, token, password, auth, session, API key, OAuth/JWT, credential, state, and code-like attributes must be redacted in findings.
- URL credentials must not be stored or exported.
- URL query values must be redacted in stored/exported reports.
- URL fragments must be redacted in stored/exported reports.
- Token-like path segments must be redacted in stored/exported reports.
- Destination origins may remain visible so reports can explain what site/domain was contacted.
- DNR mitigation must continue to work after redaction by using destination origin/hostname rather than sensitive path/query values.

### Required regression coverage

- Unit tests must assert that token-like selector values do not appear in serialized findings.
- Unit tests must assert that report export sanitization recursively removes sensitive values.
- Browser/storage tests must assert that saved reports do not contain sensitive selector, page URL, frame URL, source URL, or destination URL values.

## 0.0.32 Inline-Style and Self-Security Addendum

Inline-style coverage now includes executable fixtures for inline `style=""` URL sinks on sensitive controls, inline custom-property URL indirection, and `image-set(url(...))` URL sinks. These fixtures are part of the attack corpus and must remain expectation-driven.

Extension self-security items such as runtime-message validation, settings-import limits, DNR failure visibility, permission minimization, and UI injection invariants are tracked in `docs/SPEC.md` and `docs/STATUS.md`. They are not CSS CVEs themselves, but they reduce the risk that CSS Sentry becomes a vulnerable extension while handling attacker-influenced CSS findings.

## 10. 1.0.3 Additive CVE / Rendered Resource Traceability Update

This section is additive. It does not supersede or remove the earlier CVE-derived requirements, acceptance criteria, and traceability sections above.

### 10.1 Additional Roundcube / rendered-content CVE classes tracked for v1.x

The following CVE classes are tracked because they are relevant to rendered email, webmail sanitization, CSS sanitizer behavior, or browser-rendered remote resource loading:

| CVE | Relevance to CSS Sentry | Required project handling |
|---|---|---|
| CVE-2025-68460 | Roundcube HTML style sanitizer information disclosure class. | Keep rendered-email / style-sanitizer fixtures and parser tests active. |
| CVE-2026-26079 | Roundcube CSS comment mishandling / CSS injection class. | Keep comment-hidden CSS and rendered-email fixtures active. |
| CVE-2026-35540 | Roundcube stylesheet link to local/private-network resource class. | Detect local/private-network stylesheet links as high-risk rendered-resource findings. |
| CVE-2026-25916 | Roundcube SVG `feImage` remote resource class. | Detect SVG `feImage` remote references in rendered content. |
| CVE-2026-35542 | Roundcube BODY `background` remote resource class. | Detect HTML BODY `background` remote resource attributes. |
| CVE-2026-35543 | Roundcube SVG animation remote resource class. | Detect SVG animation URL-bearing attributes where feasible. |
| CVE-2026-35544 | Roundcube fixed-position `!important` CSS sanitizer bypass / UI integrity class. | Detect CSS-only fixed-position `!important` indicators as non-network actionable findings. |
| CVE-2026-35545 | Roundcube SVG animation fill/filter/stroke remote resource class. | Detect SVG animation values affecting URL-bearing paint/filter attributes where feasible. |

### 10.2 Additional fixtures required by this addendum

The following fixture names must remain present and paired with `.expected.json` files:

- `cve-2025-68460-roundcube-style-sanitizer.html`
- `cve-2026-26079-roundcube-comment-css-injection.html`
- `cve-2026-35540-roundcube-stylesheet-link-local-network.html`
- `cve-2026-25916-roundcube-svg-feimage.html`
- `cve-2026-35542-roundcube-body-background.html`
- `cve-2026-35543-roundcube-svg-animate-url.html`
- `cve-2026-35544-roundcube-fixed-position-important.html`
- `cve-2026-35545-roundcube-svg-animate-fill-filter-stroke.html`

### 10.3 Explicit out-of-scope CVE class

Browser engine memory-safety vulnerabilities involving CSS parsing, layout, or rendering are outside CSS Sentry's enforcement domain. They must be handled by browser vendor updates. If such a CVE is mentioned in project triage, it should be classified as an explicit non-goal rather than being silently ignored.

### 10.4 Release checklist dependency

`docs/RELEASE_CHECKLIST.md` must include a CVE/advisory search and triage step before stable releases. New relevant findings must be handled as one of:

1. fixture and detector update,
2. fixture-only regression if already covered,
3. README/docs limitation,
4. explicit non-goal/out-of-scope entry.

This rule is additive and must not remove the earlier release checklist additions in this file.



## 11. 1.0.4 CVE Traceability Preservation Update

`docs/CVE_SPEC.md` is the CVE-derived requirement and traceability document. It must preserve:

- CVE-to-requirement mappings;
- CVE-to-fixture mappings;
- adjacent CVE classifications;
- explicit non-goals, including browser-engine memory-safety CVEs that CSS Sentry cannot remediate;
- release checklist additions requiring current CVE/advisory search and triage before stable releases;
- browser-extension limitation notes that explain why some CVE classes become indicators or documented limitations rather than enforceable remediations.

The following newer CVE classes are retained as current traceability items because they directly relate to CSS sanitizer or rendered-resource bypass classes relevant to browser-side risk indicators:

| CVE | Traceability class | CSS Sentry disposition |
|---|---|---|
| CVE-2025-68460 | HTML style sanitizer information disclosure | Covered by rendered-content/style-sanitizer fixtures and CSS exfil risk model. |
| CVE-2026-26079 | CSS injection through comment mishandling | Covered by comment-hidden URL/CSS injection fixtures and parser differential handling. |
| CVE-2026-35540 | Local/private-network stylesheet links leading to SSRF/information disclosure risk in rendered content | Covered as a rendered-resource/local-network stylesheet-link indicator. |
| CVE-2026-25916 | SVG `feImage` remote-resource bypass | Covered as a rendered-resource SVG remote-reference indicator. |
| CVE-2026-35542 | BODY `background` remote-resource bypass | Covered as a rendered-resource BODY background indicator. |
| CVE-2026-35543 | SVG animation remote-resource bypass | Covered as a rendered-resource SVG animation URL-bearing indicator. |
| CVE-2026-35544 | CSS fixed-position `!important` sanitizer-bypass indicator | Covered as a CSS-only UI integrity/sanitizer-bypass indicator. |
| CVE-2026-35545 | SVG animation `fill`/`filter`/`stroke` remote-resource bypass | Covered as a rendered-resource SVG FuncIRI/URL-bearing indicator. |
| CVE-2026-2441 | Browser-engine CSS use-after-free | Out of scope for CSS Sentry enforcement; remediation belongs to browser updates. |

This section is additive. It does not replace the earlier CVE-derived design requirements, acceptance criteria, or release checklist additions.


## 12. 1.0.5 CVE-2026-40301 SVG Style Traceability Update

This section is additive. It does not replace the earlier CVE tables or the `1.0.4` preservation rules.

### 12.1 Vulnerability class

CVE-2026-40301 covers a DOMSanitizer class where SVG `<style>` elements are allowed but their text content is not inspected, allowing CSS `url()` references and `@import` rules to remain in sanitized SVG. When that SVG is rendered by the browser, those CSS constructs can trigger HTTP requests to attacker-controlled hosts.

CSS Sentry tracks this as a rendered SVG / sanitizer-bypass remote-resource class, not as a scanner for the DOMSanitizer package itself.

### 12.2 Required project handling

Required handling for this class:

- Active inline SVG `<style>` text in a rendered document must be analyzed as CSS.
- CSS `@import` inside SVG `<style>` must remain an actionable remote stylesheet sink.
- SVG CSS paint properties such as `fill`, `stroke`, `marker`, `marker-start`, `marker-mid`, and `marker-end` must be treated as URL-capable network sinks when they reference remote URLs.
- Fixture expectations must preserve this coverage so later parser or analyzer changes cannot silently drop the class.
- Externally loaded SVG images, such as an SVG referenced by `<img src=...>`, remain a browser-platform limitation unless their network destination is covered by DNR/resource policy. CSS Sentry must not claim DOM inspection of an SVG image document that the extension cannot access.

### 12.3 Current executable coverage

Current fixture coverage:

| Fixture | Purpose | Expected handling |
|---|---|---|
| `tests/fixtures/attacks/cve-2026-40301-domsanitizer-svg-style-url.html` | SVG `<style>` with remote CSS `url()` in an SVG paint property. | Actionable finding with `sink.svg_paint_remote`, `sink.remote_url`, and cross-origin destination evidence. |
| `tests/fixtures/attacks/cve-2026-40301-domsanitizer-svg-style-import.html` | SVG `<style>` with remote `@import`. | Actionable finding with `sink.import_remote` and cross-origin destination evidence. |

### 12.4 Documentation boundary

This CVE reinforces a general rule already used throughout this document: CVEs are archetypes for browser-rendered CSS risk classes. CSS Sentry should add fixtures and traceability for relevant classes, but it must not imply that it patches the affected server-side package or replaces application-side sanitizer upgrades.

## 13. 1.0.6 Adjacent CVE and Out-of-Scope Classification Update

This section is additive. It preserves awareness of adjacent sanitizer/SVG vulnerabilities without turning CSS Sentry into a general XSS scanner or package vulnerability scanner.

### 13.1 Adjacent CVEs reviewed for scope

| CVE / class | Why it is relevant to review | CSS Sentry disposition |
|---|---|---|
| CVE-2026-41240 / DOMPurify `FORBID_TAGS` bypass with function-based `ADD_TAGS` | Sanitizer bypasses can allow forbidden rendered elements to survive; if those elements include active `<style>`, SVG, iframe, form, or resource-bearing markup, they can become adjacent to CSS Sentry's rendered-content threat model. | Watchlist / conditional. Add fixtures only when the surviving element pattern creates CSS-triggered remote-resource behavior or another current CSS Sentry indicator. Do not claim DOMPurify package detection. |
| SiYuan SVG sanitizer JavaScript-scheme bypass classes such as CVE-2026-31809 | SVG sanitizer bugs are adjacent because SVG can host both JavaScript and CSS/resource-bearing attributes. | Mostly out of scope unless the bypass uses CSS `url()`, `@import`, SVG paint/filter FuncIRI, SVG animation remote-resource attributes, or another CSS Sentry modeled sink. JavaScript execution and reflected/stored XSS remain application/browser sanitizer concerns. |
| Angular SVG `<script>` `href` / `xlink:href` sanitizer class such as CVE-2026-22610 | SVG resource URL misclassification is conceptually near rendered-resource bypasses. | Out of scope for v1 because it is SVG script execution / XSS, not CSS-triggered remote-resource exfiltration. Track only if a future variant uses CSS/SVG paint/filter/style sinks already in scope. |
| Generic malicious SVG upload XSS classes such as CVE-2026-5026 | Uploaded SVG files can contain JavaScript and other active content. | Out of scope as a general uploaded-SVG XSS class. CSS Sentry covers inline/rendered SVG CSS and modeled SVG resource sinks in inspected DOM contexts; it does not sanitize uploaded SVG files or patch server upload endpoints. |

### 13.2 Boundary rule

A sanitizer or SVG CVE becomes in scope only when it creates one of the CSS Sentry modeled browser-side conditions:

1. selector or DOM-state probing combined with a network-capable CSS sink;
2. CSS `@import`, `url()`, `image-set()`, font, mask, filter, list/cursor/background/content, or SVG paint/filter/marker remote-resource behavior;
3. rendered HTML/SVG attributes already covered by `htmlResourceScan.ts`, such as BODY background, SVG `feImage`, SVG animation URL-bearing attributes, or local/private-network stylesheet links;
4. a parser/sanitizer bypass that affects the above CSS/resource behaviors.

A CVE remains out of scope when it is only JavaScript execution, generic XSS, server-side package detection, uploaded-file sanitization, or browser-engine memory safety without a CSS Sentry-modeled CSS/resource sink.


## 14. 1.0.7 Search Triage and Added CVE/Advisory Classes

This section is additive and preserves the prior CVE history. It records the latest CVE/advisory search results and the implementation decisions made for `1.0.7`.

### Added executable coverage

| Identifier | Class | CSS Sentry decision |
|---|---|---|
| CVE-2026-31873 / Unhead | Case-sensitive URI-scheme validation lets `DATA:text/css,...` survive and be interpreted by browsers as a CSS stylesheet. The payload can contain CSS attribute selectors and `background-image` callbacks. | In scope. Added mixed-case data stylesheet link scanning and fixture coverage. Data CSS is analyzed without logging the raw data URL as the source URL. |
| CVE-2026-28348 / `lxml_html_clean` | CSS Unicode escapes can bypass sanitizer checks for `@import` / `expression()`. | In scope for escaped `@import` because it maps to remote stylesheet loading. `expression()` is recorded as legacy/older-browser adjacent, not a modern browser-extension target. Added escaped `@import` recovery and fixture coverage. |

### Adjacent or out-of-scope findings from the search

| Identifier | Classification | Reason |
|---|---|---|
| CVE-2026-41305 / PostCSS | Adjacent / out of scope | The issue is CSS stringification output containing `</style>` when an application embeds user CSS into an HTML `<style>` tag. CSS Sentry does not parse and re-stringify user CSS into HTML. The relevant invariant is the existing extension-UI injection ban. |
| CVE-2026-41240 / DOMPurify | Watchlist / conditional | The advisory is about a sanitizer configuration inconsistency that may allow forbidden elements to survive. It is not CSS-specific unless a surviving path enables CSS remote-resource behavior. Add fixtures only if a concrete CSS-bearing path is identified. |
| CVE-2026-2441 / Chrome CSS | Out of scope | Official NVD classification is browser-engine CSS use-after-free / memory corruption. CSS Sentry cannot remediate browser engine RCE; users must update the browser. |
| SiYuan / Angular / generic SVG JavaScript-XSS sanitizer records | Mostly out of scope | Pure SVG JavaScript execution is an application/browser sanitizer issue. Existing SVG animate/resource-sink coverage remains relevant for CSS-adjacent remote-resource behavior only. |

### Search-to-action rule

Future CVE/advisory search results should be triaged into one of these buckets:

1. **Add fixture and implementation** when the issue involves CSS-triggered remote requests, CSS imports, CSS selector probing, inline style exfiltration, SVG CSS paint/resource sinks, or rendered-content CSS injection.
2. **Document as watchlist / conditional** when the issue might allow CSS-bearing content but the advisory does not identify a CSS remote-resource or selector-probing path.
3. **Document as out of scope** when the issue is JavaScript-only XSS, browser memory corruption, dependency/package scanning, store publication, or site-side remediation with no browser-extension control point.

## 1.0.8 Historical Issue Comments and CVE Boundary Preservation

Historical issue-comment material remains relevant when it identifies a CSS parser, sanitizer, remote-resource, timing, privacy, or compatibility class. CVE_SPEC should continue to track CVE and advisory material separately from general product requirements, but issue-comment classes can justify adding fixtures, redaction rules, parser tests, or explicit non-goals when they overlap with CSS-triggered data exfiltration.

Non-CVE historical findings such as extension-context cross-domain CSS fetching, relative `@import` rewriting, first-load timing, and load-blocking CSS side effects are not CVEs by themselves, but they inform CVE fixture design and release checklist review because the same failure mode can reappear through sanitizer/advisory classes.

## 1.0.10 Advanced Optional CVE Coverage Policy

External SVG image-document handling is now in scope for partial-coverage reporting and optional Strict destination policy. It remains out of scope for full internal inspection when the browser exposes the SVG only as an image resource. Future SVG/sanitizer advisories should be classified as follows:

- add executable fixtures when the advisory includes CSS-triggered remote-resource behavior, selector probing, CSS imports, inline style leaks, SVG style/resource behavior, or rendered-content CSS injection;
- add documentation/watchlist entries when the advisory is adjacent but lacks a concrete CSS Sentry browser-side behavior;
- keep pure JavaScript-XSS, package-version scanning, and server-side dependency-audit behavior out of scope.

Firefox enhanced stylesheet response inspection may increase reporting coverage for stylesheet response bodies in Firefox, but it does not change CVE fixture acceptance criteria unless a fixture explicitly requires response-body inspection rather than DOM/CSSOM inspection.


## 1.0.15 CVE/Fixture Classification Update

The Roundcube fixed-position `!important` fixture is retained for traceability, but CSS Sentry no longer treats that CSS-only UI-integrity class as actionable without an outbound leak path. Same-origin BODY/SVG decorative resources are benign regression coverage; cross-origin and local/private-network BODY background, SVG `feImage`, and SVG animation resource sinks remain covered by the existing CVE-derived fixtures.
