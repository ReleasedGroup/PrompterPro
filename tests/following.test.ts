import { describe, expect, it } from "vitest";
import type { AlignmentResult } from "../src/lib/alignment";
import { stabilizeAdvance } from "../src/lib/following";

function match(
  nextIndex: number,
  candidateStart = nextIndex - 6,
): AlignmentResult {
  return {
    matched: true,
    score: 0.82,
    nextIndex,
    candidateStart,
  };
}

describe("stable prompt advancement", () => {
  it("applies a nearby match immediately", () => {
    expect(stabilizeAdvance(20, match(27), null)).toEqual({
      nextIndex: 27,
      pending: null,
      confirmed: true,
    });
  });

  it("holds the first large jump as a pending candidate", () => {
    expect(stabilizeAdvance(20, match(47, 41), null)).toEqual({
      nextIndex: 20,
      pending: { candidateStart: 41, nextIndex: 47 },
      confirmed: false,
    });
  });

  it("applies a large jump after a second consistent result", () => {
    const first = stabilizeAdvance(20, match(47, 41), null);
    expect(stabilizeAdvance(20, match(49, 43), first.pending)).toEqual({
      nextIndex: 49,
      pending: null,
      confirmed: true,
    });
  });

  it("replaces an inconsistent large-jump candidate", () => {
    const first = stabilizeAdvance(20, match(47, 41), null);
    expect(stabilizeAdvance(20, match(66, 60), first.pending)).toEqual({
      nextIndex: 20,
      pending: { candidateStart: 60, nextIndex: 66 },
      confirmed: false,
    });
  });

  it("clears a pending jump after an unmatched result", () => {
    const first = stabilizeAdvance(20, match(47, 41), null);
    expect(
      stabilizeAdvance(
        20,
        {
          matched: false,
          score: 0.2,
          nextIndex: 20,
          candidateStart: 20,
        },
        first.pending,
      ),
    ).toEqual({
      nextIndex: 20,
      pending: null,
      confirmed: false,
    });
  });
});
