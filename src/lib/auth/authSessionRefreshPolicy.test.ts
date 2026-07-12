import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import type { Session } from "@supabase/supabase-js";

import {
  resolveAuthSessionRefreshAction,
  shouldSkipHydrationSignedInRefresh,
} from "@/src/lib/auth/marketingNavSessionFingerprint";
import type { MarketingNavSession } from "@/src/lib/auth/marketingSession";

const AUTHENTICATED_SESSION: MarketingNavSession = {
  isAuthenticated: true,
  isAdmin: false,
  role: "member",
  label: "Ada Lovelace",
  email: "ada@example.com",
};

const GUEST_SESSION: MarketingNavSession = {
  isAuthenticated: false,
  isAdmin: false,
  role: null,
  label: null,
  email: null,
};

function clientSession(email: string | null): Session {
  return {
    access_token: "token",
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "user-1",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00.000Z",
      email: email ?? undefined,
    },
  } as Session;
}

describe("shouldSkipHydrationSignedInRefresh", () => {
  it("skips when SSR and client emails match for an authenticated session", () => {
    assert.equal(
      shouldSkipHydrationSignedInRefresh(
        AUTHENTICATED_SESSION,
        clientSession("Ada@example.com"),
      ),
      true,
    );
  });

  it("does not skip when SSR rendered guest but client signed in", () => {
    assert.equal(
      shouldSkipHydrationSignedInRefresh(GUEST_SESSION, clientSession("ada@example.com")),
      false,
    );
  });

  it("does not skip when authenticated emails differ", () => {
    assert.equal(
      shouldSkipHydrationSignedInRefresh(
        AUTHENTICATED_SESSION,
        clientSession("other@example.com"),
      ),
      false,
    );
  });
});

describe("resolveAuthSessionRefreshAction", () => {
  it("always refreshes on SIGNED_OUT", () => {
    assert.equal(resolveAuthSessionRefreshAction("SIGNED_OUT", AUTHENTICATED_SESSION, null), "refresh");
  });

  it("skips hydration SIGNED_IN when SSR session already matches", () => {
    assert.equal(
      resolveAuthSessionRefreshAction(
        "SIGNED_IN",
        AUTHENTICATED_SESSION,
        clientSession("ada@example.com"),
      ),
      "skip",
    );
  });

  it("refreshes on genuine SIGNED_IN mismatch", () => {
    assert.equal(
      resolveAuthSessionRefreshAction("SIGNED_IN", GUEST_SESSION, clientSession("ada@example.com")),
      "refresh",
    );
  });

  it("ignores unrelated auth events", () => {
    assert.equal(
      resolveAuthSessionRefreshAction("TOKEN_REFRESHED", AUTHENTICATED_SESSION, clientSession("ada@example.com")),
      "skip",
    );
  });
});

describe("browse shell auth listener ownership", () => {
  it("uses one MarketingBrowseAuthBoundary in LayoutShell", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/layout/LayoutShell.tsx"),
      "utf8",
    );
    assert.equal((source.match(/<MarketingBrowseAuthBoundary /g) ?? []).length, 1);
    assert.match(source, /<MarketingBrowseAuthBoundary session=\{session\}>/);
    assert.equal(source.includes("AuthSessionRefreshProvider"), false);
  });

  it("does not mount AuthSessionRefreshProvider inside SessionControls", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/layout/NavigationShell.tsx"),
      "utf8",
    );
    assert.equal(source.includes("onAuthStateChange"), false);
    assert.equal(source.includes("router.refresh"), false);
  });

  it("keeps desktop and mobile SessionControls renders", () => {
    const navigationShell = readFileSync(
      path.join(process.cwd(), "src/components/layout/NavigationShell.tsx"),
      "utf8",
    );
    const mobileHeader = readFileSync(
      path.join(process.cwd(), "src/components/layout/BrowseMobileHeader.tsx"),
      "utf8",
    );

    assert.match(navigationShell, /SessionControls mode=\{mode\} session=\{session\} variant="sidebar"/);
    assert.match(mobileHeader, /SessionControls mode=\{mode\} session=\{session\} variant="mobile"/);
  });
});

describe("admin shell auth listener ownership", () => {
  it("uses one AuthSessionRefreshProvider in AdminShell", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/admin/components/AdminShell.tsx"),
      "utf8",
    );
    assert.equal((source.match(/<AuthSessionRefreshProvider /g) ?? []).length, 1);
    assert.match(source, /<AuthSessionRefreshProvider serverSession=\{session\}>/);
  });
});

describe("SessionControls sign-out policy", () => {
  it("calls signOut without explicit router.refresh", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/layout/NavigationShell.tsx"),
      "utf8",
    );
    assert.match(source, /await supabase\.auth\.signOut\(\)/);
    assert.equal(source.includes("router.refresh"), false);
  });

  it("still redirects admin sign-out to login", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/layout/NavigationShell.tsx"),
      "utf8",
    );
    assert.match(source, /router\.replace\("\/login"\)/);
  });
});

describe("AuthSessionRefreshProvider implementation", () => {
  it("subscribes once and unsubscribes on cleanup", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/auth/AuthSessionRefreshProvider.tsx"),
      "utf8",
    );
    assert.match(source, /onAuthStateChange/);
    assert.match(source, /subscription\.unsubscribe\(\)/);
    assert.match(source, /scheduleCoalescedRouterRefresh/);
    assert.match(source, /resolveAuthSessionRefreshAction/);
  });
});

describe("one auth event refresh policy", () => {
  it("coalesces duplicate refresh scheduling", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/auth/scheduleCoalescedRouterRefresh.ts"),
      "utf8",
    );
    assert.match(source, /if \(refreshScheduled\)/);
    assert.match(source, /queueMicrotask/);
  });

  it("maps one SIGNED_IN and one SIGNED_OUT to at most one refresh decision each", () => {
    assert.equal(
      resolveAuthSessionRefreshAction(
        "SIGNED_IN",
        AUTHENTICATED_SESSION,
        clientSession("ada@example.com"),
      ),
      "skip",
    );
    assert.equal(resolveAuthSessionRefreshAction("SIGNED_OUT", AUTHENTICATED_SESSION, null), "refresh");
  });
});
