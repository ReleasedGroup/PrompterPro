import { useEffect, useState } from "react";
import { Library, Radio, ShieldCheck } from "lucide-react";
import { AIGenerator } from "./components/AIGenerator";
import { Brand } from "./components/Brand";
import { ScriptsWorkspace } from "./components/ScriptsWorkspace";
import { Studio } from "./components/Studio";
import { useLocalScripts } from "./hooks/useLocalScripts";
import { getAiDraftAvailability } from "./lib/aiDraftAvailability";
import { allowStudioExit } from "./lib/studioNavigation";
import type { WorkspaceView } from "./types";

export default function App() {
  const {
    scripts,
    byId,
    createScript,
    updateScript,
    deleteScript,
    duplicateScript,
  } = useLocalScripts();
  const [view, setView] = useState<WorkspaceView>("scripts");
  const [activeId, setActiveId] = useState<string | null>(
    scripts[0]?.id ?? null,
  );
  const [showGenerator, setShowGenerator] = useState(false);
  const [studioRecording, setStudioRecording] = useState(false);
  const [aiDraftAvailable, setAiDraftAvailable] = useState(false);

  const activeScript = activeId ? byId.get(activeId) ?? null : null;

  useEffect(() => {
    void getAiDraftAvailability().then(setAiDraftAvailable);
  }, []);

  function newScript() {
    const script = createScript();
    setActiveId(script.id);
    setView("scripts");
  }

  function openStudio(id: string) {
    setActiveId(id);
    setView("studio");
  }

  function openScripts() {
    if (
      view === "studio" &&
      !allowStudioExit(studioRecording, (message) => window.confirm(message))
    ) {
      return;
    }
    setView("scripts");
  }

  function removeScript(id: string) {
    deleteScript(id);
    if (activeId === id) {
      const next = scripts.find((script) => script.id !== id);
      setActiveId(next?.id ?? null);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Brand />
        <nav aria-label="Primary navigation">
          <button
            className={view === "scripts" ? "active" : ""}
            onClick={openScripts}
          >
            <Library size={17} />
            Scripts
          </button>
          <button
            className={view === "studio" ? "active" : ""}
            onClick={() => activeScript && setView("studio")}
            disabled={!activeScript?.body.trim()}
          >
            <Radio size={17} />
            Studio
          </button>
        </nav>
        <div className="local-badge" title="Scripts and recordings stay local">
          <ShieldCheck size={16} />
          Local-first
        </div>
      </header>

      {view === "studio" && activeScript ? (
        <Studio
          script={activeScript}
          onBack={openScripts}
          onRecordingChange={setStudioRecording}
        />
      ) : (
        <ScriptsWorkspace
          scripts={scripts}
          activeId={activeId}
          onSelect={setActiveId}
          onCreate={newScript}
          aiDraftAvailable={aiDraftAvailable}
          onGenerate={() => setShowGenerator(true)}
          onUpdate={updateScript}
          onDelete={removeScript}
          onDuplicate={duplicateScript}
          onOpenStudio={openStudio}
        />
      )}

      {aiDraftAvailable && showGenerator && (
        <AIGenerator
          onClose={() => setShowGenerator(false)}
          onGenerated={(title, body) => {
            const script = createScript(title, body, "ai");
            setActiveId(script.id);
            setShowGenerator(false);
          }}
        />
      )}
    </div>
  );
}
