import { describe, expect, it } from "vitest";
import {
  maximumCameraResolution,
  maximumResolutionConstraints,
  recordingVideoBitrate,
} from "../src/lib/cameraRecording";

describe("camera recording quality", () => {
  it("uses a very high ideal when camera capabilities are unavailable", () => {
    expect(maximumCameraResolution).toEqual({
      width: { ideal: 16_384 },
      height: { ideal: 16_384 },
    });
  });

  it("requests the maximum width and height reported by the camera", () => {
    const constraints = maximumResolutionConstraints({
      width: { min: 320, max: 3840 },
      height: { min: 240, max: 2160 },
    } as MediaTrackCapabilities);

    expect(constraints).toEqual({
      width: { ideal: 3840 },
      height: { ideal: 2160 },
    });
  });

  it("scales recording bitrate with the negotiated resolution", () => {
    expect(
      recordingVideoBitrate({ width: 1920, height: 1080, frameRate: 30 }),
    ).toBe(11_197_440);
    expect(
      recordingVideoBitrate({ width: 3840, height: 2160, frameRate: 30 }),
    ).toBe(44_789_760);
  });

  it("caps extreme modes at a recorder-safe bitrate", () => {
    expect(
      recordingVideoBitrate({ width: 7680, height: 4320, frameRate: 60 }),
    ).toBe(100_000_000);
    expect(recordingVideoBitrate({})).toBeUndefined();
  });
});
