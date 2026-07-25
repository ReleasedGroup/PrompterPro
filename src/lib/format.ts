export function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const elapsed = Date.now() - date.getTime();
  const day = 86_400_000;
  if (elapsed < day && date.getDate() === new Date().getDate()) return "Today";
  if (elapsed < day * 2) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder
    .toString()
    .padStart(2, "0")}`;
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function estimatedMinutes(text: string): number {
  return Math.max(1, Math.ceil(wordCount(text) / 140));
}

export function safeFileName(value: string): string {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 64) || "recording"
  );
}
