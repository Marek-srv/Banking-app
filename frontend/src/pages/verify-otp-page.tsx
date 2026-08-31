import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { OtpStep } from "@/components/registration/otp-step";
import { PasswordStep } from "@/components/registration/password-step";
import { RegistrationShell } from "@/components/registration/registration-shell";
import { RegistrationSuccessStep } from "@/components/registration/registration-success-step";
import { useRegistrationStore } from "@/stores/registration.store";
import {
  useCompleteRegistrationMutation,
  useResendOtpMutation,
  useVerifyOtpMutation,
} from "@/hooks/useAuthMutations";

export function VerifyOtpPage() {
  const navigate = useNavigate();
  const isLeavingFlow = useRef(false);
  const details = useRegistrationStore((state) => state.details);
  const step = useRegistrationStore((state) => state.step);
  const setStep = useRegistrationStore((state) => state.setStep);
  const registrationToken = useRegistrationStore((state) => state.registrationToken);
  const customerId = useRegistrationStore((state) => state.customerId);
  const setRegistrationToken = useRegistrationStore((state) => state.setRegistrationToken);
  const setCustomerId = useRegistrationStore((state) => state.setCustomerId);
  const reset = useRegistrationStore((state) => state.reset);
  const verifyMutation = useVerifyOtpMutation();
  const resendMutation = useResendOtpMutation();
  const completeMutation = useCompleteRegistrationMutation();

  useEffect(() => {
    if (!details.email && !isLeavingFlow.current) navigate("/register", { replace: true });
  }, [details.email, navigate]);

  if (!details.email) return null;

  return (
    <RegistrationShell currentStep={step === 1 ? 2 : step}>
      {(step === 1 || step === 2) && (
        <OtpStep
          email={details.email}
          footerText="Enter the six-digit code sent to your registered email."
          onVerified={async (otp) => {
            const result = await verifyMutation.mutateAsync({ email: details.email, otp });
            setRegistrationToken(result.registrationToken);
            setStep(3);
          }}
          onResend={async () => {
            await resendMutation.mutateAsync({ email: details.email });
          }}
        />
      )}
      {step === 3 && registrationToken && (
        <PasswordStep
          minimumLength={12}
          requireLowercase
          onComplete={async (password) => {
            const result = await completeMutation.mutateAsync({
              registrationToken,
              password,
              confirmPassword: password,
            });
            setCustomerId(result.customerId);
            setStep(4);
          }}
        />
      )}
      {step === 4 && (
        <RegistrationSuccessStep
          customerId={customerId}
          onGoToLogin={() => {
            isLeavingFlow.current = true;
            reset();
            navigate("/login");
          }}
        />
      )}
    </RegistrationShell>
  );
}
