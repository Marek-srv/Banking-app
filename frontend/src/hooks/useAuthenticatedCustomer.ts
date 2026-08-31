import { useQuery } from "@tanstack/react-query";

import { settingsApi } from "@/api/settingsApi";

export const authenticatedCustomerQueryKey = ["customer", "me"] as const;

export function useAuthenticatedCustomer() {
  return useQuery({
    queryKey: authenticatedCustomerQueryKey,
    queryFn: settingsApi.getProfile,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });
}
