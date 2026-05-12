"use client";

import type { FormEvent, InputHTMLAttributes } from "react";
import { useState } from "react";

import { Button } from "@/src/components/common/Button";

export type SearchBarProps = {
  placeholder?: string;
  defaultValue?: string;
  onSearch?: (value: string) => void;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">;
  className?: string;
};

export function SearchBar({
  placeholder = "Search...",
  defaultValue = "",
  onSearch,
  inputProps,
  className,
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch?.(value.trim());
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={[
        "flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950",
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
        className={[
          "h-10 w-full rounded-lg border border-transparent bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 dark:text-slate-100 dark:focus:border-slate-700",
          inputProps?.className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
      <Button type="submit" size="md">
        Search
      </Button>
    </form>
  );
}
