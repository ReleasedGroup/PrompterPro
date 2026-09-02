import type { ScriptWordToken } from "./alignment.js";

export const VIDEO_EXPORT_MIME_TYPE = "application/x-prompter-export";

export const VIDEO_EXPORT_FONTS = [
  { family: "Arial", label: "Arial" },
  { family: "Arial Black", label: "Arial Black" },
  { family: "Georgia", label: "Georgia" },
  { family: "Segoe UI", label: "Segoe UI" },
  { family: "Trebuchet MS", label: "Trebuchet" },
  { family: "Verdana", label: "Verdana" },
] as const;

export type VideoExportFont = (typeof VIDEO_EXPORT_FONTS)[number]["family"];
export type VideoExportMode = "clean" | "subtitles";
export type VideoAspectRatio = "original" | "landscape" | "vertical";
export type SubtitleTreatment = "background" | "outline";
export const DEFAULT_SUBTITLE_HIGHLIGHT_COLOR = "#D4FF6A";

export interface TimedWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface VideoRenderRequest {
  mode: VideoExportMode;
  aspectRatio: VideoAspectRatio;
  highlightColor: string;
  subtitleTreatment: SubtitleTreatment;
  fontFamily: VideoExportFont;
  words: TimedWord[];
  fadeToBlack: boolean;
  preserveQuality: boolean;
  videoDurationMs: number;
}

const MIN_WORD_DURATION_MS = 90;
const TYPICAL_WORD_DURATION_MS = 240;
const MODEL_RECOGNITION_DELAY_MS = 1_000;
export const FINAL_CAPTION_HOLD_MS = 1_500;
const MAX_LINE_WORDS = 8;
const MAX_LINE_CHARACTERS = 48;

function displayWord(token: ScriptWordToken): string {
  return token.display.trim().replaceAll(/\s+/g, " ");
}

/**
 * Backfills the words confirmed by one streaming-recognition update. The
 * recognizer confirms phrases rather than individual words, so the elapsed
 * time is distributed across the newly advanced script range.
 */
export function appendTimedScriptWords(
  existing: TimedWord[],
  scriptTokens: ScriptWordToken[],
  fromIndex: number,
  toIndex: number,
  observedAtMs: number,
): TimedWord[] {
  const startIndex = Math.max(0, Math.min(fromIndex, scriptTokens.length));
  const endIndex = Math.max(
    startIndex,
    Math.min(toIndex, scriptTokens.length),
  );
  const count = endIndex - startIndex;
  if (count === 0) return existing;

  const lastEndMs = existing.at(-1)?.endMs ?? 0;
  const observedEndMs = Math.max(
    lastEndMs + count * MIN_WORD_DURATION_MS,
    Math.round(observedAtMs - MODEL_RECOGNITION_DELAY_MS),
  );
  const estimatedStartMs = Math.max(
    lastEndMs,
    observedEndMs - count * TYPICAL_WORD_DURATION_MS,
  );
  const durationMs = (observedEndMs - estimatedStartMs) / count;
  const additions = scriptTokens
    .slice(startIndex, endIndex)
    .map((token, index) => ({
      text: displayWord(token),
      startMs: Math.round(estimatedStartMs + durationMs * index),
      endMs: Math.round(estimatedStartMs + durationMs * (index + 1)),
    }))
    .filter((word) => word.text.length > 0);

  return [...existing, ...additions];
}

export function captionPages(
  words: TimedWord[],
  aspectRatio: VideoAspectRatio = "original",
): TimedWord[][] {
  const pages: TimedWord[][] = [];
  let page: TimedWord[] = [];
  let characters = 0;
  const maxLineWords = aspectRatio === "vertical" ? 5 : MAX_LINE_WORDS;
  const maxLineCharacters =
    aspectRatio === "vertical" ? 28 : MAX_LINE_CHARACTERS;

  const finishPage = () => {
    if (page.length > 0) pages.push(page);
    page = [];
    characters = 0;
  };

  for (const word of words) {
    const nextCharacters = characters + (page.length > 0 ? 1 : 0) + word.text.length;
    if (
      page.length > 0 &&
      (page.length >= maxLineWords || nextCharacters > maxLineCharacters)
    ) {
      finishPage();
    }

    page.push(word);
    characters += (page.length > 1 ? 1 : 0) + word.text.length;

    if (
      page.length >= (aspectRatio === "vertical" ? 3 : 4) &&
      /[.!?]["'\u2019]?$/u.test(word.text)
    ) {
      finishPage();
    }
  }
  finishPage();

  return pages;
}

export function activeCaptionPage(
  words: TimedWord[],
  timeMs: number,
  aspectRatio: VideoAspectRatio = "original",
): { words: TimedWord[]; activeIndex: number } | null {
  const pages = captionPages(words, aspectRatio);
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const pageStart = page[0]?.startMs ?? 0;
    const lastWordEnd = page.at(-1)?.endMs ?? 0;
    const pageEnd =
      pages[pageIndex + 1]?.[0]?.startMs ??
      lastWordEnd + FINAL_CAPTION_HOLD_MS;
    if (timeMs < pageStart || timeMs >= pageEnd) continue;

    const activeIndex = page.findIndex(
      (word, index) =>
        timeMs >= word.startMs &&
        timeMs < (page[index + 1]?.startMs ?? word.endMs),
    );
    return {
      words: page,
      activeIndex: activeIndex < 0 ? page.length - 1 : activeIndex,
    };
  }
  return null;
}

export function makeCaptionExportBody(
  recording: Blob,
  request: VideoRenderRequest,
  audioRecording?: Blob,
): Blob {
  const metadata = new TextEncoder().encode(
    JSON.stringify({
      ...request,
      audioByteOffset: audioRecording ? recording.size : null,
    }),
  );
  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, metadata.byteLength);
  return new Blob(
    [header, metadata, recording, ...(audioRecording ? [audioRecording] : [])],
    {
      type: VIDEO_EXPORT_MIME_TYPE,
    },
  );
}
