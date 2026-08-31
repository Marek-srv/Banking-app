import { apiClient } from "@/lib/apiClient";

type SuccessEnvelope<T> = { success: true; data: T };

export const recoveryApi = {
  async requestCustomerId(payload: { email: string; dateOfBirth: string }) {
    const response = await apiClient.post<SuccessEnvelope<{ message: string }>>("/auth/recovery/customer-id/request", payload);
    return response.data.data;
  },
  async verifyCustomerId(payload: { email: string; dateOfBirth: string; otp: string }) {
    const response = await apiClient.post<SuccessEnvelope<{ customerId: string }>>("/auth/recovery/customer-id/verify", payload);
    return response.data.data;
  },
  async requestPassword(payload: { customerId: string }) {
    const response = await apiClient.post<SuccessEnvelope<{ message: string; maskedEmail: string }>>("/auth/recovery/password/request", payload);
    return response.data.data;
  },
  async verifyPassword(payload: { customerId: string; otp: string }) {
    const response = await apiClient.post<SuccessEnvelope<{ resetToken: string; expiresInSeconds: number }>>("/auth/recovery/password/verify", payload);
    return response.data.data;
  },
  async resetPassword(payload: { customerId: string; resetToken: string; newPassword: string }) {
    const response = await apiClient.post<SuccessEnvelope<{ message: string }>>("/auth/recovery/password/reset", payload);
    return response.data.data;
  },
};
