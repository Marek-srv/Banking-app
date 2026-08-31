import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Check, KeyRound, UserRoundSearch } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { recoveryApi } from "@/api/recoveryApi";
import { AuthFlowShell } from "@/components/auth/auth-flow-shell";
import { RecoveryProgress } from "@/components/auth/recovery-progress";
import { OtpStep } from "@/components/registration/otp-step";
import { PasswordStep } from "@/components/registration/password-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/apiClient";

type Step = "customer" | "otp" | "password" | "success";

export function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("customer");
  const [customerId, setCustomerId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const requestMutation = useMutation({ mutationFn: recoveryApi.requestPassword });
  const verifyMutation = useMutation({ mutationFn: recoveryApi.verifyPassword });
  const resetMutation = useMutation({ mutationFn: recoveryApi.resetPassword });
  const currentStep = step === "customer" ? 1 : step === "otp" ? 2 : step === "password" ? 3 : 4;

  const requestOtp = async (event?: FormEvent) => {
    event?.preventDefault();
    setError("");
    const normalized = customerId.trim().toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(normalized)) { setError("Enter a valid Customer ID"); return; }
    try {
      const response = await requestMutation.mutateAsync({ customerId: normalized });
      setCustomerId(normalized);
      setMaskedEmail(response.maskedEmail);
      setStep("otp");
    } catch (requestError) { setError(getApiErrorMessage(requestError)); }
  };

  return (
    <AuthFlowShell headerStatus="Secure password recovery" eyebrow="Reset securely" title="Restore access with confidence." description="Verify your Customer ID and registered email before choosing a new banking password." footerMessage="Your password and OTP are never stored in plain text">
      <RecoveryProgress labels={["Customer ID", "Verify OTP", "New Password", "Complete"]} currentStep={currentStep} />
      {step === "customer" ? <div className="mx-auto max-w-[520px]"><div className="text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bank-light text-bank-blue"><UserRoundSearch size={23} /></span><h2 className="mt-3 text-2xl font-bold text-bank-navy">Forgot Password?</h2><p className="mt-1 text-sm text-bank-muted">Enter your Customer ID to verify your registered email.</p></div><form onSubmit={requestOtp} className="mt-6"><label className="block text-sm font-semibold text-bank-text">Customer ID<span className="relative mt-1.5 block"><KeyRound size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bank-muted" /><Input value={customerId} onChange={(event) => setCustomerId(event.target.value.toUpperCase())} autoComplete="username" maxLength={30} placeholder="CUST00001234" className="pl-11 uppercase" /></span></label>{error ? <p className="mt-3 text-xs text-red-600" role="alert">{error}</p> : null}<Button type="submit" size="large" className="mt-5 w-full" disabled={requestMutation.isPending}>{requestMutation.isPending ? "Sending OTP…" : "Continue"}</Button></form><Link to="/login" className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-bank-blue hover:underline"><ArrowLeft size={15} /> Back to Login</Link></div> : null}
      {step === "otp" ? <OtpStep email={maskedEmail} emailAlreadyMasked eyebrow="Secure verification" title="Verify your identity" helperText="OTP sent to your registered email" footerText="The full email address remains hidden. This OTP expires in 10 minutes." onResend={async () => { await requestMutation.mutateAsync({ customerId }); }} onVerified={async (otp) => { const response = await verifyMutation.mutateAsync({ customerId, otp }); setResetToken(response.resetToken); setStep("password"); }} /> : null}
      {step === "password" ? <PasswordStep eyebrow="Secure password reset" title="Create New Password" description="Choose a new password for your Internet Banking account." buttonLabel="Reset Password" minimumLength={12} requireLowercase onComplete={async (newPassword) => { await resetMutation.mutateAsync({ customerId, resetToken, newPassword }); setResetToken(""); setStep("success"); }} /> : null}
      {step === "success" ? <div className="mx-auto max-w-[500px] py-3 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check size={27} /></span><h2 className="mt-4 text-xl font-bold text-bank-navy">Password Reset Successful</h2><p className="mx-auto mt-2 max-w-[390px] text-sm leading-6 text-bank-muted">Your password has been updated. Sign in with your Customer ID and new password.</p><Button type="button" size="large" className="mt-6 w-full" onClick={() => navigate("/login")}>Go to Login</Button></div> : null}
    </AuthFlowShell>
  );
}
