import { describe, expect, it, vi } from "vitest";
import {
  isTargetOutside,
  nextPromptPosition,
  promptAnchor,
} from "../src/lib/studioControls";

describe("Studio controls", () => {
  it("cycles through each prompt height", () => {
    expect(nextPromptPosition("upper")).toBe("middle");
    expect(nextPromptPosition("middle")).toBe("lower");
    expect(nextPromptPosition("lower")).toBe("upper");
  });

  it("places the reading line above, at, or below the center", () => {
    expect(promptAnchor("upper")).toBeLessThan(0.5);
    expect(promptAnchor("middle")).toBe(0.5);
    expect(promptAnchor("lower")).toBeGreaterThan(0.5);
  });

  it("recognizes pointer targets outside the device menu", () => {
    const insideTarget = {} as EventTarget;
    const outsideTarget = {} as EventTarget;
    const boundary = {
      contains: vi.fn(
        (target: Node | null) => target === (insideTarget as unknown as Node),
      ),
    };

    expect(isTargetOutside(boundary, insideTarget)).toBe(false);
    expect(isTargetOutside(boundary, outsideTarget)).toBe(true);
    expect(isTargetOutside(null, outsideTarget)).toBe(false);
    expect(isTargetOutside(boundary, null)).toBe(false);
  });
});
