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

## Cloudflare Workers deployment model

This website keeps normal pages prerendered/static and uses the Cloudflare adapter only for on-demand routes. Dynamic endpoints handle session creation, selected controlled CSS generation, controlled resource hits, result reads, import probes, and reset behavior.

The deployment workflow is stored under `../.github/workflows/website-cloudflare.yml`. It builds the workspace website package and deploys the Worker from the `website` directory when Cloudflare secrets and deployment settings are configured.

Required GitHub secrets after enabling the workflow:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

Turnstile setup is split between the public site key used by the Astro-built client page and the private Worker secret used by the session endpoint. The build workflow passes the public key to Astro as `PUBLIC_TURNSTILE_SITE_KEY` from either a repository variable or secret named `PUBLIC_TURNSTILE_SITE_KEY` or `TURNSTILE_SITE_KEY`. The private secret must be configured as a Cloudflare Worker secret named `TURNSTILE_SECRET_KEY`; putting only the private key in GitHub Actions does not make it available to the deployed Worker runtime.

```text
GitHub Actions build-time value:
PUBLIC_TURNSTILE_SITE_KEY

Cloudflare Worker runtime secret:
TURNSTILE_SECRET_KEY
```

When the public site key is absent, the `/tests/` runner does not render Turnstile and the session endpoint remains usable only if the Worker secret is also absent. When the Worker secret is present, `/api/session.json` requires either a valid signed first-party Test Lab verification cookie or a client Turnstile token. A successful token validation sets the HttpOnly verification cookie, so repeated Start selected checks interactions on the same origin do not reset or re-run Turnstile until that cookie expires. The validation is bound to the Test Lab action and to the request hostname.

The session endpoint imports Worker environment bindings from `cloudflare:workers`, matching the current Astro Cloudflare adapter runtime model. It must not read `Astro.locals.runtime`, because that API was removed in the Astro 6 / adapter v13 line.

## Abuse-control boundary

Application code validates known test cases and short-lived session identifiers. Public deployment still needs Cloudflare WAF/rate-limiting rules for `/api/session.json`, `/api/hit/*`, and `/api/result/*`.

Turnstile belongs on session creation. Do not put an interactive challenge directly on CSS resource hit endpoints, because those requests are made as stylesheet-triggered resources rather than user-submitted forms. The runner uses explicit Turnstile rendering at page load with interaction-only appearance so most users can start selected checks without a per-button widget reset, while suspicious sessions can still be challenged before creating Test Lab sessions. The remote-font representation uses a dedicated `.woff2` hit endpoint so the request path matches the resource type being tested. The complete website overhaul model is tracked in `../docs/website/TEST_LAB_OVERHAUL_PLAN.md`.
