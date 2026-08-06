import { useCallback, useEffect, useMemo, useState } from "react";
import { loadScripts, parseScripts, saveScripts } from "../lib/scriptStorage";
import type { PrompterScript, ScriptSource } from "../types";
import { appBrand } from "../lib/appBrand";

const sampleScript: PrompterScript = {
  id: "welcome-to-prompter",
  title: `Welcome to ${appBrand.name}`,
  body:
    "Great delivery starts with a clear idea and the confidence to say it naturally.\n\n" +
    `${appBrand.name} keeps your next words close to the camera, follows your voice, and waits when you improvise. ` +
    "The recording keeps running, so you can stay present instead of worrying about the controls.\n\n" +
    "Take a breath, look toward the lens, and make the message your own.",
  source: "manual",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function useLocalScripts() {
  const desktopStorage = window.prompterDesktop;
  const [scripts, setScripts] = useState<PrompterScript[]>(() =>
    desktopStorage ? [] : loadScripts(localStorage) ?? [sampleScript],
  );
  const [storageReady, setStorageReady] = useState(!desktopStorage);

  useEffect(() => {
    if (!desktopStorage) return;
    let cancelled = false;
    void desktopStorage
      .loadScripts()
      .then((saved) => {
        if (cancelled) return;
        setScripts(
          parseScripts(saved) ?? loadScripts(localStorage) ?? [sampleScript],
        );
        setStorageReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setScripts(loadScripts(localStorage) ?? [sampleScript]);
        setStorageReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [desktopStorage]);

  useEffect(() => {
    if (!storageReady) return;
    saveScripts(scripts, localStorage);
    if (desktopStorage) {
      void desktopStorage
        .saveScripts(scripts)
        .catch((error) => console.error("Could not save scripts:", error));
    }
  }, [desktopStorage, scripts, storageReady]);

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
