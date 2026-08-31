import { FormEvent, useState } from "react";
import { Bell, Check, Eye, EyeOff, KeyRound, Laptop, LockKeyhole, Mail, MonitorSmartphone, ShieldCheck, UserRound } from "lucide-react";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { useLogoutMutation } from "@/hooks/useAuthMutations";
import { useAuthenticatedCustomer } from "@/hooks/useAuthenticatedCustomer";
import { useAuthStore } from "@/stores/auth.store";

type PasswordField = "current" | "next" | "confirm";

function maskEmail(email?: string) {
  if (!email || !email.includes("@")) return "Not available";
  const [name, domain] = email.split("@");
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}

function currentDevice() {
  const agent = navigator.userAgent;
  const os = agent.includes("Windows") ? "Windows" : agent.includes("Mac OS") ? "macOS" : agent.includes("Linux") ? "Linux" : "This device";
  const browser = agent.includes("Edg/") ? "Edge" : agent.includes("Chrome/") ? "Chrome" : agent.includes("Firefox/") ? "Firefox" : agent.includes("Safari/") ? "Safari" : "Browser";
  return `${os} • ${browser}`;
}

function SettingsToggle({ enabled, onChange, label }: { enabled: boolean; onChange: () => void; label: string }) {
  return <button type="button" onClick={onChange} role="switch" aria-checked={enabled} aria-label={label} className={`relative h-5 w-9 rounded-full transition ${enabled ? "bg-bank-blue" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${enabled ? "left-[18px]" : "left-0.5"}`} /></button>;
}

const passwordInputClass = "h-10 w-full rounded-xl border border-bank-border bg-white pl-3 pr-9 text-xs text-bank-text outline-none focus:border-bank-blue focus:ring-2 focus:ring-blue-100";

