import { describe, expect, it, vi } from "vitest";
import { tokenizeScript, wordsFromText } from "../src/lib/alignment";
import { collectRecognitionUpdate } from "../src/lib/speechResults";
import {
  allowStudioExit,
  RECORDING_EXIT_MESSAGE,
} from "../src/lib/studioNavigation";

describe("PR #1 review fixes", () => {
  it("uses the same word count for alignment and rendered prompt tokens", () => {
    const script = "A camera-ready presenter can't drift off-script.";
    const tokens = tokenizeScript(script);

    expect(tokens.map((token) => token.display).join("")).toBe(script);
    expect(tokens.map((token) => token.normalized)).toEqual(
      wordsFromText(script),
    );
    expect(tokens.map((token) => token.normalized)).toEqual([
      "a",
      "camera",
      "ready",
      "presenter",
      "can't",
      "drift",
      "off",
      "script",
    ]);
  });

  it("excludes an old finalized phrase from a new recognition decision", () => {
    const processed = new Set([0]);
    const update = collectRecognitionUpdate(
      [
        { transcript: "welcome to prompter", isFinal: true },
        { transcript: "the weather is unrelated", isFinal: true },
      ],
      1,
      processed,
    );

    expect(update).toEqual({
      heard: "the weather is unrelated",
      newlyFinalized: 1,
    });
    expect(processed).toEqual(new Set([0, 1]));
  });

  it("does not count repeated delivery of the same final result twice", () => {
    const processed = new Set<number>();
    const results = [{ transcript: "new finalized words", isFinal: true }];

    expect(
      collectRecognitionUpdate(results, 0, processed).newlyFinalized,
    ).toBe(1);
    expect(
      collectRecognitionUpdate(results, 0, processed).newlyFinalized,
    ).toBe(0);
  });

  it("guards Studio exit only while a recording is active", () => {
    const confirmExit = vi.fn(() => false);

    expect(allowStudioExit(false, confirmExit)).toBe(true);
    expect(confirmExit).not.toHaveBeenCalled();
    expect(allowStudioExit(true, confirmExit)).toBe(false);
    expect(confirmExit).toHaveBeenCalledWith(RECORDING_EXIT_MESSAGE);
  });
});
