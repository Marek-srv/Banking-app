import { FormEvent, useMemo, useState } from "react";
import { Check, Circle, Eye, EyeOff, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/apiClient";

type PasswordStepProps = {
  onComplete: (password: string) => void | Promise<void>;
  eyebrow?: string;
  title?: string;
  description?: string;
  buttonLabel?: string;
  minimumLength?: number;
  requireLowercase?: boolean;
};

export function PasswordStep({
  onComplete,
  eyebrow = "Step 3 of 4",
  title = "Create Password",
  description = "Choose a strong password to protect your account.",
  buttonLabel = "Create Account",
  minimumLength = 8,
  requireLowercase = false,
}: PasswordStepProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const requirements = useMemo(() => [
    { label: `Minimum ${minimumLength} characters`, valid: password.length >= minimumLength },
    { label: "Uppercase letter", valid: /[A-Z]/.test(password) },
    ...(requireLowercase
      ? [{ label: "Lowercase letter", valid: /[a-z]/.test(password) }]
      : []),
    { label: "Number", valid: /\d/.test(password) },
    { label: "Special character", valid: /[^A-Za-z0-9]/.test(password) },
  ], [minimumLength, password, requireLowercase]);

  const passwordValid = requirements.every((requirement) => requirement.valid);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (passwordValid && passwordsMatch) {
      try {
        setPending(true);
        setError("");
        await onComplete(password);
      } catch (submissionError) {
        setError(getApiErrorMessage(submissionError));
      } finally {
        setPending(false);
      }
    }
  }

  return (
    <div className="mx-auto max-w-[520px]">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bank-light text-bank-blue">
          <KeyRound size={23} />
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-bank-blue">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-[-0.025em] text-bank-navy">{title}</h2>
        <p className="mt-1 text-sm text-bank-muted">{description}</p>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-sm font-semibold text-bank-text">Password</label>
          <div className="relative">
            <Input
              id="new-password"
              value={password}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create a strong password"
              className="pr-12"
              aria-invalid={submitted && !passwordValid}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-bank-muted hover:text-bank-blue"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-bank-border bg-bank-page px-4 py-3">
          {requirements.map((requirement) => (
            <div key={requirement.label} className={cn("flex items-center gap-2 text-xs", requirement.valid ? "text-emerald-700" : "text-bank-muted")}>
              {requirement.valid ? <Check size={14} strokeWidth={3} /> : <Circle size={12} />}
              <span>{requirement.label}</span>
            </div>
          ))}
        </div>

        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-semibold text-bank-text">Confirm Password</label>
          <div className="relative">
            <Input
              id="confirm-password"
              value={confirmPassword}
              type={showConfirmation ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              className="pr-12"
              aria-invalid={submitted && !passwordsMatch}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-bank-muted hover:text-bank-blue"
              aria-label={showConfirmation ? "Hide password confirmation" : "Show password confirmation"}
              onClick={() => setShowConfirmation((value) => !value)}
            >
              {showConfirmation ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
          <p className={cn("mt-1 min-h-4 text-xs", confirmPassword && passwordsMatch ? "text-emerald-700" : "text-red-600")}>
            {confirmPassword && passwordsMatch ? "Passwords match" : submitted && !passwordsMatch ? "Passwords must match" : ""}
          </p>
        </div>

        {error ? <p className="text-center text-xs text-red-600" role="alert">{error}</p> : null}
        <Button type="submit" size="large" className="w-full" disabled={!passwordValid || !passwordsMatch || pending}>
          {pending ? "Updating…" : buttonLabel}
        </Button>
      </form>
    </div>
  );
}
