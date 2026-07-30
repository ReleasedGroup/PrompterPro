import { describe, expect, it, vi } from "vitest";
import { getAiDraftAvailability } from "../src/lib/aiDraftAvailability";

function response(body: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("getAiDraftAvailability", () => {
  it("shows AI drafting only when the server explicitly enables it", async () => {
    const fetchStatus = vi.fn().mockResolvedValue(response({ available: true }));

    await expect(getAiDraftAvailability(fetchStatus)).resolves.toBe(true);
    expect(fetchStatus).toHaveBeenCalledWith("/api/scripts/generate/status");
  });

  it.each([
    ["an unavailable response", response({ available: true }, false)],
    ["a missing availability flag", response({})],
    ["a false availability flag", response({ available: false })],
  ])("hides AI drafting for %s", async (_description, statusResponse) => {
    const fetchStatus = vi.fn().mockResolvedValue(statusResponse);

    await expect(getAiDraftAvailability(fetchStatus)).resolves.toBe(false);
  });

  it("hides AI drafting when the status request fails", async () => {
    const fetchStatus = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(getAiDraftAvailability(fetchStatus)).resolves.toBe(false);
  });
});
