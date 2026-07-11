import type { MouseEvent } from "react";

/** True when a tab anchor click should use instant client switching instead of navigation. */
export function shouldInterceptTabAnchorClick(
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

export function pushTabHistoryUrl(href: string): void {
  globalThis.history.pushState(null, "", href);
}

export function readTabSearchParamFromWindow(): string | null {
  const search = globalThis.window?.location.search ?? "";
  return new URLSearchParams(search).get("tab");
}
