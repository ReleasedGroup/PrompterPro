import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { FollowStatus } from "../hooks/useSpeechFollower";
import { tokenizeScript } from "../lib/alignment";
import {
  advancePromptScroll,
  promptScrollSettled,
  type PromptScrollState,
} from "../lib/promptScroll";
import {
  promptAnchor,
  promptLineRange,
  type CaptionMode,
  type PromptLineRange,
  type PromptPosition,
} from "../lib/studioControls";

interface TeleprompterOverlayProps {
  script: string;
  currentIndex: number;
  status: FollowStatus;
  fontSize: number;
  mirrored: boolean;
  position: PromptPosition;
  captionMode: CaptionMode;
}

export function TeleprompterOverlay({
  script,
  currentIndex,
  status,
  fontSize,
  mirrored,
  position,
  captionMode,
}: TeleprompterOverlayProps) {
  const words = useMemo(() => tokenizeScript(script), [script]);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const promptRef = useRef<HTMLDivElement | null>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const scrollFrameTimeRef = useRef<number | null>(null);
  const scrollTargetRef = useRef(0);
  const scrollStateRef = useRef<PromptScrollState>({
    position: 0,
    velocity: 0,
  });
  const [currentLine, setCurrentLine] = useState<PromptLineRange | null>(null);
  const anchor = promptAnchor(position);

  const animateScroll = useCallback((timestamp: number) => {
    const prompt = promptRef.current;
    if (!prompt) {
      scrollAnimationRef.current = null;
      return;
    }

    const previousTimestamp = scrollFrameTimeRef.current ?? timestamp;
    scrollFrameTimeRef.current = timestamp;
    const nextState = advancePromptScroll(
      scrollStateRef.current,
      scrollTargetRef.current,
      timestamp - previousTimestamp,
    );
    scrollStateRef.current = nextState;
    prompt.scrollTop = nextState.position;

    if (promptScrollSettled(nextState, scrollTargetRef.current)) {
      scrollAnimationRef.current = null;
      scrollFrameTimeRef.current = null;
      return;
    }
    scrollAnimationRef.current = window.requestAnimationFrame(animateScroll);
  }, []);

  const measureCurrentLine = useCallback(() => {
    if (captionMode !== "line") {
      setCurrentLine(null);
      return;
    }

    const offsets = wordRefs.current
      .slice(0, words.length)
      .map((word) => word?.offsetTop ?? Number.NaN);
    const nextLine = promptLineRange(offsets, currentIndex);
    setCurrentLine((previousLine) =>
      previousLine?.start === nextLine?.start &&
      previousLine?.end === nextLine?.end
        ? previousLine
        : nextLine,
    );
  }, [captionMode, currentIndex, words.length]);

  useLayoutEffect(() => {
    measureCurrentLine();
  }, [fontSize, measureCurrentLine, script]);

  useEffect(() => {
    const prompt = promptRef.current;
    if (captionMode !== "line" || !prompt) return;

    const observer = new ResizeObserver(measureCurrentLine);
    observer.observe(prompt);
    return () => observer.disconnect();
  }, [captionMode, measureCurrentLine]);

  useEffect(() => {
    const activeWord = wordRefs.current[currentIndex];
    const prompt = promptRef.current;
    if (!activeWord || !prompt) return;

    const targetScrollTop = Math.min(
      Math.max(
        0,
        activeWord.offsetTop +
          activeWord.offsetHeight / 2 -
          prompt.clientHeight * anchor,
      ),
      Math.max(0, prompt.scrollHeight - prompt.clientHeight),
    );
    scrollTargetRef.current = targetScrollTop;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (scrollAnimationRef.current !== null) {
        window.cancelAnimationFrame(scrollAnimationRef.current);
      }
      scrollAnimationRef.current = null;
      scrollFrameTimeRef.current = null;
      scrollStateRef.current = { position: targetScrollTop, velocity: 0 };
      prompt.scrollTop = targetScrollTop;
      return;
    }

    if (scrollAnimationRef.current === null) {
      scrollStateRef.current.position = prompt.scrollTop;
      scrollFrameTimeRef.current = null;
      scrollAnimationRef.current = window.requestAnimationFrame(animateScroll);
    }
  }, [anchor, animateScroll, currentIndex, fontSize, script]);

  useEffect(
    () => () => {
      if (scrollAnimationRef.current !== null) {
        window.cancelAnimationFrame(scrollAnimationRef.current);
      }
      scrollAnimationRef.current = null;
      scrollFrameTimeRef.current = null;
    },
    [],
  );

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
            const isCurrentLine =
              captionMode === "line" &&
              (currentLine
                ? index >= currentLine.start && index <= currentLine.end
                : index === currentIndex);
            const state =
              captionMode === "scroll"
                ? "plain"
                : isCurrentLine
                  ? "current-line"
                  : index < currentIndex
                    ? "spoken"
                    : index === currentIndex
                      ? "current"
                      : "upcoming";
            return (
              <span
                key={`${index}-${word.normalized}`}
                ref={(element) => {
                  wordRefs.current[index] = element;
                }}
                className={`prompt-word ${state}`}
                aria-current={index === currentIndex ? "true" : undefined}
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
          Prompt paused · return to{" "}
          {captionMode === "word"
            ? "the highlighted word"
            : captionMode === "line"
              ? "the highlighted line"
              : "the current prompt position"}
        </div>
      )}
    </div>
  );
}
