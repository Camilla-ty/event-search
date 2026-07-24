"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/src/components/common";
import { fetchEditionLiveExhibitors } from "@/src/features/exhibitors/client/fetchEditionLiveExhibitors";
import {
  formatExhibitorTierHeading,
  groupExhibitorsByTier,
} from "@/src/features/exhibitors/lib/groupExhibitorsByTier";
import type {
  EventExhibitorLinkAdminRow,
  LiveExhibitorRow,
} from "@/src/features/exhibitors/server/eventExhibitorAdmin";
import { computeMoveOrderedLinkIds } from "@/src/features/exhibitors/lib/moveExhibitorOrder";
import { primaryCtaClass } from "@/src/lib/design/classes";
import type { ExhibitorMoveDirection } from "@/src/lib/validation/eventExhibitor";

import {
  ExhibitorLinkDrawer,
  type ExhibitorCreateSavedPayload,
  type ExhibitorEditSavedPayload,
} from "./ExhibitorLinkDrawer";
import { RemoveExhibitorModal } from "./RemoveExhibitorModal";
import { EditionImportsPanel } from "@/src/features/exhibitor-import/components/EditionImportsPanel";
import type { EditionImportContext } from "@/src/features/exhibitor-import/server/importUiData";

type EditionExhibitorsPanelProps = {
  editionId: string;
  editionName: string;
  editionYear: number;
  exhibitors: LiveExhibitorRow[];
  importsData: EditionImportContext;
};

type DrawerState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; row: LiveExhibitorRow };

function applyLinkPatch(
  rows: LiveExhibitorRow[],
  link: EventExhibitorLinkAdminRow,
): LiveExhibitorRow[] {
  return rows.map((row) =>
    row.id === link.id
      ? {
          ...row,
          tier_rank: link.tier_rank,
          tier_label: link.tier_label,
          display_order: link.display_order,
        }
      : row,
  );
}

function sortExhibitorRoster(rows: LiveExhibitorRow[]): LiveExhibitorRow[] {
  return [...rows].sort((a, b) => {
    const ar = a.tier_rank;
    const br = b.tier_rank;
    if (ar === null && br !== null) return 1;
    if (ar !== null && br === null) return -1;
    if (ar !== null && br !== null && ar !== br) return ar - br;
    const ao = a.display_order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.display_order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id);
  });
}

