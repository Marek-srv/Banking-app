import { apiClient } from "@/lib/apiClient";

type SuccessEnvelope<T> = { success: true; data: T };

type RawCustomerProfile = {
  customer_number?: string;
  customerNumber?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  phone?: string | null;
};

export type CustomerSettingsProfile = {
  name: string;
  customerId: string;
  maskedMobile: string;
};

function maskMobile(value?: string | null) {
  if (!value) return "Not provided";
  const digits = value.replace(/\D/g, "");
  return `${"•".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export const settingsApi = {
  async getProfile() {
    const response = await apiClient.get<SuccessEnvelope<RawCustomerProfile>>("/customers/me");
    const raw = response.data.data;
    const firstName = raw.firstName ?? raw.first_name ?? "";
    const lastName = raw.lastName ?? raw.last_name ?? "";
    return {
      name: `${firstName} ${lastName}`.trim() || "π Bank Customer",
      customerId: raw.customerNumber ?? raw.customer_number ?? "",
      maskedMobile: maskMobile(raw.phone),
    } satisfies CustomerSettingsProfile;
  },
};
