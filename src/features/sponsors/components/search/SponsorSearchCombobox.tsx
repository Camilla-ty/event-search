"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/src/components/common/Button";
import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import type { SponsorSuggestItem } from "@/src/features/sponsors/server/sponsorDiscoverySuggestTypes";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";

import {
  buildSponsorProfilePath,
  buildSponsorSearchUrl,
} from "@/src/lib/routes/explorerUrls";

import { useSponsorSuggestions } from "./useSponsorSuggestions";

type SponsorSearchComboboxProps = {
  placeholder?: string;
  defaultValue?: string;
  ariaLabel?: string;
  className?: string;
  submitVariant?: "primary" | "secondary";
};

function suggestItemLogoFields(item: SponsorSuggestItem) {
  return companyLogoFieldsFromRow({
    name: item.name,
    logo_url: item.logo_url,
    domain: item.domain,
  });
}

export function SponsorSearchCombobox({
  placeholder = "Search sponsoring companies…",
  defaultValue = "",
  ariaLabel = "Search sponsoring companies globally",
  className,
  submitVariant = "secondary",
}: SponsorSearchComboboxProps) {
  const router = useRouter();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState(defaultValue);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const { trimmedQuery, eligible, items, total, loading, error, fetched } =
    useSponsorSuggestions(value);

  const showSeeAllFooter = total > items.length;
  const optionCount = items.length + (showSeeAllFooter ? 1 : 0);
  const dropdownOpen =
    isFocused && eligible && !error && (loading || fetched || items.length > 0);

  function resetActiveIndex() {
    setActiveIndex(-1);
  }

  function closeDropdown() {
    setIsFocused(false);
    resetActiveIndex();
  }

  function navigateToProfile(item: SponsorSuggestItem) {
    const href = buildSponsorProfilePath({ slug: item.slug, id: item.id });
    if (href === null) return;
    closeDropdown();
    router.push(href);
  }

  function navigateToSearchResults(query: string) {
    closeDropdown();
    router.push(buildSponsorSearchUrl(query));
  }

  function selectActiveOption() {
    if (activeIndex >= 0 && activeIndex < items.length) {
      const item = items[activeIndex];
      if (item !== undefined) {
        navigateToProfile(item);
      }
      return;
    }

    if (showSeeAllFooter && activeIndex === items.length) {
      navigateToSearchResults(trimmedQuery);
      return;
    }

    if (trimmedQuery !== "") {
      navigateToSearchResults(trimmedQuery);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    selectActiveOption();
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!dropdownOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        inputRef.current?.blur();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (optionCount === 0) return;
      setActiveIndex((current) => {
        if (current < optionCount - 1) return current + 1;
        return 0;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (optionCount === 0) return;
      setActiveIndex((current) => {
        if (current <= 0) return optionCount - 1;
        return current - 1;
      });
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
      inputRef.current?.blur();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectActiveOption();
    }
  }

  function optionId(index: number): string {
    return `${listboxId}-option-${index}`;
  }

  const activeDescendantId =
    activeIndex >= 0 && activeIndex < optionCount
      ? optionId(activeIndex)
      : undefined;

  return (
    <div className={["relative min-w-0", className].filter(Boolean).join(" ")}>
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
        role="combobox"
        aria-expanded={dropdownOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-owns={listboxId}
      >
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            resetActiveIndex();
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setIsFocused(false);
              resetActiveIndex();
            }, 120);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeDescendantId}
          autoComplete="off"
          className="h-10 w-full rounded-lg border border-transparent bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-primary/30 focus:ring-2 focus:ring-brand-primary/15"
        />
        <Button type="submit" size="md" variant={submitVariant}>
          Search
        </Button>
      </form>

      {dropdownOpen ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Sponsor company suggestions"
            className="max-h-80 overflow-y-auto py-1"
          >
            {loading ? (
              <li className="px-3 py-2 text-sm text-slate-500" aria-live="polite">
                Searching…
              </li>
            ) : null}

            {!loading && fetched && items.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500" role="presentation">
                No companies found
              </li>
            ) : null}

            {items.map((item, index) => {
              const domainLabel = item.domain?.trim() ?? "";
              const isActive = activeIndex === index;

              return (
                <li
                  key={item.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isActive}
                  className={[
                    "cursor-pointer px-3 py-2 transition",
                    isActive ? "bg-brand-primary-muted/40" : "hover:bg-brand-primary-muted/30",
                  ].join(" ")}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => {
                    navigateToProfile(item);
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <CompanyLogo
                      company={suggestItemLogoFields(item)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                      monogramClassName="text-sm font-semibold text-slate-400"
                      alt=""
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                      {domainLabel !== "" ? (
                        <p className="truncate text-xs text-slate-500">{domainLabel}</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}

            {showSeeAllFooter && !loading ? (
              <li
                id={optionId(items.length)}
                role="option"
                aria-selected={activeIndex === items.length}
                className={[
                  "cursor-pointer border-t border-slate-200 px-3 py-2 text-sm font-medium text-brand-primary transition",
                  activeIndex === items.length
                    ? "bg-brand-primary-muted/40"
                    : "hover:bg-brand-primary-muted/30",
                ].join(" ")}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  navigateToSearchResults(trimmedQuery);
                }}
              >
                See all {total.toLocaleString()} results
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
