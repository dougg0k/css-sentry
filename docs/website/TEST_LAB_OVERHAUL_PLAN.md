# Test Lab Overhaul Plan

Last Updated: 2026/05/14 18:19:34 -03

## Purpose

The website must be a CSS Sentry behavior verification lab. It must not be a clone of a legacy vulnerable/safe page, and it must not imply that a single endpoint result is a complete security verdict.

The correct product shape is:

```text
controlled fake data
selected CSS behavior
controlled endpoint result
extension scan diagnostic
background report-save acknowledgement
manual popup/report confirmation
mode-specific interpretation
local history for support
```

## Active Website Shape

The primary surface is the main /tests/ runner (`/tests/`). It supports selecting one check, selecting a behavior category, running all checks, polling per-check endpoint results, displaying extension diagnostic state, showing report-save acknowledgement, and recording manual popup/report confirmation.

Individual `/tests/:caseId/` routes are compatibility deep links. They redirect into the runner with that single case selected. This prevents duplicated report instructions, troubleshooting copy, mode controls, and endpoint interpretation across many pages.

## Mode Handling

The runner must use CSS Sentry's detected diagnostic mode when available. The manual mode selector remains available only under a manual override block for cases where the extension diagnostic signal is unavailable.

The site must support all extension mode labels that can appear in diagnostics:

```text
default
passive
balanced
strict
trusted
paused
always_scan_never_sanitize
never_scan_never_sanitize
```

## Diagnostic Handling

The website must listen for two distinct diagnostic events:

```text
css-sentry:test-lab-scan
css-sentry:test-lab-report
```

The first event answers whether the content-script scanner saw findings. The second event answers whether the background report-save path acknowledged storage. This distinction is required because a page can be scanned, can find issues, and still fail to show a popup/report if the report pipeline fails.

The diagnostic bridge remains local-origin scoped by default. A public Cloudflare deployment should still run endpoint checks and manual report confirmation, but it must not expect automatic scan/report events unless the extension later defines and tests an explicit official Test Lab origin allowlist.

## Coverage Completion Model

Coverage is documented as completion status, not as a page named matrix. The runner and status documents must map test cases to behavior classes, expected reason terms, fixture references, implementation status, and limitations.

The current coverage groups are:

```text
setup check
basic selector probe
remote request sink
stylesheet delivery
modern CSS syntax
large stylesheet resilience
declaration indirection
side-channel indicator
```

## Required Interpretation States

The runner must distinguish:

```text
extension did not signal
extension scanned with zero findings
extension scanned with findings
background report was saved
background report was not acknowledged
endpoint was received
endpoint was not received
manual popup/report check is missing
manual popup/report found the expected case
manual popup/report did not find the case
```

## Remaining Validation

The website implementation remains incomplete until local and deployed behavior are validated with CSS Sentry installed. Required validation includes the guided runner, the known detector check, at least one check from each coverage group, report-save acknowledgement, local history, reset behavior, Cloudflare Worker deployment, WAF/rate-limit configuration, and accessibility review.
