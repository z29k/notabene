import { describe, expect, it } from "vitest";
import { composeAuthor, displayName, isLoopbackHost, parseAuthor } from "../src/lib/client/comments-client";

describe("composeAuthor", () => {
  it("embeds the email git-style when present", () => {
    expect(composeAuthor("Ada Lovelace", "ada@x.io")).toBe("Ada Lovelace <ada@x.io>");
  });
  it("is just the name when no email", () => {
    expect(composeAuthor("Ada Lovelace", "")).toBe("Ada Lovelace");
    expect(composeAuthor("  Ada  ", "  ")).toBe("Ada");
  });
});

describe("parseAuthor", () => {
  it("splits Name <email>", () => {
    expect(parseAuthor("Ada Lovelace <ada@x.io>")).toEqual({ name: "Ada Lovelace", email: "ada@x.io" });
  });
  it("handles a bare name", () => {
    expect(parseAuthor("Ada Lovelace")).toEqual({ name: "Ada Lovelace", email: "" });
  });
  it("round-trips with composeAuthor", () => {
    for (const [n, e] of [
      ["Ada", "ada@x.io"],
      ["Grace Hopper", ""],
    ] as const) {
      expect(parseAuthor(composeAuthor(n, e))).toEqual({ name: n, email: e });
    }
  });
});

describe("displayName", () => {
  it("strips the email for display", () => {
    expect(displayName("Ada Lovelace <ada@x.io>")).toBe("Ada Lovelace");
    expect(displayName("you")).toBe("you");
  });
});

describe("isLoopbackHost", () => {
  it("recognizes loopback hosts (local → no gate)", () => {
    for (const h of ["localhost", "127.0.0.1", "127.1.2.3", "::1", "[::1]", "0.0.0.0", "app.localhost"]) {
      expect(isLoopbackHost(h)).toBe(true);
    }
  });
  it("treats LAN / deployed hosts as remote (→ gate)", () => {
    for (const h of ["192.168.1.20", "10.0.0.5", "docs.example.com", "my-host"]) {
      expect(isLoopbackHost(h)).toBe(false);
    }
  });
});
