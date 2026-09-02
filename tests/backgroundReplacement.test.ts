import { describe, expect, it } from "vitest";
import {
  backgroundAssetKind,
  buildIvfVideo,
  coverRect,
  foregroundAlpha,
  normalizeFrameRate,
  replacementVideoBitrate,
  stabilizeForegroundAlpha,
} from "../src/lib/backgroundReplacement";

describe("background replacement export", () => {
  it("accepts still images and videos only", () => {
    expect(backgroundAssetKind({ type: "image/jpeg" })).toBe("image");
    expect(backgroundAssetKind({ type: "video/mp4" })).toBe("video");
    expect(backgroundAssetKind({ type: "application/pdf" })).toBeNull();
  });

  it("center-crops replacement media to cover a landscape export", () => {
    expect(coverRect(1080, 1920, 1920, 1080)).toEqual({
      sourceX: 0,
      sourceY: 656.25,
      sourceWidth: 1080,
      sourceHeight: 607.5,
    });
    expect(coverRect(2560, 1080, 1920, 1080)).toEqual({
      sourceX: 320,
      sourceY: 0,
      sourceWidth: 1920,
      sourceHeight: 1080,
    });
  });

  it("feathers uncertain mask pixels while preserving confident foreground", () => {
    expect(foregroundAlpha(0.1)).toBe(0);
    expect(foregroundAlpha(0.52)).toBeGreaterThan(100);
    expect(foregroundAlpha(0.9)).toBe(255);
  });

  it("damps small mask changes but tracks real motion quickly", () => {
    const flickerUp = stabilizeForegroundAlpha(110, 150, 30);
    const flickerDown = stabilizeForegroundAlpha(150, 110, 30);
    const enteringFrame = stabilizeForegroundAlpha(0, 255, 30);

    expect(flickerUp).toBeGreaterThan(110);
    expect(flickerUp).toBeLessThan(150);
    expect(flickerDown).toBeGreaterThan(110);
    expect(flickerDown).toBeLessThan(150);
    expect(enteringFrame).toBeGreaterThan(180);
  });

  it("uses equivalent temporal smoothing time at higher frame rates", () => {
    const oneFrameAt30 = stabilizeForegroundAlpha(100, 180, 30);
    const firstFrameAt60 = stabilizeForegroundAlpha(100, 180, 60);
    const twoFramesAt60 = stabilizeForegroundAlpha(firstFrameAt60, 180, 60);
    expect(twoFramesAt60).toBeCloseTo(oneFrameAt30, 0);
  });

  it("keeps source bitrate or raises it to the native frame-rate quality target", () => {
    expect(replacementVideoBitrate(1920, 1080, 60)).toBe(22_394_880);
    expect(replacementVideoBitrate(1920, 1080, 30, 30_000_000)).toBe(
      30_000_000,
    );
    expect(replacementVideoBitrate(7680, 4320, 120)).toBe(100_000_000);
  });

  it("uses the measured source frame rate and rejects bogus capture rates", () => {
    expect(normalizeFrameRate(29.97)).toBe(29.97);
    expect(normalizeFrameRate(60)).toBe(60);
    expect(normalizeFrameRate(1_000)).toBe(30);
    expect(normalizeFrameRate(Number.NaN)).toBe(30);
  });

  it("writes the exact frame count and frame-rate timebase to IVF", async () => {
    const video = buildIvfVideo(
      [
        { data: new Uint8Array([1, 2, 3]).buffer, timestamp: 0 },
        { data: new Uint8Array([4, 5]).buffer, timestamp: 33_367 },
      ],
      1920,
      1080,
      29.97,
      "VP90",
    );
    const view = new DataView(await video.arrayBuffer());
    expect(new TextDecoder().decode(new Uint8Array(view.buffer, 0, 4))).toBe("DKIF");
    expect(view.getUint32(16, true)).toBe(29_970);
    expect(view.getUint32(20, true)).toBe(1_000);
    expect(view.getUint32(24, true)).toBe(2);
    expect(view.getUint32(32, true)).toBe(3);
  });
});
