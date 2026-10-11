import { describe, expect, it } from "vitest";
import { cn, formatPrice, initials, titleCase, truncate } from "./utils";

describe("utils", () => {
  it("cn filters falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("initials handles single and multi word names", () => {
    expect(initials("Ramesh Patil")).toBe("RP");
    expect(initials("Sunita")).toBe("S");
  });

  it("formatPrice renders quote and fixed pricing honestly", () => {
    expect(formatPrice({ type: "quote", currency: "INR" })).toBe("Quote");
    expect(formatPrice({ type: "fixed", amount: 500, currency: "INR" })).toBe("\u20B9500");
  });

  it("titleCase and truncate behave", () => {
    expect(titleCase("kolhapur")).toBe("Kolhapur");
    expect(truncate("hello world", 5)).toBe("hell\u2026");
  });
});