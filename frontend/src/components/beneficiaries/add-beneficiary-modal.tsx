import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { beneficiaryApi, type Beneficiary, type CreateBeneficiaryRequest } from "@/api/beneficiaryApi";
import { getApiErrorMessage } from "@/lib/apiClient";

type Step = "form" | "review" | "success";

type FormValues = {
  beneficiaryName: string;
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  nickname: string;
};

const initialValues: FormValues = { beneficiaryName: "", bankName: "", accountNumber: "", confirmAccountNumber: "", ifscCode: "", nickname: "" };

type AddBeneficiaryModalProps = {
  open: boolean;
  onClose: () => void;
  onTransfer: (beneficiary: Beneficiary) => void;
};

function maskForReview(value: string) {
  return `••••${value.slice(-4).padStart(4, "•")}`;
}

function validate(values: FormValues) {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  if (values.beneficiaryName.trim().length < 2) errors.beneficiaryName = "Enter the beneficiary name";
  if (values.bankName.trim().length < 2) errors.bankName = "Enter the bank name";
  if (!/^[A-Za-z0-9]{6,20}$/.test(values.accountNumber.trim())) errors.accountNumber = "Enter a valid 6–20 character account number";
  if (values.confirmAccountNumber !== values.accountNumber) errors.confirmAccountNumber = "Account numbers do not match";
  if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(values.ifscCode.trim())) errors.ifscCode = "Enter a valid 11-character IFSC code";
  if (values.nickname.trim().length > 100) errors.nickname = "Nickname must be 100 characters or fewer";
  return errors;
}

const fieldClass = "mt-1.5 h-10 w-full rounded-xl border border-bank-border bg-white px-3 text-xs text-bank-text outline-none transition placeholder:text-slate-400 focus:border-bank-blue focus:ring-2 focus:ring-blue-100";

