export const PROMPT_POSITIONS = ["upper", "middle", "lower"] as const;

export type PromptPosition = (typeof PROMPT_POSITIONS)[number];

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
