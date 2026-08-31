import { Headphones, Mail, Phone, ShieldCheck } from "lucide-react";

import { BankIllustration } from "@/components/bank-illustration";
import { BrandMark } from "@/components/brand-mark";
import { LoginCard } from "@/components/login-card";

const supportItems = [
  { icon: ShieldCheck, title: "Safe & Secure", detail: "Protected banking" },
  { icon: Headphones, title: "24x7 Customer Support", detail: "We're always here" },
  { icon: Phone, title: "1800 123 9999", detail: "Toll-free helpline" },
  { icon: Mail, title: "support@pi.bank", detail: "Email support" },
];

export function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bank-page">
      <header className="relative z-10 flex h-[70px] shrink-0 items-center border-b border-bank-border bg-white px-6 shadow-[0_2px_12px_rgba(11,31,58,0.04)] lg:px-12 xl:px-[6vw]">
        <BrandMark />
        <div className="ml-auto hidden items-center gap-2 text-xs font-medium text-bank-muted sm:flex">
          <ShieldCheck size={16} className="text-bank-blue" />
          RBI-grade secure banking experience
        </div>
      </header>

      <main className="grid flex-1 lg:grid-cols-[53%_47%]">
        <section className="relative flex min-h-[430px] flex-col overflow-hidden bg-white px-6 pb-4 pt-8 sm:px-12 lg:min-h-0 lg:justify-center lg:px-[6vw] lg:py-6">
          <div className="pointer-events-none absolute -left-24 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-bank-light/60 blur-3xl" />
          <div className="relative mx-auto w-full max-w-[680px]">
            <div className="mb-1 pl-2 lg:mb-0">
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-bank-blue">Banking made simple</p>
              <h2 className="mt-1 max-w-[480px] text-2xl font-bold tracking-[-0.03em] text-bank-navy xl:text-[30px]">
                Your trusted bank, wherever life takes you.
              </h2>
            </div>
            <BankIllustration />
          </div>
        </section>

        <section className="relative flex items-center justify-center overflow-hidden bg-bank-page px-5 py-9 sm:px-10 lg:border-l lg:border-bank-border/70 lg:py-7">
          <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-blue-100/60 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-blue-100/50 blur-3xl" />
          <div className="relative z-10 w-full max-w-[465px]">
            <LoginCard />
            <p className="mt-4 text-center text-xs text-bank-muted">
              Never share your password or OTP with anyone.
            </p>
          </div>
        </section>
      </main>

      <footer className="shrink-0 border-t border-bank-border bg-white px-5 py-4 lg:px-12 lg:py-3 xl:px-[6vw]">
        <div className="mx-auto flex max-w-[1320px] flex-col items-center justify-between gap-4 lg:flex-row">
          <div className="grid w-full grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 lg:max-w-[850px] lg:gap-8">
            {supportItems.map(({ icon: Icon, title, detail }) => (
              <div key={title} className="flex items-center gap-2.5">
                <Icon size={19} className="shrink-0 text-bank-blue" strokeWidth={2} />
                <div>
                  <p className="text-xs font-semibold text-bank-navy xl:text-[13px]">{title}</p>
                  <p className="mt-0.5 hidden text-[10px] text-bank-muted xl:block">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="whitespace-nowrap text-xs text-bank-muted">© 2026 π Bank</p>
        </div>
      </footer>
    </div>
  );
}
