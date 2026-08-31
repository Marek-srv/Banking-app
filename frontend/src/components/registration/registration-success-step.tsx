import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

type RegistrationSuccessStepProps = {
  customerId: string;
  onGoToLogin: () => void;
};

export function RegistrationSuccessStep({ customerId, onGoToLogin }: RegistrationSuccessStepProps) {
  return (
    <div className="mx-auto max-w-[500px] py-2 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
        <Check size={34} strokeWidth={3} />
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-bank-blue">Step 4 of 4</p>
      <h2 className="mt-1 text-[26px] font-bold tracking-[-0.025em] text-bank-navy">Registration Successful</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-bank-muted">
        Welcome to π Bank. Keep your Customer ID safe—you will need it to sign in.
      </p>

      <div className="mx-auto mt-6 max-w-sm rounded-xl border border-blue-100 bg-bank-light px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-bank-muted">Your Customer ID</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <p className="text-2xl font-bold tracking-[0.08em] text-bank-navy">{customerId}</p>
          <Copy size={17} className="text-bank-blue" aria-hidden="true" />
        </div>
      </div>

      <Button type="button" size="large" className="mt-6 w-full max-w-sm" onClick={onGoToLogin}>
        Go to Login
      </Button>
      <p className="mt-4 text-xs text-bank-muted">For your security, you have not been logged in automatically.</p>
    </div>
  );
}
