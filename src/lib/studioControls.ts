export const PROMPT_POSITIONS = ["upper", "middle", "lower"] as const;
export const CAPTION_MODES = ["word", "line", "scroll"] as const;

export type PromptPosition = (typeof PROMPT_POSITIONS)[number];
export type CaptionMode = (typeof CAPTION_MODES)[number];

export interface PromptLineRange {
  start: number;
  end: number;
}

const PROMPT_ANCHORS: Record<PromptPosition, number> = {
  upper: 0.28,
  middle: 0.5,
  lower: 0.72,
};

export function nextPromptPosition(
  currentPosition: PromptPosition,
): PromptPosition {
  const currentIndex = PROMPT_POSITIONS.indexOf(currentPosition);
  return PROMPT_POSITIONS[(currentIndex + 1) % PROMPT_POSITIONS.length];
}

export function nextCaptionMode(currentMode: CaptionMode): CaptionMode {
  const currentIndex = CAPTION_MODES.indexOf(currentMode);
  return CAPTION_MODES[(currentIndex + 1) % CAPTION_MODES.length];
}

export function promptLineRange(
  wordOffsets: readonly number[],
  currentIndex: number,
  tolerance = 1,
): PromptLineRange | null {
  const currentOffset = wordOffsets[currentIndex];
  if (!Number.isFinite(currentOffset)) return null;

  let start = currentIndex;
  let end = currentIndex;
  while (
    start > 0 &&
    Math.abs(wordOffsets[start - 1] - currentOffset) <= tolerance
  ) {
    start -= 1;
  }
  while (
    end < wordOffsets.length - 1 &&
    Math.abs(wordOffsets[end + 1] - currentOffset) <= tolerance
  ) {
    end += 1;
  }

  return { start, end };
}

export function promptAnchor(position: PromptPosition): number {
  return PROMPT_ANCHORS[position];
}

interface ContainmentBoundary {
  contains(target: Node | null): boolean;
}

export function isTargetOutside(
  boundary: ContainmentBoundary | null,
  target: EventTarget | null,
): boolean {
  return (
    boundary !== null &&
    target !== null &&
    !boundary.contains(target as Node)
  );
}
