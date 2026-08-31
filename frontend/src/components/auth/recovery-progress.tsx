import { Check } from "lucide-react";

type RecoveryProgressProps = {
  labels: string[];
  currentStep: number;
};

export function RecoveryProgress({ labels, currentStep }: RecoveryProgressProps) {
  return (
    <div className="mb-5 flex items-start" aria-label={`Recovery step ${currentStep} of ${labels.length}`}>
      {labels.map((label, index) => {
        const step = index + 1;
        const complete = step < currentStep;
        const active = step === currentStep;
        return (
          <div key={label} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-center"><span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold ${complete ? "border-bank-blue bg-bank-blue text-white" : active ? "border-bank-blue bg-bank-light text-bank-blue" : "border-bank-border bg-white text-bank-muted"}`}>{complete ? <Check size={13} /> : step}</span><span className={`mt-1.5 whitespace-nowrap text-[9px] font-semibold ${active || complete ? "text-bank-navy" : "text-bank-muted"}`}>{label}</span></div>{step < labels.length ? <span className={`mt-3.5 h-px flex-1 ${complete ? "bg-bank-blue" : "bg-bank-border"}`} /> : null}
          </div>
        );
      })}
    </div>
  );
}
