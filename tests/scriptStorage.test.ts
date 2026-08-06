import { describe, expect, it } from "vitest";
import {
  loadScripts,
  parseScripts,
  saveScripts,
  SCRIPT_STORAGE_KEY,
} from "../src/lib/scriptStorage";
import type { PrompterScript } from "../src/types";

const script: PrompterScript = {
  id: "script-1",
  title: "Persistent script",
  body: "This survives the next session.",
  source: "manual",
  createdAt: "2026-08-06T00:00:00.000Z",
  updatedAt: "2026-08-06T00:00:00.000Z",
};

function memoryStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

describe("script storage", () => {
  it("saves and restores scripts, including an empty library", () => {
    const storage = memoryStorage();
    saveScripts([script], storage);
    expect(loadScripts(storage)).toEqual([script]);

    saveScripts([], storage);
    expect(loadScripts(storage)).toEqual([]);
  });

  it("accepts validated desktop data", () => {
    expect(parseScripts([script])).toEqual([script]);
    expect(parseScripts(JSON.stringify([script]))).toEqual([script]);
  });

  it("rejects malformed persisted data", () => {
    expect(parseScripts([{ ...script, body: 42 }])).toBeNull();
    expect(parseScripts("not json")).toBeNull();
  });

  it("uses the versioned browser storage key", () => {
    const keys: string[] = [];
    saveScripts([script], {
      getItem: () => null,
      setItem: (key) => keys.push(key),
    });
    expect(keys).toEqual([SCRIPT_STORAGE_KEY]);
  });
});
