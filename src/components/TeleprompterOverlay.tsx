import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { FollowStatus } from "../hooks/useSpeechFollower";
import { tokenizeScript } from "../lib/alignment";
import {
  promptAnchor,
  type PromptPosition,
} from "../lib/studioControls";

interface TeleprompterOverlayProps {
  script: string;
  currentIndex: number;
  status: FollowStatus;
  fontSize: number;
  mirrored: boolean;
  position: PromptPosition;
}

export function TeleprompterOverlay({
  script,
  currentIndex,
  status,
  fontSize,
  mirrored,
  position,
}: TeleprompterOverlayProps) {
  const words = useMemo(() => tokenizeScript(script), [script]);
  const activeRef = useRef<HTMLSpanElement | null>(null);
  const promptRef = useRef<HTMLDivElement | null>(null);
  const anchor = promptAnchor(position);

  useEffect(() => {
    const activeWord = activeRef.current;
    const prompt = promptRef.current;
    if (!activeWord || !prompt) return;

    const targetScrollTop =
      activeWord.offsetTop +
      activeWord.offsetHeight / 2 -
      prompt.clientHeight * anchor;

    prompt.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [anchor, currentIndex]);

  const positionStyles = {
    "--prompt-anchor": `${anchor * 100}%`,
  } as CSSProperties;

  return (
    <div
      className={`teleprompter-overlay ${mirrored ? "mirrored" : ""}`}
      style={positionStyles}
    >
      <div className="reading-line" aria-hidden="true" />
      <div className="prompt-fade prompt-fade-top" />
      <div className="prompt-fade prompt-fade-bottom" />
      <div
        ref={promptRef}
        className="prompt-scroll"
        style={{ fontSize: `${fontSize}px` }}
        aria-live="off"
      >
        <div className="prompt-spacer prompt-spacer-start" />
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
        <div className="prompt-spacer prompt-spacer-end" />
      </div>
      {status === "off-script" && (
        <div className="off-script-banner">
          Prompt paused · return to the highlighted words
        </div>
      )}
    </div>
  );
}
