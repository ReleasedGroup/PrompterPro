interface AiDraftStatus {
  available?: unknown;
}

export async function getAiDraftAvailability(
  fetchStatus: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetchStatus("/api/scripts/generate/status");
    if (!response.ok) return false;

    const status = (await response.json()) as AiDraftStatus;
    return status.available === true;
  } catch {
    return false;
  }
}
