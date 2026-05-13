import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";
import { ANALYSIS_LIMITS } from "../shared/constants";
import { effectiveModeForUrl, shouldScan } from "../core/policy/mode";
import { getSitePolicy } from "../browser/storage/reports";
import { scanDocument } from "../browser/scanner/scanDocument";
import { applyContentNeutralization } from "../browser/scanner/contentNeutralization";
import type { AnalysisSummary } from "../shared/types";

let debounceTimer: number | undefined;
let lastSummary: AnalysisSummary | null = null;

export default defineContentScript({
	matches: ["<all_urls>"],
	runAt: "document_start",
	allFrames: true,
	async main() {
		const policy = await getSitePolicy();
		const mode = effectiveModeForUrl(location.href, policy);
		if (!shouldScan(mode)) return;

		const runScan = () => {
			const scannedSummary = scanDocument(document, policy);
			lastSummary = applyContentNeutralization(document, scannedSummary, policy, mode).summary;
			void browser.runtime.sendMessage({
				type: "css-sentry:scan-complete",
				url: location.href,
				summary: lastSummary,
			});
		};

		const scheduleScan = () => {
			if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
			debounceTimer = window.setTimeout(runScan, ANALYSIS_LIMITS.mutationDebounceMs);
		};

		if (document.readyState === "loading") {
			runScan();
			document.addEventListener("DOMContentLoaded", runScan, { once: true });
			window.addEventListener("load", runScan, { once: true });
		} else {
			runScan();
			if (document.readyState !== "complete") window.addEventListener("load", runScan, { once: true });
		}

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === "attributes") {
					scheduleScan();
					return;
				}
				for (const node of Array.from(mutation.addedNodes)) {
					if (node.nodeType !== Node.ELEMENT_NODE) continue;
					const element = node as Element;
					if (element.matches("style,link[rel~='stylesheet'],[style],body[background],feImage,animate,animateTransform,animateMotion,set,img[src],image[href],object[data],embed[src]") || element.querySelector("style,link[rel~='stylesheet'],[style],body[background],feImage,animate,animateTransform,animateMotion,set,img[src],image[href],object[data],embed[src]")) {
						scheduleScan();
						return;
					}
				}
			}
		});
		observer.observe(document.documentElement, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["style", "background", "href", "xlink:href", "values", "from", "to", "by", "attributeName"],
		});
	},
});
