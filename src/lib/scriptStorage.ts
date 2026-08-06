import type { PrompterScript } from "../types";

export const SCRIPT_STORAGE_KEY = "prompter.scripts.v1";

export interface ScriptStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isScript(value: unknown): value is PrompterScript {
  if (!value || typeof value !== "object") return false;
  const script = value as Record<string, unknown>;
  return (
    typeof script.id === "string" &&
    typeof script.title === "string" &&
    typeof script.body === "string" &&
    (script.source === "manual" || script.source === "ai") &&
    typeof script.createdAt === "string" &&
    typeof script.updatedAt === "string"
  );
}

export function parseScripts(value: unknown): PrompterScript[] | null {
  if (typeof value === "string") {
    try {
      return parseScripts(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return Array.isArray(value) && value.every(isScript) ? value : null;
}

export function loadScripts(storage: ScriptStorage): PrompterScript[] | null {
  try {
    return parseScripts(storage.getItem(SCRIPT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveScripts(
  scripts: PrompterScript[],
  storage: ScriptStorage,
): void {
  try {
    storage.setItem(SCRIPT_STORAGE_KEY, JSON.stringify(scripts));
  } catch {
    // The desktop store remains available if browser storage is unavailable.
  }
}
