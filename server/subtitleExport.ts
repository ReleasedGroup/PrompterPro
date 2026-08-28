import {
  VIDEO_EXPORT_FONTS,
  captionPages,
  type CaptionExportRequest,
  type TimedWord,
  type VideoExportFont,
} from "../src/lib/videoExport.js";

const MAX_METADATA_BYTES = 512 * 1024;
const MAX_CAPTION_WORDS = 10_000;
const MAX_VIDEO_DURATION_MS = 4 * 60 * 60 * 1_000;

export interface ParsedCaptionExport {
  recording: Buffer;
  request: CaptionExportRequest;
}

function isExportFont(value: unknown): value is VideoExportFont {
  return VIDEO_EXPORT_FONTS.some((font) => font.family === value);
}

function parseWord(value: unknown): TimedWord | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<TimedWord>;
  const text = typeof candidate.text === "string"
    ? candidate.text.trim().replaceAll(/\s+/g, " ").slice(0, 80)
    : "";
  const startMs = Number(candidate.startMs);
  const endMs = Number(candidate.endMs);

  if (
    !text ||
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    startMs < 0 ||
    endMs <= startMs ||
    endMs > MAX_VIDEO_DURATION_MS
  ) {
    return null;
  }

  return {
    text,
    startMs: Math.round(startMs),
    endMs: Math.round(endMs),
  };
}

export function parseCaptionExportBody(body: Buffer): ParsedCaptionExport {
  if (body.length < 5) throw new Error("The caption export is empty.");
  const metadataLength = body.readUInt32BE(0);
  if (
    metadataLength === 0 ||
    metadataLength > MAX_METADATA_BYTES ||
    metadataLength + 4 >= body.length
  ) {
    throw new Error("The caption export metadata is invalid.");
  }

  let metadata: unknown;
  try {
    metadata = JSON.parse(body.subarray(4, metadataLength + 4).toString("utf8"));
  } catch {
    throw new Error("The caption export metadata is not valid JSON.");
  }

  if (typeof metadata !== "object" || metadata === null) {
    throw new Error("The caption export options are invalid.");
  }
  const candidate = metadata as Partial<CaptionExportRequest>;
  if (!isExportFont(candidate.fontFamily)) {
    throw new Error("Choose a supported subtitle font.");
  }
  if (
    !Array.isArray(candidate.words) ||
    candidate.words.length === 0 ||
    candidate.words.length > MAX_CAPTION_WORDS
  ) {
    throw new Error("No spoken-word timings were supplied.");
  }

  const words = candidate.words.map(parseWord);
  if (words.some((word) => word === null)) {
    throw new Error("One or more spoken-word timings are invalid.");
  }
  const parsedWords = words as TimedWord[];
  for (let index = 1; index < parsedWords.length; index += 1) {
    if (parsedWords[index].startMs < parsedWords[index - 1].endMs) {
      throw new Error("Spoken-word timings must be chronological.");
    }
  }

  return {
    recording: body.subarray(metadataLength + 4),
    request: { fontFamily: candidate.fontFamily, words: parsedWords },
  };
}

function escapeAssText(text: string): string {
  return text
    .replaceAll("\\", "\\\\")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("\n", " ")
    .replaceAll("\r", " ");
}

function formatAssTime(milliseconds: number): string {
  const centiseconds = Math.max(0, Math.round(milliseconds / 10));
  const hours = Math.floor(centiseconds / 360_000);
  const minutes = Math.floor((centiseconds % 360_000) / 6_000);
  const seconds = Math.floor((centiseconds % 6_000) / 100);
  const remainder = centiseconds % 100;
  return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${remainder.toString().padStart(2, "0")}`;
}

function highlightedLine(words: TimedWord[], activeIndex: number): string {
  return words
    .map((word, index) => {
      const text = escapeAssText(word.text);
      if (index !== activeIndex) return text;
      return `{\\c&H006AFFD4&\\b1\\fscx108\\fscy108}${text}{\\rLowerThird}`;
    })
    .join(" ");
}

export function buildAssSubtitles(
  words: TimedWord[],
  fontFamily: VideoExportFont,
): string {
  const events: string[] = [];
  for (const page of captionPages(words)) {
    for (let index = 0; index < page.length; index += 1) {
      const word = page[index];
      const nextWord = page[index + 1];
      const endMs = Math.max(word.startMs + 80, nextWord?.startMs ?? word.endMs);
      events.push(
        [
          "Dialogue: 0",
          formatAssTime(word.startMs),
          formatAssTime(endMs),
          "LowerThird",
          "",
          "0",
          "0",
          "0",
          "",
          highlightedLine(page, index),
        ].join(","),
      );
    }
  }

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1920",
    "PlayResY: 1080",
    "ScaledBorderAndShadow: yes",
    "WrapStyle: 2",
    "",
    "[V4+ Styles]",
    "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
    `Style: LowerThird,${fontFamily},60,&H00F6F8F5,&H00F6F8F5,&H00101010,&H90060809,-1,0,0,0,100,100,0.8,0,3,11,0,2,76,76,92,1`,
    "",
    "[Events]",
    "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
    ...events,
    "",
  ].join("\r\n");
}
