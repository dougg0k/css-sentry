# Release Checklist

Last Updated: 2026/04/30 18:10:00 -03

Use this checklist before publishing a release candidate or stable release.

## Preflight

- Do not reduce or summarize docs during release work. If a document is reorganized, preserve the full substantive content and update links.

- [ ] Confirm `package.json` version is correct for the release stage, such as `1.0.0` or a future `1.0.1-rc.1`.
- [ ] Confirm `README.md` claim language does not overpromise.
- [ ] Confirm `README.md` does not contain `Last Updated`; timestamp metadata belongs only in documents under `docs/`.
- [ ] Confirm `docs/STATUS.md` reflects the current package and verification state.
- [ ] Confirm `docs/CVE_SPEC.md` has no unresolved v1-blocking CVE-derived items.
- [ ] Confirm `docs/SECURITY.md`, `docs/PRIVACY.md`, and `docs/PERMISSIONS.md` are present and current.
- [ ] Confirm `docs/RELEASE_NOTES.md` is present, current for this release, and remains the changelog home.
- [ ] Confirm runtime message and import hardening tests pass.
- [ ] Confirm manifest permissions match `docs/PERMISSIONS.md`.
- [ ] Confirm DNR status appears in Options after a DNR operation.
- [ ] For false-positive/noise-reduction releases, run or document `pnpm run audit:false-positives -- --limit 250 --save-reports actionable` and preserve any actionable per-site reports under `test-results/` only.
- [ ] Confirm `pnpm-workspace.yaml` remains at the repository root when pnpm build-script approval is needed.

## Required Verification

```bash
pnpm install --frozen-lockfile
pnpm run compile
pnpm run test
pnpm run build
pnpm run test:e2e
pnpm run build:firefox
```

Full manual gate:

```bash
pnpm run verify:full
```

Optional AI/debug report:

```bash
pnpm run test:ai
```

## Artifact Generation

```bash
pnpm run zip
pnpm run zip:firefox
```

## Manual Browser Checks

Chrome/Chromium:

- [ ] load `.output/chrome-mv3` as an unpacked extension;
- [ ] popup opens;
- [ ] options page opens;
- [ ] report page opens;
- [ ] Passive/Balanced/Strict mode buttons work;
- [ ] advanced options show/hide correctly;
- [ ] local reports can be cleared;
- [ ] report export does not reveal known test secrets;
- [ ] destination blocklist works on a local test page.

Firefox:

- [ ] build with `pnpm run build:firefox`;
- [ ] load the Firefox build in a fresh profile or temporary extension environment;
- [ ] popup/options/report pages open;
- [ ] normal browsing with uBlock Origin does not show obvious breakage in regular usage.

## Structure Checks

The source package should not include:

- [ ] `node_modules/`;
- [ ] `.output/`;
- [ ] `test-results/`;
- [ ] Playwright traces;
- [ ] `json-report.json`;
- [ ] root `SPEC.md`, `CVE_SPEC.md`, `STATUS.md`, `SECURITY.md`, `PRIVACY.md`, `PERMISSIONS.md`, or `RELEASE_CHECKLIST.md`.

The source package should include:

- [ ] `README.md`;
- [ ] `docs/SPEC.md`;
- [ ] `docs/CVE_SPEC.md`;
- [ ] `docs/STATUS.md`;
- [ ] `docs/SECURITY.md`;
- [ ] `docs/PRIVACY.md`;
- [ ] `docs/PERMISSIONS.md`;
- [ ] `docs/RELEASE_CHECKLIST.md`;
- [ ] `docs/RELEASE_NOTES.md`;
- [ ] `docs/SELF_SECURITY.md`;
- [ ] `src/`;
- [ ] `tests/`;
- [ ] `package.json`;
- [ ] `pnpm-lock.yaml`;
- [ ] `pnpm-workspace.yaml`.

## v1 Release Criteria

A stable `1.0.0` release requires:

- [ ] release candidate verification passed;
- [ ] no known release-blocking bug remains;
- [ ] known limitations documented;
- [ ] `docs/STATUS.md` has no v1-blocking `Partial`, `Not implemented`, or `Not truly tested` item;
- [ ] release notes written;
- [ ] source and browser-extension artifacts generated cleanly.

## Release Candidate Promotion

Promote a pre-release package to the next release candidate only after the full manual gate passes and `docs/STATUS.md` has no unresolved v1-blocking item.

Promote a release candidate to stable only after a manual usage period finds no release-blocking issue, release notes are updated, and browser artifacts are generated cleanly.


## Documentation Role and Coverage Checks

Before packaging a source release:

- [ ] Confirm `docs/RELEASE_NOTES.md` contains changelog/release history and does not replace status/specification content.
- [ ] Confirm `docs/STATUS.md` contains current coverage, limitations, verification state, and audit notes.
- [ ] Confirm `docs/SPEC.md` contains requirements, accepted implementation decisions, historical issue-derived requirements, and regression rules.
- [ ] Confirm `docs/CVE_SPEC.md` contains CVE-derived requirements, fixture mappings, adjacent CVE classes, explicit non-goals, and CVE/advisory release-checklist obligations.
- [ ] Confirm `docs/SELF_SECURITY.md` maps extension self-security safeguards to implementation and test evidence.
- [ ] Confirm each implemented capability is tracked in at least one durable document.
- [ ] Confirm no document was shortened by deleting tracking history, rationale, coverage evidence, or limitation context.

## Documentation Regression Guard

Project documentation is part of the release safety system. Do not replace detailed documents with shortened summaries during release preparation.

Before publishing or packaging a release, verify that these documents remain substantive and are not accidentally reduced:

