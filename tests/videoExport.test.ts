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
  buildVideoFilter,
  hexToAssColor,
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

  it("compensates for the streaming model's one-second transcript delay", () => {
    const tokens = tokenizeScript("Make");
    const timed = appendTimedScriptWords([], tokens, 0, 1, 2_500);

    expect(timed).toEqual([{ text: "Make", startMs: 1_260, endMs: 1_500 }]);
  });

  it("groups a sentence into one lower-third line and finds its active word", () => {
    expect(captionPages(words)).toHaveLength(1);
    expect(activeCaptionPage(words, 520)).toMatchObject({ activeIndex: 2 });
    expect(activeCaptionPage(words, 1_200)).toMatchObject({ activeIndex: 3 });
    expect(activeCaptionPage(words, 2_500)).toBeNull();
  });

  it("serializes and validates the binary recording envelope", async () => {
    const body = makeCaptionExportBody(
      new Blob(["recording"], { type: "video/mp4" }),
      {
        mode: "subtitles",
        aspectRatio: "landscape",
        highlightColor: "#FF3366",
        subtitleTreatment: "outline",
        fontFamily: "Georgia",
        words,
        fadeToBlack: true,
        preserveQuality: true,
        videoDurationMs: 3_000,
      },
    );
    const parsed = parseCaptionExportBody(
      Buffer.from(await body.arrayBuffer()),
    );

    expect(parsed.request.fontFamily).toBe("Georgia");
    expect(parsed.request.aspectRatio).toBe("landscape");
    expect(parsed.request.highlightColor).toBe("#FF3366");
    expect(parsed.request.subtitleTreatment).toBe("outline");
    expect(parsed.request.words).toEqual(words);
    expect(parsed.request.fadeToBlack).toBe(true);
    expect(parsed.request.preserveQuality).toBe(true);
    expect(parsed.recording.toString()).toBe("recording");
    expect(parsed.audioRecording).toBeNull();
  });

  it("keeps separately rendered video and original audio tracks distinct", async () => {
    const body = makeCaptionExportBody(
      new Blob(["rendered-video"], { type: "video/x-ivf" }),
      {
        mode: "clean",
        aspectRatio: "vertical",
        highlightColor: "#D4FF6A",
        subtitleTreatment: "background",
        fontFamily: "Arial",
        words: [],
        fadeToBlack: false,
        preserveQuality: true,
        videoDurationMs: 3_000,
      },
      new Blob(["original-audio"], { type: "video/mp4" }),
    );
    const parsed = parseCaptionExportBody(
      Buffer.from(await body.arrayBuffer()),
    );

    expect(parsed.recording.toString()).toBe("rendered-video");
    expect(parsed.audioRecording?.toString()).toBe("original-audio");
  });

  it("renders a single-line ASS lower third with spoken-word highlighting", () => {
    const subtitles = buildAssSubtitles(words, "Arial Black");

    expect(subtitles).toContain("Style: LowerThird,Arial Black,60");
    expect(subtitles).toContain("\\c&H006AFFD4&");
    expect(subtitles).toContain("Make every");
    expect(subtitles.match(/Dialogue: 0/g)).toHaveLength(words.length);
    expect(subtitles).toContain("0:00:02.45");
  });

  it("uses a portrait-safe caption canvas and shorter lines for Shorts", () => {
    const portraitWords: TimedWord[] = [
      ...words,
      { text: "especially", startMs: 950, endMs: 1_150 },
      { text: "vertically", startMs: 1_150, endMs: 1_400 },
    ];
    const subtitles = buildAssSubtitles(
      portraitWords,
      "Arial Black",
      "vertical",
    );
    expect(captionPages(portraitWords, "vertical")).toHaveLength(2);
    expect(subtitles).toContain("PlayResX: 1080");
    expect(subtitles).toContain("PlayResY: 1920");
    expect(subtitles).toContain("Style: LowerThird,Arial Black,64");
  });

  it("renders a custom highlight colour with an outlined text treatment", () => {
    const subtitles = buildAssSubtitles(
      words,
      "Arial Black",
      "landscape",
      "#12ABEF",
      "outline",
    );
    expect(hexToAssColor("#12ABEF")).toBe("&H00EFAB12&");
    expect(subtitles).toContain("\\c&H00EFAB12&");
    expect(subtitles).toContain("&H00000000,-1,0,0,0,100,100,0.8,0,1,4,1,2");
  });

  it("builds optional subtitle and end-fade filters", () => {
    expect(buildVideoFilter({
      mode: "subtitles",
      aspectRatio: "landscape",
      highlightColor: "#D4FF6A",
      subtitleTreatment: "background",
      fontFamily: "Arial",
      words,
      fadeToBlack: true,
      preserveQuality: false,
      videoDurationMs: 12_500,
    })).toBe(
      "scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,setsar=1,ass=captions.ass,fade=t=out:st=11.500:d=1.000:color=black",
    );

    expect(buildVideoFilter({
      mode: "clean",
      aspectRatio: "original",
      highlightColor: "#D4FF6A",
      subtitleTreatment: "background",
      fontFamily: "Arial",
      words: [],
      fadeToBlack: false,
      preserveQuality: false,
      videoDurationMs: 12_500,
    })).toBeNull();

    expect(buildVideoFilter({
      mode: "clean",
      aspectRatio: "vertical",
      highlightColor: "#D4FF6A",
      subtitleTreatment: "outline",
      fontFamily: "Arial",
      words: [],
      fadeToBlack: false,
      preserveQuality: true,
      videoDurationMs: 12_500,
    })).toBe(
      "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1",
    );
  });
});
