import { describe, expect, it } from "vitest";
import { GET } from "../../../website/src/pages/api/controlled-css/[sessionId].css";

const SESSION_ID = "00000000-0000-4000-8000-000000000000";

function request(path: string): Request {
  return new Request(`http://localhost:4321${path}`);
}

describe("website controlled CSS endpoint", () => {
  it("rejects invalid session identifiers", async () => {
    const response = await GET({
      params: { sessionId: "invalid.css" },
      request: request("/api/controlled-css/invalid.css?cases=attribute-selector"),
    } as never);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("");
  });

  it("emits selected controlled CSS with same-origin endpoints", async () => {
    const response = await GET({
      params: { sessionId: `${SESSION_ID}.css` },
      request: request(`/api/controlled-css/${SESSION_ID}.css?cases=import-rule,attribute-selector`),
    } as never);
    const css = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/css");
    expect(css.trim().startsWith('@import url("http://localhost:4321/test-assets/import-probe.css')).toBe(true);
    expect(css).toContain(`http://localhost:4321/api/hit/attribute-selector.svg?session=${SESSION_ID}`);
  });
});
