export const RECORDING_EXIT_MESSAGE =
  "Stop this recording and return to Scripts?";

export function allowStudioExit(
  isRecording: boolean,
  confirmExit: (message: string) => boolean,
): boolean {
  return !isRecording || confirmExit(RECORDING_EXIT_MESSAGE);
}
