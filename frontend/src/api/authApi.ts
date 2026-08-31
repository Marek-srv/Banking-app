import { apiClient } from "@/lib/apiClient";

type SuccessEnvelope<T> = {
  success: true;
  data: T;
};

export type AuthUser = {
  userId: string;
  email: string;
  role: string;
};

export type RegisterRequest = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  mobile: string;
  email: string;
};

export type RegisterResponse = {
  email: string;
  message: string;
};

export type VerifyOtpRequest = {
  email: string;
  otp: string;
};

export type VerifyOtpResponse = {
  message: string;
  registrationToken: string;
  expiresInSeconds: number;
};

export type CompleteRegistrationRequest = {
  registrationToken: string;
  password: string;
  confirmPassword: string;
};

export type CompleteRegistrationResponse = {
  customerId: string;
};

export type ResendOtpRequest = {
  email: string;
};

export type ResendOtpResponse = {
  message: string;
};

export type CustomerIdLoginRequest = {
  customerId: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export const authApi = {
  async register(payload: RegisterRequest) {
    const response = await apiClient.post<SuccessEnvelope<RegisterResponse>>(
      "/auth/register",
      payload,
    );
    return response.data.data;
  },

  async verifyOtp(payload: VerifyOtpRequest) {
    const response = await apiClient.post<SuccessEnvelope<VerifyOtpResponse>>(
      "/auth/verify-otp",
      payload,
    );
    return response.data.data;
  },

  async resendOtp(payload: ResendOtpRequest) {
    const response = await apiClient.post<SuccessEnvelope<ResendOtpResponse>>(
      "/auth/resend-otp",
      payload,
    );
    return response.data.data;
  },

  async completeRegistration(payload: CompleteRegistrationRequest) {
    const response = await apiClient.post<SuccessEnvelope<CompleteRegistrationResponse>>(
      "/auth/complete-registration",
      payload,
    );
    return response.data.data;
  },

  async login(payload: CustomerIdLoginRequest) {
    const response = await apiClient.post<SuccessEnvelope<LoginResponse>>(
      "/auth/login",
      payload,
    );
    return response.data.data;
  },

  async logout() {
    const response = await apiClient.post<SuccessEnvelope<{ message: string }>>(
      "/auth/logout",
    );
    return response.data.data;
  },
};
