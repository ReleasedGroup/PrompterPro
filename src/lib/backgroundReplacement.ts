import {
  FilesetResolver,
  ImageSegmenter,
  type ImageSegmenterResult,
} from "@mediapipe/tasks-vision";

export type BackgroundAssetKind = "image" | "video";

export interface BackgroundReplacementProgress {
  phase: "loading" | "rotoscoping" | "encoding";
  progress: number;
}

export interface BackgroundReplacementOptions {
  frameRate?: number;
  videoBitsPerSecond?: number;
  onProgress?: (progress: BackgroundReplacementProgress) => void;
}

interface CoverRect {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
}

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH =
  "/mediapipe/models/selfie_segmenter_landscape.tflite";

export function backgroundAssetKind(
  file: Pick<File, "type">,
): BackgroundAssetKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export function coverRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): CoverRect {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  if (sourceRatio > targetRatio) {
    const width = sourceHeight * targetRatio;
    return {
      sourceX: (sourceWidth - width) / 2,
      sourceY: 0,
      sourceWidth: width,
      sourceHeight,
    };
  }
  const height = sourceWidth / targetRatio;
  return {
    sourceX: 0,
    sourceY: (sourceHeight - height) / 2,
    sourceWidth,
    sourceHeight: height,
  };
}

export function foregroundAlpha(confidence: number): number {
  const normalized = Math.max(0, Math.min(1, (confidence - 0.28) / 0.48));
  const smoothed = normalized * normalized * (3 - 2 * normalized);
  return Math.round(smoothed * 255);
}

/**
 * Applies an asymmetric temporal low-pass filter to a mask pixel. Large
 * changes track motion quickly, while small confidence changes around hair
 * and clothing edges are damped to prevent frame-to-frame shimmer.
 */
export function stabilizeForegroundAlpha(
  previousAlpha: number,
  nextAlpha: number,
  frameRate = 30,
): number {
  const previous = Math.max(0, Math.min(255, previousAlpha));
  const next = Math.max(0, Math.min(255, nextAlpha));
  const delta = next - previous;
  if (Math.abs(delta) < 3) return Math.round(previous);

  const framesPerSecond = normalizeFrameRate(frameRate);
  const frameDurationMs = 1_000 / framesPerSecond;
  const timeConstantMs =
    Math.abs(delta) > 160
      ? 25
      : delta > 0
        ? 45
        : 85;
  const blend = 1 - Math.exp(-frameDurationMs / timeConstantMs);
  const stabilized = Math.round(previous + delta * blend);
  if (stabilized < 2) return 0;
  if (stabilized > 253) return 255;
  return stabilized;
}

export function replacementVideoBitrate(
  width: number,
  height: number,
  frameRate: number,
  sourceBitrate?: number,
): number {
  const qualityTarget = Math.round(width * height * frameRate * 0.18);
  return Math.max(
    8_000_000,
    Math.min(100_000_000, Math.max(sourceBitrate || 0, qualityTarget)),
  );
}

function waitForMedia(
  media: HTMLMediaElement,
  eventName: "loadeddata" | "loadedmetadata",
): Promise<void> {
  if (
    (eventName === "loadedmetadata" &&
      media.readyState >= HTMLMediaElement.HAVE_METADATA) ||
    (eventName === "loadeddata" &&
      media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      media.removeEventListener(eventName, handleReady);
      media.removeEventListener("error", handleError);
    };
    const handleReady = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("One of the selected videos could not be decoded."));
    };
    media.addEventListener(eventName, handleReady, { once: true });
    media.addEventListener("error", handleError, { once: true });
  });
}

export function normalizeFrameRate(frameRate?: number): number {
  if (
    !Number.isFinite(frameRate) ||
    (frameRate ?? 0) < 1 ||
    (frameRate ?? 0) > 120
  ) {
    return 30;
  }
  return frameRate as number;
}

function drawCover(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): void {
  const rect = coverRect(sourceWidth, sourceHeight, targetWidth, targetHeight);
  context.drawImage(
    source,
    rect.sourceX,
    rect.sourceY,
    rect.sourceWidth,
    rect.sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  );
}

interface TemporalMaskState {
  alpha: Uint8ClampedArray | null;
  hasPreviousFrame: boolean;
  width: number;
  height: number;
}

