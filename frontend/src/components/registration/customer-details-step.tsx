import { FormEvent, useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RegistrationDetails } from "@/stores/registration.store";
import { getApiErrorMessage } from "@/lib/apiClient";

type FieldErrors = Partial<Record<keyof RegistrationDetails, string>>;

type CustomerDetailsStepProps = {
  initialDetails: RegistrationDetails;
  onContinue: (details: RegistrationDetails) => void | Promise<void>;
};

const namePattern = /^[a-zA-Z][a-zA-Z .'-]*$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mobilePattern = /^[6-9]\d{9}$/;

function validateDetails(details: RegistrationDetails): FieldErrors {
  const errors: FieldErrors = {};

  if (details.firstName.trim().length < 2 || !namePattern.test(details.firstName.trim())) {
    errors.firstName = "Enter a valid first name";
  }
  if (details.lastName.trim().length < 2 || !namePattern.test(details.lastName.trim())) {
    errors.lastName = "Enter a valid last name";
  }
  if (!details.dateOfBirth) {
    errors.dateOfBirth = "Select your date of birth";
  } else if (new Date(details.dateOfBirth) >= new Date()) {
    errors.dateOfBirth = "Date of birth must be in the past";
  }
  if (!mobilePattern.test(details.mobileNumber)) {
    errors.mobileNumber = "Enter a valid 10-digit mobile number";
  }
  if (!emailPattern.test(details.email.trim())) {
    errors.email = "Enter a valid email address";
  }

  return errors;
}

export function CustomerDetailsStep({ initialDetails, onContinue }: CustomerDetailsStepProps) {
  const [details, setDetails] = useState(initialDetails);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState("");
  const [pending, setPending] = useState(false);

  function updateField(field: keyof RegistrationDetails, value: string) {
    setDetails((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateDetails(details);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      try {
        setPending(true);
        setRequestError("");
        await onContinue({
          ...details,
          firstName: details.firstName.trim(),
          lastName: details.lastName.trim(),
          email: details.email.trim().toLowerCase(),
        });
      } catch (error) {
        setRequestError(getApiErrorMessage(error));
      } finally {
        setPending(false);
      }
    }
  }

  const fields: Array<{
    key: keyof RegistrationDetails;
    label: string;
    type: string;
    placeholder: string;
    autoComplete: string;
    inputMode?: "email" | "numeric" | "text";
  }> = [
    { key: "firstName", label: "First Name", type: "text", placeholder: "Enter first name", autoComplete: "given-name" },
    { key: "lastName", label: "Last Name", type: "text", placeholder: "Enter last name", autoComplete: "family-name" },
    { key: "dateOfBirth", label: "Date of Birth", type: "date", placeholder: "", autoComplete: "bday" },
    { key: "mobileNumber", label: "Mobile Number", type: "tel", placeholder: "10-digit mobile number", autoComplete: "tel", inputMode: "numeric" },
    { key: "email", label: "Email Address", type: "email", placeholder: "name@example.com", autoComplete: "email", inputMode: "email" },
  ];

  return (
    <div>
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bank-blue">Step 1 of 4</p>
        <h2 className="mt-1 text-2xl font-bold tracking-[-0.025em] text-bank-navy">Customer Details</h2>
        <p className="mt-1 text-sm text-bank-muted">Tell us a little about yourself to get started.</p>
      </div>

      <form className="mt-5" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.key} className={field.key === "email" ? "sm:col-span-2" : undefined}>
              <label htmlFor={field.key} className="mb-1.5 block text-sm font-semibold text-bank-text">
                {field.label}
              </label>
              <Input
                id={field.key}
                type={field.type}
                value={details[field.key]}
                placeholder={field.placeholder}
                autoComplete={field.autoComplete}
                inputMode={field.inputMode}
                maxLength={field.key === "mobileNumber" ? 10 : undefined}
                max={field.key === "dateOfBirth" ? new Date().toISOString().split("T")[0] : undefined}
                aria-invalid={Boolean(errors[field.key])}
                aria-describedby={errors[field.key] ? `${field.key}-error` : undefined}
                className={errors[field.key] ? "border-red-500 focus:border-red-500 focus:ring-red-500/10" : undefined}
                onChange={(event) => {
                  const value = field.key === "mobileNumber"
                    ? event.target.value.replace(/\D/g, "")
                    : event.target.value;
                  updateField(field.key, value);
                }}
              />
              <p id={`${field.key}-error`} className="mt-1 min-h-4 text-xs text-red-600" role={errors[field.key] ? "alert" : undefined}>
                {errors[field.key] ?? ""}
              </p>
            </div>
          ))}
        </div>

        {requestError ? <p className="mb-2 text-center text-xs text-red-600" role="alert">{requestError}</p> : null}
        <Button type="submit" size="large" disabled={pending} className="mt-2 w-full gap-2 sm:ml-auto sm:flex sm:w-48">
          {pending ? "Starting…" : "Continue"} {!pending ? <ArrowRight size={17} /> : null}
        </Button>
      </form>
    </div>
  );
}
