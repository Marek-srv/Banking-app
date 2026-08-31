import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { CustomerDetailsStep } from "@/components/registration/customer-details-step";
import { RegistrationShell } from "@/components/registration/registration-shell";
import { useRegistrationStore } from "@/stores/registration.store";
import { useRegisterMutation } from "@/hooks/useAuthMutations";

export function RegisterPage() {
  const navigate = useNavigate();
  const details = useRegistrationStore((state) => state.details);
  const setDetails = useRegistrationStore((state) => state.setDetails);
  const setStep = useRegistrationStore((state) => state.setStep);
  const registerMutation = useRegisterMutation();

  useEffect(() => {
    setStep(1);
  }, [setStep]);

  return (
    <RegistrationShell currentStep={1}>
      <CustomerDetailsStep
        initialDetails={details}
        onContinue={async (nextDetails) => {
          await registerMutation.mutateAsync({
            firstName: nextDetails.firstName,
            lastName: nextDetails.lastName,
            dateOfBirth: nextDetails.dateOfBirth,
            mobile: nextDetails.mobileNumber,
            email: nextDetails.email,
          });
          setDetails(nextDetails);
          setStep(2);
          navigate("/verify-otp");
        }}
      />
    </RegistrationShell>
  );
}
