import { create } from "zustand";

interface OnboardingState {
  showWizard: boolean;
  currentStep: number;
  totalSteps: number;
  setShowWizard: (show: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  completeWizard: () => void;
  resetWizard: () => void;
  checkShouldShow: () => void;
}

const getLocalStorage = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
};

const setLocalStorage = (key: string, value: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
};

const removeLocalStorage = (key: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  showWizard: false,
  currentStep: 0,
  totalSteps: 6,
  setShowWizard: (show) => set({ showWizard: show }),
  nextStep: () => {
    const { currentStep, totalSteps } = get();
    if (currentStep < totalSteps - 1) {
      set({ currentStep: currentStep + 1 });
    } else {
      get().completeWizard();
    }
  },
  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 0) set({ currentStep: currentStep - 1 });
  },
  goToStep: (step) => set({ currentStep: step }),
  completeWizard: () => {
    setLocalStorage("agent1_onboarding_completed", "true");
    set({ showWizard: false, currentStep: 0 });
  },
  resetWizard: () => {
    removeLocalStorage("agent1_onboarding_completed");
    set({ showWizard: true, currentStep: 0 });
  },
  checkShouldShow: () => {
    const completed = getLocalStorage("agent1_onboarding_completed");
    if (!completed) set({ showWizard: true, currentStep: 0 });
  },
}));
