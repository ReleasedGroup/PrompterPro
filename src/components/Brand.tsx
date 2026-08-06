import { AudioLines } from "lucide-react";
import { appBrand } from "../lib/appBrand";

export function Brand() {
  return (
    <div className="brand" aria-label={appBrand.name}>
      <span className="brand-mark">
        <AudioLines size={20} strokeWidth={2.4} />
      </span>
      <span>{appBrand.name}</span>
    </div>
  );
}
