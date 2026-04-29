import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { __resetBrowserMock } from "./browser-mock";

afterEach(() => { __resetBrowserMock(); });
