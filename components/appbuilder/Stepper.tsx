"use client";

import { WIZARD_STEPS, type WizardStepId } from "@/lib/appbuilder/types";
import { stepIndex } from "@/lib/appbuilder/project";

export function WizardStepper({ current }: { current: WizardStepId }) {
  const idx = Math.max(0, stepIndex(current));
  return (
    <div className="stepper" aria-label="Wizard progress">
      {WIZARD_STEPS.map((s, i) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            className={`step-pill ${i < idx ? "done" : ""} ${i === idx ? "active" : ""}`}
          >
            <span className="n">{i < idx ? "✓" : i + 1}</span>
            <span className="hide-sm">{s.label}</span>
          </div>
          {i < WIZARD_STEPS.length - 1 ? <div className="step-sep" /> : null}
        </div>
      ))}
    </div>
  );
}
