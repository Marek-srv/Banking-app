import type { ReactNode } from "react";
import { AuthFlowShell } from "@/components/auth/auth-flow-shell";
import { RegistrationProgress } from "@/components/registration/registration-progress";
import type { RegistrationStep } from "@/stores/registration.store";

type RegistrationShellProps = {
  currentStep: RegistrationStep;
  children: ReactNode;
};

export function RegistrationShell({ currentStep, children }: RegistrationShellProps) {
  return (
    <AuthFlowShell
      headerStatus="Secure online registration"
      eyebrow="Join π Bank"
      title="Open the door to simpler banking."
      description="A guided, secure registration experience designed around you."
      footerMessage="Your registration information is encrypted and protected"
    >
      <RegistrationProgress currentStep={currentStep} />
      {children}
    </AuthFlowShell>
  );
}
