import { useState, type FormEvent } from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";
import type { GenerateScriptInput } from "../types";

interface AIGeneratorProps {
  onClose: () => void;
  onGenerated: (title: string, body: string) => void;
}

const initialForm: GenerateScriptInput = {
  topic: "",
  audience: "",
  tone: "Warm and confident",
  durationMinutes: 2,
  keyPoints: "",
};

export function AIGenerator({ onClose, onGenerated }: AIGeneratorProps) {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.topic.trim()) {
      setError("Give the script a topic first.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { script?: string; error?: string };
      if (!response.ok || !data.script) {
        throw new Error(data.error || "The script could not be generated.");
      }
      onGenerated(form.topic.trim().slice(0, 80), data.script);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The script could not be generated.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="generator-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="generator-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        <div className="generator-kicker">
          <Sparkles size={16} />
          AI draft
        </div>
        <h2 id="generator-title">Turn an idea into something worth saying.</h2>
        <p className="muted">
          Give Prompter the substance. You stay in control of every word.
        </p>

        <form onSubmit={handleSubmit} className="generator-form">
          <label>
            <span>What are you talking about?</span>
            <input
              autoFocus
              value={form.topic}
              maxLength={300}
              placeholder="e.g. Why small teams should ship sooner"
              onChange={(event) =>
                setForm({ ...form, topic: event.target.value })
              }
            />
          </label>
          <div className="field-row">
            <label>
              <span>Audience</span>
              <input
                value={form.audience}
                maxLength={200}
                placeholder="Founders and product leads"
                onChange={(event) =>
                  setForm({ ...form, audience: event.target.value })
                }
              />
            </label>
            <label>
              <span>Tone</span>
              <select
                value={form.tone}
                onChange={(event) =>
                  setForm({ ...form, tone: event.target.value })
                }
              >
                <option>Warm and confident</option>
                <option>Direct and energetic</option>
                <option>Calm and thoughtful</option>
                <option>Conversational and playful</option>
                <option>Clear and professional</option>
              </select>
            </label>
          </div>
          <div className="field-row duration-row">
            <label>
              <span>Length</span>
              <div className="duration-control">
                {[1, 2, 3, 5].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className={form.durationMinutes === minutes ? "selected" : ""}
                    onClick={() =>
                      setForm({ ...form, durationMinutes: minutes })
                    }
                  >
                    {minutes}m
                  </button>
                ))}
              </div>
            </label>
            <div className="word-target">
              ≈ {form.durationMinutes * 140} spoken words
            </div>
          </div>
          <label>
            <span>Key points</span>
            <textarea
              value={form.keyPoints}
              maxLength={2500}
              rows={5}
              placeholder={"One idea per line\nInclude facts that must stay accurate\nEnd with the action you want"}
              onChange={(event) =>
                setForm({ ...form, keyPoints: event.target.value })
              }
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="primary-button generate-submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                Writing your draft…
              </>
            ) : (
              <>
                Generate editable draft
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
