import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";
import { effectiveModeForUrl, shouldScan } from "../core/policy/mode";
import type { ExtensionMode } from "../shared/types";
import { getSitePolicy } from "../browser/storage/reports";
import { scanDocument } from "../browser/scanner/scanDocument";
import { applyContentNeutralization } from "../browser/scanner/contentNeutralization";
import { createDocumentScanController } from "../browser/scanner/documentScanController";
import {
  publishTestLabReportDiagnostic,
  publishTestLabScanDiagnostic,
  publishTestLabScanDisabledDiagnostic,
} from "../browser/scanner/testLabDiagnostics";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  allFrames: true,
  async main() {
    const policy = await getSitePolicy();
    const mode = effectiveModeForUrl(location.href, policy);
    if (!shouldScan(mode)) {
      publishScanDisabledDiagnosticAtReadyBoundaries(document, window, mode);
      return;
    }

    createDocumentScanController({
      document,
      windowTarget: window,
      policy,
      mode,
      scanDocument,
      applyContentNeutralization,
      async sendScanComplete(summary) {
        publishTestLabScanDiagnostic(document, summary, mode);
        try {
          const response = await browser.runtime.sendMessage({
            type: "css-sentry:scan-complete",
            url: location.href,
            summary,
          });
          publishTestLabReportDiagnostic(document, response);
        } catch {
          publishTestLabReportDiagnostic(document, null);
        }
      },
    }).start();
  },
});

function publishScanDisabledDiagnosticAtReadyBoundaries(
  documentRef: Document,
  windowTarget: Window,
  mode: ExtensionMode,
): void {
  let published = publishTestLabScanDisabledDiagnostic(documentRef, mode);
  if (published || documentRef.readyState === "complete") return;

  const publishIfNeeded = (): void => {
    if (published) return;
    published = publishTestLabScanDisabledDiagnostic(documentRef, mode);
  };

  if (documentRef.readyState === "loading") {
    documentRef.addEventListener("DOMContentLoaded", publishIfNeeded, { once: true });
  }
  windowTarget.addEventListener("load", publishIfNeeded, { once: true });
}
