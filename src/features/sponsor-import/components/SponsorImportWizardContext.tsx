"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ImportStep } from "../client/types";
import type { SponsorImportBatch } from "../client/types";

type SponsorImportWizardContextValue = {
  batch: SponsorImportBatch;
  goToStep: (requested: ImportStep) => void;
  openDraftStep: () => void;
  updateBatch: (batch: SponsorImportBatch) => void;
  markImportToDraftComplete: () => void;
};

const SponsorImportWizardContext = createContext<SponsorImportWizardContextValue | null>(null);

type SponsorImportWizardProviderProps = {
  value: SponsorImportWizardContextValue;
  children: ReactNode;
};

export function SponsorImportWizardProvider({
  value,
  children,
}: SponsorImportWizardProviderProps) {
  return (
    <SponsorImportWizardContext.Provider value={value}>
      {children}
    </SponsorImportWizardContext.Provider>
  );
}

export function useSponsorImportWizard(): SponsorImportWizardContextValue {
  const context = useContext(SponsorImportWizardContext);
  if (context === null) {
    throw new Error("useSponsorImportWizard must be used within SponsorImportWizardProvider");
  }
  return context;
}
