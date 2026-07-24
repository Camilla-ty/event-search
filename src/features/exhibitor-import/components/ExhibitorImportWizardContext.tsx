"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ImportStep } from "../client/types";
import type { ExhibitorImportBatch } from "../client/types";

type ExhibitorImportWizardContextValue = {
  batch: ExhibitorImportBatch;
  goToStep: (requested: ImportStep) => void;
  openDraftStep: () => void;
  updateBatch: (batch: ExhibitorImportBatch) => void;
  markImportToDraftComplete: () => void;
};

const ExhibitorImportWizardContext = createContext<ExhibitorImportWizardContextValue | null>(null);

type ExhibitorImportWizardProviderProps = {
  value: ExhibitorImportWizardContextValue;
  children: ReactNode;
};

export function ExhibitorImportWizardProvider({
  value,
  children,
}: ExhibitorImportWizardProviderProps) {
  return (
    <ExhibitorImportWizardContext.Provider value={value}>
      {children}
    </ExhibitorImportWizardContext.Provider>
  );
}

export function useExhibitorImportWizard(): ExhibitorImportWizardContextValue {
  const context = useContext(ExhibitorImportWizardContext);
  if (context === null) {
    throw new Error("useExhibitorImportWizard must be used within ExhibitorImportWizardProvider");
  }
  return context;
}
