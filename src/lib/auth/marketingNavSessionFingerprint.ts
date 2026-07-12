import type { Session } from "@supabase/supabase-js";

import type { MarketingNavSession } from "@/src/lib/auth/marketingSession";

export function normalizeAuthEmail(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed === "" ? null : trimmed;
}

/** Stable fingerprint for comparing SSR nav session with client auth reconciliation. */
export function marketingNavSessionFingerprint(session: MarketingNavSession): string {
  return JSON.stringify({
    isAuthenticated: session.isAuthenticated,
    isAdmin: session.isAdmin,
    role: session.role,
    email: normalizeAuthEmail(session.email),
    label: session.label?.trim() ?? null,
  });
}

export function readClientAuthEmail(session: Session | null): string | null {
  return normalizeAuthEmail(session?.user.email);
}

/**
 * Skip hydration-time SIGNED_IN refresh when SSR already rendered the same signed-in user.
 */
export function shouldSkipHydrationSignedInRefresh(
  serverSession: MarketingNavSession,
  clientSession: Session | null,
): boolean {
  if (!serverSession.isAuthenticated) {
    return false;
  }

  const clientUser = clientSession?.user;
  if (!clientUser) {
    return false;
  }

  const serverEmail = normalizeAuthEmail(serverSession.email);
  const clientEmail = readClientAuthEmail(clientSession);

  if (serverEmail !== null && clientEmail !== null) {
    return serverEmail === clientEmail;
  }

  return serverEmail === clientEmail;
}

export type AuthSessionRefreshAction = "refresh" | "skip";

export function resolveAuthSessionRefreshAction(
  event: string,
  serverSession: MarketingNavSession,
  clientSession: Session | null,
): AuthSessionRefreshAction {
  if (event === "SIGNED_OUT") {
    return "refresh";
  }

  if (event !== "SIGNED_IN") {
    return "skip";
  }

  if (shouldSkipHydrationSignedInRefresh(serverSession, clientSession)) {
    return "skip";
  }

  return "refresh";
}
