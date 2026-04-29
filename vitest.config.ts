import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["tests/setup/vitest.setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/entrypoints/**/main.tsx", "src/**/*.d.ts"]
    }
  },
  resolve: {
    alias: {
      "wxt/browser": new URL("./tests/setup/browser-mock.ts", import.meta.url).pathname
    }
  }
});
