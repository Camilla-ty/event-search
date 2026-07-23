"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { InlineErrorBanner } from "@/src/components/common";
import { MergeCanonicalSelector } from "@/src/features/companies/components/admin/merge/MergeCanonicalSelector";
import { MergeConfirmDialog } from "@/src/features/companies/components/admin/merge/MergeConfirmDialog";
import { MergeCompanyPicker } from "@/src/features/companies/components/admin/merge/MergeCompanyPicker";
import { MergeDraftLinkConflictsTable } from "@/src/features/companies/components/admin/merge/MergeDraftLinkConflictsTable";
import { MergeExhibitorConflictsTable } from "@/src/features/companies/components/admin/merge/MergeExhibitorConflictsTable";
import { MergeFieldResolutionForm } from "@/src/features/companies/components/admin/merge/MergeFieldResolutionForm";
import { MergeImpactPreview } from "@/src/features/companies/components/admin/merge/MergeImpactPreview";
import { MergeOrganizerConflictsTable } from "@/src/features/companies/components/admin/merge/MergeOrganizerConflictsTable";
import { MergeSponsorshipConflictsTable } from "@/src/features/companies/components/admin/merge/MergeSponsorshipConflictsTable";
import type {
  MergeCompanyPickerOption,
  MergePreviewApiResponse,
  MergeWizardPrefill,
  MergeWizardStep,
} from "@/src/features/companies/components/admin/merge/mergeWizardTypes";
import { MERGE_WIZARD_STEPS } from "@/src/features/companies/components/admin/merge/mergeWizardTypes";
import {
  applyCanonicalCompanyIdChange,
  resolveInitialCanonicalCompanyId,
} from "@/src/features/companies/components/admin/merge/mergeWizardCanonical";
import {
  buildInitialResolutionsFromPreview,
  executeMergeCompanies,
  updateDraftLinkStrategy,
  updateExhibitorFieldStrategy,
  updateOrganizerStrategy,
  updateSponsorshipStrategy,
} from "@/src/features/companies/components/admin/merge/mergeWizardResolutions";
import { recomputeMergeIdentityBlockerMessages } from "@/src/features/companies/components/admin/merge/mergeIdentityBlockers";
import type {
  CompanyMergeExhibitorFieldName,
  CompanyMergeFieldResolutions,
  CompanyMergePreviewSnapshot,
  CompanyMergeResolutions,
  DraftLinkConflictStrategy,
  ExhibitorFieldStrategy,
  OrganizerConflictStrategy,
  SponsorshipConflictStrategy,
} from "@/src/features/companies/server/companyMerge";
import { primaryCtaClass, secondaryCtaClass } from "@/src/lib/design/classes";

type MergeCompaniesWizardProps = {
  prefill: MergeWizardPrefill;
};

async function fetchMergePreview(
  canonicalId: string,
  duplicateId: string,
): Promise<CompanyMergePreviewSnapshot> {
  const params = new URLSearchParams({
    canonical: canonicalId,
    duplicate: duplicateId,
  });
  const res = await fetch(`/api/admin/companies/merge/preview?${params.toString()}`);
  const data = (await res.json()) as MergePreviewApiResponse;

  if (!res.ok || !data.ok) {
    const message = data.ok ? "Preview request failed." : data.error;
    throw new Error(message);
  }

  return data.preview;
}

