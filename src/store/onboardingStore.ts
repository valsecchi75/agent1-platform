import { create } from "zustand";

interface OnboardingState {
  showWizard: boolean;
  currentStep: number;
  totalSteps: number;
  dontShowAgain: boolean;
  setShowWizard: (show: boolean) => void;
  setDontShowAgain: (value: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  completeWizard: () => void;
  resetWizard: () => void;
  checkShouldShow: () => void;
}

const STORAGE_KEY = "agent1_onboarding_completed";
const DONT_SHOW_KEY = "agent1_onboarding_dont_show";

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
  dontShowAgain: getLocalStorage(DONT_SHOW_KEY) === "true",
  setShowWizard: (show) => set({ showWizard: show }),
  setDontShowAgain: (value) => {
    if (value) {
      setLocalStorage(DONT_SHOW_KEY, "true");
    } else {
      removeLocalStorage(DONT_SHOW_KEY);
    }
    set({ dontShowAgain: value });
  },
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
    setLocalStorage(STORAGE_KEY, "true");
    // If user checked "don't show again", persist that too
    const { dontShowAgain } = get();
    if (dontShowAgain) {
      setLocalStorage(DONT_SHOW_KEY, "true");
    }
    set({ showWizard: false, currentStep: 0 });
  },
  resetWizard: () => {
    removeLocalStorage(STORAGE_KEY);
    removeLocalStorage(DONT_SHOW_KEY);
    set({ showWizard: true, currentStep: 0, dontShowAgain: false });
  },
  checkShouldShow: () => {
    const completed = getLocalStorage(STORAGE_KEY);
    const dontShow = getLocalStorage(DONT_SHOW_KEY);
    // Show wizard only if not completed AND not permanently dismissed
    if (!completed && !dontShow) {
      set({ showWizard: true, currentStep: 0 });
    }
  },
}));