export function EditionExhibitorsPanel({
  editionId,
  editionName,
  editionYear,
  exhibitors: initialExhibitors,
  importsData,
}: EditionExhibitorsPanelProps) {
  const [exhibitors, setExhibitors] = useState(initialExhibitors);
  const [drawer, setDrawer] = useState<DrawerState>({ kind: "closed" });
  const [removeRow, setRemoveRow] = useState<LiveExhibitorRow | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [syncedInitial, setSyncedInitial] = useState(initialExhibitors);

  if (initialExhibitors !== syncedInitial) {
    setSyncedInitial(initialExhibitors);
    setExhibitors(initialExhibitors);
  }

  const attachedCompanyIds = useMemo(
    () => new Set(exhibitors.map((row) => row.company_id)),
    [exhibitors],
  );

  const tierGroups = useMemo(() => groupExhibitorsByTier(exhibitors), [exhibitors]);

  async function refetchExhibitors(): Promise<boolean> {
    try {
      const fresh = await fetchEditionLiveExhibitors(editionId);
      setExhibitors(fresh);
      setRosterError(null);
      return true;
    } catch {
      return false;
    }
  }

  function handleCreated(payload: ExhibitorCreateSavedPayload) {
    const next: LiveExhibitorRow = {
      id: payload.link.id,
      company_id: payload.link.company_id,
      tier_rank: payload.link.tier_rank,
      tier_label: payload.link.tier_label,
      display_order: payload.link.display_order,
      companies: {
        id: payload.company.id,
        name: payload.company.name,
        slug: null,
        domain: payload.company.domain,
      },
    };
    setExhibitors((current) => sortExhibitorRoster([...current, next]));
    setDrawer({ kind: "closed" });
    setRosterError(null);
  }

  async function handleEdited(payload: ExhibitorEditSavedPayload) {
    setDrawer({ kind: "closed" });
    setRosterError(null);
    if (payload.kind === "tier") {
      const refreshed = await refetchExhibitors();
      if (!refreshed) {
        setExhibitors((current) => sortExhibitorRoster(applyLinkPatch(current, payload.link)));
        setRosterError("Saved, but could not refresh the full roster. Reload if order looks off.");
      }
      return;
    }
    setExhibitors((current) => applyLinkPatch(current, payload.link));
  }

  function handleRemoved(linkId: string) {
    setExhibitors((current) => current.filter((row) => row.id !== linkId));
    setRemoveRow(null);
    setRosterError(null);
  }

  async function handleMove(row: LiveExhibitorRow, direction: ExhibitorMoveDirection) {
    const siblings = exhibitors.filter((candidate) => candidate.tier_rank === row.tier_rank);
    const orderedIds = siblings.map((candidate) => candidate.id);
    const nextOrder = computeMoveOrderedLinkIds(orderedIds, row.id, direction);
    if (nextOrder === null) return;

    setReorderingId(row.id);
    setRosterError(null);
    try {
      const res = await fetch(`/api/admin/event-editions/${editionId}/exhibitors/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier_rank: row.tier_rank,
          ordered_link_ids: [...nextOrder],
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        links?: EventExhibitorLinkAdminRow[];
      };
      if (!res.ok || !data.ok || !Array.isArray(data.links)) {
        const refreshed = await refetchExhibitors();
        if (!refreshed) {
          setRosterError(data.error ?? "Failed to reorder exhibitors.");
        }
        return;
      }

      const orderById = new Map(data.links.map((link) => [link.id, link.display_order]));
      setExhibitors((current) =>
        sortExhibitorRoster(
          current.map((candidate) => {
            const nextDisplayOrder = orderById.get(candidate.id);
            return nextDisplayOrder === undefined
              ? candidate
              : { ...candidate, display_order: nextDisplayOrder };
          }),
        ),
      );
    } catch {
      const refreshed = await refetchExhibitors();
      if (!refreshed) {
        setRosterError("Failed to reorder exhibitors.");
      }
    } finally {
      setReorderingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Link companies as exhibitors for this event. Group by tier; reorder within a tier.
        </p>
        <button
          type="button"
          className={primaryCtaClass}
          onClick={() => setDrawer({ kind: "create" })}
        >
          Add exhibitor
        </button>
      </div>

      {rosterError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {rosterError}
        </p>
      ) : null}

      {exhibitors.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          No exhibitors yet.{" "}
          <button
            type="button"
            className="text-brand-primary hover:underline"
            onClick={() => setDrawer({ kind: "create" })}
          >
            Add the first exhibitor
          </button>
        </p>
      ) : (
        <div className="space-y-6">
          {tierGroups.map((group) => (
            <div key={group.tierRank === null ? "null" : String(group.tierRank)}>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">
                {formatExhibitorTierHeading(group)}
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Company</th>
                      <th className="px-4 py-3 font-medium">Order</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.exhibitors.map((row, index) => {
                      const company = row.companies;
                      const isFirst = index === 0;
                      const isLast = index === group.exhibitors.length - 1;
                      const reorderBusy = reorderingId !== null;

                      return (
                        <tr key={row.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {company ? (
                              <Link
                                href={`/admin/companies/${company.id}`}
                                className="text-brand-primary hover:underline"
                              >
                                {company.name ?? "—"}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{row.display_order ?? "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                className="h-8 px-2 text-xs"
                                disabled={isFirst || reorderBusy}
                                onClick={() => void handleMove(row, "up")}
                              >
                                Move up
                              </Button>
                              <Button
                                variant="secondary"
                                className="h-8 px-2 text-xs"
                                disabled={isLast || reorderBusy}
                                onClick={() => void handleMove(row, "down")}
                              >
                                Move down
                              </Button>
                              <Button
                                variant="secondary"
                                className="h-8 px-2 text-xs"
                                disabled={reorderBusy}
                                onClick={() => setDrawer({ kind: "edit", row })}
                              >
                                Edit tier
                              </Button>
                              <Button
                                variant="secondary"
                                className="h-8 px-2 text-xs !text-red-700"
                                disabled={reorderBusy}
                                onClick={() => setRemoveRow(row)}
                              >
                                Remove
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {drawer.kind === "create" ? (
        <ExhibitorLinkDrawer
          mode="create"
          editionId={editionId}
          attachedCompanyIds={attachedCompanyIds}
          onClose={() => setDrawer({ kind: "closed" })}
          onSaved={handleCreated}
        />
      ) : null}

      {drawer.kind === "edit" ? (
        <ExhibitorLinkDrawer
          mode="edit"
          row={drawer.row}
          onClose={() => setDrawer({ kind: "closed" })}
          onSaved={(payload) => void handleEdited(payload)}
        />
      ) : null}

      {removeRow ? (
        <RemoveExhibitorModal
          row={removeRow}
          editionName={editionName}
          editionYear={editionYear}
          onClose={() => setRemoveRow(null)}
          onRemoved={handleRemoved}
        />
      ) : null}

      <div className="border-t border-slate-200 pt-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Bulk Upload</h3>
        <EditionImportsPanel data={importsData} />
      </div>
    </div>
  );
}
