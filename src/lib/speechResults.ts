export interface RecognitionResultSnapshot {
  transcript: string;
  isFinal: boolean;
}

export interface RecognitionUpdate {
  heard: string;
  newlyFinalized: number;
}

/**
 * Web Speech keeps old finalized results in the result list. Only results at
 * or after resultIndex changed for this event, so matching older entries again
 * can hide new off-script speech.
 */
export function collectRecognitionUpdate(
  results: RecognitionResultSnapshot[],
  resultIndex: number,
  processedFinalResults: Set<number>,
): RecognitionUpdate {
  const changedStart = Math.min(Math.max(resultIndex, 0), results.length);
  const changedParts: string[] = [];
  let newlyFinalized = 0;

  for (let index = changedStart; index < results.length; index += 1) {
    const result = results[index];
    const transcript = result.transcript.trim();
    if (transcript) changedParts.push(transcript);

    if (result.isFinal && !processedFinalResults.has(index)) {
      processedFinalResults.add(index);
      newlyFinalized += 1;
    }
  }

  return {
    heard: changedParts.join(" ").trim(),
    newlyFinalized,
  };
}
