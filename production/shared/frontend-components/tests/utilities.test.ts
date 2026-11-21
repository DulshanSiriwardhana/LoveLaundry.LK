import { describe, expect, it } from "vitest";
import { cx } from "../src/utilities";

describe("cx class combiner", () => {
  it("joins truthy class names in order", () => {
    expect(cx("panel", "panel-title")).toBe("panel panel-title");
  });

  it("drops false, null, and undefined parts", () => {
    expect(cx("panel", false, null, undefined, "active")).toBe("panel active");
  });

  it("returns an empty string when nothing is truthy", () => {
    expect(cx(false, null, undefined)).toBe("");
  });
});
