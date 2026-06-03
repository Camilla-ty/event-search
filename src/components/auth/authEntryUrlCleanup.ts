"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  authEntryHasTransientQuery,
  buildCleanAuthEntryUrl,
  type AuthEntryPath,
} from "@/src/lib/auth/cleanAuthEntryUrl";

/**
 * Strips transient ?error=, ?notice=, and ?email= from the auth entry URL after consumption.
 */
export function useAuthEntryUrlCleanup(
  router: AppRouterInstance,
  entryPath: AuthEntryPath,
  redirectTo: string,
  searchParams: ReadonlyURLSearchParams,
): void {
  const cleanedRef = useRef(false);

  useEffect(() => {
    if (cleanedRef.current) {
      return;
    }
    if (!authEntryHasTransientQuery(searchParams)) {
      return;
    }
    cleanedRef.current = true;
    router.replace(buildCleanAuthEntryUrl(entryPath, redirectTo), { scroll: false });
  }, [router, entryPath, redirectTo, searchParams]);
}
