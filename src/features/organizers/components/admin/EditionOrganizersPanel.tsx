"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/src/components/common";
import { primaryCtaClass } from "@/src/lib/design/classes";

import type { EditionOrganizerAdminRow } from "@/src/features/organizers/server/eventOrganizerAdmin";

import { OrganizerLinkDrawer } from "./OrganizerLinkDrawer";
import { RemoveOrganizerModal } from "./RemoveOrganizerModal";

type EditionOrganizersPanelProps = {
  editionId: string;
  editionName: string;
  editionYear: number;
  organizers: EditionOrganizerAdminRow[];
};

type DrawerState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; row: EditionOrganizerAdminRow };

export function EditionOrganizersPanel({
  editionId,
  editionName,
  editionYear,
  organizers,
}: EditionOrganizersPanelProps) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<DrawerState>({ kind: "closed" });
  const [removeRow, setRemoveRow] = useState<EditionOrganizerAdminRow | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const attachedCompanyIds = useMemo(
    () => new Set(organizers.map((row) => row.company_id)),
    [organizers],
  );

  function handleDone() {
    setDrawer({ kind: "closed" });
    router.refresh();
  }

  async function handleMove(row: EditionOrganizerAdminRow, direction: "up" | "down") {
    setReorderingId(row.id);
    try {
      const res = await fetch(`/api/admin/event-editions/${editionId}/organizers/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizer_id: row.id, direction }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        return;
      }
      router.refresh();
    } finally {
      setReorderingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Link companies as organizers for this edition. Order controls display on the public
          Organizers tab.
        </p>
        <button
          type="button"
          className={primaryCtaClass}
          onClick={() => setDrawer({ kind: "create" })}
        >
          Add organizer
        </button>
      </div>

      {organizers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          No organizers yet.{" "}
          <button
            type="button"
            className="text-brand-primary hover:underline"
            onClick={() => setDrawer({ kind: "create" })}
          >
            Add the first organizer
          </button>
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {organizers.map((row, index) => {
                const company = row.companies;
                const isFirst = index === 0;
                const isLast = index === organizers.length - 1;
                const busy = reorderingId === row.id;

                return (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {company ? (
                        <Link
                          href={`/admin/companies/${company.id}`}
                          className="text-brand-primary hover:underline"
                        >
                          {company.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.role_label}</td>
                    <td className="px-4 py-3 text-slate-600">{row.display_order}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          className="h-8 px-2 text-xs"
                          disabled={isFirst || busy}
                          onClick={() => void handleMove(row, "up")}
                        >
                          Move up
                        </Button>
                        <Button
                          variant="secondary"
                          className="h-8 px-2 text-xs"
                          disabled={isLast || busy}
                          onClick={() => void handleMove(row, "down")}
                        >
                          Move down
                        </Button>
                        <Button
                          variant="secondary"
                          className="h-8 px-2 text-xs"
                          onClick={() => setDrawer({ kind: "edit", row })}
                        >
                          Edit role
                        </Button>
                        <Button
                          variant="secondary"
                          className="h-8 px-2 text-xs !text-red-700"
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
      )}

      {drawer.kind === "create" ? (
        <OrganizerLinkDrawer
          mode="create"
          editionId={editionId}
          attachedCompanyIds={attachedCompanyIds}
          onClose={() => setDrawer({ kind: "closed" })}
          onSaved={handleDone}
        />
      ) : null}

      {drawer.kind === "edit" ? (
        <OrganizerLinkDrawer
          mode="edit"
          editionId={editionId}
          row={drawer.row}
          onClose={() => setDrawer({ kind: "closed" })}
          onSaved={handleDone}
        />
      ) : null}

      {removeRow ? (
        <RemoveOrganizerModal
          editionId={editionId}
          row={removeRow}
          editionName={editionName}
          editionYear={editionYear}
          onClose={() => setRemoveRow(null)}
          onRemoved={() => {
            setRemoveRow(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
