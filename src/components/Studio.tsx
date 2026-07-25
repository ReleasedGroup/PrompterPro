import {
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  FlipHorizontal2,
  Mic2,
  Minus,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Square,
  Video,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSpeechFollower } from "../hooks/useSpeechFollower";
import { formatDuration, safeFileName } from "../lib/format";
import type { PrompterScript } from "../types";
import { TeleprompterOverlay } from "./TeleprompterOverlay";

type StudioState =
  | "setup"
  | "ready"
  | "countdown"
  | "recording"
  | "processing"
  | "review"
  | "error";

interface StudioProps {
  script: PrompterScript;
  onBack: () => void;
  onRecordingChange: (isRecording: boolean) => void;
}

interface DevicePreferences {
  cameraId: string;
  microphoneId: string;
}

const DEVICE_PREFERENCES_KEY = "prompter.devices.v1";

function loadDevicePreferences(): DevicePreferences {
  try {
    const saved = localStorage.getItem(DEVICE_PREFERENCES_KEY);
    if (!saved) return { cameraId: "", microphoneId: "" };
    const parsed = JSON.parse(saved) as Partial<DevicePreferences>;
    return {
      cameraId: typeof parsed.cameraId === "string" ? parsed.cameraId : "",
      microphoneId:
        typeof parsed.microphoneId === "string" ? parsed.microphoneId : "",
    };
  } catch {
    return { cameraId: "", microphoneId: "" };
  }
}

function saveDevicePreferences(preferences: DevicePreferences) {
  localStorage.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify(preferences));
}

