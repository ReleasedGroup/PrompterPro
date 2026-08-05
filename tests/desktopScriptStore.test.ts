import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadScriptStore,
  saveScriptStore,
} from "../desktop/script-store.mjs";

describe("desktop script store", () => {
  it("persists scripts independently of the local server origin", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "prompter-scripts-"));
    const scripts = [{ id: "script-1", title: "Saved" }];

    expect(await loadScriptStore(directory)).toBeNull();
    await saveScriptStore(directory, scripts);

    expect(await loadScriptStore(directory)).toEqual(scripts);
    const saved = await readFile(path.join(directory, "scripts.json"), "utf8");
    expect(JSON.parse(saved)).toEqual(scripts);
  });
});
