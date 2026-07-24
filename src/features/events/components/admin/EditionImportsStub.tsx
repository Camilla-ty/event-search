import Link from "next/link";

import { Button } from "@/src/components/common";

type EditionImportsStubProps = {
  editionName: string;
  seriesName: string;
  liveSponsorCount: number;
};

export function EditionImportsStub({
  editionName,
  seriesName,
  liveSponsorCount,
}: EditionImportsStubProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p>
          <span className="font-medium">{editionName}</span> · {seriesName}
        </p>
        <p className="mt-1 text-slate-600">Live sponsors: {liveSponsorCount}</p>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-4">
        <h3 className="font-semibold text-sky-950">Sponsor import not available yet</h3>
        <p className="mt-2 text-sm text-sky-900">
          Sponsor import for this event will be available in Phase 4. When live, you will
          upload an Excel file, review matches, publish sponsors to this event, and see
          import history here.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-sky-900">
          <li>One active import per event</li>
          <li>Additive publish — existing live sponsors stay</li>
          <li>Excel columns: Company name, Website, Sponsor tier (integer)</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" disabled title="Available after Phase 4">
            Import sponsors
          </Button>
          <Link
            href="/admin/sponsor-imports"
            className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Go to sponsor imports
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 opacity-60">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Rows</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                Import history will appear here after Phase 4.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
