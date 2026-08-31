import { ClipboardEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { MailCheck, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/apiClient";

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 10 * 60;
const RESEND_DELAY_SECONDS = 30;

type OtpStepProps = {
  email: string;
  onVerified: (otp: string) => void | Promise<void>;
  onResend?: () => void | Promise<void>;
  emailAlreadyMasked?: boolean;
  eyebrow?: string;
  title?: string;
  helperText?: string;
  footerText?: string;
};

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function maskEmail(email: string) {
  const [localPart, domain = ""] = email.split("@");
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

export function OtpStep({
  email,
  onVerified,
  onResend,
  emailAlreadyMasked = false,
  eyebrow = "Step 2 of 4",
  title = "Verify your email",
  helperText = "OTP sent to",
  footerText = "For this UI phase, any complete six-digit OTP continues the flow.",
}: OtpStepProps) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [secondsLeft, setSecondsLeft] = useState(OTP_EXPIRY_SECONDS);
  const [resendWait, setResendWait] = useState(RESEND_DELAY_SECONDS);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
      setResendWait((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  function updateDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    setError("");

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index]) {
        setDigits((current) => current.map((digit, position) => position === index ? "" : digit));
      } else if (index > 0) {
        setDigits((current) => current.map((digit, position) => position === index - 1 ? "" : digit));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const pastedDigits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pastedDigits) return;

    const next = Array(OTP_LENGTH).fill("");
    pastedDigits.split("").forEach((digit, index) => {
      next[index] = digit;
    });
    setDigits(next);
    setError("");
    inputRefs.current[Math.min(pastedDigits.length, OTP_LENGTH) - 1]?.focus();
  }

  async function verifyOtp() {
    if (secondsLeft === 0) {
      setError("This OTP has expired. Please request a new one.");
      return;
    }
    if (digits.some((digit) => !digit)) {
      setError("Enter the complete 6-digit OTP.");
      return;
    }
    try {
      setPending(true);
      setError("");
      await onVerified(digits.join(""));
    } catch (verificationError) {
      setError(getApiErrorMessage(verificationError));
    } finally {
      setPending(false);
    }
  }

  async function resendOtp() {
    try {
      setPending(true);
      setError("");
      setFeedback("");
      await onResend?.();
      setDigits(Array(OTP_LENGTH).fill(""));
      setSecondsLeft(OTP_EXPIRY_SECONDS);
      setResendWait(RESEND_DELAY_SECONDS);
      setFeedback("A new OTP has been sent.");
      window.setTimeout(() => inputRefs.current[0]?.focus(), 0);
    } catch (resendError) {
      setError(getApiErrorMessage(resendError));
    } finally {
      setPending(false);
    }
  }

  const complete = digits.every(Boolean);

  return (
    <div className="mx-auto max-w-[520px] text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bank-light text-bank-blue">
        <MailCheck size={24} />
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-bank-blue">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-bold tracking-[-0.025em] text-bank-navy">{title}</h2>
      <p className="mt-2 text-sm text-bank-muted">{helperText}</p>
      <p className="mt-0.5 text-sm font-semibold text-bank-navy">{emailAlreadyMasked ? email : maskEmail(email)}</p>

      <div className="mt-6 flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => { inputRefs.current[index] = element; }}
            value={digit}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            aria-label={`OTP digit ${index + 1}`}
            className={cn(
              "h-12 w-11 rounded-lg border bg-white text-center text-xl font-bold text-bank-navy outline-none transition focus:border-bank-blue focus:ring-4 focus:ring-blue-500/10 sm:h-14 sm:w-12",
              error ? "border-red-400" : digit ? "border-bank-blue" : "border-bank-border",
            )}
            onChange={(event) => updateDigit(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
          />
        ))}
      </div>

      <p className={`mt-3 min-h-5 text-xs ${error ? "text-red-600" : "text-emerald-700"}`} role={error ? "alert" : undefined}>{error || feedback}</p>
      <p className={cn("mt-1 text-sm font-medium", secondsLeft < 60 ? "text-red-600" : "text-bank-muted")}>
        Expires in <span className="font-semibold tabular-nums text-bank-navy">{formatTime(secondsLeft)}</span>
      </p>

      <Button type="button" size="large" className="mt-5 w-full" disabled={!complete || secondsLeft === 0 || pending} onClick={verifyOtp}>
        {pending ? "Verifying…" : "Verify OTP"}
      </Button>

      <button
        type="button"
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-bank-blue transition hover:underline disabled:cursor-not-allowed disabled:text-bank-muted disabled:no-underline"
        disabled={resendWait > 0 || pending}
        onClick={resendOtp}
      >
        <RefreshCw size={15} />
        {resendWait > 0 ? `Resend OTP in ${resendWait}s` : "Resend OTP"}
      </button>
      <p className="mt-4 text-xs leading-5 text-bank-muted">{footerText}</p>
    </div>
  );
}