function paintMask(
  result: ImageSegmenterResult,
  maskCanvas: HTMLCanvasElement,
  maskContext: CanvasRenderingContext2D,
  temporalState: TemporalMaskState,
  frameRate: number,
): boolean {
  const mask = result.confidenceMasks?.[0];
  if (!mask) return false;
  if (maskCanvas.width !== mask.width || maskCanvas.height !== mask.height) {
    maskCanvas.width = mask.width;
    maskCanvas.height = mask.height;
  }
  const values = mask.getAsFloat32Array();
  if (
    temporalState.alpha?.length !== values.length ||
    temporalState.width !== mask.width ||
    temporalState.height !== mask.height
  ) {
    temporalState.alpha = new Uint8ClampedArray(values.length);
    temporalState.hasPreviousFrame = false;
    temporalState.width = mask.width;
    temporalState.height = mask.height;
  }
  const pixels = maskContext.createImageData(mask.width, mask.height);
  for (let index = 0; index < values.length; index += 1) {
    const offset = index * 4;
    const targetAlpha = foregroundAlpha(values[index]);
    const alpha = temporalState.hasPreviousFrame
      ? stabilizeForegroundAlpha(
          temporalState.alpha[index],
          targetAlpha,
          frameRate,
        )
      : targetAlpha;
    temporalState.alpha[index] = alpha;
    pixels.data[offset] = 255;
    pixels.data[offset + 1] = 255;
    pixels.data[offset + 2] = 255;
    pixels.data[offset + 3] = alpha;
  }
  temporalState.hasPreviousFrame = true;
  maskContext.putImageData(pixels, 0, 0);
  return true;
}

interface IvfFrame {
  data: ArrayBuffer;
  timestamp: number;
}

function writeFourCc(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < 4; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function writeUint64(view: DataView, offset: number, value: number): void {
  const lower = value >>> 0;
  const upper = Math.floor(value / 0x1_0000_0000) >>> 0;
  view.setUint32(offset, lower, true);
  view.setUint32(offset + 4, upper, true);
}

export function buildIvfVideo(
  frames: IvfFrame[],
  width: number,
  height: number,
  frameRate: number,
  fourCc: "VP80" | "VP90",
): Blob {
  const header = new ArrayBuffer(32);
  const headerView = new DataView(header);
  writeFourCc(headerView, 0, "DKIF");
  headerView.setUint16(4, 0, true);
  headerView.setUint16(6, 32, true);
  writeFourCc(headerView, 8, fourCc);
  headerView.setUint16(12, width, true);
  headerView.setUint16(14, height, true);
  headerView.setUint32(16, Math.round(frameRate * 1_000), true);
  headerView.setUint32(20, 1_000, true);
  headerView.setUint32(24, frames.length, true);
  headerView.setUint32(28, 0, true);

  const parts: BlobPart[] = [header];
  for (const [index, frame] of frames.entries()) {
    const frameHeader = new ArrayBuffer(12);
    const frameView = new DataView(frameHeader);
    frameView.setUint32(0, frame.data.byteLength, true);
    // IVF timestamps use the stream timebase. WebCodecs may return chunks out of
    // order, so the sorted frame index is the stable presentation timestamp.
    writeUint64(frameView, 4, index);
    parts.push(frameHeader, frame.data);
  }
  return new Blob(parts, { type: "video/x-ivf" });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.000_5 && video.readyState >= 2) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };
    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("A video frame could not be decoded."));
    };
    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.currentTime = time;
  });
}

async function chooseEncoderConfig(
  width: number,
  height: number,
  frameRate: number,
  bitrate: number,
): Promise<{ config: VideoEncoderConfig; fourCc: "VP80" | "VP90" }> {
  const candidates: Array<{
    config: VideoEncoderConfig;
    fourCc: "VP80" | "VP90";
  }> = [
    {
      fourCc: "VP90",
      config: {
        codec: "vp09.00.10.08",
        width,
        height,
        bitrate,
        framerate: frameRate,
        bitrateMode: "variable",
        latencyMode: "quality",
        hardwareAcceleration: "prefer-hardware",
      },
    },
    {
      fourCc: "VP90",
      config: {
        codec: "vp09.00.10.08",
        width,
        height,
        bitrate,
        framerate: frameRate,
        bitrateMode: "variable",
        latencyMode: "quality",
      },
    },
    {
      fourCc: "VP80",
      config: {
        codec: "vp8",
        width,
        height,
        bitrate,
        framerate: frameRate,
        bitrateMode: "variable",
        latencyMode: "quality",
      },
    },
  ];

  for (const candidate of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported(candidate.config);
      if (support.supported) return candidate;
    } catch {
      // Try the next codec/configuration.
    }
  }
  throw new Error("This browser does not have a frame-accurate video encoder.");
}

