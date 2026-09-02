import { describe, expect, it, vi } from "vitest";
import {
  isTargetOutside,
  nextCaptionMode,
  nextPromptPosition,
  promptAnchor,
  promptLineRange,
} from "../src/lib/studioControls";
import {
  DEFAULT_STUDIO_PREFERENCES,
  loadStudioPreferences,
  updateStudioPreferences,
} from "../src/lib/studioPreferences";

function preferenceStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("Studio controls", () => {
  it("cycles through each prompt height", () => {
    expect(nextPromptPosition("upper")).toBe("middle");
    expect(nextPromptPosition("middle")).toBe("lower");
    expect(nextPromptPosition("lower")).toBe("upper");
  });

  it("places the reading line above, at, or below the center", () => {
    expect(promptAnchor("upper")).toBeLessThan(0.5);
    expect(promptAnchor("middle")).toBe(0.5);
    expect(promptAnchor("lower")).toBeGreaterThan(0.5);
  });

  it("cycles through each caption mode", () => {
    expect(nextCaptionMode("word")).toBe("line");
    expect(nextCaptionMode("line")).toBe("scroll");
    expect(nextCaptionMode("scroll")).toBe("word");
  });

  it("finds every word on the active visual line", () => {
    const offsets = [100, 100, 101, 152, 152, 204];

    expect(promptLineRange(offsets, 1)).toEqual({ start: 0, end: 2 });
    expect(promptLineRange(offsets, 4)).toEqual({ start: 3, end: 4 });
    expect(promptLineRange(offsets, 6)).toBeNull();
  });

  it("recognizes pointer targets outside the device menu", () => {
    const insideTarget = {} as EventTarget;
    const outsideTarget = {} as EventTarget;
    const boundary = {
      contains: vi.fn(
        (target: Node | null) => target === (insideTarget as unknown as Node),
      ),
    };

    expect(isTargetOutside(boundary, insideTarget)).toBe(false);
    expect(isTargetOutside(boundary, outsideTarget)).toBe(true);
    expect(isTargetOutside(null, outsideTarget)).toBe(false);
    expect(isTargetOutside(boundary, null)).toBe(false);
  });
});

describe("Studio preferences", () => {
  it("restores enabled devices, font size, and prompt height", () => {
    const storage = preferenceStorage({
      "prompter.studio.v1": JSON.stringify({
        devicesEnabled: true,
        cameraId: "camera-2",
        microphoneId: "microphone-3",
        fontSize: 54,
        promptPosition: "upper",
        captionMode: "line",
      }),
    });

    expect(loadStudioPreferences(storage)).toEqual({
      devicesEnabled: true,
      cameraId: "camera-2",
      microphoneId: "microphone-3",
      fontSize: 54,
      promptPosition: "upper",
      captionMode: "line",
      exportMode: "clean",
      exportAspectRatio: "original",
      exportFont: "Arial Black",
      exportHighlightColor: "#D4FF6A",
      exportSubtitleTreatment: "background",
      exportFadeToBlack: false,
    });
  });

  it("migrates an existing enabled device choice", () => {
    const storage = preferenceStorage({
      "prompter.devices.v1": JSON.stringify({
        cameraId: "legacy-camera",
        microphoneId: "legacy-microphone",
      }),
    });

    expect(loadStudioPreferences(storage)).toMatchObject({
      devicesEnabled: true,
      cameraId: "legacy-camera",
      microphoneId: "legacy-microphone",
    });
  });

  it("uses safe defaults for malformed preferences", () => {
    const storage = preferenceStorage({
      "prompter.studio.v1": JSON.stringify({
        devicesEnabled: "yes",
        cameraId: 123,
        fontSize: 200,
        promptPosition: "sideways",
        captionMode: "paragraph",
      }),
    });

    expect(loadStudioPreferences(storage)).toEqual({
      ...DEFAULT_STUDIO_PREFERENCES,
      fontSize: 72,
    });
  });

  it("updates one preference without discarding the others", () => {
    const storage = preferenceStorage();
    updateStudioPreferences(
      {
        devicesEnabled: true,
        cameraId: "camera-1",
        microphoneId: "microphone-1",
        fontSize: 50,
        promptPosition: "lower",
        captionMode: "scroll",
      },
      storage,
    );
    updateStudioPreferences({ fontSize: 58 }, storage);

    expect(loadStudioPreferences(storage)).toEqual({
      devicesEnabled: true,
      cameraId: "camera-1",
      microphoneId: "microphone-1",
      fontSize: 58,
      promptPosition: "lower",
      captionMode: "scroll",
      exportMode: "clean",
      exportAspectRatio: "original",
      exportFont: "Arial Black",
      exportHighlightColor: "#D4FF6A",
      exportSubtitleTreatment: "background",
      exportFadeToBlack: false,
    });
  });

  it("restores subtitle export style and font choices", () => {
    const storage = preferenceStorage({
      "prompter.studio.v1": JSON.stringify({
        exportMode: "subtitles",
        exportAspectRatio: "vertical",
        exportFont: "Georgia",
        exportHighlightColor: "#ff3366",
        exportSubtitleTreatment: "outline",
        exportFadeToBlack: true,
      }),
    });

    expect(loadStudioPreferences(storage)).toMatchObject({
      exportMode: "subtitles",
      exportAspectRatio: "vertical",
      exportFont: "Georgia",
      exportHighlightColor: "#FF3366",
      exportSubtitleTreatment: "outline",
      exportFadeToBlack: true,
    });
  });
});
