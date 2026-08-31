import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { RegistrationStep } from "@/stores/registration.store";

const steps = [
  { number: 1, label: "Details" },
  { number: 2, label: "Verify Email" },
  { number: 3, label: "Password" },
  { number: 4, label: "Complete" },
] as const;

type RegistrationProgressProps = {
  currentStep: RegistrationStep;
};

export function RegistrationProgress({ currentStep }: RegistrationProgressProps) {
  return (
    <nav className="mb-6" aria-label="Registration progress">
      <ol className="flex items-start">
        {steps.map((step, index) => {
          const isComplete = step.number < currentStep;
          const isCurrent = step.number === currentStep;

          return (
            <li key={step.number} className="relative flex flex-1 flex-col items-center">
              {index > 0 && (
                <span
                  className={cn(
                    "absolute right-1/2 top-[15px] h-0.5 w-full -translate-y-1/2",
                    step.number <= currentStep ? "bg-bank-blue" : "bg-bank-border",
                  )}
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 bg-white text-xs font-bold transition-colors",
                  (isComplete || isCurrent) && "border-bank-blue",
                  isComplete && "bg-bank-blue text-white",
                  isCurrent && "text-bank-blue shadow-[0_0_0_4px_rgba(11,99,229,0.10)]",
                  !isComplete && !isCurrent && "border-bank-border text-bank-muted",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isComplete ? <Check size={15} strokeWidth={3} /> : step.number}
              </span>
              <span
                className={cn(
                  "mt-2 text-center text-[10px] font-semibold sm:text-xs",
                  isComplete || isCurrent ? "text-bank-navy" : "text-bank-muted",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
