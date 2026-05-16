# Test Lab Coverage Control

## Purpose

The CSS Sentry website coverage model is a coverage completion model for controlled behavior coverage, not as a page named matrix and not a single vulnerable/safe verdict. The website must show which controlled CSS behaviors are represented, which CSS Sentry reason-code families they correspond to, which fixture or spec material supports them, and which results are expected under the current extension mode.

The coverage surface must preserve this boundary:

```text
A controlled endpoint request is one evidence source.
A CSS Sentry scan diagnostic is a second evidence source.
A background report-save acknowledgement is a third evidence source.
A user-confirmed popup/report result is a fourth evidence source.
Only the combined state can be interpreted.
```

## Coverage Requirements

The guided `/tests/` runner is the primary user surface. It must support one check, one category, or all selected checks without duplicating the same endpoint/report/troubleshooting content on many isolated pages. `/tests/:caseId/` remains a deep-link compatibility route only and redirects into `/tests/?cases=<caseId>`.

Each coverage row must carry:

```text
case id
behavior category
risk class
implementation status
fake data used
CSS mechanism
controlled endpoint path
expected CSS Sentry reason terms
fixture references
spec or CVE references
mode expectations
limitations
manual report-check instructions
```

The site must not claim that passing all checks proves complete protection from every CSS-based leak. It may claim only that CSS Sentry behaved as expected for the selected controlled cases in the selected or detected mode.

## Implemented Coverage Groups

### Setup check

The known detector smoke check verifies the minimal supported path: fake value selector, remote image sink, endpoint result, scan diagnostic, report-save acknowledgement, and manual report confirmation.

### Basic selector probes

Implemented selector-family coverage includes exact match, prefix match, suffix match, substring match, repeated probe pattern, and `:has()` relational selector representation.

### Remote request sinks

Implemented sink coverage includes `background-image`, `mask-image`, and `image-set()` request paths. These are distinct because browser request behavior and parser/report terms can differ even when all produce remote URL sinks.

### Stylesheet delivery

Implemented stylesheet-delivery coverage includes same-origin `@import` delivery and a large-input import-recovery representation. Cross-origin companion deployment remains a separate public deployment requirement because it requires a second origin.

### Modern CSS syntax

Implemented grouping and modern-syntax coverage includes `@supports`, `@media`, nested CSS, and `@layer` wrappers.

### Large stylesheet resilience

Implemented large-input coverage includes a late selector probe and an advanced late-import representation. Fixture-corpus tests remain authoritative for exact performance-budget and import-recovery behavior.

### Declaration indirection

Implemented declaration-indirection coverage includes custom property URL sinks, `var()` fallback URL chains, and an attr/if value-source representation. The attr/if case is marked manual-explanation because fixture behavior is more authoritative than public browser endpoint behavior for unevenly supported syntax.

### Side-channel indicators

Implemented side-channel coverage includes remote font signals and font measurement/container indicators. These are risk indicators and must not be described as complete data extraction proofs.

## Diagnostic Requirements

The extension must publish separate local Test Lab events:

```text
css-sentry:test-lab-scan
css-sentry:test-lab-report
```

The scan event means the content-script scanner completed and can report mode, state, finding counts, reason codes, and actions. The report event means the background path acknowledged report persistence after `saveFrameReport`. The payload must not include selectors, full URLs, fake field values, or raw finding details. The page must process the same sanitized payload whether it arrives through the DOM event, the stored diagnostic attribute, a later attribute mutation, or the same-origin `window.postMessage` bridge.

Public deployments can run endpoint checks, but automatic extension diagnostic events remain intentionally local-origin scoped unless a later release explicitly allowlists an official Test Lab origin. This prevents arbitrary websites from exposing extension mode or finding-summary state merely by copying the Test Lab meta marker. Public deployment interpretation therefore requires manual CSS Sentry popup/report confirmation until an official diagnostic origin is defined.

## Interpretation Requirements

The interpretation engine must distinguish at least these states:

```text
no session started
endpoint received
endpoint not received
extension scan signal missing
scan connected with zero findings
scan connected with findings
report saved
report save failed or unavailable
manual report not checked
manual report found
manual report absent
Passive report-only expected
Balanced or Strict unexpected no-finding state
Trusted, Paused, or Never scan intentionally reduced protection
```

## Remaining Coverage Boundaries

The website foundation still requires real browser validation with the extension installed, deployed Cloudflare Workers validation, Cloudflare WAF/rate-limit configuration, cross-origin companion endpoint work, iframe coverage pages, accessibility validation, and final public copy/privacy review before the public website should be treated as release-complete.

## Static Runner Coverage Boundary

Coverage completion is independent from server-rendering the page shell. The guided runner may be prerendered as long as selected controlled CSS is still generated from the shared test-case protocol and delivered through a dynamic endpoint before CSS Sentry's normal scan path needs to evaluate the active session.

The dynamic endpoint layer remains part of coverage because endpoint hit recording is one of the evidence sources. The page shell does not need request-time rendering to provide that evidence.
