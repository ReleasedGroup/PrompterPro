import { useCallback, useEffect, useMemo, useState } from "react";
import type { PrompterScript, ScriptSource } from "../types";

const STORAGE_KEY = "prompter.scripts.v1";

const sampleScript: PrompterScript = {
  id: "welcome-to-prompter",
  title: "Welcome to Prompter",
  body:
    "Great delivery starts with a clear idea and the confidence to say it naturally.\n\n" +
    "Prompter keeps your next words close to the camera, follows your voice, and waits when you improvise. " +
    "The recording keeps running, so you can stay present instead of worrying about the controls.\n\n" +
    "Take a breath, look toward the lens, and make the message your own.",
  source: "manual",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function loadScripts(): PrompterScript[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [sampleScript];
    const parsed = JSON.parse(saved) as PrompterScript[];
    return Array.isArray(parsed) ? parsed : [sampleScript];
  } catch {
    return [sampleScript];
  }
}

export function useLocalScripts() {
  const [scripts, setScripts] = useState<PrompterScript[]>(loadScripts);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
  }, [scripts]);

  const createScript = useCallback(
    (title = "Untitled script", body = "", source: ScriptSource = "manual") => {
      const now = new Date().toISOString();
      const script: PrompterScript = {
        id: crypto.randomUUID(),
        title,
        body,
        source,
        createdAt: now,
        updatedAt: now,
      };
      setScripts((current) => [script, ...current]);
      return script;
    },
    [],
  );

  const updateScript = useCallback(
    (id: string, patch: Partial<Pick<PrompterScript, "title" | "body">>) => {
      setScripts((current) =>
        current.map((script) =>
          script.id === id
            ? { ...script, ...patch, updatedAt: new Date().toISOString() }
            : script,
        ),
      );
    },
    [],
  );

  const deleteScript = useCallback((id: string) => {
    setScripts((current) => current.filter((script) => script.id !== id));
  }, []);

  const duplicateScript = useCallback((id: string) => {
    setScripts((current) => {
      const original = current.find((script) => script.id === id);
      if (!original) return current;
      const now = new Date().toISOString();
      return [
        {
          ...original,
          id: crypto.randomUUID(),
          title: `${original.title} — copy`,
          createdAt: now,
          updatedAt: now,
        },
        ...current,
      ];
    });
  }, []);

  const byId = useMemo(
    () => new Map(scripts.map((script) => [script.id, script])),
    [scripts],
  );

  return {
    scripts,
    byId,
    createScript,
    updateScript,
    deleteScript,
    duplicateScript,
  };
}
