import { defineConfig } from "wxt";

const BASE_PERMISSIONS = ["storage", "declarativeNetRequest", "webNavigation"] as const;
const FIREFOX_ENHANCED_PERMISSIONS_MV2 = ["webRequest", "webRequestBlocking"] as const;
const FIREFOX_ENHANCED_PERMISSIONS_MV3 = ["webRequest", "webRequestBlocking", "webRequestFilterResponse"] as const;

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  vite: () => ({
    build: { sourcemap: false }
  }),
  manifest: ({ browser, manifestVersion }) => {
    const firefoxPermissions = manifestVersion === 3
      ? FIREFOX_ENHANCED_PERMISSIONS_MV3
      : FIREFOX_ENHANCED_PERMISSIONS_MV2;

    return {
      name: "CSS Sentry",
      description: "Browser extension for detecting and reducing CSS-based data exfiltration risk.",
      permissions: browser === "firefox"
        ? [...BASE_PERMISSIONS, ...firefoxPermissions]
        : [...BASE_PERMISSIONS],
      host_permissions: ["<all_urls>"],
      action: { default_title: "CSS Sentry" },
      options_ui: { page: "options.html", open_in_tab: true },
      browser_specific_settings: browser === "firefox" ? {
        gecko: {
          id: "css-sentry@dougg0k",
          data_collection_permissions: { required: ["none"] }
        }
      } : undefined
    };
  }
});
