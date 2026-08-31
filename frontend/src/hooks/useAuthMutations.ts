import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import {
  authApi,
  type CustomerIdLoginRequest,
  type RegisterRequest,
  type ResendOtpRequest,
  type VerifyOtpRequest,
  type CompleteRegistrationRequest,
} from "@/api/authApi";
import { useAuthStore } from "@/stores/auth.store";

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (payload: RegisterRequest) => authApi.register(payload),
  });
}

export function useVerifyOtpMutation() {
  return useMutation({
    mutationFn: (payload: VerifyOtpRequest) => authApi.verifyOtp(payload),
  });
}

export function useResendOtpMutation() {
  return useMutation({
    mutationFn: (payload: ResendOtpRequest) => authApi.resendOtp(payload),
  });
}

export function useCompleteRegistrationMutation() {
  return useMutation({
    mutationFn: (payload: CompleteRegistrationRequest) => authApi.completeRegistration(payload),
  });
}

export function useCustomerIdLoginMutation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: (payload: CustomerIdLoginRequest) => authApi.login(payload),
    onSuccess: ({ token, user }) => {
      queryClient.removeQueries();
      setSession(token, user);
      navigate(user.role === "ADMIN" ? "/admin/dashboard" : "/dashboard", { replace: true });
    },
  });
}

export function useLogoutMutation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const clearSession = useAuthStore((state) => state.clearSession);

  return useMutation({
    mutationFn: async () => {
      if (accessToken) await authApi.logout();
    },
    onSettled: () => {
      clearSession();
      queryClient.removeQueries();
      navigate("/login", { replace: true });
    },
  });
}
