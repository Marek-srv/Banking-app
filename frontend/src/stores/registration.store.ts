import { create } from "zustand";

export type RegistrationDetails = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  mobileNumber: string;
  email: string;
};

export type RegistrationStep = 1 | 2 | 3 | 4;

const emptyDetails: RegistrationDetails = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  mobileNumber: "",
  email: "",
};

type RegistrationState = {
  details: RegistrationDetails;
  step: RegistrationStep;
  registrationToken: string;
  customerId: string;
  setDetails: (details: RegistrationDetails) => void;
  setStep: (step: RegistrationStep) => void;
  setRegistrationToken: (registrationToken: string) => void;
  setCustomerId: (customerId: string) => void;
  reset: () => void;
};

export const useRegistrationStore = create<RegistrationState>((set) => ({
  details: emptyDetails,
  step: 1,
  registrationToken: "",
  customerId: "",
  setDetails: (details) => set({ details }),
  setStep: (step) => set({ step }),
  setRegistrationToken: (registrationToken) => set({ registrationToken }),
  setCustomerId: (customerId) => set({ customerId }),
  reset: () => set({ details: emptyDetails, step: 1, registrationToken: "", customerId: "" }),
}));
