import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AuthUser } from "@/api/authApi";

export type AuthCustomer = {
  customerId: string;
  firstName?: string;
  lastName?: string;
};

export type AuthenticationStatus = "unauthenticated" | "authenticated";

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  customer: AuthCustomer | null;
  status: AuthenticationStatus;
  hasHydrated: boolean;
  setSession: (accessToken: string, user: AuthUser) => void;
  setCustomer: (customer: AuthCustomer) => void;
  clearSession: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      customer: null,
      status: "unauthenticated",
      hasHydrated: false,
      setSession: (accessToken, user) => set({
        accessToken,
        user,
        status: "authenticated",
      }),
      setCustomer: (customer) => set({ customer }),
      clearSession: () => set({
        accessToken: null,
        user: null,
        customer: null,
        status: "unauthenticated",
      }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "pi-bank-auth-session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ accessToken, user, customer, status }) => ({
        accessToken,
        user,
        customer,
        status,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
