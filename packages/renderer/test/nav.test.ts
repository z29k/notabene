import { describe, expect, it } from "vitest";
import { humanize, navLabel, pageTitle } from "../src/lib/nav";

describe("humanize", () => {
  it("title-cases kebab/underscore segments", () => {
    expect(humanize("getting-started")).toBe("Getting Started");
    expect(humanize("billing_setup")).toBe("Billing Setup");
  });
  it("upcases known acronyms", () => {
    expect(humanize("api-reference")).toBe("API Reference");
    expect(humanize("dns-and-tls")).toBe("DNS and TLS");
  });
  it("keeps small words lowercase (except first)", () => {
    expect(humanize("state-of-the-art")).toBe("State of the Art");
  });
  it("splits camelCase", () => {
    expect(humanize("ipAddress")).toBe("IP Address");
  });
});

describe("navLabel", () => {
  it("maps readme/index to Overview", () => {
    expect(navLabel("readme")).toBe("Overview");
    expect(navLabel("docs/index")).toBe("Overview");
  });
  it("humanizes the last segment", () => {
    expect(navLabel("guide/getting-started")).toBe("Getting Started");
  });
});

describe("pageTitle", () => {
  it("prefers the first H1", () => {
    expect(pageTitle("# Real Title\n\nbody", "x/y")).toBe("Real Title");
  });
  it("falls back to the nav label", () => {
    expect(pageTitle("no heading here", "guide/getting-started")).toBe("Getting Started");
  });
});
