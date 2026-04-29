# Permissions Rationale

Last Updated: 2026/04/29 11:55:00 -03

CSS Sentry should request only permissions required for detection, local reporting, and optional mitigation, and optional Firefox-specific stylesheet response inspection.

## Storage

Used for local settings, per-origin protection modes, advanced-options visibility, destination allow/block lists, local reports, and report retention metadata.

Storage is local to the extension. It is not telemetry.

## Content Scripts / Host Access

Used for:

- scanning inline styles and stylesheet text that the browser permits the extension to inspect;
- detecting dynamically inserted style/link/style attributes;
- reporting same-origin frame findings;
- reporting partial coverage when frames or stylesheets cannot be inspected.

Host access should be explained clearly. Missing host permissions should produce clear UI states rather than noisy console errors.

## declarativeNetRequest

Used for:

- high-confidence finding-based mitigation;
- destination blocklist enforcement;
- destination allowlist precedence;
- Strict-mode third-party resource blocking where configured;
- first-load destination blocklist prevention through global policy rules.

DNR is required because Chrome Manifest V3 does not allow old-style blocking `webRequest` behavior for general extension request blocking.

## webRequest

Used only for the advanced, off-by-default Firefox enhanced stylesheet response inspection path when Firefox exposes `webRequest.filterResponseData`. This path inspects stylesheet response bodies for local reporting while passing the original response through unchanged. It must not fetch remote CSS from the extension context and must degrade safely on browsers that do not expose the response-filter API.

## Web Navigation

Used for applying tab-scoped Strict-mode or destination-policy DNR rules early in the navigation lifecycle.

## Permissions Not Requested for v1

CSS Sentry does not currently request `activeTab`, `scripting`, `webRequestBlocking`, or optional host permissions. The extension does not programmatically inject scripts; WXT declares static content scripts from the manifest.

If future versions add programmatic injection or optional host permissions, `docs/PERMISSIONS.md`, `docs/STATUS.md`, and project-structure tests must be updated with a specific rationale.

## Permissions Not Intended for v1

The v1 scope should avoid permissions or capabilities that imply broader access than needed, such as remote code execution, dynamic code loading, cloud analysis, broad native-messaging integration, or unrelated browsing-data access.

## Store Listing Guidance

The browser-store description should explain permissions in plain language:

- CSS Sentry reads page styles so it can detect risky CSS patterns.
- CSS Sentry stores local reports so users can review what was detected.
- CSS Sentry uses browser network-blocking rules to stop high-confidence CSS-triggered requests or user-configured blocklisted destinations.
- CSS Sentry does not send reports or telemetry to a remote service by default.

## Permission Regression Rule

Permission changes must be treated as security-relevant changes. Any future addition, removal, or semantic change to manifest permissions must update this file, `docs/STATUS.md`, and the permission-alignment project-structure test in the same change.
