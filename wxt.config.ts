import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  vite: () => ({
    build: { sourcemap: true }
  }),
  manifest: {
    name: "CSS Sentry",
    description: "Browser extension for detecting and reducing CSS-based data exfiltration risk.",
    permissions: ["storage", "declarativeNetRequest", "webNavigation", "webRequest"],
    host_permissions: ["<all_urls>"],
    action: { default_title: "CSS Sentry" },
    options_ui: { page: "options.html", open_in_tab: true },
    browser_specific_settings: {
      gecko: {
        id: "css-sentry@dougg0k",
        data_collection_permissions: { required: ["none"] }
      }
    }
  }
});
