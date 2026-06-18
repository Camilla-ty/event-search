"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
  type KeyboardEvent,
} from "react";

import {
  appendCompanyAlias,
  MAX_COMPANY_ALIASES,
} from "@/src/lib/companies/companyAliases";

export type CompanyAliasesInputHandle = {
  /** Commits any typed draft into chips and returns the full alias list for save. */
  flushPending: () => string[];
};

type CompanyAliasesInputProps = {
  value: readonly string[];
  onChange: (aliases: string[]) => void;
  canonicalName?: string;
  disabled?: boolean;
};

function commitDraftAliases(
  existing: readonly string[],
  draft: string,
  canonicalName: string,
): string[] {
  const trimmed = draft.trim();
  if (trimmed === "") {
    return [...existing];
  }

  const result = appendCompanyAlias(existing, trimmed, canonicalName);
  if (result.ok) {
    return result.aliases;
  }
  return [...existing];
}

export const CompanyAliasesInput = forwardRef<CompanyAliasesInputHandle, CompanyAliasesInputProps>(
  function CompanyAliasesInput(
    { value, onChange, canonicalName = "", disabled = false },
    ref,
  ) {
    const [draft, setDraft] = useState("");

    const flushPending = useCallback((): string[] => {
      const next = commitDraftAliases(value, draft, canonicalName);
      if (next.length !== value.length || draft.trim() !== "") {
        onChange(next);
      }
      setDraft("");
      return next;
    }, [canonicalName, draft, onChange, value]);

    useImperativeHandle(ref, () => ({ flushPending }), [flushPending]);

    function tryCommitDraft(raw: string) {
      const result = appendCompanyAlias(value, raw, canonicalName);
      if (result.ok) {
        onChange(result.aliases);
        setDraft("");
      }
    }

    function handleBlur() {
      if (draft.trim() === "") {
        return;
      }
      tryCommitDraft(draft);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      if (event.key === "Enter") {
        event.preventDefault();
        tryCommitDraft(draft);
        return;
      }

      if (event.key === "Backspace" && draft === "" && value.length > 0) {
        event.preventDefault();
        onChange(value.slice(0, -1));
      }
    }

    function handleDraftChange(nextDraft: string) {
      if (nextDraft.includes(",")) {
        const parts = nextDraft.split(",");
        const remainder = parts.pop() ?? "";
        let aliases = [...value];
        for (const part of parts) {
          const result = appendCompanyAlias(aliases, part, canonicalName);
          if (result.ok) {
            aliases = result.aliases;
          }
        }
        onChange(aliases);
        setDraft(remainder);
        return;
      }

      setDraft(nextDraft);
    }

    function removeAlias(index: number) {
      onChange(value.filter((_, itemIndex) => itemIndex !== index));
    }

    const atMaxAliases = value.length >= MAX_COMPANY_ALIASES;

    return (
      <div className="space-y-2">
        <div
          className={[
            "flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5",
            "focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/15",
            disabled ? "cursor-not-allowed opacity-60" : "",
          ].join(" ")}
        >
          {value.map((alias, index) => (
            <span
              key={`${alias}-${index}`}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-slate-100 py-1 pl-2.5 pr-1 text-sm text-slate-800"
            >
              <span className="truncate">{alias}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove alias ${alias}`}
                className="rounded-full px-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:cursor-not-allowed"
                onClick={() => removeAlias(index)}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={draft}
            disabled={disabled || atMaxAliases}
            placeholder={
              atMaxAliases
                ? `Maximum ${MAX_COMPANY_ALIASES} aliases`
                : "Type an alias and press Enter"
            }
            className="min-h-8 min-w-[12rem] flex-1 border-0 bg-transparent py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
            onChange={(event) => handleDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
        </div>
        <p className="text-xs text-slate-500">
          Press Enter to add each former name. Used for admin search only; public pages still show
          the canonical company name.
        </p>
      </div>
    );
  },
);
