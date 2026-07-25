import type { AlignmentResult } from "./alignment";

const MAX_IMMEDIATE_ADVANCE = 12;
const CONSISTENT_START_TOLERANCE = 4;
const CONSISTENT_END_TOLERANCE = 6;

export interface PendingAdvance {
  candidateStart: number;
  nextIndex: number;
}

export interface StableAdvance {
  nextIndex: number;
  pending: PendingAdvance | null;
  confirmed: boolean;
}

/**
 * Small advances feel continuous and can be applied immediately. A large jump
 * needs two nearby recognition results so a changing partial transcript cannot
 * throw the presenter far down the script.
 */
export function stabilizeAdvance(
  currentIndex: number,
  match: AlignmentResult,
  pending: PendingAdvance | null,
): StableAdvance {
  if (!match.matched) {
    return { nextIndex: currentIndex, pending: null, confirmed: false };
  }

  if (match.nextIndex <= currentIndex + MAX_IMMEDIATE_ADVANCE) {
    return { nextIndex: match.nextIndex, pending: null, confirmed: true };
  }

  const consistent =
    pending !== null &&
    Math.abs(pending.candidateStart - match.candidateStart) <=
      CONSISTENT_START_TOLERANCE &&
    Math.abs(pending.nextIndex - match.nextIndex) <= CONSISTENT_END_TOLERANCE;

  return consistent
    ? { nextIndex: match.nextIndex, pending: null, confirmed: true }
    : {
        nextIndex: currentIndex,
        pending: {
          candidateStart: match.candidateStart,
          nextIndex: match.nextIndex,
        },
        confirmed: false,
      };
}
