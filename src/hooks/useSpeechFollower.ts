import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { alignTranscript, wordsFromText } from "../lib/alignment";
import {
  stabilizeAdvance,
  type PendingAdvance,
} from "../lib/following";

export type FollowStatus =
  | "idle"
  | "listening"
  | "following"
  | "off-script"
  | "unsupported"
  | "error";

interface LocalSpeechMessage {
  type: "ready" | "transcript" | "error";
  text?: string;
  final?: boolean;
  message?: string;
}

function localSpeechUrl(): string {
  const url = new URL("/api/speech", window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function parseSpeechMessage(data: unknown): LocalSpeechMessage | null {
  if (typeof data !== "string") return null;
  try {
    const parsed = JSON.parse(data) as Partial<LocalSpeechMessage>;
    if (
      parsed.type !== "ready" &&
      parsed.type !== "transcript" &&
      parsed.type !== "error"
    ) {
      return null;
    }
    return parsed as LocalSpeechMessage;
  } catch {
    return null;
  }
}

export function useSpeechFollower(
  script: string,
  enabled: boolean,
  mediaStream: MediaStream | null,
) {
  const scriptWords = useMemo(() => wordsFromText(script), [script]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<FollowStatus>("idle");
  const [lastHeard, setLastHeard] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const cursorRef = useRef(0);
  const missesRef = useRef(0);
  const pendingAdvanceRef = useRef<PendingAdvance | null>(null);

  const setCursor = useCallback(
    (next: number) => {
      const bounded = Math.min(Math.max(next, 0), scriptWords.length);
      cursorRef.current = bounded;
      setCurrentIndex(bounded);
    },
    [scriptWords.length],
  );

  const move = useCallback(
    (delta: number) => {
      setCursor(cursorRef.current + delta);
      setStatus(enabled ? "following" : "idle");
      missesRef.current = 0;
      pendingAdvanceRef.current = null;
    },
    [enabled, setCursor],
  );

  const reset = useCallback(() => {
    setCursor(0);
    setLastHeard("");
    setConfidence(0);
    setErrorMessage("");
    missesRef.current = 0;
    pendingAdvanceRef.current = null;
    setStatus("idle");
  }, [setCursor]);

  useEffect(() => {
    reset();
  }, [script, reset]);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    const audioTrack = mediaStream
      ?.getAudioTracks()
      .find((track) => track.readyState === "live");
    if (!audioTrack) {
      setErrorMessage("No live microphone track is available.");
      setStatus("error");
      return;
    }
    const liveAudioTrack = audioTrack;

    if (
      typeof AudioContext === "undefined" ||
      typeof AudioWorkletNode === "undefined" ||
      typeof WebSocket === "undefined"
    ) {
      setErrorMessage(
        "This browser cannot stream microphone audio to the local speech engine.",
      );
      setStatus("unsupported");
      return;
    }

    let disposed = false;
    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let processor: AudioWorkletNode | null = null;
    let silentSink: GainNode | null = null;
    let socket: WebSocket | null = null;
    let engineReady = false;
    let failureReported = false;

    const handleTranscript = (text: string, final: boolean) => {
      const heard = text.trim();
      if (!heard) return;

      const result = alignTranscript(scriptWords, heard, cursorRef.current);
      const stable = stabilizeAdvance(
        cursorRef.current,
        result,
        pendingAdvanceRef.current,
      );
      pendingAdvanceRef.current = stable.pending;
      setLastHeard(heard);
      setConfidence(result.score);

      if (result.matched) {
        missesRef.current = 0;
        if (stable.confirmed) {
          setCursor(Math.max(cursorRef.current, stable.nextIndex));
          setStatus("following");
        } else {
          setStatus("listening");
        }
      } else if (final) {
        missesRef.current += 1;
        setStatus(missesRef.current >= 2 ? "off-script" : "listening");
      }
    };

    async function startLocalRecognition() {
      setErrorMessage("");
      setStatus("listening");

      audioContext = new AudioContext();
      await audioContext.audioWorklet.addModule("/audio-processor.js");
      if (disposed) return;
      await audioContext.resume();

      socket = new WebSocket(localSpeechUrl());
      socket.binaryType = "arraybuffer";
      socket.onmessage = (event) => {
        if (disposed) return;
        const message = parseSpeechMessage(event.data);
        if (!message) return;

        if (message.type === "ready") {
          engineReady = true;
          setStatus("listening");
        } else if (message.type === "transcript" && message.text) {
          handleTranscript(message.text, Boolean(message.final));
        } else if (message.type === "error") {
          engineReady = false;
          failureReported = true;
          setErrorMessage(
            message.message || "Local speech recognition is unavailable.",
          );
          setStatus("error");
        }
      };
      socket.onclose = () => {
        engineReady = false;
        if (!disposed && !failureReported) {
          failureReported = true;
          setErrorMessage("The local speech engine disconnected.");
          setStatus("error");
        }
      };
      socket.onerror = () => {
        if (!disposed && !failureReported) {
          failureReported = true;
          setErrorMessage(
            "The local speech engine could not be reached. Keep the Prompter API running.",
          );
          setStatus("error");
        }
      };
      socket.onopen = () => {
        socket?.send(
          JSON.stringify({
            type: "start",
            sampleRate: audioContext?.sampleRate,
          }),
        );
      };

      const microphoneStream = new MediaStream([liveAudioTrack]);
      source = audioContext.createMediaStreamSource(microphoneStream);
      processor = new AudioWorkletNode(
        audioContext,
        "prompter-audio-processor",
        {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        },
      );
      silentSink = audioContext.createGain();
      silentSink.gain.value = 0;
      processor.port.onmessage = (event: MessageEvent<Float32Array>) => {
        const samples = event.data;
        if (
          engineReady &&
          socket?.readyState === WebSocket.OPEN &&
          socket.bufferedAmount < 512 * 1024
        ) {
          socket.send(samples.buffer);
        }
      };
      source.connect(processor);
      processor.connect(silentSink);
      silentSink.connect(audioContext.destination);
    }

    void startLocalRecognition().catch((error: unknown) => {
      if (disposed) return;
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Local speech recognition could not start.",
      );
      setStatus("error");
    });

    return () => {
      disposed = true;
      engineReady = false;
      if (
        socket?.readyState === WebSocket.OPEN ||
        socket?.readyState === WebSocket.CONNECTING
      ) {
        socket.close(1000, "Recording stopped");
      }
      if (processor) {
        processor.port.onmessage = null;
        processor.disconnect();
      }
      silentSink?.disconnect();
      source?.disconnect();
      void audioContext?.close();
    };
  }, [enabled, mediaStream, scriptWords, setCursor]);

  return {
    currentIndex,
    status,
    lastHeard,
    confidence,
    errorMessage,
    totalWords: scriptWords.length,
    move,
    reset,
  };
}
