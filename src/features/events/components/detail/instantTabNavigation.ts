import type { MouseEvent } from "react";

import {
  pushHistoryUrl,
  readSearchParamFromWindow,
  shouldInterceptInPageAnchorClick,
} from "@/src/lib/navigation/historyUrl";

/** @deprecated Prefer `shouldInterceptInPageAnchorClick` from `@/src/lib/navigation`. */
export function shouldInterceptTabAnchorClick(
  event: Pick<
    MouseEvent<HTMLAnchorElement>,
    "defaultPrevented" | "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
  > & {
    currentTarget: Pick<HTMLAnchorElement, "target">;
  },
): boolean {
  return shouldInterceptInPageAnchorClick(event);
}

/** @deprecated Prefer `pushHistoryUrl` from `@/src/lib/navigation`. */
export function pushTabHistoryUrl(href: string): void {
  pushHistoryUrl(href);
}

export function readTabSearchParamFromWindow(): string | null {
  return readSearchParamFromWindow("tab");
}

export {
  pushHistoryUrl,
  readSearchParamFromWindow,
  readSearchParamsFromWindow,
  replaceHistoryUrl,
  shouldInterceptInPageAnchorClick,
} from "@/src/lib/navigation/historyUrl";
