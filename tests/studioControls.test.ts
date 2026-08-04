import { describe, expect, it, vi } from "vitest";
import {
  isTargetOutside,
  nextPromptPosition,
  promptAnchor,
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
      }),
    });

    expect(loadStudioPreferences(storage)).toEqual({
      devicesEnabled: true,
      cameraId: "camera-2",
      microphoneId: "microphone-3",
      fontSize: 54,
      promptPosition: "upper",
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
    });
  });
});