function preferredMimeType(): string {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

async function makeMp4(recording: Blob): Promise<Blob> {
  if (recording.type.toLowerCase().includes("mp4")) {
    return recording;
  }

  const response = await fetch("/api/recordings/mp4", {
    method: "POST",
    headers: {
      "Content-Type": recording.type || "application/octet-stream",
    },
    body: recording,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error || "The take could not be converted to MP4.");
  }

  const converted = await response.blob();
  if (converted.size === 0) {
    throw new Error("The MP4 exporter returned an empty file.");
  }
  return new Blob([converted], { type: "video/mp4" });
}

export function Studio({
  script,
  onBack,
  onRecordingChange,
}: StudioProps) {
  const [initialDevicePreferences] = useState(loadDevicePreferences);
  const [studioState, setStudioState] = useState<StudioState>("setup");
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [fontSize, setFontSize] = useState(42);
  const [mirrored, setMirrored] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingType, setRecordingType] = useState("");
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [availableMicrophones, setAvailableMicrophones] = useState<
    MediaDeviceInfo[]
  >([]);
  const [selectedCameraId, setSelectedCameraId] = useState(
    initialDevicePreferences.cameraId,
  );
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState(
    initialDevicePreferences.microphoneId,
  );
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [switchingDevice, setSwitchingDevice] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingUrlRef = useRef("");
  const explicitDeviceSelectionRef = useRef(false);
  const isRecording = studioState === "recording";
  const follower = useSpeechFollower(script.body, isRecording);
  const resetFollower = follower.reset;
  const movePrompt = follower.move;

  const attachPreview = useCallback(() => {
    if (previewRef.current && streamRef.current) {
      previewRef.current.srcObject = streamRef.current;
      void previewRef.current.play().catch(() => undefined);
    }
  }, []);

  const refreshDeviceList = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAvailableCameras(
        devices.filter((device) => device.kind === "videoinput"),
      );
      setAvailableMicrophones(
        devices.filter((device) => device.kind === "audioinput"),
      );
    } catch {
      // Some browsers block enumeration until media permission is granted.
    }
  }, []);

  const enableDevices = useCallback(
    async (
      cameraId = selectedCameraId,
      microphoneId = selectedMicrophoneId,
      requireExactDevices = explicitDeviceSelectionRef.current,
    ) => {
      setError("");
      setSwitchingDevice(true);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("This browser does not support camera recording.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(cameraId
            ? {
                deviceId:
                  requireExactDevices
                    ? { exact: cameraId }
                    : { ideal: cameraId },
              }
            : {}),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: {
          ...(microphoneId
            ? {
                deviceId:
                  requireExactDevices
                    ? { exact: microphoneId }
                    : { ideal: microphoneId },
              }
            : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

        const activeCameraId =
          stream.getVideoTracks()[0]?.getSettings().deviceId ?? cameraId;
        const activeMicrophoneId =
          stream.getAudioTracks()[0]?.getSettings().deviceId ?? microphoneId;

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        setSelectedCameraId(activeCameraId);
        setSelectedMicrophoneId(activeMicrophoneId);
        saveDevicePreferences({
          cameraId: activeCameraId,
          microphoneId: activeMicrophoneId,
        });
        await refreshDeviceList();
        setStudioState("ready");
        explicitDeviceSelectionRef.current = false;
        window.setTimeout(attachPreview, 0);
        return true;
      } catch (caught) {
        setError(
          caught instanceof DOMException && caught.name === "NotAllowedError"
            ? "Camera or microphone access was blocked. Allow both devices in your browser settings, then try again."
            : caught instanceof DOMException &&
                (caught.name === "NotFoundError" ||
                  caught.name === "OverconstrainedError")
              ? "That camera or microphone is no longer available. Choose another device."
              : caught instanceof DOMException &&
                  caught.name === "NotReadableError"
                ? "The selected device could not be opened. Close other apps that may be using it, then try again."
              : caught instanceof Error
                ? caught.message
                : "Camera and microphone could not be started.",
        );
        if (!streamRef.current) setStudioState("error");
        return false;
      } finally {
        setSwitchingDevice(false);
      }
    },
    [
      attachPreview,
      refreshDeviceList,
      selectedCameraId,
      selectedMicrophoneId,
    ],
  );

  const changeDevice = useCallback(
    async (kind: "camera" | "microphone", deviceId: string) => {
      if (isRecording || switchingDevice) return;
      if (
        (kind === "camera" && deviceId === selectedCameraId) ||
        (kind === "microphone" && deviceId === selectedMicrophoneId)
      ) {
        return;
      }

      const previousCameraId = selectedCameraId;
      const previousMicrophoneId = selectedMicrophoneId;
      const cameraId = kind === "camera" ? deviceId : selectedCameraId;
      const microphoneId =
        kind === "microphone" ? deviceId : selectedMicrophoneId;
      explicitDeviceSelectionRef.current = true;

      if (kind === "camera") setSelectedCameraId(deviceId);
      else setSelectedMicrophoneId(deviceId);

      if (streamRef.current) {
        const switched = await enableDevices(cameraId, microphoneId, true);
        if (!switched) {
          explicitDeviceSelectionRef.current = false;
          setSelectedCameraId(previousCameraId);
          setSelectedMicrophoneId(previousMicrophoneId);
          saveDevicePreferences({
            cameraId: previousCameraId,
            microphoneId: previousMicrophoneId,
          });
        }
      } else {
        saveDevicePreferences({ cameraId, microphoneId });
      }
    },
    [
      enableDevices,
      isRecording,
      selectedCameraId,
      selectedMicrophoneId,
      switchingDevice,
    ],
  );

  const beginRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") {
      setError("Recording is not supported by this browser.");
      setStudioState("error");
      return;
    }

    const videoTrack = stream.getVideoTracks().find(
      (track) => track.readyState === "live",
    );
    const audioTrack = stream.getAudioTracks().find(
      (track) => track.readyState === "live",
    );
    if (!videoTrack || !audioTrack) {
      setError(
        "A live camera and microphone are both required before recording.",
      );
      setStudioState("error");
      return;
    }

    try {
      const mimeType = preferredMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];
      setElapsed(0);
      resetFollower();
      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current);
      }
      recordingUrlRef.current = "";
      setRecordingUrl("");

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError("The recording stopped because the media recorder failed.");
        setStudioState("error");
      };
      recorder.onstop = () => {
        const type =
          recorder.mimeType || chunksRef.current[0]?.type || "video/webm";
        const rawRecording = new Blob(chunksRef.current, { type });
        chunksRef.current = [];

        void makeMp4(rawRecording)
          .then((mp4Recording) => {
            const url = URL.createObjectURL(mp4Recording);
            recordingUrlRef.current = url;
            setRecordingType("video/mp4");
            setRecordingUrl(url);
            setStudioState("review");
          })
          .catch((conversionError) => {
            const url = URL.createObjectURL(rawRecording);
            recordingUrlRef.current = url;
            setRecordingType(type);
            setRecordingUrl(url);
            setError(
              conversionError instanceof Error
                ? `${conversionError.message} Your raw take is still available below.`
                : "MP4 export failed. Your raw take is still available below.",
            );
            setStudioState("review");
          });
      };

      recorderRef.current = recorder;
      recorder.start(1_000);
      setStudioState("recording");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The recording could not be started.",
      );
      setStudioState("error");
    }
  }, [resetFollower]);

  const startCountdown = useCallback(() => {
    if (!streamRef.current) {
      void enableDevices();
      return;
    }
    setCountdown(3);
    setStudioState("countdown");
  }, [enableDevices]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      setStudioState("processing");
      recorderRef.current.stop();
    }
  }, []);

  const resetTake = useCallback(() => {
    if (recordingUrlRef.current) {
      URL.revokeObjectURL(recordingUrlRef.current);
    }
    recordingUrlRef.current = "";
    setRecordingUrl("");
    setRecordingType("");
    setError("");
    setElapsed(0);
    resetFollower();
    setStudioState(streamRef.current ? "ready" : "setup");
    window.setTimeout(attachPreview, 0);
  }, [attachPreview, resetFollower]);

  const handleBack = useCallback(() => {
    onBack();
  }, [onBack]);

  useEffect(() => {
    attachPreview();
  }, [attachPreview, studioState]);

  useEffect(() => {
    if (!navigator.mediaDevices) return;
    const handleDeviceChange = () => {
      void refreshDeviceList();
    };
    void refreshDeviceList();
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () =>
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange,
      );
  }, [refreshDeviceList]);

  useEffect(() => {
    if (!streamRef.current || isRecording || switchingDevice) return;
    const cameraMissing =
      Boolean(selectedCameraId) &&
      availableCameras.length > 0 &&
      !availableCameras.some(
        (device) => device.deviceId === selectedCameraId,
      );
    const microphoneMissing =
      Boolean(selectedMicrophoneId) &&
      availableMicrophones.length > 0 &&
      !availableMicrophones.some(
        (device) => device.deviceId === selectedMicrophoneId,
      );

    if (cameraMissing || microphoneMissing) {
      void enableDevices(
        cameraMissing ? "" : selectedCameraId,
        microphoneMissing ? "" : selectedMicrophoneId,
        false,
      );
    }
  }, [
    availableCameras,
    availableMicrophones,
    enableDevices,
    isRecording,
    selectedCameraId,
    selectedMicrophoneId,
    switchingDevice,
  ]);

  useEffect(() => {
    if (isRecording) setDevicesOpen(false);
  }, [isRecording]);

  useEffect(() => {
    onRecordingChange(isRecording);
    return () => onRecordingChange(false);
  }, [isRecording, onRecordingChange]);

  useEffect(() => {
    if (studioState !== "countdown") return;
    if (countdown <= 0) {
      beginRecording();
      return;
    }
    const timer = window.setTimeout(
      () => setCountdown((value) => value - 1),
      850,
    );
    return () => window.clearTimeout(timer);
  }, [beginRecording, countdown, studioState]);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(
      () => setElapsed((value) => value + 1),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable=true]")) {
        return;
      }
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        movePrompt(-5);
      }
      if (event.code === "ArrowRight") {
        event.preventDefault();
        movePrompt(5);
      }
      if (event.code === "Space") {
        event.preventDefault();
        if (isRecording) stopRecording();
        else if (studioState === "ready") startCountdown();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isRecording, movePrompt, startCountdown, stopRecording, studioState]);

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    };
  }, []);

  const statusLabel =
    follower.status === "following"
      ? "Following your voice"
      : follower.status === "off-script"
        ? "Off script · prompt paused"
        : follower.status === "unsupported"
          ? "Manual prompt mode"
          : follower.status === "error"
            ? "Speech follow unavailable"
            : "Listening for your words";

  const mp4Ready = recordingType.includes("mp4");
  const downloadExtension = mp4Ready ? "mp4" : "webm";

  return (
    <main className="studio-layout">
      <header className="studio-header">
        <button className="back-button" onClick={handleBack}>
          <ArrowLeft size={18} />
          Scripts
        </button>
        <div className="studio-title">
          <strong>{script.title}</strong>
          <span>
            {follower.currentIndex} / {follower.totalWords} words
          </span>
        </div>
        <div className="studio-settings">
          <div className="devices-menu">
            <button
              className={`tool-button ${devicesOpen ? "active" : ""}`}
              onClick={() => setDevicesOpen((open) => !open)}
              disabled={isRecording || studioState === "countdown"}
              aria-expanded={devicesOpen}
              aria-haspopup="dialog"
            >
              <SlidersHorizontal size={17} />
              Devices
            </button>
            {devicesOpen && (
              <section
                className="devices-popover"
                aria-label="Camera and microphone"
              >
                <header>
                  <div>
                    <strong>Input devices</strong>
                    <span>Used for preview and the raw recording</span>
                  </div>
                  {switchingDevice && <span className="mini-spinner" />}
                </header>

                <label>
                  <span>
                    <Camera size={15} />
                    Camera
                  </span>
                  <select
                    aria-label="Camera"
                    value={selectedCameraId}
                    disabled={switchingDevice || availableCameras.length === 0}
                    onChange={(event) =>
                      void changeDevice("camera", event.target.value)
                    }
                  >
                    {availableCameras.length === 0 && (
                      <option value="">No camera found</option>
                    )}
                    {availableCameras.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>
                    <Mic2 size={15} />
                    Microphone
                  </span>
                  <select
                    aria-label="Microphone"
                    value={selectedMicrophoneId}
                    disabled={
                      switchingDevice || availableMicrophones.length === 0
                    }
                    onChange={(event) =>
                      void changeDevice("microphone", event.target.value)
                    }
                  >
                    {availableMicrophones.length === 0 && (
                      <option value="">No microphone found</option>
                    )}
                    {availableMicrophones.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>

                {switchingDevice ? (
                  <p className="device-switching-message">
                    Switching inputs… the current preview stays active until
                    the new device is ready.
                  </p>
                ) : !streamRef.current ? (
                  <p>
                    Allow camera and microphone access to reveal device names
                    and switch inputs.
                  </p>
                ) : (
                  <p>
                    Changes apply immediately to the preview and your next
                    recording.
                  </p>
                )}
                {error && streamRef.current && !switchingDevice && (
                  <p className="device-switch-error">{error}</p>
                )}
              </section>
            )}
          </div>
          <button
            className={`tool-button ${mirrored ? "active" : ""}`}
            onClick={() => setMirrored((value) => !value)}
            title="Mirror prompt"
          >
            <FlipHorizontal2 size={17} />
            Mirror
          </button>
          <div className="font-control">
            <button
              onClick={() => setFontSize((size) => Math.max(26, size - 4))}
              aria-label="Decrease prompt size"
            >
              <Minus size={15} />
            </button>
            <span>Aa</span>
            <button
              onClick={() => setFontSize((size) => Math.min(72, size + 4))}
              aria-label="Increase prompt size"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>
      </header>

      <section className="studio-stage" ref={stageRef}>
        {studioState === "review" && recordingUrl ? (
          <video
            className="review-video"
            src={recordingUrl}
            controls
            playsInline
          />
        ) : (
          <video
            ref={previewRef}
            className="camera-preview"
            muted
            playsInline
            autoPlay
          />
        )}

        {(studioState === "setup" || studioState === "error") && (
          <div className="device-setup">
            <span className="device-icon">
              <Camera size={27} />
            </span>
            <h2>Ready when you are.</h2>
            <p>
              Connect your camera and microphone to see the prompt over your
              live preview.
            </p>
            {error && <div className="device-error">{error}</div>}
            <button className="primary-button" onClick={() => void enableDevices()}>
              <Video size={18} />
              Enable camera &amp; microphone
            </button>
            <span className="privacy-note">
              Your recording stays on this device.
            </span>
          </div>
        )}

        {studioState !== "setup" &&
          studioState !== "error" &&
          studioState !== "review" && (
            <TeleprompterOverlay
              script={script.body}
              currentIndex={follower.currentIndex}
              status={follower.status}
              fontSize={fontSize}
              mirrored={mirrored}
            />
          )}

        {studioState === "countdown" && (
          <div className="countdown-overlay">
            <span>{countdown || "Go"}</span>
          </div>
        )}

        {studioState === "processing" && (
          <div className="processing-overlay">
            <span className="spinner large" />
            Finishing your take…
          </div>
        )}

        {studioState === "review" && (
          <>
            <div className="review-label">
              {mp4Ready ? "MP4 ready" : "Raw take ready"}
            </div>
            {error && <div className="export-error">{error}</div>}
          </>
        )}

        {studioState !== "setup" && studioState !== "error" && (
          <button
            className="fullscreen-button"
            onClick={() => void stageRef.current?.requestFullscreen()}
            aria-label="Enter full screen"
          >
            <Expand size={18} />
          </button>
        )}
      </section>

      <footer className="studio-controls">
        <div className="follow-status" data-status={follower.status}>
          <span className="status-pulse" />
          <div>
            <strong>{statusLabel}</strong>
            <small>
              {follower.lastHeard
                ? `Heard “${follower.lastHeard.slice(-64)}”`
                : "The recording never pauses"}
            </small>
          </div>
        </div>

        <div className="transport">
          {studioState === "review" ? (
            <>
              <button className="secondary-button" onClick={resetTake}>
                <RefreshCw size={17} />
                New take
              </button>
              <a
                className="record-button download-button"
                href={recordingUrl}
                download={`${safeFileName(script.title)}-${new Date()
                  .toISOString()
                  .slice(0, 19)
                  .replaceAll(":", "-")}.${downloadExtension}`}
              >
                <Download size={19} />
                {mp4Ready ? "Save MP4" : "Download raw backup"}
              </a>
            </>
          ) : isRecording ? (
            <button className="record-button recording" onClick={stopRecording}>
              <Square size={17} fill="currentColor" />
              Stop · {formatDuration(elapsed)}
            </button>
          ) : (
            <button
              className="record-button"
              onClick={startCountdown}
              disabled={
                studioState === "setup" ||
                studioState === "error" ||
                studioState === "countdown" ||
                studioState === "processing"
              }
            >
              <span className="record-dot" />
              Record
            </button>
          )}
        </div>

        <div className="prompt-nudge">
          <button onClick={() => movePrompt(-5)} aria-label="Move prompt back">
            <ChevronLeft size={19} />
          </button>
          <span>
            <Mic2 size={15} />
            Prompt position
          </span>
          <button onClick={() => movePrompt(5)} aria-label="Move prompt forward">
            <ChevronRight size={19} />
          </button>
        </div>
      </footer>
    </main>
  );
}
