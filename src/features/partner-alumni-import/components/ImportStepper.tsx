import type { ImportStep } from "../client/types";
import { stepperIndex } from "../client/resumeStep";

const STEPS = [
  { id: "upload", label: "Upload" },
  { id: "validation", label: "Validation" },
  { id: "review", label: "Review" },
  { id: "summary", label: "Summary" },
] as const;

export function ImportStepper({ currentStep }: { currentStep: ImportStep }) {
  const currentIdx = stepperIndex(currentStep);

  return (
    <nav
      aria-label="Import progress"
      className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4 text-sm"
    >
      {STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx || (currentStep === "mapping" && step.id === "upload");
        return (
          <span key={step.id} className="flex items-center gap-2">
            {idx > 0 ? <span className="text-slate-300">→</span> : null}
            <span
              className={[
                "rounded-md px-2 py-1",
                active
                  ? "bg-brand-primary-muted font-semibold text-brand-primary"
                  : done
                    ? "text-slate-700"
                    : "text-slate-400",
              ].join(" ")}
            >
              {done ? "✓ " : ""}
              {step.label}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