export function AddBeneficiaryModal({ open, onClose, onTransfer }: AddBeneficiaryModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [created, setCreated] = useState<Beneficiary | null>(null);
  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: beneficiaryApi.createBeneficiary,
    onSuccess: async (beneficiary) => {
      setCreated(beneficiary);
      setStep("success");
      await queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
    },
  });

  const resetAndClose = () => {
    if (createMutation.isPending) return;
    setStep("form"); setValues(initialValues); setErrors({}); setCreated(null); createMutation.reset(); onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") resetAndClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!open) return null;

  const update = (field: keyof FormValues, value: string) => {
    const normalized = field === "ifscCode" || field === "accountNumber" || field === "confirmAccountNumber"
      ? value.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
      : value;
    setValues((current) => ({ ...current, [field]: normalized }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const review = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate(values);
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    createMutation.reset();
    setStep("review");
  };

  const submit = () => {
    if (createMutation.isPending) return;
    const payload: CreateBeneficiaryRequest = {
      beneficiaryName: values.beneficiaryName.trim(),
      beneficiaryAccountNo: values.accountNumber,
      bankName: values.bankName.trim(),
      bankCode: values.ifscCode.trim().toUpperCase(),
      ...(values.nickname.trim() ? { nickname: values.nickname.trim() } : {}),
    };
    createMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bank-dark/40 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="add-beneficiary-title">
      <button type="button" className="absolute inset-0" onClick={resetAndClose} aria-label="Close add beneficiary" />
      <section className="relative z-10 w-[590px] rounded-2xl bg-white shadow-[0_24px_70px_rgba(6,26,51,0.25)]">
        <header className="flex h-[66px] items-center justify-between border-b border-bank-border px-6">
          <div><h2 id="add-beneficiary-title" className="text-sm font-extrabold text-bank-navy">{step === "success" ? "Beneficiary Added" : "Add Beneficiary"}</h2><p className="mt-0.5 text-[10px] text-bank-muted">{step === "form" ? "Enter beneficiary bank details" : step === "review" ? "Review the details before adding" : "The beneficiary is ready to use"}</p></div>
          <button type="button" onClick={resetAndClose} disabled={createMutation.isPending} className="flex h-9 w-9 items-center justify-center rounded-full text-bank-muted hover:bg-bank-page hover:text-bank-navy disabled:opacity-50" aria-label="Close"><X size={18} /></button>
        </header>

        {step === "form" ? (
          <form onSubmit={review} className="p-6">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
              <label className="text-[10px] font-semibold text-bank-navy">Beneficiary Name<input value={values.beneficiaryName} onChange={(event) => update("beneficiaryName", event.target.value)} className={fieldClass} placeholder="Rahul Sharma" />{errors.beneficiaryName ? <span className="mt-1 block text-[9px] text-red-600">{errors.beneficiaryName}</span> : null}</label>
              <label className="text-[10px] font-semibold text-bank-navy">Bank Name<input value={values.bankName} onChange={(event) => update("bankName", event.target.value)} className={fieldClass} placeholder="HDFC Bank" />{errors.bankName ? <span className="mt-1 block text-[9px] text-red-600">{errors.bankName}</span> : null}</label>
              <label className="text-[10px] font-semibold text-bank-navy">Account Number<input value={values.accountNumber} onChange={(event) => update("accountNumber", event.target.value)} inputMode="text" maxLength={20} className={fieldClass} placeholder="Enter account number" />{errors.accountNumber ? <span className="mt-1 block text-[9px] text-red-600">{errors.accountNumber}</span> : null}</label>
              <label className="text-[10px] font-semibold text-bank-navy">Confirm Account Number<input value={values.confirmAccountNumber} onChange={(event) => update("confirmAccountNumber", event.target.value)} inputMode="text" maxLength={20} className={fieldClass} placeholder="Re-enter account number" />{errors.confirmAccountNumber ? <span className="mt-1 block text-[9px] text-red-600">{errors.confirmAccountNumber}</span> : null}</label>
              <label className="text-[10px] font-semibold text-bank-navy">IFSC Code<input value={values.ifscCode} onChange={(event) => update("ifscCode", event.target.value)} maxLength={11} className={`${fieldClass} uppercase`} placeholder="HDFC0001234" />{errors.ifscCode ? <span className="mt-1 block text-[9px] text-red-600">{errors.ifscCode}</span> : null}</label>
              <label className="text-[10px] font-semibold text-bank-navy">Nickname <span className="font-normal text-bank-muted">(Optional)</span><input value={values.nickname} onChange={(event) => update("nickname", event.target.value)} maxLength={100} className={fieldClass} placeholder="Rahul" />{errors.nickname ? <span className="mt-1 block text-[9px] text-red-600">{errors.nickname}</span> : null}</label>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-bank-border pt-4"><p className="flex items-center gap-1.5 text-[9px] text-bank-muted"><ShieldCheck size={13} className="text-emerald-600" /> Details are encrypted and securely submitted</p><button type="submit" className="inline-flex h-10 items-center gap-2 rounded-xl bg-bank-blue px-5 text-[11px] font-bold text-white hover:bg-blue-700">Review Details <ArrowRight size={14} /></button></div>
          </form>
        ) : null}

        {step === "review" ? (
          <div className="p-6">
            <div className="rounded-xl border border-bank-border bg-bank-page/60 px-4">
              {[['Beneficiary Name', values.beneficiaryName], ['Bank', values.bankName], ['Account', maskForReview(values.accountNumber)], ['IFSC', values.ifscCode], ['Nickname', values.nickname || 'Not provided']].map(([label, value]) => <div key={label} className="grid grid-cols-[150px_1fr] border-b border-bank-border/70 py-3 last:border-b-0"><span className="text-[10px] text-bank-muted">{label}</span><span className="text-right text-[11px] font-bold text-bank-text">{value}</span></div>)}
            </div>
            {createMutation.isError ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[10px] font-medium text-red-700">{getApiErrorMessage(createMutation.error)}</p> : null}
            <div className="mt-5 flex justify-between"><button type="button" disabled={createMutation.isPending} onClick={() => setStep("form")} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-bank-border px-4 text-[11px] font-bold text-bank-navy hover:border-bank-blue hover:text-bank-blue"><ArrowLeft size={14} /> Edit Details</button><button type="button" disabled={createMutation.isPending} onClick={submit} className="inline-flex h-10 min-w-[155px] items-center justify-center gap-2 rounded-xl bg-bank-blue px-5 text-[11px] font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{createMutation.isPending ? <><LoaderCircle size={14} className="animate-spin" /> Adding…</> : <>Confirm & Add <Check size={14} /></>}</button></div>
          </div>
        ) : null}

        {step === "success" && created ? (
          <div className="px-8 py-9 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check size={27} strokeWidth={2.5} /></span>
            <h3 className="mt-4 text-lg font-extrabold text-bank-navy">Beneficiary Added</h3>
            <p className="mt-1 text-xs text-bank-muted">{created.beneficiaryName} has been added successfully.</p>
            <p className="mt-3 text-xs font-bold tracking-[0.08em] text-bank-text">{created.maskedAccountNumber}</p>
            <div className="mx-auto mt-6 grid max-w-[330px] grid-cols-2 gap-3"><button type="button" onClick={() => onTransfer(created)} className="h-10 rounded-xl bg-bank-blue text-[11px] font-bold text-white hover:bg-blue-700">Transfer Now</button><button type="button" onClick={resetAndClose} className="h-10 rounded-xl border border-bank-border text-[11px] font-bold text-bank-navy hover:border-bank-blue hover:text-bank-blue">Done</button></div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
