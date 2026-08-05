import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const SCRIPT_FILE_NAME = "scripts.json";

export async function loadScriptStore(userDataDirectory) {
  try {
    return JSON.parse(
      await readFile(path.join(userDataDirectory, SCRIPT_FILE_NAME), "utf8"),
    );
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

export async function saveScriptStore(userDataDirectory, scripts) {
  await mkdir(userDataDirectory, { recursive: true });
  const destination = path.join(userDataDirectory, SCRIPT_FILE_NAME);
  const temporary = `${destination}.tmp`;
  await writeFile(temporary, JSON.stringify(scripts), "utf8");
  await rename(temporary, destination);
}
