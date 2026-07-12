"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ImportScope, ImportStep, PartnerAlumniImportBatch } from "../client/types";

type GoToStepOptions = {
  history?: "push" | "replace";
};

type PartnerAlumniImportWizardContextValue = {
  scope: ImportScope;
  batch: PartnerAlumniImportBatch;
  goToStep: (requested: ImportStep, options?: GoToStepOptions) => void;
  updateBatch: (batch: PartnerAlumniImportBatch) => void;
  markValidationComplete: () => void;
  markImportComplete: () => void;
};

const PartnerAlumniImportWizardContext =
  createContext<PartnerAlumniImportWizardContextValue | null>(null);

type PartnerAlumniImportWizardProviderProps = {
  value: PartnerAlumniImportWizardContextValue;
  children: ReactNode;
};

export function PartnerAlumniImportWizardProvider({
  value,
  children,
}: PartnerAlumniImportWizardProviderProps) {
  return (
    <PartnerAlumniImportWizardContext.Provider value={value}>
      {children}
    </PartnerAlumniImportWizardContext.Provider>
  );
}

export function usePartnerAlumniImportWizard(): PartnerAlumniImportWizardContextValue {
  const context = useContext(PartnerAlumniImportWizardContext);
  if (context === null) {
    throw new Error(
      "usePartnerAlumniImportWizard must be used within PartnerAlumniImportWizardProvider",
    );
  }
  return context;
}