/**
 * Renders the recorded presenter over an uploaded image or looping video.
 * Every source frame is sought, segmented, composited and timestamped
 * independently. Rendering may therefore be slower than playback, but it
 * cannot lose frames when segmentation is slower than real time.
 */
export async function replaceVideoBackground(
  recording: Blob,
  background: File,
  options: BackgroundReplacementOptions = {},
): Promise<Blob> {
  const kind = backgroundAssetKind(background);
  if (!kind) {
    throw new Error("Choose a still image or video for the new background.");
  }
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") {
    throw new Error(
      "This browser cannot make a frame-accurate background render.",
    );
  }

  const onProgress = options.onProgress;
  const outputFrameRate = normalizeFrameRate(options.frameRate);
  onProgress?.({ phase: "loading", progress: 0 });
  const recordingUrl = URL.createObjectURL(recording);
  const backgroundUrl = URL.createObjectURL(background);
  const sourceVideo = document.createElement("video");
  sourceVideo.src = recordingUrl;
  sourceVideo.playsInline = true;
  sourceVideo.preload = "auto";

  let backgroundImage: ImageBitmap | null = null;
  let backgroundVideo: HTMLVideoElement | null = null;
  let segmenter: ImageSegmenter | null = null;
  let encoder: VideoEncoder | null = null;

  try {
    await waitForMedia(sourceVideo, "loadeddata");
    if (!sourceVideo.videoWidth || !sourceVideo.videoHeight) {
      throw new Error("The recorded video has no visible frames.");
    }

    if (kind === "image") {
      backgroundImage = await createImageBitmap(background);
    } else {
      backgroundVideo = document.createElement("video");
      backgroundVideo.src = backgroundUrl;
      backgroundVideo.playsInline = true;
      backgroundVideo.preload = "auto";
      backgroundVideo.muted = true;
      backgroundVideo.loop = true;
      await waitForMedia(backgroundVideo, "loadeddata");
    }

    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    const segmenterOptions = {
      runningMode: "VIDEO" as const,
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    };
    try {
      segmenter = await ImageSegmenter.createFromOptions(fileset, {
        ...segmenterOptions,
        baseOptions: {
          modelAssetPath: MODEL_PATH,
          delegate: "GPU",
        },
      });
    } catch {
      segmenter = await ImageSegmenter.createFromOptions(fileset, {
        ...segmenterOptions,
        baseOptions: {
          modelAssetPath: MODEL_PATH,
          delegate: "CPU",
        },
      });
    }

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = sourceVideo.videoWidth;
    outputCanvas.height = sourceVideo.videoHeight;
    const outputContext = outputCanvas.getContext("2d", { alpha: false });
    const personCanvas = document.createElement("canvas");
    personCanvas.width = outputCanvas.width;
    personCanvas.height = outputCanvas.height;
    const personContext = personCanvas.getContext("2d");
    const maskCanvas = document.createElement("canvas");
    const maskContext = maskCanvas.getContext("2d");
    const temporalMask: TemporalMaskState = {
      alpha: null,
      hasPreviousFrame: false,
      width: 0,
      height: 0,
    };
    if (!outputContext || !personContext || !maskContext) {
      throw new Error("The video compositor could not be started.");
    }

    const bitrate = replacementVideoBitrate(
      outputCanvas.width,
      outputCanvas.height,
      outputFrameRate,
      options.videoBitsPerSecond,
    );
    const { config, fourCc } = await chooseEncoderConfig(
      outputCanvas.width,
      outputCanvas.height,
      outputFrameRate,
      bitrate,
    );
    const encodedFrames: IvfFrame[] = [];
    let encoderError: Error | null = null;
    encoder = new VideoEncoder({
      output: (chunk) => {
        const data = new ArrayBuffer(chunk.byteLength);
        chunk.copyTo(new Uint8Array(data));
        encodedFrames.push({ data, timestamp: chunk.timestamp });
      },
      error: (error) => {
        encoderError = error;
      },
    });
    encoder.configure(config);

    const duration = sourceVideo.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("The recorded video duration could not be read.");
    }
    const totalFrames = Math.max(1, Math.round(duration * outputFrameRate));
    const frameDuration = Math.round(1_000_000 / outputFrameRate);
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      const frameTime = Math.min(
        Math.max(0, duration - 0.001),
        frameIndex / outputFrameRate,
      );
      await seekVideo(sourceVideo, frameTime);
      if (backgroundVideo && Number.isFinite(backgroundVideo.duration)) {
        const backgroundDuration = backgroundVideo.duration;
        if (backgroundDuration > 0) {
          await seekVideo(
            backgroundVideo,
            Math.min(backgroundDuration - 0.001, frameTime % backgroundDuration),
          );
        }
      }

      segmenter.segmentForVideo(
        sourceVideo,
        Math.round(frameIndex * 1_000 / outputFrameRate),
        (result) => {
          if (
            !paintMask(
              result,
              maskCanvas,
              maskContext,
              temporalMask,
              outputFrameRate,
            )
          ) {
            throw new Error("The presenter could not be found in this frame.");
          }

          outputContext.fillStyle = "#111416";
          outputContext.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
          if (backgroundImage) {
            drawCover(
              outputContext,
              backgroundImage,
              backgroundImage.width,
              backgroundImage.height,
              outputCanvas.width,
              outputCanvas.height,
            );
          } else if (backgroundVideo) {
            drawCover(
              outputContext,
              backgroundVideo,
              backgroundVideo.videoWidth,
              backgroundVideo.videoHeight,
              outputCanvas.width,
              outputCanvas.height,
            );
          }

          personContext.clearRect(0, 0, personCanvas.width, personCanvas.height);
          personContext.globalCompositeOperation = "source-over";
          personContext.filter = "none";
          personContext.drawImage(
            sourceVideo,
            0,
            0,
            personCanvas.width,
            personCanvas.height,
          );
          personContext.globalCompositeOperation = "destination-in";
          personContext.filter = "blur(2.5px)";
          personContext.drawImage(
            maskCanvas,
            0,
            0,
            personCanvas.width,
            personCanvas.height,
          );
          personContext.globalCompositeOperation = "source-over";
          personContext.filter = "none";
          outputContext.drawImage(personCanvas, 0, 0);
        },
      );

      const frame = new VideoFrame(outputCanvas, {
        timestamp: Math.round(frameIndex * 1_000_000 / outputFrameRate),
        duration: frameDuration,
      });
      encoder.encode(frame, {
        keyFrame: frameIndex % Math.max(1, Math.round(outputFrameRate * 2)) === 0,
      });
      frame.close();

      if (encoder.encodeQueueSize > 4) await encoder.flush();
      if (encoderError) throw encoderError;
      onProgress?.({
        phase: "rotoscoping",
        progress: (frameIndex + 1) / totalFrames,
      });
      if (frameIndex % 4 === 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
    }

    onProgress?.({ phase: "encoding", progress: 0 });
    await encoder.flush();
    if (encoderError) throw encoderError;
    encodedFrames.sort((left, right) => left.timestamp - right.timestamp);
    const rendered = buildIvfVideo(
      encodedFrames,
      outputCanvas.width,
      outputCanvas.height,
      outputFrameRate,
      fourCc,
    );
    if (rendered.size === 0 || encodedFrames.length !== totalFrames) {
      throw new Error("The frame-accurate encoder returned an incomplete video.");
    }
    onProgress?.({ phase: "encoding", progress: 1 });
    return rendered;
  } finally {
    sourceVideo.pause();
    backgroundVideo?.pause();
    if (encoder && encoder.state !== "closed") encoder.close();
    segmenter?.close();
    backgroundImage?.close();
    URL.revokeObjectURL(recordingUrl);
    URL.revokeObjectURL(backgroundUrl);
  }
}
