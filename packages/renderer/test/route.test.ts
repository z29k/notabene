import { describe, expect, it } from "vitest";
import { makeRouteFor } from "../src/lib/client/comments-client";

// Nested space (docs/plans) must win over its parent (docs).
const route = makeRouteFor([
  { key: "docs", path: "docs" },
  { key: "plans", path: "docs/plans" },
]);

describe("makeRouteFor", () => {
  it("routes a page under the most specific root", () => {
    expect(route("docs/plans/services/x")).toBe("/plans/services/x");
  });
  it("routes a page under the parent root", () => {
    expect(route("docs/architecture/billing")).toBe("/docs/architecture/billing");
  });
  it("routes a root index to /<key>", () => {
    expect(route("docs")).toBe("/docs");
    expect(route("docs/plans")).toBe("/plans");
  });
  it("returns # for an unknown page", () => {
    expect(route("other/thing")).toBe("#");
  });
});
