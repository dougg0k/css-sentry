import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OptionsApp from "../../../src/entrypoints/options/OptionsApp";
import PopupApp from "../../../src/entrypoints/popup/App";
import ReportApp from "../../../src/entrypoints/report/ReportApp";
import { browser } from "wxt/browser";
import { STORAGE_KEYS, DEFAULT_SITE_POLICY, EMPTY_ANALYSIS_SUMMARY } from "../../../src/shared/constants";

describe("React UI", () => {
  it("renders options with balanced default, standard controls, and advanced toggle in compatibility/privacy", async () => {
    render(<OptionsApp />);
    await waitFor(() => expect(screen.getByText("Default protection mode")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Balanced:/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Origin rules")).toBeInTheDocument();
    expect(screen.getByText("Compatibility and privacy")).toBeInTheDocument();
    expect(screen.getByLabelText(/show advanced options/i)).not.toBeChecked();
    expect(screen.getByLabelText(/show advanced options/i).closest("section")?.textContent).toContain("Compatibility and privacy");
    expect(screen.getByText("Local reports and settings")).toBeInTheDocument();
    expect(screen.getAllByText(/Logs are local reports/).length).toBeGreaterThan(0);
    expect(screen.getByText("Mode explanations")).toBeInTheDocument();
    expect(screen.getAllByText("Detect and record findings only.").length).toBeGreaterThan(0);
    expect(screen.getByText(/Scans CSS and stores local findings, but avoids blocking or sanitizing/)).toBeInTheDocument();
    expect(screen.getAllByText(/Use when:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Warn and block high-confidence exfiltration attempts.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fail closed on sensitive sites.").length).toBeGreaterThan(0);
    expect(screen.getByText("Do not scan or mitigate this origin.")).toBeInTheDocument();
    expect(screen.getByText(/Marks the origin as trusted/)).toBeInTheDocument();
    expect(screen.getByText("Temporarily disable protection for this origin.")).toBeInTheDocument();
    expect(screen.getByText(/Stops scanning and mitigation for the origin/)).toBeInTheDocument();
    expect(screen.getByText("Always scan, but never alter or block the page.")).toBeInTheDocument();
    expect(screen.getByText("Completely disable CSS Sentry for this origin.")).toBeInTheDocument();
    expect(screen.queryByText("Allowed destination origins")).not.toBeInTheDocument();
    expect(screen.queryByText("Enable Firefox enhanced stylesheet response inspection")).not.toBeInTheDocument();
      });

  it("reveals advanced origin and compatibility controls when advanced options are enabled", async () => {
    render(<OptionsApp />);
    await waitFor(() => expect(screen.getByText("Compatibility and privacy")).toBeInTheDocument());
    expect(screen.getByText("Never fetch remote CSS from the extension")).toBeInTheDocument();
    expect(screen.getByText("Enable declarative network blocking")).toBeInTheDocument();
    expect(screen.getByText("Enable strict third-party resource blocking")).toBeInTheDocument();
    expect(screen.getByText("Show partial-analysis findings")).toBeInTheDocument();
    expect(screen.queryByText("Enable Firefox enhanced stylesheet response inspection")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/show advanced options/i));

    await waitFor(() => expect(screen.getByText("Enable Firefox enhanced stylesheet response inspection")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Trusted:/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Paused:/ })).toBeInTheDocument();
    expect(screen.getByText("Allowed destination origins")).toBeInTheDocument();
    expect(screen.getByText("Blocked destination origins")).toBeInTheDocument();
    expect(screen.getByText("Exact per-origin mode overrides")).toBeInTheDocument();
    expect(screen.getByText("Report external SVG image documents as partial coverage")).toBeInTheDocument();
    expect(screen.getByText("Apply Strict SVG image-document network policy")).toBeInTheDocument();
  });

  it("sanitizes invalid origins such as null from stored policy before rendering", async () => {
    await browser.storage.local.set({
      [STORAGE_KEYS.settings]: {
        ...DEFAULT_SITE_POLICY,
        trustedOrigins: ["https://null", "https://valid.example"],
        perOriginModes: { "https://null": "trusted", "https://valid.example": "strict" },
      },
    });
    render(<OptionsApp />);
    await waitFor(() => expect(screen.getByText("https://valid.example")).toBeInTheDocument());
    expect(screen.queryByText("https://null")).not.toBeInTheDocument();
  });

  it("renders popup standard global modes only when advanced options are disabled", async () => {
    render(<PopupApp />);
    await waitFor(() => expect(screen.getByText("Protection mode")).toBeInTheDocument());
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Balanced:/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Passive:/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Strict:/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Trusted:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Paused:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Always scan \/ never sanitize:/ })).not.toBeInTheDocument();
        expect(screen.queryByText("null")).not.toBeInTheDocument();
  });

  it("shows only advanced global popup modes when advanced options are enabled", async () => {
    await browser.storage.local.set({ [STORAGE_KEYS.settings]: { ...DEFAULT_SITE_POLICY, advancedModeEnabled: true } });
    render(<PopupApp />);
    await waitFor(() => expect(screen.getByText("Protection mode")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Trusted:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Paused:/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Always scan \/ never sanitize:/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Never scan \/ never sanitize:/ })).toBeInTheDocument();
  });

  it("saves a global-mode update from the popup and settings reflects the same mode", async () => {
    render(<PopupApp />);
    await waitFor(() => expect(screen.getByText("Protection mode")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Strict:/ }));

    await waitFor(() => expect(screen.getByRole("button", { name: /Strict:/ })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("button", { name: /Balanced:/ })).toHaveAttribute("aria-pressed", "false");

    const stored = await browser.storage.local.get(STORAGE_KEYS.settings);
    expect(stored[STORAGE_KEYS.settings]).toMatchObject({ mode: "strict" });
  });

  it("popup reflects global mode changed in settings", async () => {
    await browser.storage.local.set({ [STORAGE_KEYS.settings]: { ...DEFAULT_SITE_POLICY, mode: "passive" } });
    render(<PopupApp />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Passive:/ })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("button", { name: /Balanced:/ })).toHaveAttribute("aria-pressed", "false");
  });


  it("shows partial frame coverage in popup and report UI", async () => {
    const partialSummary = {
      ...EMPTY_ANALYSIS_SUMMARY,
      state: "analysis.partial" as const,
      findings: [],
      analyzedFrames: 1,
      partialFrames: 1,
      startedAt: 1,
      finishedAt: 2,
    };
    await browser.storage.local.set({
      [`${STORAGE_KEYS.reportsPrefix}1`]: {
        tabId: 1,
        url: "https://app.example.test/",
        origin: "https://app.example.test",
        summary: partialSummary,
        updatedAt: Date.now(),
        frames: [{
          frameId: 2,
          parentFrameId: 0,
          frameUrl: "https://third-party.example.test/mail",
          frameOrigin: "https://third-party.example.test",
          summary: partialSummary,
          updatedAt: Date.now(),
        }],
      },
    });

    render(<PopupApp />);
    await waitFor(() => expect(screen.getByText(/Partial frame coverage/)).toBeInTheDocument());

    render(<ReportApp />);
    await waitFor(() => expect(screen.getByText("Frame URL")).toBeInTheDocument());
    expect(screen.getByText("Parent frame")).toBeInTheDocument();
    expect(screen.getByText("https://third-party.example.test/mail")).toBeInTheDocument();
  });



  it("popup explains whether findings changed the page or were only logged", async () => {
    const now = Date.now();
    const summary = {
      ...EMPTY_ANALYSIS_SUMMARY,
      findings: [
        {
          id: "logged-1",
          severity: "medium" as const,
          confidence: 76,
          pageUrl: "https://app.example.test/",
          pageOrigin: "https://app.example.test",
          frameUrl: "https://app.example.test/",
          frameOrigin: "https://app.example.test",
          sourceKind: "style_element" as const,
          sourceUrl: "https://app.example.test/",
          sourceOrigin: "https://app.example.test",
          selector: "input[value^=a]",
          property: "background-image",
          destinationOrigin: "https://attacker.example",
          destinationUrl: "https://attacker.example/a",
          action: "logged" as const,
          state: "analysis.complete" as const,
          reasons: ["selector.attribute.prefix_match", "sink.remote_url", "url.cross_origin"] as const,
          timestamp: now,
          details: "CSS rule with sensitive selector signals uses background-image with 1 remote URL sink(s).",
        },
        {
          id: "coverage-1",
          severity: "info" as const,
          confidence: 100,
          pageUrl: "https://app.example.test/",
          pageOrigin: "https://app.example.test",
          frameUrl: "https://app.example.test/",
          frameOrigin: "https://app.example.test",
          sourceKind: "stylesheet" as const,
          sourceUrl: "https://cdn.example.test/app.css",
          sourceOrigin: "https://cdn.example.test",
          selector: null,
          property: null,
          destinationOrigin: null,
          destinationUrl: null,
          action: "logged" as const,
          state: "stylesheet.cross_origin_uninspectable" as const,
          reasons: ["stylesheet.cross_origin.uninspectable"] as const,
          timestamp: now,
          details: "Stylesheet rules were not inspectable.",
        }
      ],
      analyzedFrames: 1,
      analyzedStylesheets: 1,
      partialStylesheets: 1,
      startedAt: 1,
      finishedAt: 2,
    };
    await browser.storage.local.set({
      [`${STORAGE_KEYS.reportsPrefix}1`]: {
        tabId: 1,
        url: "https://app.example.test/",
        origin: "https://app.example.test",
        summary,
        updatedAt: now,
        frames: [],
      },
    });

    render(<PopupApp />);
    await waitFor(() => expect(screen.getByText("No page changes made")).toBeInTheDocument());
    expect(screen.getAllByText("Logged only").length).toBeGreaterThan(0);
    expect(screen.getByText("Coverage notice")).toBeInTheDocument();
    expect(screen.getByText(/no request was blocked/i)).toBeInTheDocument();
  });

  it("renders local report page actions", async () => {
    render(<ReportApp />);
    await waitFor(() => expect(screen.getByText("Finding report")).toBeInTheDocument());
    expect(screen.getByText("Export JSON")).toBeInTheDocument();
    expect(screen.getByText("Clear reports")).toBeInTheDocument();
  });
});
