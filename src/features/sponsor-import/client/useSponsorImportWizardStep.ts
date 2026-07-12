"use client";

import { useCallback, useRef } from "react";

import { useUrlSyncedState } from "@/src/lib/navigation/useUrlSyncedState";

import type { ImportStep } from "./types";
import type { SponsorImportBatchStatus } from "../types";
import { parseImportStep, resolveStepForBatch } from "./resumeStep";

export function buildSponsorImportWizardPathname(batchId: string): string {
  return `/admin/sponsor-imports/${batchId}`;
}

export function serializeImportStep(step: ImportStep): URLSearchParams {
  return new URLSearchParams({ step });
}

export function parseGuardedImportStep(
  params: URLSearchParams,
  batchStatus: SponsorImportBatchStatus,
): ImportStep {
  const requested = parseImportStep(params.get("step"));
  return resolveStepForBatch(batchStatus, requested);
}

export function guardImportStep(
  batchStatus: SponsorImportBatchStatus,
  requested: ImportStep,
): ImportStep {
  return resolveStepForBatch(batchStatus, requested);
}

type UseSponsorImportWizardStepOptions = {
  batchId: string;
  initialStep: ImportStep;
  batchStatus: SponsorImportBatchStatus;
};

export function useSponsorImportWizardStep({
  batchId,
  initialStep,
  batchStatus,
}: UseSponsorImportWizardStepOptions) {
  const batchStatusRef = useRef(batchStatus);
  batchStatusRef.current = batchStatus;

  const pathname = buildSponsorImportWizardPathname(batchId);

  const parse = useCallback(
    (params: URLSearchParams) => parseGuardedImportStep(params, batchStatusRef.current),
    [],
  );

  const serialize = useCallback((step: ImportStep) => serializeImportStep(step), []);

  const [activeStep, setActiveStep] = useUrlSyncedState({
    initial: initialStep,
    pathname,
    parse,
    serialize,
    history: "push",
    equals: (left, right) => left === right,
  });

  const goToStep = useCallback(
    (requested: ImportStep) => {
      const resolved = guardImportStep(batchStatusRef.current, requested);
      setActiveStep(resolved);
    },
    [setActiveStep],
  );

  return { activeStep, goToStep };
}
