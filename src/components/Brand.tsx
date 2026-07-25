import { AudioLines } from "lucide-react";

export function Brand() {
  return (
    <div className="brand" aria-label="Prompter">
      <span className="brand-mark">
        <AudioLines size={20} strokeWidth={2.4} />
      </span>
      <span>Prompter</span>
    </div>
  );
}