export function SettingsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [visible, setVisible] = useState<Record<PasswordField, boolean>>({ current: false, next: false, confirm: false });
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState(false);
  const [notifications, setNotifications] = useState({ transactions: true, login: true, email: true });
  const logoutMutation = useLogoutMutation();
  const authUser = useAuthStore((state) => state.user);
  const authCustomer = useAuthStore((state) => state.customer);
  const profileQuery = useAuthenticatedCustomer();

  const profile = profileQuery.data;
  const profileItems = [
    ["Name", profile?.name ?? ([authCustomer?.firstName, authCustomer?.lastName].filter(Boolean).join(" ") || "π Bank Customer")],
    ["Customer ID", profile?.customerId || authCustomer?.customerId || "Profile temporarily unavailable"],
    ["Masked Email", maskEmail(authUser?.email)],
    ["Masked Mobile", profile?.maskedMobile ?? "Not available"],
  ];

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    setPasswordNotice(false);
    if (!passwords.current) { setPasswordError("Enter your current password"); return; }
    if (passwords.next.length < 8 || !/[A-Z]/.test(passwords.next) || !/\d/.test(passwords.next) || !/[^A-Za-z0-9]/.test(passwords.next)) { setPasswordError("New password must be at least 8 characters and include uppercase, number, and special character"); return; }
    if (passwords.next !== passwords.confirm) { setPasswordError("New passwords do not match"); return; }
    setPasswordError("");
    setPasswords({ current: "", next: "", confirm: "" });
    setPasswordNotice(true);
  };

  const updatePassword = (field: PasswordField, value: string) => { setPasswords((current) => ({ ...current, [field]: value })); setPasswordError(""); setPasswordNotice(false); };

  return (
    <div className="flex h-screen min-w-[1180px] overflow-hidden bg-bank-page">
      <DashboardSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} onLogout={() => logoutMutation.mutate()} logoutPending={logoutMutation.isPending} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader title="Settings" subtitle="Manage your profile, security, and preferences" />
        <main className="min-h-0 flex-1 overflow-y-auto bg-bank-page px-5 py-4">
          <div className="mx-auto max-w-[1460px] space-y-4">
            <section className="rounded-2xl border border-bank-border/90 bg-white p-5 shadow-[0_5px_18px_rgba(11,31,58,0.045)]" aria-labelledby="profile-settings-heading">
              <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bank-light text-bank-blue"><UserRound size={19} /></span><div><h1 id="profile-settings-heading" className="text-sm font-extrabold text-bank-navy">Profile</h1><p className="mt-0.5 text-[10px] text-bank-muted">Your verified banking identity</p></div><span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700"><ShieldCheck size={12} /> Verified</span></div>
              <div className="mt-4 grid grid-cols-4 divide-x divide-bank-border rounded-xl border border-bank-border bg-bank-page/50 py-3">{profileItems.map(([label, value]) => <div key={label} className="px-4"><p className="text-[9px] font-medium text-bank-muted">{label}</p><p className={`mt-1 truncate text-xs font-bold text-bank-text ${profileQuery.isLoading ? "animate-pulse text-slate-300" : ""}`} title={value}>{profileQuery.isLoading && label !== "Masked Email" ? "Loading…" : value}</p></div>)}</div>
              {profileQuery.isError ? <p className="mt-2 text-[9px] text-amber-700">Profile details could not be refreshed. Showing available session information.</p> : null}
            </section>

            <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)] gap-4">
              <section className="rounded-2xl border border-bank-border/90 bg-white p-5 shadow-[0_5px_18px_rgba(11,31,58,0.045)]" aria-labelledby="security-settings-heading">
                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-bank-light text-bank-blue"><LockKeyhole size={17} /></span><div><h2 id="security-settings-heading" className="text-sm font-extrabold text-bank-navy">Security</h2><p className="mt-0.5 text-[10px] text-bank-muted">Password and account protection</p></div></div>
                <div className="mt-4 border-t border-bank-border pt-4"><h3 className="text-[11px] font-extrabold text-bank-navy">Change Password</h3><p className="mt-1 text-[9px] text-bank-muted">Use a strong password you don’t use elsewhere.</p>
                  <form onSubmit={submitPassword} className="mt-3 grid grid-cols-3 gap-3">
                    {([['current', 'Current Password'], ['next', 'New Password'], ['confirm', 'Confirm Password']] as Array<[PasswordField, string]>).map(([field, label]) => <label key={field} className="text-[9px] font-semibold text-bank-navy">{label}<span className="relative mt-1.5 block"><input type={visible[field] ? "text" : "password"} value={passwords[field]} onChange={(event) => updatePassword(field, event.target.value)} autoComplete={field === "current" ? "current-password" : "new-password"} className={passwordInputClass} /><button type="button" onClick={() => setVisible((current) => ({ ...current, [field]: !current[field] }))} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-bank-muted hover:text-bank-blue" aria-label={`${visible[field] ? "Hide" : "Show"} ${label.toLowerCase()}`}>{visible[field] ? <EyeOff size={15} /> : <Eye size={15} />}</button></span></label>)}
                    <div className="col-span-3 flex items-center justify-between"><div>{passwordError ? <p className="text-[9px] font-medium text-red-600">{passwordError}</p> : passwordNotice ? <p className="flex items-center gap-1 text-[9px] font-medium text-amber-700"><Check size={12} /> Change-password API is not available; no password was sent.</p> : <p className="text-[9px] text-bank-muted">Minimum 8 characters with uppercase, number, and special character.</p>}</div><button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-bank-blue px-4 text-[10px] font-bold text-white hover:bg-blue-700"><KeyRound size={14} /> Update Password</button></div>
                  </form>
                </div>
              </section>

              <div className="space-y-4">
                <section className="rounded-2xl border border-bank-border/90 bg-white p-4 shadow-[0_5px_18px_rgba(11,31,58,0.045)]" aria-labelledby="notification-settings-heading">
                  <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bank-light text-bank-blue"><Bell size={16} /></span><div><h2 id="notification-settings-heading" className="text-xs font-extrabold text-bank-navy">Notifications</h2><p className="mt-0.5 text-[9px] text-bank-muted">Preferences for this browser</p></div></div>
                  <div className="mt-2 divide-y divide-bank-border/70">{[
                    ["transactions", "Transaction Alerts", Bell], ["login", "Login Alerts", ShieldCheck], ["email", "Email Notifications", Mail],
                  ].map(([key, label, Icon]) => { const typedKey = key as keyof typeof notifications; return <div key={key as string} className="flex h-9 items-center gap-2"><Icon size={14} className="text-bank-muted" /><span className="flex-1 text-[10px] font-semibold text-bank-text">{label as string}</span><span className="text-[9px] font-bold text-bank-blue">{notifications[typedKey] ? "ON" : "OFF"}</span><SettingsToggle enabled={notifications[typedKey]} onChange={() => setNotifications((current) => ({ ...current, [typedKey]: !current[typedKey] }))} label={`Toggle ${label as string}`} /></div>; })}</div>
                </section>

                <section className="rounded-2xl border border-bank-border/90 bg-white p-4 shadow-[0_5px_18px_rgba(11,31,58,0.045)]" aria-labelledby="sessions-settings-heading">
                  <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bank-light text-bank-blue"><MonitorSmartphone size={16} /></span><div><h2 id="sessions-settings-heading" className="text-xs font-extrabold text-bank-navy">Login / Sessions</h2><p className="mt-0.5 text-[9px] text-bank-muted">Review signed-in devices</p></div></div>
                  <div className="mt-3 flex items-center rounded-xl border border-bank-border bg-bank-page/50 p-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-bank-blue shadow-sm"><Laptop size={16} /></span><div className="ml-3 min-w-0 flex-1"><p className="truncate text-[10px] font-bold text-bank-text">{currentDevice()}</p><p className="mt-0.5 text-[9px] text-bank-muted">Location unavailable</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-bold text-emerald-700">Current Session</span></div>
                  <p className="mt-2 text-[9px] leading-4 text-bank-muted">The backend does not currently expose other active sessions or per-session revocation.</p>
                  <button type="button" disabled className="mt-3 h-9 w-full cursor-not-allowed rounded-lg border border-bank-border bg-slate-50 text-[10px] font-bold text-slate-400">Logout From All Other Devices</button>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
