import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";
import { effectiveModeForUrl, shouldScan } from "../core/policy/mode";
import { getSitePolicy } from "../browser/storage/reports";
import { scanDocument } from "../browser/scanner/scanDocument";
import { applyContentNeutralization } from "../browser/scanner/contentNeutralization";
import { createDocumentScanController } from "../browser/scanner/documentScanController";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  allFrames: true,
  async main() {
    const policy = await getSitePolicy();
    const mode = effectiveModeForUrl(location.href, policy);
    if (!shouldScan(mode)) return;

    createDocumentScanController({
      document,
      windowTarget: window,
      policy,
      mode,
      scanDocument,
      applyContentNeutralization,
      sendScanComplete(summary) {
        return browser.runtime.sendMessage({
          type: "css-sentry:scan-complete",
          url: location.href,
          summary,
        });
      },
    }).start();
  },
});
