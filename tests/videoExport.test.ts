import { describe, expect, it } from "vitest";
import { tokenizeScript } from "../src/lib/alignment";
import {
  activeCaptionPage,
  appendTimedScriptWords,
  captionPages,
  makeCaptionExportBody,
  type TimedWord,
} from "../src/lib/videoExport";
import {
  buildAssSubtitles,
  parseCaptionExportBody,
} from "../server/subtitleExport";

const words: TimedWord[] = [
  { text: "Make", startMs: 100, endMs: 300 },
  { text: "every", startMs: 300, endMs: 500 },
  { text: "word", startMs: 500, endMs: 700 },
  { text: "land.", startMs: 700, endMs: 950 },
];

describe("video subtitle export", () => {
  it("backfills phrase timestamps in chronological script order", () => {
    const tokens = tokenizeScript("Make every word land.");
    const first = appendTimedScriptWords([], tokens, 0, 2, 620);
    const completed = appendTimedScriptWords(first, tokens, 2, 4, 1_080);

    expect(completed.map((word) => word.text)).toEqual([
      "Make",
      "every",
      "word",
      "land.",
    ]);
    expect(completed[0].startMs).toBeGreaterThanOrEqual(0);
    expect(completed[2].startMs).toBe(completed[1].endMs);
    expect(completed[3].endMs).toBeGreaterThan(completed[3].startMs);
  });

  it("groups a sentence into one lower-third line and finds its active word", () => {
    expect(captionPages(words)).toHaveLength(1);
    expect(activeCaptionPage(words, 520)).toMatchObject({ activeIndex: 2 });
    expect(activeCaptionPage(words, 1_200)).toBeNull();
  });

  it("serializes and validates the binary recording envelope", async () => {
    const body = makeCaptionExportBody(
      new Blob(["recording"], { type: "video/mp4" }),
      { fontFamily: "Georgia", words },
    );
    const parsed = parseCaptionExportBody(
      Buffer.from(await body.arrayBuffer()),
    );

    expect(parsed.request.fontFamily).toBe("Georgia");
    expect(parsed.request.words).toEqual(words);
    expect(parsed.recording.toString()).toBe("recording");
  });

  it("renders a single-line ASS lower third with spoken-word highlighting", () => {
    const subtitles = buildAssSubtitles(words, "Arial Black");

    expect(subtitles).toContain("Style: LowerThird,Arial Black,60");
    expect(subtitles).toContain("\\c&H006AFFD4&");
    expect(subtitles).toContain("Make every");
    expect(subtitles.match(/Dialogue: 0/g)).toHaveLength(words.length);
  });
});
