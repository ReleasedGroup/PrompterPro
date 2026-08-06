export interface PromptScrollState {
  position: number;
  velocity: number;
}

const SPRING_STIFFNESS = 120;
const SPRING_DAMPING = 22;
const MAX_FRAME_SECONDS = 0.032;
const SETTLED_DISTANCE = 0.25;
const SETTLED_VELOCITY = 2;

export function advancePromptScroll(
  state: PromptScrollState,
  target: number,
  elapsedMilliseconds: number,
): PromptScrollState {
  const elapsedSeconds =
    Math.min(Math.max(elapsedMilliseconds, 0), MAX_FRAME_SECONDS * 1_000) /
    1_000;
  const distance = target - state.position;

  if (
    Math.abs(distance) <= SETTLED_DISTANCE &&
    Math.abs(state.velocity) <= SETTLED_VELOCITY
  ) {
    return { position: target, velocity: 0 };
  }

  const acceleration =
    SPRING_STIFFNESS * distance - SPRING_DAMPING * state.velocity;
  const velocity = state.velocity + acceleration * elapsedSeconds;
  const position = state.position + velocity * elapsedSeconds;

  return { position, velocity };
}

export function promptScrollSettled(
  state: PromptScrollState,
  target: number,
): boolean {
  return state.position === target && state.velocity === 0;
}
