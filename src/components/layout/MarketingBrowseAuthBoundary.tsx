"use client";

import type { ReactNode } from "react";

import { AuthSessionRefreshProvider } from "@/src/components/auth/AuthSessionRefreshProvider";
import type { MarketingNavSession } from "@/src/lib/auth/marketingSession";

type MarketingBrowseAuthBoundaryProps = {
  session: MarketingNavSession;
  children: ReactNode;
};

/** One auth listener owner for the browse/marketing shell (sidebar + mobile chrome). */
export function MarketingBrowseAuthBoundary({
  session,
  children,
}: MarketingBrowseAuthBoundaryProps) {
  return (
    <AuthSessionRefreshProvider serverSession={session}>{children}</AuthSessionRefreshProvider>
  );
}
