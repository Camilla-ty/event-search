"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import {
  marketingNavSessionFingerprint,
  resolveAuthSessionRefreshAction,
} from "@/src/lib/auth/marketingNavSessionFingerprint";
import type { MarketingNavSession } from "@/src/lib/auth/marketingSession";
import { scheduleCoalescedRouterRefresh } from "@/src/lib/auth/scheduleCoalescedRouterRefresh";
import { createClient } from "@/src/lib/supabase/client";

type AuthSessionRefreshProviderProps = {
  serverSession: MarketingNavSession;
  children: ReactNode;
};

/**
 * Single shell-level owner for Supabase auth events that require RSC refresh.
 */
export function AuthSessionRefreshProvider({
  serverSession,
  children,
}: AuthSessionRefreshProviderProps) {
  const router = useRouter();
  const serverSessionRef = useRef(serverSession);
  const serverSessionFingerprint = marketingNavSessionFingerprint(serverSession);

  useEffect(() => {
    serverSessionRef.current = serverSession;
  }, [serverSession]);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, clientSession) => {
      const action = resolveAuthSessionRefreshAction(
        event,
        serverSessionRef.current,
        clientSession,
      );
      if (action === "refresh") {
        scheduleCoalescedRouterRefresh(router);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, serverSessionFingerprint]);

  return children;
}