export function MergeCompaniesWizard({ prefill }: MergeCompaniesWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<MergeWizardStep>(1);
  const [companyA, setCompanyA] = useState<MergeCompanyPickerOption | null>(
    prefill.canonical,
  );
  const [companyB, setCompanyB] = useState<MergeCompanyPickerOption | null>(
    prefill.duplicate,
  );
  const [canonicalId, setCanonicalId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CompanyMergePreviewSnapshot | null>(null);
  const [resolutions, setResolutions] = useState<CompanyMergeResolutions | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);

  const duplicateId =
    companyA && companyB && canonicalId
      ? canonicalId === companyA.id
        ? companyB.id
        : companyA.id
      : null;

  const step1Complete =
    companyA !== null && companyB !== null && companyA.id !== companyB.id;

  const identityBlockers =
    preview !== null && resolutions !== null
      ? recomputeMergeIdentityBlockerMessages(preview, resolutions.field_resolutions)
      : preview?.blockers ?? [];

  const thirdPartyBlockers = identityBlockers.filter((message) =>
    message.includes("owned by another company"),
  );
  const hasThirdPartyBlockers = thirdPartyBlockers.length > 0;
  const hasIdentityBlockers = identityBlockers.length > 0;

  const loadPreview = useCallback(async () => {
    if (!canonicalId || !duplicateId) return;

    setPreviewLoading(true);
    setPreviewError(null);
    setPreview(null);

    try {
      const nextPreview = await fetchMergePreview(canonicalId, duplicateId);
      setPreview(nextPreview);
      setResolutions(buildInitialResolutionsFromPreview(nextPreview));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Preview request failed.";
      setPreviewError(message);
      setResolutions(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [canonicalId, duplicateId]);

  useEffect(() => {
    if (step !== 3) return;
    void loadPreview();
  }, [step, loadPreview]);

  function goToStep2() {
    if (!companyA || !companyB) return;
    setCanonicalId(
      resolveInitialCanonicalCompanyId(companyA, companyB, {
        lockCanonical: prefill.lockCanonical,
        lockDuplicate: prefill.lockDuplicate,
      }),
    );
    setStep(2);
  }

  function handleCanonicalIdChange(requestedId: string) {
    if (!companyA || !companyB || !canonicalId) return;
    setCanonicalId(
      applyCanonicalCompanyIdChange(
        requestedId,
        companyA,
        companyB,
        {
          lockCanonical: prefill.lockCanonical,
          lockDuplicate: prefill.lockDuplicate,
        },
        canonicalId,
      ),
    );
  }

  function goToStep3() {
    if (!canonicalId || !duplicateId) return;
    setStep(3);
  }

  function goToStep4() {
    if (!preview || hasThirdPartyBlockers) return;
    if (!resolutions) {
      setResolutions(buildInitialResolutionsFromPreview(preview));
    }
    setStep(4);
  }

  function goToStep5() {
    if (!preview || !resolutions || hasIdentityBlockers) return;
    setStep(5);
  }

  function handleFieldChange<K extends keyof CompanyMergeFieldResolutions>(
    field: K,
    value: CompanyMergeFieldResolutions[K],
  ) {
    setResolutions((current) => {
      if (!current) return current;
      return {
        ...current,
        field_resolutions: {
          ...current.field_resolutions,
          [field]: value,
        },
      };
    });
  }

  function handleSponsorshipStrategyChange(
    eventEditionId: string,
    strategy: SponsorshipConflictStrategy,
  ) {
    setResolutions((current) => {
      if (!current) return current;
      return updateSponsorshipStrategy(current, eventEditionId, strategy);
    });
  }

  function handleOrganizerStrategyChange(
    eventEditionId: string,
    strategy: OrganizerConflictStrategy,
  ) {
    setResolutions((current) => {
      if (!current) return current;
      return updateOrganizerStrategy(current, eventEditionId, strategy);
    });
  }

  function handleExhibitorFieldStrategyChange(
    eventEditionId: string,
    field: CompanyMergeExhibitorFieldName,
    strategy: ExhibitorFieldStrategy,
  ) {
    setResolutions((current) => {
      if (!current) return current;
      return updateExhibitorFieldStrategy(current, eventEditionId, field, strategy);
    });
  }

  function handleDraftLinkStrategyChange(
    batchId: string,
    strategy: DraftLinkConflictStrategy,
  ) {
    setResolutions((current) => {
      if (!current) return current;
      return updateDraftLinkStrategy(current, batchId, strategy);
    });
  }

  async function handleConfirmMerge(confirmation: string) {
    if (!canonicalId || !duplicateId || !resolutions) return;

    setExecuteLoading(true);
    setExecuteError(null);

    try {
      const result = await executeMergeCompanies({
        canonicalCompanyId: canonicalId,
        duplicateCompanyId: duplicateId,
        confirmation,
        resolutions,
      });

      const redirectUrl = `/admin/companies/${result.canonical_company_id}?merged=1&merge_id=${encodeURIComponent(result.merge_id)}`;
      router.push(redirectUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Merge request failed.";
      setExecuteError(message);
      setExecuteLoading(false);
    }
  }

  const canonicalName = preview?.companies.canonical.name ?? "Canonical";
  const duplicateName = preview?.companies.duplicate.name ?? "Duplicate";

  return (
    <div className="space-y-6">
      <nav aria-label="Merge wizard progress">
        <ol className="flex flex-wrap gap-2">
          {MERGE_WIZARD_STEPS.map(({ step: stepNumber, label }) => {
            const active = step === stepNumber;
            const complete = step > stepNumber;
            return (
              <li
                key={stepNumber}
                className={[
                  "rounded-full px-3 py-1.5 text-sm",
                  active
                    ? "bg-brand-primary font-medium text-white"
                    : complete
                      ? "bg-brand-primary-muted text-brand-primary"
                      : "border border-slate-200 bg-white text-slate-600",
                ].join(" ")}
              >
                {stepNumber}. {label}
              </li>
            );
          })}
        </ol>
      </nav>

      {step === 1 ? (
        <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Select two companies</h2>
            <p className="mt-1 text-sm text-slate-600">
              Search the directory and pick the pair you want to merge. You will choose which
              company to keep on the next step.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <MergeCompanyPicker
              label={prefill.lockCanonical ? "Company to keep" : "Company A"}
              description={
                prefill.lockCanonical
                  ? "Pre-selected from the company profile."
                  : undefined
              }
              selected={companyA}
              onSelect={setCompanyA}
              onClear={() => setCompanyA(null)}
              disabled={prefill.lockCanonical}
              excludeIds={companyB ? [companyB.id] : []}
            />
            <MergeCompanyPicker
              label={prefill.lockDuplicate ? "Company to merge away" : "Company B"}
              description={
                prefill.lockDuplicate
                  ? "Pre-selected from the company profile."
                  : undefined
              }
              selected={companyB}
              onSelect={setCompanyB}
              onClear={() => setCompanyB(null)}
              disabled={prefill.lockDuplicate}
              excludeIds={companyA ? [companyA.id] : []}
            />
          </div>

          {companyA && companyB && companyA.id === companyB.id ? (
            <InlineErrorBanner message="Select two different companies." />
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              className={`${primaryCtaClass} h-10`}
              disabled={!step1Complete}
              onClick={goToStep2}
            >
              Next: Choose canonical
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 && companyA && companyB && canonicalId ? (
        <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
          <MergeCanonicalSelector
            companyA={companyA}
            companyB={companyB}
            canonicalId={canonicalId}
            lockCanonical={prefill.lockCanonical}
            lockDuplicate={prefill.lockDuplicate}
            onCanonicalIdChange={handleCanonicalIdChange}
          />

          <div className="flex justify-between gap-3">
            <button
              type="button"
              className={`${secondaryCtaClass} h-10`}
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              className={`${primaryCtaClass} h-10`}
              onClick={goToStep3}
            >
              Next: Preview impact
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
          <MergeImpactPreview
            loading={previewLoading}
            error={previewError}
            preview={preview}
          />

          {identityBlockers.length > 0 ? (
            <InlineErrorBanner message={identityBlockers.join(" ")} />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className={`${secondaryCtaClass} h-10`}
              onClick={() => setStep(2)}
            >
              Back
            </button>
            <button
              type="button"
              className={`${primaryCtaClass} h-10`}
              disabled={previewLoading || previewError !== null || preview === null || hasThirdPartyBlockers}
              onClick={goToStep4}
            >
              Next: Resolve conflicts
            </button>
          </div>
        </section>
      ) : null}

      {step === 4 && preview && resolutions ? (
        <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Resolve conflicts</h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose how to handle event conflicts, import draft conflicts, and differing
              profile fields. Primary Identity and website must resolve to the same Match Key.
            </p>
          </div>

          {identityBlockers.length > 0 ? (
            <InlineErrorBanner message={identityBlockers.join(" ")} />
          ) : null}

          <MergeSponsorshipConflictsTable
            conflicts={preview.sponsorship_conflicts}
            resolutions={resolutions}
            canonicalName={canonicalName}
            duplicateName={duplicateName}
            onStrategyChange={handleSponsorshipStrategyChange}
          />

          <MergeOrganizerConflictsTable
            conflicts={preview.organizer_conflicts}
            resolutions={resolutions}
            canonicalName={canonicalName}
            duplicateName={duplicateName}
            onStrategyChange={handleOrganizerStrategyChange}
          />

          <MergeExhibitorConflictsTable
            conflicts={preview.exhibitor_conflicts}
            resolutions={resolutions}
            canonicalName={canonicalName}
            duplicateName={duplicateName}
            onFieldStrategyChange={handleExhibitorFieldStrategyChange}
          />

          <MergeDraftLinkConflictsTable
            conflicts={preview.draft_link_conflicts}
            resolutions={resolutions}
            canonicalName={canonicalName}
            duplicateName={duplicateName}
            onStrategyChange={handleDraftLinkStrategyChange}
          />

          <MergeFieldResolutionForm
            preview={preview}
            fieldResolutions={resolutions.field_resolutions}
            onFieldChange={handleFieldChange}
          />

          <div className="flex justify-between gap-3">
            <button
              type="button"
              className={`${secondaryCtaClass} h-10`}
              onClick={() => setStep(3)}
            >
              Back
            </button>
            <button
              type="button"
              className={`${primaryCtaClass} h-10`}
              disabled={hasIdentityBlockers}
              onClick={goToStep5}
            >
              Next: Confirm merge
            </button>
          </div>
        </section>
      ) : null}

      {step === 5 && preview && resolutions ? (
        <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Confirm merge</h2>
            <p className="mt-1 text-sm text-slate-600">
              Review the final merge summary, then confirm to execute.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <p>
              Keep <span className="font-medium text-slate-900">{canonicalName}</span> and merge
              away <span className="font-medium text-slate-900">{duplicateName}</span>.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>
                {preview.impact.event_sponsors_to_repoint} sponsorship
                {preview.impact.event_sponsors_to_repoint === 1 ? "" : "s"} to repoint
              </li>
              <li>
                {preview.impact.event_exhibitors_to_repoint} exhibitor link
                {preview.impact.event_exhibitors_to_repoint === 1 ? "" : "s"} to repoint
              </li>
              <li>
                {preview.sponsorship_conflicts.length} event conflict
                {preview.sponsorship_conflicts.length === 1 ? "" : "s"} resolved
              </li>
              <li>
                {preview.exhibitor_conflicts.length} exhibitor field conflict
                {preview.exhibitor_conflicts.length === 1 ? "" : "s"} resolved
              </li>
              <li>
                {preview.draft_link_conflicts.length} draft batch conflict
                {preview.draft_link_conflicts.length === 1 ? "" : "s"} resolved
              </li>
            </ul>
          </div>

          {preview.warnings.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-medium">Warnings</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className={`${secondaryCtaClass} h-10`}
              onClick={() => setStep(4)}
              disabled={executeLoading}
            >
              Back
            </button>
            <button
              type="button"
              className={`${primaryCtaClass} h-10 !bg-red-600 hover:!bg-red-700 focus-visible:!ring-red-300`}
              disabled={executeLoading || hasIdentityBlockers}
              onClick={() => {
                setExecuteError(null);
                setConfirmOpen(true);
              }}
            >
              Merge companies
            </button>
          </div>
        </section>
      ) : null}

      <MergeConfirmDialog
        open={confirmOpen}
        canonicalName={canonicalName}
        duplicateName={duplicateName}
        loading={executeLoading}
        error={executeError}
        onClose={() => {
          if (executeLoading) return;
          setConfirmOpen(false);
          setExecuteError(null);
        }}
        onConfirm={(confirmation) => void handleConfirmMerge(confirmation)}
      />
    </div>
  );
}
