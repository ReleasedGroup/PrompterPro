import { useEffect, useMemo, useRef } from "react";
import type { FollowStatus } from "../hooks/useSpeechFollower";

interface TeleprompterOverlayProps {
  script: string;
  currentIndex: number;
  status: FollowStatus;
  fontSize: number;
  mirrored: boolean;
}

function segmentWords(text: string): string[] {
  return text.match(/\S+/g) ?? [];
}

export function TeleprompterOverlay({
  script,
  currentIndex,
  status,
  fontSize,
  mirrored,
}: TeleprompterOverlayProps) {
  const words = useMemo(() => segmentWords(script), [script]);
  const activeRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [currentIndex]);

  return (
    <div className={`teleprompter-overlay ${mirrored ? "mirrored" : ""}`}>
      <div className="reading-line" aria-hidden="true" />
      <div className="prompt-fade prompt-fade-top" />
      <div className="prompt-fade prompt-fade-bottom" />
      <div
        className="prompt-scroll"
        style={{ fontSize: `${fontSize}px` }}
        aria-live="off"
      >
        <div className="prompt-spacer" />
        <p>
          {words.map((word, index) => {
            const state =
              index < currentIndex
                ? "spoken"
                : index === currentIndex
                  ? "current"
                  : "upcoming";
            return (
              <span
                key={`${index}-${word}`}
                ref={index === currentIndex ? activeRef : null}
                className={`prompt-word ${state}`}
              >
                {word}{" "}
              </span>
            );
          })}
        </p>
        <div className="prompt-spacer" />
      </div>
      {status === "off-script" && (
        <div className="off-script-banner">
          Prompt paused · return to the highlighted words
        </div>
      )}
    </div>
  );
}
