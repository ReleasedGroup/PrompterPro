import {
  CAPTION_MODES,
  PROMPT_POSITIONS,
  type CaptionMode,
  type PromptPosition,
} from "./studioControls";
import {
  VIDEO_EXPORT_FONTS,
  type VideoExportFont,
  type VideoExportMode,
} from "./videoExport";

export interface StudioPreferences {
  devicesEnabled: boolean;
  cameraId: string;
  microphoneId: string;
  fontSize: number;
  promptPosition: PromptPosition;
  captionMode: CaptionMode;
  exportMode: VideoExportMode;
  exportFont: VideoExportFont;
}

interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STUDIO_PREFERENCES_KEY = "prompter.studio.v1";
const LEGACY_DEVICE_PREFERENCES_KEY = "prompter.devices.v1";
const MIN_FONT_SIZE = 26;
const MAX_FONT_SIZE = 72;

export const DEFAULT_STUDIO_PREFERENCES: StudioPreferences = {
  devicesEnabled: false,
  cameraId: "",
  microphoneId: "",
  fontSize: 42,
  promptPosition: "middle",
  captionMode: "word",
  exportMode: "clean",
  exportFont: "Arial Black",
};

function parseObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseDeviceId(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseFontSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_STUDIO_PREFERENCES.fontSize;
  }
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value));
}

function parsePromptPosition(value: unknown): PromptPosition {
  return PROMPT_POSITIONS.includes(value as PromptPosition)
    ? (value as PromptPosition)
    : DEFAULT_STUDIO_PREFERENCES.promptPosition;
}

function parseCaptionMode(value: unknown): CaptionMode {
  return CAPTION_MODES.includes(value as CaptionMode)
    ? (value as CaptionMode)
    : DEFAULT_STUDIO_PREFERENCES.captionMode;
}

function parseExportMode(value: unknown): VideoExportMode {
  return value === "subtitles" ? "subtitles" : "clean";
}

function parseExportFont(value: unknown): VideoExportFont {
  return VIDEO_EXPORT_FONTS.some((font) => font.family === value)
    ? (value as VideoExportFont)
    : DEFAULT_STUDIO_PREFERENCES.exportFont;
}

export function loadStudioPreferences(
  storage: PreferenceStorage = localStorage,
): StudioPreferences {
  try {
    const saved = parseObject(storage.getItem(STUDIO_PREFERENCES_KEY));
    const legacyDevices = parseObject(
      storage.getItem(LEGACY_DEVICE_PREFERENCES_KEY),
    );
    const cameraId = parseDeviceId(saved.cameraId ?? legacyDevices.cameraId);
    const microphoneId = parseDeviceId(
      saved.microphoneId ?? legacyDevices.microphoneId,
    );

    return {
      devicesEnabled:
        typeof saved.devicesEnabled === "boolean"
          ? saved.devicesEnabled
          : Boolean(cameraId || microphoneId),
      cameraId,
      microphoneId,
      fontSize: parseFontSize(saved.fontSize),
      promptPosition: parsePromptPosition(saved.promptPosition),
      captionMode: parseCaptionMode(saved.captionMode),
      exportMode: parseExportMode(saved.exportMode),
      exportFont: parseExportFont(saved.exportFont),
    };
  } catch {
    return { ...DEFAULT_STUDIO_PREFERENCES };
  }
}

export function updateStudioPreferences(
  updates: Partial<StudioPreferences>,
  storage: PreferenceStorage = localStorage,
): void {
  try {
    const preferences = { ...loadStudioPreferences(storage), ...updates };
    storage.setItem(STUDIO_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences are optional when storage is unavailable or blocked.
  }
}
