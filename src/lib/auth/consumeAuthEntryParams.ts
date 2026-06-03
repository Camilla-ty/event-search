import type { ReadonlyURLSearchParams } from "next/navigation";

import { getLoginNoticeMessage } from "@/src/lib/auth/authMessages";
import { readAuthEntrySearchParams } from "@/src/lib/auth/readAuthEntrySearchParams";
import type { ResolvedOAuthError } from "@/src/lib/auth/resolveOAuthError";

export type ConsumedAuthEntryParams = {
  redirectTo: string;
  email: string | null;
  noticeMessage: string | null;
  oauthError: ResolvedOAuthError | null;
};

/**
 * Snapshot of transient auth entry query params for in-memory display after URL cleanup.
 */
export function consumeAuthEntryParams(
  searchParams: Pick<ReadonlyURLSearchParams, "get">,
  redirectFallback = "/",
): ConsumedAuthEntryParams {
  const entry = readAuthEntrySearchParams(searchParams, redirectFallback);
  return {
    redirectTo: entry.redirectTo,
    email: entry.email,
    noticeMessage: getLoginNoticeMessage(entry.notice),
    oauthError: entry.oauthError,
  };
}
