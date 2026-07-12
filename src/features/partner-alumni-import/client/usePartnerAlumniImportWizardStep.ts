"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  pushHistoryUrl,
  readSearchParamsFromWindow,
  replaceHistoryUrl,
} from "@/src/lib/navigation/historyUrl";
import { buildPathWithSearchParams } from "@/src/lib/navigation/urlPath";

import type { ImportScope, ImportStep } from "./types";
import type { PartnerAlumniImportBatchStatus } from "../types";
import { importFlowBasePath, parseImportStep, resolveStepForBatch } from "./resumeStep";

export function serializePartnerAlumniImportStep(step: ImportStep): URLSearchParams {
  return new URLSearchParams({ step });
}

export function parseGuardedPartnerAlumniImportStep(
  params: URLSearchParams,
  batchStatus: PartnerAlumniImportBatchStatus,
): ImportStep {
  const requested = parseImportStep(params.get("step"));
  return resolveStepForBatch(batchStatus, requested);
}

export function guardPartnerAlumniImportStep(
  batchStatus: PartnerAlumniImportBatchStatus,
  requested: ImportStep,
): ImportStep {
  return resolveStepForBatch(batchStatus, requested);
}

type GoToStepOptions = {
  history?: "push" | "replace";
};

type UsePartnerAlumniImportWizardStepOptions = {
  scope: ImportScope;
  batchId: string;
  initialStep: ImportStep;
  batchStatus: PartnerAlumniImportBatchStatus;
};

/**
 * Category A wizard step state — mirrors useUrlSyncedState with per-step push/replace.
 */
export function usePartnerAlumniImportWizardStep({
  scope,
  batchId,
  initialStep,
  batchStatus,
}: UsePartnerAlumniImportWizardStepOptions) {
  const batchStatusRef = useRef(batchStatus);
  batchStatusRef.current = batchStatus;

  const pathname = importFlowBasePath(scope, batchId);
  const pendingHistoryModeRef = useRef<"push" | "replace">("push");
  const [activeStep, setActiveStepInternal] = useState<ImportStep>(initialStep);
  const suppressHistoryWriteRef = useRef(false);

  const parseFromLocation = useCallback(
    () => parseGuardedPartnerAlumniImportStep(readSearchParamsFromWindow(), batchStatusRef.current),
    [],
  );

  useEffect(() => {
    suppressHistoryWriteRef.current = true;
    setActiveStepInternal(initialStep);
  }, [initialStep]);

  useEffect(() => {
    function handlePopState() {
      suppressHistoryWriteRef.current = true;
      setActiveStepInternal(parseFromLocation());
    }

    globalThis.addEventListener("popstate", handlePopState);
    return () => globalThis.removeEventListener("popstate", handlePopState);
  }, [parseFromLocation]);

  useEffect(() => {
    if (suppressHistoryWriteRef.current) {
      suppressHistoryWriteRef.current = false;
      return;
    }

    const nextHref = buildPathWithSearchParams(
      pathname,
      serializePartnerAlumniImportStep(activeStep),
    );
    const currentHref = buildPathWithSearchParams(pathname, readSearchParamsFromWindow());
    if (nextHref === currentHref) {
      return;
    }

    if (pendingHistoryModeRef.current === "replace") {
      replaceHistoryUrl(nextHref);
    } else {
      pushHistoryUrl(nextHref);
    }
    pendingHistoryModeRef.current = "push";
  }, [activeStep, pathname]);

  const goToStep = useCallback((requested: ImportStep, options?: GoToStepOptions) => {
    const resolved = guardPartnerAlumniImportStep(batchStatusRef.current, requested);
    pendingHistoryModeRef.current = options?.history ?? "push";
    setActiveStepInternal(resolved);
  }, []);

  return { activeStep, goToStep };
}
