export interface AlignmentResult {
  matched: boolean;
  score: number;
  nextIndex: number;
  candidateStart: number;
}

export interface ScriptWordToken {
  display: string;
  normalized: string;
}

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['\u2019][\p{L}\p{N}]+)*/gu;

export function normalizeWord(word: string): string {
  return word
    .toLocaleLowerCase()
    .replaceAll("\u2019", "'")
    .match(WORD_PATTERN)?.join("") ?? "";
}

export function tokenizeScript(text: string): ScriptWordToken[] {
  const matches = Array.from(text.matchAll(WORD_PATTERN));

  return matches.map((match, index) => {
    const wordStart = match.index;
    const tokenStart = index === 0 ? 0 : wordStart;
    const tokenEnd = matches[index + 1]?.index ?? text.length;

    return {
      display: text.slice(tokenStart, tokenEnd),
      normalized: normalizeWord(match[0]),
    };
  });
}

export function wordsFromText(text: string): string[] {
  return tokenizeScript(text).map((token) => token.normalized);
}

function editDistance(left: string, right: string): number {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  const current = new Array<number>(right.length + 1).fill(0);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      current[j] =
        left[i - 1] === right[j - 1]
          ? previous[j - 1]
          : Math.min(previous[j - 1], previous[j], current[j - 1]) + 1;
    }
    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length];
}

function wordsMatch(left: string, right: string): boolean {
  if (left === right) return true;

  const withoutApostrophesLeft = left.replaceAll("'", "");
  const withoutApostrophesRight = right.replaceAll("'", "");
  if (withoutApostrophesLeft === withoutApostrophesRight) return true;

  const longest = Math.max(left.length, right.length);
  if (longest < 5 || Math.abs(left.length - right.length) > 2) return false;
  return 1 - editDistance(left, right) / longest >= 0.8;
}

function longestCommonSubsequence(left: string[], right: string[]): number {
  const previous = new Array<number>(right.length + 1).fill(0);
  const current = new Array<number>(right.length + 1).fill(0);

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      current[j] =
        wordsMatch(left[i - 1], right[j - 1])
          ? previous[j - 1] + 1
          : Math.max(previous[j], current[j - 1]);
    }
    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j];
      current[j] = 0;
    }
  }

  return previous[right.length];
}

function requiredScore(spokenLength: number): number {
  if (spokenLength <= 1) return 0.9;
  if (spokenLength === 2) return 0.72;
  if (spokenLength === 3) return 0.62;
  return 0.55;
}

/**
 * Aligns only around the current cursor. The bounded search prevents a repeated
 * phrase near the end of a script from causing a large, surprising jump.
 */
export function alignTranscript(
  scriptWords: string[],
  transcript: string,
  currentIndex: number,
): AlignmentResult {
  const spoken = wordsFromText(transcript).slice(-12);
  const safeCursor = Math.min(Math.max(currentIndex, 0), scriptWords.length);

  if (spoken.length === 0 || scriptWords.length === 0) {
    return {
      matched: false,
      score: 0,
      nextIndex: safeCursor,
      candidateStart: safeCursor,
    };
  }

  const searchStart = Math.max(0, safeCursor - 12);
  const searchEnd = Math.min(
    scriptWords.length - 1,
    safeCursor + Math.max(48, spoken.length * 3),
  );
  let best: AlignmentResult = {
    matched: false,
    score: 0,
    nextIndex: safeCursor,
    candidateStart: safeCursor,
  };

  for (let start = searchStart; start <= searchEnd; start += 1) {
    const minimumLength = Math.max(1, spoken.length - 2);
    const maximumLength = Math.min(
      scriptWords.length - start,
      spoken.length + 2,
    );

    for (let length = minimumLength; length <= maximumLength; length += 1) {
      const candidate = scriptWords.slice(start, start + length);
      const common = longestCommonSubsequence(spoken, candidate);
      const orderedSimilarity = (2 * common) / (spoken.length + candidate.length);
      const exact =
        spoken.join(" ") === candidate.join(" ") ? 0.08 : 0;
      const rewindPenalty =
        start < safeCursor ? Math.abs(start - safeCursor) * 0.006 : 0;
      const forwardPenalty =
        start > safeCursor + 20 ? (start - safeCursor - 20) * 0.002 : 0;
      const score = Math.min(
        1,
        orderedSimilarity + exact - rewindPenalty - forwardPenalty,
      );

      if (score > best.score) {
        best = {
          matched: false,
          score,
          nextIndex: Math.min(start + length, scriptWords.length),
          candidateStart: start,
        };
      }
    }
  }

  const threshold = requiredScore(spoken.length);
  const avoidsLargeRewind = best.nextIndex >= safeCursor - 4;
  best.matched = best.score >= threshold && avoidsLargeRewind;
  if (!best.matched) best.nextIndex = safeCursor;
  return best;
}
