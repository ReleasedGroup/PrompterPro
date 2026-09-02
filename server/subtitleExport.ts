import {
  VIDEO_EXPORT_FONTS,
  DEFAULT_SUBTITLE_HIGHLIGHT_COLOR,
  FINAL_CAPTION_HOLD_MS,
  captionPages,
  type TimedWord,
  type VideoAspectRatio,
  type SubtitleTreatment,
  type VideoExportFont,
  type VideoRenderRequest,
} from "../src/lib/videoExport.js";

const MAX_METADATA_BYTES = 512 * 1024;
const MAX_CAPTION_WORDS = 10_000;
const MAX_VIDEO_DURATION_MS = 4 * 60 * 60 * 1_000;

export interface ParsedCaptionExport {
  recording: Buffer;
  audioRecording: Buffer | null;
  request: VideoRenderRequest;
}

const FADE_TO_BLACK_DURATION_MS = 1_000;

function isExportFont(value: unknown): value is VideoExportFont {
  return VIDEO_EXPORT_FONTS.some((font) => font.family === value);
}

function parseAspectRatio(value: unknown): VideoAspectRatio {
  if (typeof value === "undefined") return "original";
  if (value === "original" || value === "landscape" || value === "vertical") {
    return value;
  }
  throw new Error("Choose a supported video format.");
}

function parseHighlightColor(value: unknown): string {
  if (typeof value === "undefined") return DEFAULT_SUBTITLE_HIGHLIGHT_COLOR;
  if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) {
    return value.toUpperCase();
  }
  throw new Error("Choose a valid subtitle highlight colour.");
}

