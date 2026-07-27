const MAX_CAPTURE_DIMENSION = 16_384;
const MIN_RECORDING_BITRATE = 8_000_000;
const MAX_RECORDING_BITRATE = 100_000_000;
const BITS_PER_PIXEL_PER_FRAME = 0.18;

export const maximumCameraResolution: Pick<
  MediaTrackConstraints,
  "width" | "height"
> = {
  // A high ideal is a fallback for browsers that do not expose track
  // capabilities. Ideals never reject a camera that supports less.
  width: { ideal: MAX_CAPTURE_DIMENSION },
  height: { ideal: MAX_CAPTURE_DIMENSION },
};

export function maximumResolutionConstraints(
  capabilities: MediaTrackCapabilities,
): MediaTrackConstraints {
  const maximumWidth = capabilities.width?.max;
  const maximumHeight = capabilities.height?.max;

  return {
    ...(maximumWidth ? { width: { ideal: maximumWidth } } : {}),
    ...(maximumHeight ? { height: { ideal: maximumHeight } } : {}),
  };
}

export async function maximizeVideoTrackResolution(
  track: MediaStreamTrack,
): Promise<MediaTrackSettings> {
  if (typeof track.getCapabilities !== "function") {
    return track.getSettings();
  }

  const capabilities = track.getCapabilities();
  const constraints = maximumResolutionConstraints(capabilities);

  if (constraints.width || constraints.height) {
    await track.applyConstraints(constraints);
  }

  return track.getSettings();
}

export function recordingVideoBitrate(
  settings: MediaTrackSettings,
): number | undefined {
  const { width, height } = settings;
  if (!width || !height) return undefined;

  const framesPerSecond = settings.frameRate || 30;
  const target = Math.round(
    width * height * framesPerSecond * BITS_PER_PIXEL_PER_FRAME,
  );

  return Math.min(
    MAX_RECORDING_BITRATE,
    Math.max(MIN_RECORDING_BITRATE, target),
  );
}
