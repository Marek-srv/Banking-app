import type { ReactNode } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { BankIllustration } from "@/components/bank-illustration";
import { BrandMark } from "@/components/brand-mark";

type AuthFlowShellProps = {
  children: ReactNode;
  headerStatus: string;
  eyebrow: string;
  title: string;
  description: string;
  footerMessage: string;
};

export function AuthFlowShell({ children, headerStatus, eyebrow, title, description, footerMessage }: AuthFlowShellProps) {
  return (
    <div className="flex min-h-screen min-w-[1100px] flex-col bg-bank-page">
      <header className="relative z-10 flex h-[70px] shrink-0 items-center border-b border-bank-border bg-white px-12 shadow-[0_2px_12px_rgba(11,31,58,0.04)] xl:px-[6vw]">
        <Link to="/login" aria-label="π Bank login"><BrandMark /></Link>
        <div className="ml-auto flex items-center gap-2 text-xs font-medium text-bank-muted"><ShieldCheck size={16} className="text-bank-blue" />{headerStatus}</div>
      </header>

      <main className="grid flex-1 grid-cols-[40%_60%]">
        <aside className="relative flex flex-col items-center justify-center overflow-hidden border-r border-bank-border/70 bg-white px-10 py-5">
          <div className="pointer-events-none absolute -left-20 top-20 h-72 w-72 rounded-full bg-bank-light/70 blur-3xl" />
          <div className="relative w-full max-w-[480px] text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-bank-blue">{eyebrow}</p>
            <h1 className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-bank-navy">{title}</h1>
            <p className="mx-auto mt-2 max-w-[390px] text-sm leading-6 text-bank-muted">{description}</p>
            <div className="mx-auto mt-1 max-w-[440px]"><BankIllustration /></div>
          </div>
        </aside>

        <section className="relative flex items-center justify-center overflow-hidden px-10 py-7">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-blue-100/50 blur-3xl" />
          <div className="relative z-10 w-full max-w-[680px] rounded-2xl border border-white/80 bg-white px-9 py-7 shadow-card">{children}</div>
        </section>
      </main>

      <footer className="flex shrink-0 items-center justify-between border-t border-bank-border bg-white px-12 py-3 text-xs text-bank-muted xl:px-[6vw]"><span className="inline-flex items-center gap-2"><LockKeyhole size={15} className="text-bank-blue" />{footerMessage}</span><span>© 2026 π Bank</span></footer>
    </div>
  );
}
