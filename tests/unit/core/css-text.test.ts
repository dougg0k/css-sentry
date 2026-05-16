import { describe, expect, it } from "vitest";
import { cssUnescape, stripCssComments } from "../../../src/core/css/text";

describe("CSS text helpers", () => {
  it("strips comments from large generated CSS without regex replacement", () => {
    const css = `${".generated{display:block}\n".repeat(5000)}/* hidden */.probe{background:url("https://example.test/pixel.svg")}`;

    const stripped = stripCssComments(css);

    expect(stripped).not.toContain("hidden");
    expect(stripped).toContain(".probe");
  });

  it("unescapes simple and hexadecimal CSS escapes without global replace", () => {
    expect(cssUnescape("session\\_token")).toBe("session_token");
    expect(cssUnescape("\\43 SS")).toBe("CSS");
    expect(cssUnescape("\\0 ")).toBe("�");
  });
});
