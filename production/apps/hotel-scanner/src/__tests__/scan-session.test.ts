import { describe, expect, it } from "vitest";
import { classifyLinen, normaliseCode, parseLinenCode, summarise, transitionViolation } from "../scan-session";
import type { TransitionCatalogue } from "../api";

describe("hotel scanner session helpers", () => {
  it("normalises tag codes and extracts codes from deep links", () => {
    expect(normaliseCode("  ll-abc123 ")).toBe("LL-ABC123");
    expect(parseLinenCode("https://lovelaundry.lk/scan?code=LL-A1B2C3")).toBe("LL-A1B2C3");
    expect(parseLinenCode("https://lovelaundry.lk/tag/LL-A1B2C3")).toBe("LL-A1B2C3");
    expect(parseLinenCode("https://example.com/home")).toBeNull();
  });

  it("classifies bath and pool towels and bedsheets", () => {
    expect(classifyLinen({ category: "Towel", description: "pool towel" })).toBe("pool_towel");
    expect(classifyLinen({ category: "Towel", item_type: "Bath Towel" })).toBe("bath_towel");
    expect(classifyLinen({ category: "Bedsheet", size: "single" })).toBe("single_bedsheet");
    expect(classifyLinen({ category: "Bedsheet", size: "double" })).toBe("double_bedsheet");
    expect(classifyLinen({ category: "BATH_MAT" })).toBe("other");
  });

  it("summarises distinct verified linen by category", () => {
    const summary = summarise([
      { code: "A", outcome: "queued", category: "bath_towel", verified: true, at: 1 },
      { code: "A", outcome: "duplicate", category: "bath_towel", verified: true, at: 2 },
      { code: "B", outcome: "accepted", category: "pool_towel", verified: true, at: 3 },
      { code: "C", outcome: "error", at: 4 },
    ]);
    expect(summary.distinct).toBe(2);
    expect(summary.bathTowels).toBe(1);
    expect(summary.poolTowels).toBe(1);
    expect(summary.verified).toBe(2);
    expect(summary.errors).toBe(1);
  });

  it("honours admin transition rules", () => {
    const catalogue: TransitionCatalogue = {
      statuses: [],
      violation_mode: "block",
      transition_rules: [{ from_status: "COLLECTED", to_statuses: ["AT_LAUNDRY"] }],
    };
    expect(transitionViolation(catalogue, "COLLECTED", "COLLECTED")).toContain("Cannot move");
    expect(transitionViolation(catalogue, "COLLECTED", "AT_LAUNDRY")).toBeNull();
    expect(transitionViolation(catalogue, "IN_STOCK", "COLLECTED")).toBeNull();
  });
});
