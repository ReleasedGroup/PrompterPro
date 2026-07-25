import { describe, expect, it, vi } from "vitest";
import { tokenizeScript, wordsFromText } from "../src/lib/alignment";
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

  it("guards Studio exit only while a recording is active", () => {
    const confirmExit = vi.fn(() => false);

    expect(allowStudioExit(false, confirmExit)).toBe(true);
    expect(confirmExit).not.toHaveBeenCalled();
    expect(allowStudioExit(true, confirmExit)).toBe(false);
    expect(confirmExit).toHaveBeenCalledWith(RECORDING_EXIT_MESSAGE);
  });
});
