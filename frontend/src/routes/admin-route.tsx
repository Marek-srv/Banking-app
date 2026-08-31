import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { accessToken, status, hasHydrated, user } = useAuthStore();
  if (!hasHydrated) return <div className="grid min-h-screen place-items-center bg-bank-page text-sm font-semibold text-bank-muted">Restoring secure session…</div>;
  if (status !== "authenticated" || !accessToken) return <Navigate to="/login" replace />;
  if (user?.role !== "ADMIN") return <div className="grid min-h-screen place-items-center bg-bank-page"><div className="rounded-2xl border border-red-100 bg-white p-10 text-center shadow-card"><p className="text-3xl font-extrabold text-red-600">403</p><h1 className="mt-2 text-lg font-bold text-bank-navy">Admin access required</h1><a href="/dashboard" className="mt-5 inline-flex rounded-lg bg-bank-blue px-4 py-2 text-xs font-bold text-white">Return to Dashboard</a></div></div>;
  return children;
}
