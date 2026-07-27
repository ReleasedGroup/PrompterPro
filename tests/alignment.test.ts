import { describe, expect, it } from "vitest";
import {
  alignTranscript,
  normalizeWord,
  wordsFromText,
} from "../src/lib/alignment";

const script = wordsFromText(
  "Welcome to PrompterPro. Today we are going to make recording feel natural and calm. Take a breath and look at the camera.",
);

describe("speech alignment", () => {
  it("normalizes punctuation, case, and curly apostrophes", () => {
    expect(normalizeWord("DON’T!")).toBe("don't");
    expect(wordsFromText("Hello, WORLD.")).toEqual(["hello", "world"]);
  });

  it("advances from the beginning on an exact phrase", () => {
    const result = alignTranscript(script, "Welcome to PrompterPro", 0);
    expect(result.matched).toBe(true);
    expect(result.nextIndex).toBe(3);
  });

  it("allows small filler-word differences", () => {
    const result = alignTranscript(
      script,
      "today we are actually going to make recording",
      3,
    );
    expect(result.matched).toBe(true);
    expect(result.nextIndex).toBeGreaterThan(8);
  });

  it("tolerates a small speech-recognition spelling error", () => {
    const result = alignTranscript(
      script,
      "recording feels natural and calm",
      9,
    );
    expect(result.matched).toBe(true);
    expect(result.nextIndex).toBeGreaterThan(12);
  });

  it("uses recent context to recover after a partial phrase", () => {
    const result = alignTranscript(
      script,
      "we are going to make recording feel",
      5,
    );
    expect(result.matched).toBe(true);
    expect(result.nextIndex).toBeGreaterThan(10);
  });

  it("does not move for unrelated speech", () => {
    const result = alignTranscript(
      script,
      "the weather forecast is entirely different",
      5,
    );
    expect(result.matched).toBe(false);
    expect(result.nextIndex).toBe(5);
  });

  it("resumes slightly behind the cursor", () => {
    const result = alignTranscript(
      script,
      "make recording feel natural and calm",
      11,
    );
    expect(result.matched).toBe(true);
    expect(result.nextIndex).toBeGreaterThanOrEqual(14);
  });

  it("finds a nearby phrase ahead of the cursor", () => {
    const result = alignTranscript(script, "take a breath and look", 9);
    expect(result.matched).toBe(true);
    expect(result.nextIndex).toBeGreaterThan(15);
  });

  it("keeps an empty transcript at the cursor", () => {
    expect(alignTranscript(script, "", 7)).toMatchObject({
      matched: false,
      nextIndex: 7,
    });
  });

  it("bounds the cursor at the end of the script", () => {
    const result = alignTranscript(script, "look at the camera", 10_000);
    expect(result.nextIndex).toBeLessThanOrEqual(script.length);
  });
});
