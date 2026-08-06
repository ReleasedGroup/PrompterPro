import { describe, expect, it } from "vitest";
import {
  advancePromptScroll,
  promptScrollSettled,
  type PromptScrollState,
} from "../src/lib/promptScroll";

function runFrames(
  state: PromptScrollState,
  target: number,
  count: number,
): PromptScrollState[] {
  const frames: PromptScrollState[] = [];
  for (let index = 0; index < count; index += 1) {
    state = advancePromptScroll(state, target, 1000 / 60);
    frames.push(state);
  }
  return frames;
}

describe("prompt scrolling", () => {
  it("accelerates and then decelerates into a new word position", () => {
    const frames = runFrames({ position: 0, velocity: 0 }, 100, 120);
    const peakVelocity = Math.max(...frames.map((frame) => frame.velocity));

    expect(frames[1].velocity).toBeGreaterThan(frames[0].velocity);
    expect(peakVelocity).toBeGreaterThan(frames[1].velocity);
    expect(frames.at(-1)).toEqual({ position: 100, velocity: 0 });
  });

  it("preserves momentum and decelerates before reversing", () => {
    const moving = { position: 30, velocity: 300 };
    const next = advancePromptScroll(moving, 0, 1000 / 60);

    expect(next.velocity).toBeGreaterThan(0);
    expect(next.velocity).toBeLessThan(moving.velocity);
  });

  it("caps long frames and reports a settled target", () => {
    const delayed = advancePromptScroll(
      { position: 0, velocity: 0 },
      100,
      10_000,
    );
    const capped = advancePromptScroll(
      { position: 0, velocity: 0 },
      100,
      32,
    );

    expect(delayed).toEqual(capped);
    expect(promptScrollSettled({ position: 100, velocity: 0 }, 100)).toBe(true);
  });
});
