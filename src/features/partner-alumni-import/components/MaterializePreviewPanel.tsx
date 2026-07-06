import type { MaterializePreviewSummary } from "../types";

type MaterializePreviewPanelProps = {
  preview: MaterializePreviewSummary;
  canImport: boolean;
};

export function MaterializePreviewPanel({ preview, canImport }: MaterializePreviewPanelProps) {
  if (!canImport) return null;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-labelledby="materialize-preview-title"
    >
      <h3 id="materialize-preview-title" className="text-base font-semibold text-slate-900">
        Before you import
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        This import will apply the following changes to the target version.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div
          className={[
            "rounded-lg border px-4 py-3",
            preview.companies_to_create > 0
              ? "border-rose-300 bg-rose-50"
              : "border-slate-200 bg-slate-50",
          ].join(" ")}
        >
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Companies to create
          </dt>
          <dd
            className={[
              "mt-1 tabular-nums",
              preview.companies_to_create > 0 ? "text-3xl font-bold text-rose-900" : "text-2xl font-semibold",
            ].join(" ")}
          >
            {preview.companies_to_create}
          </dd>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Version members to create
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-emerald-950">
            {preview.members_to_create}
          </dd>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Version members to update
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-amber-950">
            {preview.members_to_update}
          </dd>
        </div>
      </dl>
      {preview.members_to_skip > 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          {preview.members_to_skip} resolved row
          {preview.members_to_skip === 1 ? "" : "s"} will link to existing members without order
          changes.
        </p>
      ) : null}
    </section>
  );
}