function parseSubtitleTreatment(value: unknown): SubtitleTreatment {
  if (typeof value === "undefined") return "background";
  if (value === "background" || value === "outline") return value;
  throw new Error("Choose a supported subtitle text treatment.");
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
  const candidate = metadata as Partial<VideoRenderRequest> & {
    audioByteOffset?: unknown;
  };
  if (candidate.mode !== "clean" && candidate.mode !== "subtitles") {
    throw new Error("Choose a supported video export style.");
  }
  if (!isExportFont(candidate.fontFamily)) {
    throw new Error("Choose a supported subtitle font.");
  }
  if (
    !Array.isArray(candidate.words) ||
    candidate.words.length > MAX_CAPTION_WORDS
  ) {
    throw new Error("The spoken-word timings are invalid.");
  }
  if (candidate.mode === "subtitles" && candidate.words.length === 0) {
    throw new Error("No spoken-word timings were supplied.");
  }
  if (typeof candidate.fadeToBlack !== "boolean") {
    throw new Error("The fade option is invalid.");
  }
  const videoDurationMs = Number(candidate.videoDurationMs);
  if (
    !Number.isFinite(videoDurationMs) ||
    videoDurationMs <= 0 ||
    videoDurationMs > MAX_VIDEO_DURATION_MS
  ) {
    throw new Error("The video duration is invalid.");
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

  const payload = body.subarray(metadataLength + 4);
  const audioByteOffset =
    candidate.audioByteOffset === null ||
    typeof candidate.audioByteOffset === "undefined"
      ? null
      : Number(candidate.audioByteOffset);
  if (
    audioByteOffset !== null &&
    (!Number.isSafeInteger(audioByteOffset) ||
      audioByteOffset <= 0 ||
      audioByteOffset >= payload.length)
  ) {
    throw new Error("The separate audio track is invalid.");
  }

  return {
    recording:
      audioByteOffset === null
        ? payload
        : payload.subarray(0, audioByteOffset),
    audioRecording:
      audioByteOffset === null ? null : payload.subarray(audioByteOffset),
    request: {
      mode: candidate.mode,
      aspectRatio: parseAspectRatio(candidate.aspectRatio),
      highlightColor: parseHighlightColor(candidate.highlightColor),
      subtitleTreatment: parseSubtitleTreatment(candidate.subtitleTreatment),
      fontFamily: candidate.fontFamily,
      words: parsedWords,
      fadeToBlack: candidate.fadeToBlack,
      preserveQuality: candidate.preserveQuality === true,
      videoDurationMs: Math.round(videoDurationMs),
    },
  };
}

export function buildVideoFilter(request: VideoRenderRequest): string | null {
  const filters: string[] = [];
  if (request.aspectRatio === "landscape") {
    filters.push(
      "scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos",
      "crop=1920:1080",
      "setsar=1",
    );
  } else if (request.aspectRatio === "vertical") {
    filters.push(
      "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos",
      "crop=1080:1920",
      "setsar=1",
    );
  }
  if (request.mode === "subtitles") filters.push("ass=captions.ass");
  if (request.fadeToBlack) {
    const fadeStartMs = Math.max(
      0,
      request.videoDurationMs - FADE_TO_BLACK_DURATION_MS,
    );
    filters.push(
      `fade=t=out:st=${(fadeStartMs / 1_000).toFixed(3)}:d=${(
        FADE_TO_BLACK_DURATION_MS / 1_000
      ).toFixed(3)}:color=black`,
    );
  }
  return filters.length > 0 ? filters.join(",") : null;
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

export function hexToAssColor(hexColor: string): string {
  const red = hexColor.slice(1, 3);
  const green = hexColor.slice(3, 5);
  const blue = hexColor.slice(5, 7);
  return `&H00${blue}${green}${red}&`;
}

function highlightedLine(
  words: TimedWord[],
  activeIndex: number,
  highlightColor: string,
): string {
  return words
    .map((word, index) => {
      const text = escapeAssText(word.text);
      if (index !== activeIndex) return text;
      return `{\\c${hexToAssColor(highlightColor)}\\b1\\fscx108\\fscy108}${text}{\\rLowerThird}`;
    })
    .join(" ");
}

export function buildAssSubtitles(
  words: TimedWord[],
  fontFamily: VideoExportFont,
  aspectRatio: VideoAspectRatio = "original",
  highlightColor = DEFAULT_SUBTITLE_HIGHLIGHT_COLOR,
  subtitleTreatment: SubtitleTreatment = "background",
): string {
  const events: string[] = [];
  const pages = captionPages(words, aspectRatio);
  const vertical = aspectRatio === "vertical";
  const playResX = vertical ? 1080 : 1920;
  const playResY = vertical ? 1920 : 1080;
  const fontSize = vertical ? 64 : 60;
  const horizontalMargin = vertical ? 72 : 76;
  const verticalMargin = vertical ? 270 : 92;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    for (let index = 0; index < page.length; index += 1) {
      const word = page[index];
      const nextWord = page[index + 1];
      const nextPageStartMs = pages[pageIndex + 1]?.[0]?.startMs;
      const endMs = Math.max(
        word.startMs + 80,
        nextWord?.startMs ??
          nextPageStartMs ??
          word.endMs + FINAL_CAPTION_HOLD_MS,
      );
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
          highlightedLine(page, index, highlightColor),
        ].join(","),
      );
    }
  }

  const borderStyle = subtitleTreatment === "outline" ? 1 : 3;
  const outlineWidth = subtitleTreatment === "outline" ? 4 : 11;
  const shadowDepth = subtitleTreatment === "outline" ? 1 : 0;
  const backColour = subtitleTreatment === "outline" ? "&H00000000" : "&H90060809";

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${playResX}`,
    `PlayResY: ${playResY}`,
    "ScaledBorderAndShadow: yes",
    "WrapStyle: 2",
    "",
    "[V4+ Styles]",
    "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
    `Style: LowerThird,${fontFamily},${fontSize},&H00F6F8F5,&H00F6F8F5,&H00101010,${backColour},-1,0,0,0,100,100,0.8,0,${borderStyle},${outlineWidth},${shadowDepth},2,${horizontalMargin},${horizontalMargin},${verticalMargin},1`,
    "",
    "[Events]",
    "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
    ...events,
    "",
  ].join("\r\n");
}
