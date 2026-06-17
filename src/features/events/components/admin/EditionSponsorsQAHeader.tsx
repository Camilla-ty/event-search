"use client";

import Link from "next/link";

import { Button } from "@/src/components/common";
import { formInputClass, secondaryCtaClass } from "@/src/lib/design/classes";

type EditionSponsorsQAHeaderProps = {
  sponsorCount: number;
  tierCount: number;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  editionSlug: string;
  eventWebsiteUrl: string | null;
  onAddSponsor: () => void;
};

export function EditionSponsorsQAHeader({
  sponsorCount,
  tierCount,
  searchQuery,
  onSearchQueryChange,
  editionSlug,
  eventWebsiteUrl,
  onAddSponsor,
}: EditionSponsorsQAHeaderProps) {
  const eventPixelsHref = `/events/${encodeURIComponent(editionSlug.trim())}`;
  const websiteUrl = eventWebsiteUrl?.trim() ?? "";
  const hasWebsite = websiteUrl !== "";

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm text-slate-600">
            {sponsorCount} live sponsor{sponsorCount === 1 ? "" : "s"} · {tierCount} tier
            {tierCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onAddSponsor}>
            Add sponsor
          </Button>
          <Link
            href={eventPixelsHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`${secondaryCtaClass} h-10`}
          >
            Open EventPixels page
          </Link>
          {hasWebsite ? (
            <Link
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${secondaryCtaClass} h-10`}
            >
              Open event website
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="Set website on the Profile tab"
              className={`${secondaryCtaClass} h-10 cursor-not-allowed opacity-50`}
            >
              Open event website
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search sponsors by name or domain…"
          aria-label="Search sponsors by name or domain"
          className={formInputClass}
        />
        {searchQuery.trim() !== "" ? (
          <button
            type="button"
            className="shrink-0 text-sm text-slate-600 hover:text-slate-900"
            onClick={() => onSearchQueryChange("")}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
