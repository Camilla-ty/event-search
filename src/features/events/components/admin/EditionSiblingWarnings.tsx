import Link from "next/link";

import type { EditionSiblingSummary } from "@/src/features/events/server/eventEditionAdmin";

type EditionSiblingWarningsProps = {
  siblings: EditionSiblingSummary[];
  year: number;
  cityId: string;
  cityLabel: string;
};

function formatSiblingLabel(sibling: EditionSiblingSummary): string {
  const cityName = sibling.cities?.name;
  if (cityName) return `${sibling.name} (${cityName})`;
  return sibling.name;
}

export function EditionSiblingWarnings({
  siblings,
  year,
  cityId,
  cityLabel,
}: EditionSiblingWarningsProps) {
  if (siblings.length === 0) return null;

  const cityMatches =
    cityId !== ""
      ? siblings.filter((sibling) => sibling.city_id === cityId)
      : [];

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <p className="font-medium">Related editions for this series in {year}</p>
      <ul className="mt-2 list-disc space-y-2 pl-5">
        {cityMatches.length > 0 ? (
          <li>
            An edition already exists for this series, year, and city
            {cityLabel !== "" ? ` (${cityLabel})` : ""}:
            <ul className="mt-1 list-none space-y-1 pl-0">
              {cityMatches.map((sibling) => (
                <li key={sibling.id}>
                  <Link
                    href={`/admin/events/editions/${sibling.id}`}
                    className="font-medium text-brand-primary underline"
                  >
                    {formatSiblingLabel(sibling)}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ) : null}
        <li>
          {siblings.length === 1
            ? "One other edition exists"
            : `${siblings.length} other editions exist`}{" "}
          for this series in {year}. Use a distinct name and slug
          {cityId === "" ? " — add a city or include location in the edition name" : ""}:
          <ul className="mt-1 list-none space-y-1 pl-0">
            {siblings.map((sibling) => (
              <li key={sibling.id}>
                <Link
                  href={`/admin/events/editions/${sibling.id}`}
                  className="text-brand-primary underline"
                >
                  {formatSiblingLabel(sibling)}
                </Link>
                <span className="text-amber-900/80"> · /events/{sibling.slug}</span>
              </li>
            ))}
          </ul>
        </li>
      </ul>
    </div>
  );
}
