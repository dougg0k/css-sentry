# Privacy

Last Updated: 2026/05/13 14:58:56 -03

CSS Sentry is designed to be local-first and telemetry-free by default.

## Default Privacy Model

By default, CSS Sentry does not:

- send telemetry;
- require an account;
- upload CSS, selectors, URLs, findings, reports, settings, page contents, or browsing history;
- use a remote analysis service;
- fetch remote stylesheets from the extension context solely for analysis.

Findings and reports are stored locally in browser extension storage so the user can understand what was detected, blocked, or partially analyzed.

## What May Be Stored Locally

Local reports may include:

- page origin and URL;
- frame URL and parent-frame metadata;
- finding severity and confidence;
- reason codes;
- destination origin for a CSS-triggered request;
- redacted selector/declaration details;
- analysis states such as `analysis.complete`, `analysis.partial`, or `frame.cross_origin.uninspectable`;
- timestamps and per-tab report summaries.

## Redaction Rules

CSS Sentry should redact sensitive values before storing or exporting reports. Redaction should cover:

- selector values for probed `value` attributes;
- sensitive/token-like attribute values;
- URL credentials;
- URL query values;
- URL fragments;
- token-like URL path segments;
- diagnostic fields that could contain secrets.

Redaction should preserve enough shape for debugging. For example:

```css
input[name="csrf_token"][value^="[redacted]"]
```

The field name can remain useful while the probed value is redacted.

## Destination Origins

Destination origins may remain visible because they are needed for explainability and DNR policy decisions. A report may show `https://attacker.example`, but should not store sensitive query strings, fragments, credentials, or token-like path values from the full request URL.

## Clearing Reports

The UI should provide a way to clear local reports. Clearing reports removes stored finding history from extension storage, but it does not change browser history, website logs, or network logs outside the extension.

## Exported Reports

Report exports are user-triggered. Exported reports should be sanitized again as defense-in-depth before download. Users should still review exports before sharing them.

## Remote Fetching

CSS Sentry should not fetch remote CSS from the extension context for normal analysis. This is a fixed privacy and compatibility invariant, not a checkbox-backed preference. The Options UI may explain the invariant, but it must not expose a “never fetch remote CSS” switch unless a real, separately designed, opt-in remote-fetch feature exists and the switch controls that feature through the actual fetch authority.

If remote stylesheet fetching is ever added, it must be opt-in, clearly explained, disabled by default, documented, and tested with common blocker expectations. Ordinary builds must continue to have a source-level regression test that rejects extension-context remote CSS fetch code.

## Telemetry

Telemetry is intentionally avoided for v1. If telemetry is ever added, it must be opt-in, minimal, documented, and disabled by default.

## Local Size and Retention Limits

CSS Sentry caps imported settings, stored reports, frames per report, and findings per report. These limits reduce the chance that a malicious page can cause excessive extension-storage growth or make the report UI unusable.

## Local DNR Status

CSS Sentry stores the latest declarativeNetRequest operation status locally so the Options page can show whether network-policy rules were installed successfully. This status is diagnostic only and is not transmitted.

## Documentation Regression Rule

Privacy documentation must remain explicit about what is stored, what is redacted, what remains local, and how users clear or export reports. Do not replace this document with a shorter privacy summary unless the removed details are preserved elsewhere and linked.

## Partial-Analysis Finding Display

The `Show partial-analysis findings` option controls only whether informational partial-analysis finding rows are displayed in popup and report views. CSS Sentry keeps the underlying report evidence in local storage and exports it unchanged. The high-level analysis state, partial frame counts, and partial stylesheet counts remain visible even when those informational rows are hidden, because those counters communicate inspection completeness rather than optional diagnostic detail.


## 1.0.39 retention and remote-fetch invariant update

Report retention is enforced when reports are saved and when settings are saved, so lowering the retention window prunes older local reports immediately instead of waiting for a later startup pass. CSS Sentry still does not fetch remote stylesheets from the extension context for analysis; Firefox enhanced inspection observes browser-loaded stylesheet responses through the browser response-filter API where available.


## 1.0.42 Bounded Inspection and Artifact Privacy Update

Firefox enhanced stylesheet response inspection remains optional, Firefox-specific, and off by default. When enabled, it passes browser-loaded stylesheet response bytes through unchanged and retains only a bounded prefix of the stylesheet for local analysis. If the configured byte budget is reached or analysis fails, CSS Sentry records partial coverage instead of buffering unbounded response bodies. Release artifact verification rejects sourcemaps in packaged output so distributed extension packages do not unintentionally include source maps.


## 1.0.45 Diagnostic Scope Update

DNR skipped-target diagnostics are local-only and summarize why a finding-derived network rule was not installed. They use reason codes and counts for local troubleshooting and do not introduce telemetry or remote reporting.
