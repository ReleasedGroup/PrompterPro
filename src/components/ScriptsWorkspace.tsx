import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Clock3,
  Copy,
  FilePlus2,
  MoreHorizontal,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { estimatedMinutes, formatRelativeDate, wordCount } from "../lib/format";
import type { PrompterScript } from "../types";

interface ScriptsWorkspaceProps {
  scripts: PrompterScript[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onGenerate: () => void;
  onUpdate: (
    id: string,
    patch: Partial<Pick<PrompterScript, "title" | "body">>,
  ) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onOpenStudio: (id: string) => void;
}

export function ScriptsWorkspace({
  scripts,
  activeId,
  onSelect,
  onCreate,
  onGenerate,
  onUpdate,
  onDelete,
  onDuplicate,
  onOpenStudio,
}: ScriptsWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const active = scripts.find((script) => script.id === activeId) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return scripts;
    return scripts.filter(
      (script) =>
        script.title.toLocaleLowerCase().includes(needle) ||
        script.body.toLocaleLowerCase().includes(needle),
    );
  }, [query, scripts]);

  useEffect(() => {
    if (!activeId && scripts[0]) onSelect(scripts[0].id);
  }, [activeId, onSelect, scripts]);

  function confirmDelete(script: PrompterScript) {
    if (window.confirm(`Delete “${script.title}”? This cannot be undone.`)) {
      onDelete(script.id);
      setMenuId(null);
    }
  }

  return (
    <main className="scripts-layout">
      <aside className="library-panel">
        <div className="library-heading">
          <div>
            <span className="eyebrow">Your words</span>
            <h1>Scripts</h1>
          </div>
          <button className="icon-button add-script" onClick={onCreate} aria-label="New script">
            <FilePlus2 size={19} />
          </button>
        </div>

        <button className="ai-draft-button" onClick={onGenerate}>
          <span className="ai-draft-icon">
            <Sparkles size={18} />
          </span>
          <span>
            <strong>Draft with AI</strong>
            <small>Start from an idea</small>
          </span>
          <ArrowRight size={17} />
        </button>

        <label className="search-box">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search scripts"
            aria-label="Search scripts"
          />
        </label>

        <div className="script-list" role="list">
          {filtered.map((script) => (
            <article
              key={script.id}
              className={`script-card ${script.id === activeId ? "active" : ""}`}
              onClick={() => onSelect(script.id)}
              role="listitem"
            >
              <div className="script-card-top">
                <span className="source-dot" data-source={script.source} />
                <button
                  className="card-menu-button"
                  aria-label={`Actions for ${script.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenuId(menuId === script.id ? null : script.id);
                  }}
                >
                  <MoreHorizontal size={18} />
                </button>
                {menuId === script.id && (
                  <div className="card-menu">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onDuplicate(script.id);
                        setMenuId(null);
                      }}
                    >
                      <Copy size={15} /> Duplicate
                    </button>
                    <button
                      className="danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        confirmDelete(script);
                      }}
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                )}
              </div>
              <h3>{script.title || "Untitled script"}</h3>
              <p>{script.body || "Start writing your script…"}</p>
              <footer>
                <span>{formatRelativeDate(script.updatedAt)}</span>
                <span>{wordCount(script.body)} words</span>
              </footer>
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="empty-search">
              No scripts match “{query}”.
            </div>
          )}
        </div>
      </aside>

      <section className="editor-panel">
        {active ? (
          <>
            <header className="editor-toolbar">
              <div className="editor-meta">
                <span className="save-status">
                  <span className="saved-dot" />
                  Saved on this device
                </span>
                <span className="meta-divider" />
                <span>
                  <Clock3 size={14} />
                  {estimatedMinutes(active.body)} min read
                </span>
              </div>
              <button
                className="primary-button studio-button"
                disabled={!active.body.trim()}
                onClick={() => onOpenStudio(active.id)}
              >
                Open in Studio
                <ArrowRight size={17} />
              </button>
            </header>

            <div className="editor-canvas">
              <input
                className="title-input"
                aria-label="Script title"
                value={active.title}
                placeholder="Untitled script"
                onChange={(event) =>
                  onUpdate(active.id, { title: event.target.value })
                }
              />
              <textarea
                className="body-input"
                aria-label="Script body"
                value={active.body}
                placeholder="Write the words you want to say…"
                onChange={(event) =>
                  onUpdate(active.id, { body: event.target.value })
                }
              />
              <footer className="editor-footer">
                <span>{wordCount(active.body)} words</span>
                <span>About {estimatedMinutes(active.body)} min spoken</span>
              </footer>
            </div>
          </>
        ) : (
          <div className="empty-editor">
            <FilePlus2 size={34} />
            <h2>Create your first script</h2>
            <p>Write it yourself or turn a rough idea into an editable draft.</p>
            <button className="primary-button" onClick={onCreate}>
              New script
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
