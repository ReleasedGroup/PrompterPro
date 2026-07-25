import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { alignTranscript, wordsFromText } from "../lib/alignment";
import { collectRecognitionUpdate } from "../lib/speechResults";

export type FollowStatus =
  | "idle"
  | "listening"
  | "following"
  | "off-script"
  | "unsupported"
  | "error";

export function useSpeechFollower(script: string, enabled: boolean) {
  const scriptWords = useMemo(() => wordsFromText(script), [script]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<FollowStatus>("idle");
  const [lastHeard, setLastHeard] = useState("");
  const [confidence, setConfidence] = useState(0);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRunRef = useRef(false);
  const cursorRef = useRef(0);
  const missesRef = useRef(0);
  const processedFinalResultsRef = useRef(new Set<number>());

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
    },
    [enabled, setCursor],
  );

  const reset = useCallback(() => {
    setCursor(0);
    setLastHeard("");
    setConfidence(0);
    missesRef.current = 0;
    processedFinalResultsRef.current.clear();
    setStatus("idle");
  }, [setCursor]);

  useEffect(() => {
    reset();
  }, [script, reset]);

  useEffect(() => {
    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!Recognition) {
      if (enabled) setStatus("unsupported");
      return;
    }

    if (!enabled) {
      shouldRunRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setStatus((current) =>
        current === "unsupported" ? "unsupported" : "idle",
      );
      return;
    }

    shouldRunRef.current = true;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-AU";
    recognitionRef.current = recognition;
    setStatus("listening");

    recognition.onstart = () => {
      setStatus((current) =>
        current === "following" || current === "off-script"
          ? current
          : "listening",
      );
    };

    recognition.onresult = (event) => {
      const snapshots = Array.from(
        { length: event.results.length },
        (_, index) => ({
          transcript: event.results[index][0]?.transcript ?? "",
          isFinal: event.results[index].isFinal,
        }),
      );
      const { heard, newlyFinalized } = collectRecognitionUpdate(
        snapshots,
        event.resultIndex,
        processedFinalResultsRef.current,
      );
      if (!heard) return;

      const result = alignTranscript(scriptWords, heard, cursorRef.current);
      setLastHeard(heard);
      setConfidence(result.score);

      if (result.matched) {
        missesRef.current = 0;
        setCursor(Math.max(cursorRef.current, result.nextIndex));
        setStatus("following");
      } else if (newlyFinalized > 0) {
        missesRef.current += newlyFinalized;
        setStatus(missesRef.current >= 2 ? "off-script" : "listening");
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        shouldRunRef.current = false;
      }
      setStatus("error");
    };

    recognition.onend = () => {
      if (!shouldRunRef.current) return;
      processedFinalResultsRef.current.clear();
      window.setTimeout(() => {
        try {
          recognition.start();
        } catch {
          // A late stop or browser restart race is safe to ignore.
        }
      }, 250);
    };

    try {
      recognition.start();
    } catch {
      setStatus("error");
    }

    return () => {
      shouldRunRef.current = false;
      recognition.onstart = null;
      recognition.onend = null;
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [enabled, scriptWords, setCursor]);

  return {
    currentIndex,
    status,
    lastHeard,
    confidence,
    totalWords: scriptWords.length,
    move,
    reset,
  };
}
