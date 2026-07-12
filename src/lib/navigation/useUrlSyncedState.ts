"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  pushHistoryUrl,
  readPathnameFromWindow,
  readSearchParamsFromWindow,
  replaceHistoryUrl,
} from "@/src/lib/navigation/historyUrl";
import { buildPathWithSearchParams } from "@/src/lib/navigation/urlPath";

export type UseUrlSyncedStateOptions<T> = {
  /** Value from the server on cold load / after a real route navigation. */
  initial: T;
  pathname: string;
  parse: (params: URLSearchParams) => T;
  serialize: (value: T) => URLSearchParams;
  equals?: (left: T, right: T) => boolean;
  /** Default `replace` — typical for filters; use `push` for wizard steps. */
  history?: "push" | "replace";
  buildPath?: (pathname: string, params: URLSearchParams) => string;
};

/**
 * Guard History API writes after navigation starts but before the owning component unmounts.
 * Uses exact pathname equality so nested child routes (e.g. /events → /events/[id]) are blocked.
 */
export function shouldSyncUrlForOwnedPathname(
  ownerPathname: string,
  currentPathname: string,
): boolean {
  return ownerPathname === currentPathname;
}

/** True when the browser is still on the route that owns this History API sync hook. */
export function canOwnerSyncHistoryUrl(ownerPathname: string): boolean {
  return shouldSyncUrlForOwnedPathname(ownerPathname, readPathnameFromWindow());
}

/**
 * Category A URL-only state: local React state mirrored to the address bar via the
 * History API without Next.js soft navigation (`router.push` / `router.replace`).
 */
export function useUrlSyncedState<T>({
  initial,
  pathname,
  parse,
  serialize,
  equals = Object.is,
  history = "replace",
  buildPath = buildPathWithSearchParams,
}: UseUrlSyncedStateOptions<T>): readonly [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setStateInternal] = useState<T>(initial);
  const suppressHistoryWriteRef = useRef(false);
  const ownerPathnameRef = useRef(pathname);

  useEffect(() => {
    suppressHistoryWriteRef.current = true;
    setStateInternal(initial);
  }, [initial]);

  useEffect(() => {
    function handlePopState() {
      if (!canOwnerSyncHistoryUrl(ownerPathnameRef.current)) {
        return;
      }

      suppressHistoryWriteRef.current = true;
      setStateInternal(parse(readSearchParamsFromWindow()));
    }

    globalThis.addEventListener("popstate", handlePopState);
    return () => globalThis.removeEventListener("popstate", handlePopState);
  }, [parse]);

  useEffect(() => {
    const ownerPathname = ownerPathnameRef.current;
    if (!canOwnerSyncHistoryUrl(ownerPathname)) {
      return;
    }

    if (suppressHistoryWriteRef.current) {
      suppressHistoryWriteRef.current = false;
      return;
    }

    const nextHref = buildPath(ownerPathname, serialize(state));
    const currentHref = buildPath(ownerPathname, readSearchParamsFromWindow());
    if (nextHref === currentHref) {
      return;
    }

    if (history === "push") {
      pushHistoryUrl(nextHref);
    } else {
      replaceHistoryUrl(nextHref);
    }
  }, [state, serialize, buildPath, history]);

  const setState = useCallback((value: T | ((prev: T) => T)) => {
    setStateInternal((prev) => {
      const next = typeof value === "function" ? (value as (previous: T) => T)(prev) : value;
      return equals(prev, next) ? prev : next;
    });
  }, [equals]);

  return [state, setState] as const;
}
