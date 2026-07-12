import type { MouseEvent } from "react";

/** True when an in-page anchor click should be handled client-side instead of navigating. */
export function shouldInterceptInPageAnchorClick(
  event: Pick<
    MouseEvent<HTMLAnchorElement>,
    "defaultPrevented" | "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
  > & {
    currentTarget: Pick<HTMLAnchorElement, "target">;
  },
): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const target = event.currentTarget.target;
  if (target !== "" && target !== "_self") return false;

  return true;
}

export function pushHistoryUrl(href: string): void {
  globalThis.history.pushState(null, "", href);
}

export function replaceHistoryUrl(href: string): void {
  globalThis.history.replaceState(null, "", href);
}

export function readPathnameFromWindow(): string {
  return globalThis.window?.location.pathname ?? "";
}

export function readSearchParamsFromWindow(): URLSearchParams {
  const search = globalThis.window?.location.search ?? "";
  return new URLSearchParams(search);
}

export function readSearchParamFromWindow(key: string): string | null {
  return readSearchParamsFromWindow().get(key);
}
