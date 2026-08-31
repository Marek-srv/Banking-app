import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Check, Mail, UserSearch } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { recoveryApi } from "@/api/recoveryApi";
import { AuthFlowShell } from "@/components/auth/auth-flow-shell";
import { RecoveryProgress } from "@/components/auth/recovery-progress";
import { OtpStep } from "@/components/registration/otp-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/apiClient";

type Step = "details" | "otp" | "success";

export function ForgotCustomerIdPage() {
  const [step, setStep] = useState<Step>("details");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const requestMutation = useMutation({ mutationFn: recoveryApi.requestCustomerId });
  const verifyMutation = useMutation({ mutationFn: recoveryApi.verifyCustomerId });
  const currentStep = step === "details" ? 1 : step === "otp" ? 2 : 3;

  const requestOtp = async (event?: FormEvent) => {
    event?.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || !dateOfBirth) { setError("Enter your registered email and date of birth"); return; }
    try {
      await requestMutation.mutateAsync({ email: email.trim().toLowerCase(), dateOfBirth });
      setStep("otp");
    } catch (requestError) { setError(getApiErrorMessage(requestError)); }
  };

  return (
    <AuthFlowShell headerStatus="Secure account recovery" eyebrow="Recover access" title="We’ll help you get back to banking." description="Verify your registered details securely to recover your π Bank credentials." footerMessage="Recovery details and OTPs are encrypted and protected">
      <RecoveryProgress labels={["Your Details", "Verify OTP", "Customer ID"]} currentStep={currentStep} />
      {step === "details" ? (
        <div className="mx-auto max-w-[520px]"><div className="text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bank-light text-bank-blue"><UserSearch size={23} /></span><h2 className="mt-3 text-2xl font-bold text-bank-navy">Forgot Customer ID?</h2><p className="mt-1 text-sm text-bank-muted">Enter the details registered with your account.</p></div>
          <form onSubmit={requestOtp} className="mt-5 space-y-4"><label className="block text-sm font-semibold text-bank-text">Registered Email<span className="relative mt-1.5 block"><Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bank-muted" /><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="name@example.com" className="pl-11" /></span></label><label className="block text-sm font-semibold text-bank-text">Date of Birth<span className="relative mt-1.5 block"><CalendarDays size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bank-muted" /><Input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} max={new Date().toISOString().slice(0, 10)} className="pl-11" /></span></label>{error ? <p className="text-xs text-red-600" role="alert">{error}</p> : null}<Button type="submit" size="large" className="w-full" disabled={requestMutation.isPending}>{requestMutation.isPending ? "Sending OTP…" : "Continue"}</Button></form><Link to="/login" className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-bank-blue hover:underline"><ArrowLeft size={15} /> Back to Login</Link>
        </div>
      ) : null}
      {step === "otp" ? <OtpStep email={email} eyebrow="Secure verification" title="Verify your email" footerText="For your security, the OTP can be used only once and expires in 10 minutes." onResend={async () => { await requestMutation.mutateAsync({ email: email.trim().toLowerCase(), dateOfBirth }); }} onVerified={async (otp) => { const result = await verifyMutation.mutateAsync({ email: email.trim().toLowerCase(), dateOfBirth, otp }); setCustomerId(result.customerId); setStep("success"); }} /> : null}
      {step === "success" ? <div className="mx-auto max-w-[500px] py-3 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check size={27} /></span><h2 className="mt-4 text-xl font-bold text-bank-navy">Customer ID Recovered</h2><p className="mt-4 text-sm text-bank-muted">Your Customer ID</p><p className="mt-2 rounded-xl border border-blue-100 bg-bank-light px-4 py-4 text-xl font-extrabold tracking-[0.09em] text-bank-navy">{customerId}</p><Button type="button" size="large" className="mt-6 w-full" onClick={() => navigate("/login")}>Go to Login</Button></div> : null}
    </AuthFlowShell>
  );
}