- `docs/SPEC.md`
- `docs/CVE_SPEC.md`
- `docs/STATUS.md`
- `docs/SELF_SECURITY.md`
- `docs/SECURITY.md`
- `docs/PERMISSIONS.md`
- `docs/PRIVACY.md`
- `docs/RELEASE_NOTES.md`

Additive updates are allowed. Destructive condensation, "normalization" by removing tracking history, or replacement with thin summaries is not allowed unless the user explicitly requests a shorter document and the removed content is preserved elsewhere.

## CVE / Advisory Search and Triage

Before a stable release:

1. Search current CVE/advisory sources for CSS injection, CSS exfiltration, HTML style sanitizer, rendered email, webmail sanitizer, SVG remote-resource, and browser-rendered remote-resource classes.
2. Triage each relevant result into:
   - implemented detector and fixture;
   - fixture-only regression because existing logic already covers it;
   - documented limitation;
   - explicit non-goal / out-of-scope item.
3. Confirm `docs/CVE_SPEC.md` includes the triage result.
4. Confirm `docs/STATUS.md` reflects the actual implementation and verification state.
5. Confirm no new CVE-derived requirement is silently omitted.

## Source Package vs Browser Artifact

`pnpm run verify:full` is the required source verification gate. `pnpm run zip` and `pnpm run zip:firefox` are release-artifact generation commands and are only required when preparing installable browser extension archives.


## 1.0.5 Additional Tracking Checks

Before packaging future releases, also verify:

- [ ] CVE-2026-40301 fixtures remain present with matching expectation files.
- [ ] SVG `<style>` `url()` and `@import` behavior remains covered by fixture tests.
- [ ] `docs/STATUS.md` still preserves future candidates, avoided features, and known limitations.
- [ ] `docs/SPEC.md` still states that project documents are tracking artifacts, not only release summaries.
- [ ] Externally loaded SVG image-document limitations remain documented unless implementation coverage changes.

## 1.0.6 Additional Maintenance Checks

Before packaging a release after `1.0.6`, confirm:

- `.gitignore` excludes generated Playwright/Vitest outputs, including `test-results` and `json-report.json`.
- `docs/chrome-extension-logo.png` and `docs/firefox-addon-logo.svg` remain present if referenced by documentation or store-readiness notes.
- Popup and Options entrypoints remain composed from smaller components rather than accumulating repeated presentational functions in one file.
- `src/shared/components/InfoTooltip.tsx` remains the shared tooltip primitive unless intentionally replaced.
- `docs/STATUS.md` classifies v1-scope items as `Covered for documented scope`, `Covered by current corpus`, `Manual / policy`, `Documented limitation`, or `Out of scope` instead of using vague partial language.
- Store-publication screenshots, store copy, and actual submissions are not treated as required source-package implementation unless a future release explicitly chooses to publish.
- Adjacent sanitizer/SVG CVEs that do not involve CSS-triggered remote-resource behavior are tracked as watchlist or out-of-scope items with reasons, not silently ignored.


## 1.0.7 Additional Search and Fixture Checks

Before packaging after `1.0.7`, confirm:

- `docs/STATUS.md` uses `Features Avoided`, not `old avoided-features heading`.
- automated workflow is not listed as an implementation coverage gap.
- CVE-2026-31873 and CVE-2026-28348 fixture names are present in `tests/integration/spec-acceptance.test.ts`.
- Data CSS stylesheet links are scanned without storing the raw data URL as a source URL.
- Escaped `@import` recovery is covered by a fixture.
- Adjacent/out-of-scope search results remain documented in `docs/CVE_SPEC.md` and `docs/STATUS.md`.
- Future sanitizer-specific fixture packs are only added when advisories map to CSS-triggered remote-resource behavior, selector probing, CSS imports, inline style leaks, or rendered-content CSS injection.

## 1.0.8 Documentation Scope Check

Before future releases, confirm that status wording does not imply either under-coverage or universal coverage:

- Use `Covered for documented scope` for implemented/tested behavior within CSS Sentry's stated threat model.
- Use `Covered by current corpus` for parser/CVE/fixture classes that may expand as new advisories appear.
- Use `Manual / policy` for deliberate manual validation areas such as broad extension compatibility.
- Use `Out of scope` only when the item is not part of CSS Sentry's threat model or source package.
- Do not reintroduce CI workflow as an implementation gap unless the maintainer explicitly changes release policy.
- Do not delete historical issue-derived coverage material during cleanup; move it to a better tracking section if necessary.

## 1.0.10 Advanced Option Checks

- [ ] Advanced SVG image-document reporting is off by default.
- [ ] Strict SVG image-document DNR policy is off by default.
- [ ] Firefox enhanced stylesheet response inspection is off by default and degrades safely outside Firefox or without `filterResponseData`.
- [ ] DNR status text treats zero tab-scoped rules as a successful no-op, not an error.
- [ ] Documentation states that externally loaded SVG image-document internals are not fully inspectable.

## 1.0.12 False-Positive Release Checks

Before publishing a release after `1.0.12`, confirm:

- [ ] Balanced mode does not emit actionable findings for presentation-only CSS with zero remote URL sinks.
- [ ] Standalone remote `@font-face` loads such as reCAPTCHA/Roboto are not DNR-blocked in Balanced mode.
- [ ] YouTube/player, Gmail-like Material, ChatGPT-like UI, and reCAPTCHA font benign fixtures remain present.
- [ ] Selector-driven CSS exfil fixtures with sensitive attributes plus remote sinks still produce actionable findings.
- [ ] `pnpm run audit:false-positives -- --limit 100 --save-reports actionable` can be run as a development-only common-site sweep when preparing a publication candidate. Its output remains under `test-results/` and is not committed as runtime data.
