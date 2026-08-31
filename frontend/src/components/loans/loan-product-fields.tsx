import { useState } from "react";
import { LOAN_PRODUCTS, type LoanType } from "@/api/loanApi";

const productLabels: Record<LoanType, string> = {
  PERSONAL: "Personal Loan",
  HOME: "Home Loan",
  VEHICLE: "Vehicle Loan",
  EDUCATION: "Education Loan",
};

const subtypeLabels: Record<string, string> = {
  UNSECURED_PERSONAL: "Unsecured Personal",
  HOME_PURCHASE: "Home Purchase",
  NEW_VEHICLE: "New Vehicle",
  HIGHER_EDUCATION: "Higher Education",
};

export function LoanProductFields() {
  const [loanType, setLoanType] = useState<LoanType>("PERSONAL");
  const subtypes = LOAN_PRODUCTS[loanType];

  return (
    <>
      <label className="block text-[11px] font-bold text-bank-navy">
        Loan Type
        <select
          name="loanType"
          value={loanType}
          onChange={(event) => setLoanType(event.target.value as LoanType)}
          required
          className="mt-1.5 h-10 w-full rounded-lg border border-bank-border px-3 text-xs font-normal"
        >
          {(Object.keys(LOAN_PRODUCTS) as LoanType[]).map((type) => (
            <option key={type} value={type}>{productLabels[type]}</option>
          ))}
        </select>
      </label>
      <label className="block text-[11px] font-bold text-bank-navy">
        Loan Subtype
        <select
          key={loanType}
          name="loanSubtype"
          defaultValue={subtypes[0]}
          required
          className="mt-1.5 h-10 w-full rounded-lg border border-bank-border px-3 text-xs font-normal"
        >
          {subtypes.map((subtype) => (
            <option key={subtype} value={subtype}>{subtypeLabels[subtype]}</option>
          ))}
        </select>
      </label>
    </>
  );
}
