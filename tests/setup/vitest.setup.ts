import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { browser } from "wxt/browser";

type BrowserMockWithReset = typeof browser & {
  __resetBrowserMock(): void;
};

function resetAliasedBrowserMock(): void {
  (browser as BrowserMockWithReset).__resetBrowserMock();
}

beforeEach(() => {
  resetAliasedBrowserMock();
});

afterEach(() => {
  cleanup();
  resetAliasedBrowserMock();
});
