"use client";

import { useCallback, useEffect, useRef } from "react";

import { useUrlSyncedState } from "@/src/lib/navigation/useUrlSyncedState";

import type { ImportStep } from "./types";
import type { ExhibitorImportBatchStatus } from "../types";
import { parseImportStep, resolveStepForBatch } from "./resumeStep";

export function buildExhibitorImportWizardPathname(batchId: string): string {
  return `/admin/exhibitor-imports/${batchId}`;
}

export function serializeImportStep(step: ImportStep): URLSearchParams {
  return new URLSearchParams({ step });
}

export function parseGuardedImportStep(
  params: URLSearchParams,
  batchStatus: ExhibitorImportBatchStatus,
): ImportStep {
  const requested = parseImportStep(params.get("step"));
  return resolveStepForBatch(batchStatus, requested);
}

export function guardImportStep(
  batchStatus: ExhibitorImportBatchStatus,
  requested: ImportStep,
): ImportStep {
  return resolveStepForBatch(batchStatus, requested);
}

type UseExhibitorImportWizardStepOptions = {
  batchId: string;
  initialStep: ImportStep;
  batchStatus: ExhibitorImportBatchStatus;
};

export function useExhibitorImportWizardStep({
  batchId,
  initialStep,
  batchStatus,
}: UseExhibitorImportWizardStepOptions) {
  const batchStatusRef = useRef(batchStatus);
  useEffect(() => {
    batchStatusRef.current = batchStatus;
  }, [batchStatus]);

  const pathname = buildExhibitorImportWizardPathname(batchId);

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
