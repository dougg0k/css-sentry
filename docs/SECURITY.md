# Security Policy

Last Updated: 2026/04/29 11:55:00 -03

CSS Sentry is a browser extension for detecting and reducing risk from known high-signal CSS-based data exfiltration patterns. Security reports are welcome, especially reports with minimized reproductions and clear expected/actual behavior.

## Supported Versions

Only the latest package line is supported for security fixes. Older development snapshots and superseded patch packages may be useful for regression comparison, but fixes should be made against the latest package.

| Version | Supported |
|---|---:|
| `1.0.4` | Yes, after local `pnpm run verify:full` passes |
| `1.0.3` | Superseded by documentation patch `1.0.4` |
| `1.0.0` through `1.0.2` | Superseded |
| `0.0.x` development snapshots | No |


## What to Report

Please report:

- CSS exfiltration bypasses that avoid detection or mitigation;
- false negatives in Passive, Balanced, or Strict mode;
- high-impact false positives that break normal browsing;
- sensitive values appearing in stored reports, exported reports, popup text, report text, or test artifacts;
- DNR policy failures, especially first-load destination blocklist failures;
- parser inconsistencies for comments, escapes, nested rules, custom properties, `@import`, or malformed browser-tolerated CSS;
- frame/iframe coverage problems, including same-origin frame overwrites or missing cross-origin partial-coverage states;
- permission prompts or missing-permission states that are confusing, noisy, or unsafe;
- compatibility problems with commonly used privacy/security extensions.

## What Not to Send

Do not include real credentials, session tokens, CSRF tokens, private URLs, private CSS from sensitive systems, or live exploit payloads against a third-party service.

Use minimized reproductions whenever possible. Replace secrets with placeholders such as `[redacted-token]`, `[redacted-url]`, or `[redacted-origin]`.

## Safe Reproduction Guidance

A useful security report usually includes browser/version, operating system, CSS Sentry version, protection mode, advanced-options state, other enabled blockers, a minimal HTML/CSS reproduction, expected behavior, actual behavior, and whether the page used iframes, rendered email, rendered markdown, third-party stylesheets, or inline styles.

For CSS exfiltration bypasses, a local reproduction using `localhost` or a private test origin is strongly preferred.

## Handling Expectations

This project does not promise emergency response times during early development. Reports should still be handled carefully:

1. confirm whether the report is in scope;
2. reduce the report to a fixture when possible;
3. add a regression test before or with the fix;
4. update `docs/CVE_SPEC.md` if the issue maps to a CVE-derived class;
5. update `docs/STATUS.md` when coverage status changes;
6. document any limitation that cannot be fixed due to browser-extension platform constraints.

## Scope Boundaries

CSS Sentry is a defense-in-depth browser extension. Some limitations are expected and should be documented rather than treated as fixable vulnerabilities:

- Chrome Manifest V3 does not allow arbitrary response-body rewriting for every stylesheet.
- Cross-origin frames and stylesheets may be partially or fully uninspectable due to browser security boundaries.
- Strict mode may break some websites.
- Future CSS features may require new parser support, fixtures, or rule updates.
- CSS Sentry does not protect against malicious JavaScript already running with page privileges.

## Disclosure Channel

Until a dedicated private disclosure channel exists, use the project issue tracker with a minimized reproduction and no live secrets. If a future private security advisory channel is added, update this section and the README.

## Extension Self-Security Scope

Security reports may also cover CSS Sentry itself. Useful reports include:

- runtime-message validation bypasses;
- settings import crashes or policy-confusion cases;
- report-storage denial-of-service cases;
- DNR failure states that are not visible to the user;
- extension UI injection or dynamic-code execution sinks;
- permission requests that are broader than documented.

## Documentation and Traceability Security Rule

Security-relevant documentation is part of the project control surface. Do not remove detailed security, CVE, status, or self-security traceability content during release preparation. If content is reorganized, the substantive information must be preserved and the new location must be linked from the original document or from `README.md`.
