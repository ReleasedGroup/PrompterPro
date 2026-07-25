import { useEffect, useMemo, useRef } from "react";
import type { FollowStatus } from "../hooks/useSpeechFollower";
import { tokenizeScript } from "../lib/alignment";

interface TeleprompterOverlayProps {
  script: string;
  currentIndex: number;
  status: FollowStatus;
  fontSize: number;
  mirrored: boolean;
}

export function TeleprompterOverlay({
  script,
  currentIndex,
  status,
  fontSize,
  mirrored,
}: TeleprompterOverlayProps) {
  const words = useMemo(() => tokenizeScript(script), [script]);
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
                key={`${index}-${word.normalized}`}
                ref={index === currentIndex ? activeRef : null}
                className={`prompt-word ${state}`}
              >
                {word.display}
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
