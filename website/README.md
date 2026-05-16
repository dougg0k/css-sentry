# CSS Sentry Test Lab

This Astro site is a controlled behavior verification lab for CSS Sentry. It uses fake sentinel values, guided test walkthroughs, known test cases, statically prerendered pages, and same-origin dynamic endpoints to help users compare browser-side CSS behavior with CSS Sentry's popup and report output.

The site is not a general security certification. A successful result only applies to the explicit test case, browser, extension version, protection mode, and deployment configuration being used.

## Package manager model

The website is part of the root pnpm workspace. Run install from the repository root or from `website/`; pnpm will resolve the workspace root through `pnpm-workspace.yaml` and install both workspace projects.

```text
pnpm install --no-frozen-lockfile
pnpm --filter css-sentry-website dev
pnpm --filter css-sentry-website build
pnpm --filter css-sentry-website preview
```

Root convenience scripts are also available:

```text
pnpm website:dev
pnpm website:build
pnpm website:preview
pnpm verify:website-source
```

The website depends on workspace inclusion. If `pnpm install` reports everything is already up to date while `astro` is missing, verify that `pnpm-workspace.yaml` includes `website` under `packages`. Cloudflare local build tooling also requires the `workerd` build script to be approved under `allowBuilds`. If the lockfile was not regenerated after adding the website package, run `pnpm install --no-frozen-lockfile` once and commit the updated `pnpm-lock.yaml` before switching CI back to frozen-lockfile installs.

## Live session behavior

Starting selected checks creates a short-lived session, records the selected allowlisted cases in the URL with browser history, injects controlled CSS for that session without refreshing the page, and then polls the result endpoint. The default selected run intentionally excludes the large stylesheet stress case; select that case directly or use Run all checks after the baseline scan path works. Direct session URLs still use the `initial-test-style` stylesheet path for reruns and shared links. This preserves live endpoint verification while avoiding server-rendering the normal website pages.

After the reload, each guided check shows fake data, the CSS rule, the controlled request path, endpoint state, manual CSS Sentry confirmation controls, and mode-aware interpretation. Users should compare both signals:

```text
1. CSS Sentry popup/report findings for the selected cases.
2. The website endpoint-result table showing whether controlled requests reached the test endpoint.
```

Endpoint results are not a standalone safe/unsafe verdict. Passive, Trusted, and Paused modes can legitimately allow requests, and browser timing or other extensions can affect whether a resource reaches the endpoint before mitigation applies.

Diagnostic events are restricted to supported Test Lab origins. Localhost is supported for development, and the public Cloudflare Worker Test Lab is supported when deployed under the `css-sentry-test-lab.*.workers.dev` origin pattern. Other public origins can still run endpoint checks, but they rely on manual CSS Sentry popup/report confirmation.
