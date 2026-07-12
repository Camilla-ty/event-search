"use client";

import type { FormEvent, InputHTMLAttributes } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/src/components/common/Button";
import {
  explorerGlobalSearchInputClass,
  explorerSearchFormDefaultClass,
  explorerSearchFormToolbarClass,
  SearchSubmitIconButton,
} from "@/src/components/common/explorer";

export type SearchBarProps = {
  placeholder?: string;
  defaultValue?: string;
  /** When set, keeps the input aligned with external URL/filter state. */
  syncValue?: string;
  onSearch?: (value: string) => void;
  ariaLabel?: string;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">;
  className?: string;
  submitVariant?: "primary" | "secondary";
  variant?: "default" | "toolbar";
};

const defaultInputClass =
  "h-10 w-full rounded-lg border border-transparent bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-primary/30 focus:ring-2 focus:ring-brand-primary/15";

export function SearchBar({
  placeholder = "Search...",
  defaultValue = "",
  syncValue,
  onSearch,
  ariaLabel = "Search",
  inputProps,
  className,
  submitVariant = "primary",
  variant = "default",
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);
  const isToolbar = variant === "toolbar";

  useEffect(() => {
    if (syncValue !== undefined) {
      setValue(syncValue);
    }
  }, [syncValue]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch?.(value.trim());
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={[
        isToolbar ? explorerSearchFormToolbarClass : explorerSearchFormDefaultClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <input
        {...inputProps}
        type={inputProps?.type ?? "search"}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={[
          isToolbar ? explorerGlobalSearchInputClass : defaultInputClass,
          inputProps?.className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {isToolbar ? (
        <SearchSubmitIconButton ariaLabel={ariaLabel} />
      ) : (
        <Button type="submit" size="md" variant={submitVariant}>
          Search
        </Button>
      )}
    </form>
  );
}
