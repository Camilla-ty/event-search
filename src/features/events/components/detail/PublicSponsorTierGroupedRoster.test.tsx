import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { PublicSponsorTierGroupedRoster } from "@/src/features/events/components/detail/PublicSponsorTierGroupedRoster";
import type { EventSponsorRow } from "@/src/features/events/components/detail/types";
import type {
  PublicSponsorTierPageResult,
  PublicSponsorTierSummaryItem,
} from "@/src/features/events/server/publicSponsorRoster";

const EDITION_ID = "22222222-2222-2222-2222-222222222222";

const summaries: PublicSponsorTierSummaryItem[] = [
  {
    tierRank: 1,
    tierLabel: "Gold",
    count: 25,
    locked: false,
  },
  {
    tierRank: 2,
    tierLabel: "Silver",
    count: 12,
    locked: true,
  },
  {
    tierRank: 3,
    tierLabel: "Bronze",
    count: 7,
    locked: true,
  },
];

function makeSponsor(id: string, name: string, tierRank: number): EventSponsorRow {
  return {
    id,
    company_id: `${id}-company`,
    tier_rank: tierRank,
    tier_label: tierRank === 1 ? "Gold" : tierRank === 2 ? "Silver" : "Bronze",
    display_order: 1,
    companies: {
      id: `${id}-company`,
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      domain: `${id}.example`,
      restricted_at: null,
      logo_url: null,
      logo_source: null,
      logo_status: null,
    },
  } as EventSponsorRow;
}

const tierOneSponsors: EventSponsorRow[] = [
  makeSponsor("sponsor-1", "Tier One Company", 1),
];

type PendingFetch = {
  url: string;
  signal: AbortSignal | null;
  respond: (payload: unknown, ok?: boolean) => void;
  fail: (error: unknown) => void;
};

function tierPagePayload(
  tierRank: number,
  rows: EventSponsorRow[],
  options: {
    page?: number;
    totalInTier?: number;
    totalPages?: number;
    hasMore?: boolean;
  } = {},
): PublicSponsorTierPageResult {
  return {
    editionId: EDITION_ID,
    tierRank,
    tierLabel: tierRank === 1 ? "Gold" : tierRank === 2 ? "Silver" : "Bronze",
    page: options.page ?? 1,
    pageSize: 20,
    totalInTier: options.totalInTier ?? rows.length,
    totalPages: options.totalPages ?? 1,
    hasMore: options.hasMore ?? false,
    rows,
  };
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(label),
  );
  assert.ok(button, `Expected a button containing "${label}".`);
  return button;
}

describe("PublicSponsorTierGroupedRoster tier lazy loading (Phase 4)", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  const originalFetch = globalThis.fetch;
  let pendingFetches: PendingFetch[] = [];

  function mount(isAuthenticated: boolean) {
    pendingFetches = [];
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((resolve, reject) => {
        pendingFetches.push({
          url: String(input),
          signal: init?.signal ?? null,
          respond: (payload, ok = true) => {
            resolve({
              ok,
              status: ok ? 200 : 500,
              json: async () => payload,
            } as Response);
          },
          fail: (error) => reject(error),
        });
      })) as typeof fetch;

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <PublicSponsorTierGroupedRoster
          editionId={EDITION_ID}
          initialTier1Page={tierPagePayload(1, tierOneSponsors, {
            totalInTier: 25,
            totalPages: 2,
            hasMore: true,
          })}
          tierSummaries={summaries.map((summary) => ({
            ...summary,
            locked: !isAuthenticated && summary.tierRank !== 1,
          }))}
          isAuthenticated={isAuthenticated}
          loginHref="/login?redirect=%2Fevents%2Fexample"
          signupHref="/signup?redirect=%2Fevents%2Fexample"
        />,
      );
    });
  }

  afterEach(() => {
    if (root !== null) {
      act(() => {
        root!.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
    globalThis.fetch = originalFetch;
  });

  it("opens Tier 1 by default with SSR rows and never fetches", () => {
    mount(false);

    const gold = findButton(container!, "Gold · 25 sponsors");
    const silver = findButton(container!, "Silver · 12 sponsors");

    assert.equal(gold.getAttribute("aria-expanded"), "true");
    assert.equal(silver.getAttribute("aria-expanded"), "false");
    assert.match(container!.textContent ?? "", /Tier One Company/);
    assert.doesNotMatch(container!.textContent ?? "", /Load More/);
    assert.equal(pendingFetches.length, 0);
  });

  it("loads and appends Tier 1 page 2 for authenticated users", async () => {
    mount(true);

    const loadMore = findButton(container!, "Load More");
    act(() => {
      loadMore.click();
    });

    assert.equal(pendingFetches.length, 1);
    assert.equal(
      pendingFetches[0]!.url,
      `/api/events/${EDITION_ID}/sponsors?tier_rank=1&page=2`,
    );
    assert.equal(loadMore.disabled, true);
    assert.match(loadMore.textContent ?? "", /Loading more…/);

    // Disabled controls must not start duplicate page requests.
    act(() => {
      loadMore.click();
    });
    assert.equal(pendingFetches.length, 1);

    await act(async () => {
      pendingFetches[0]!.respond(
        tierPagePayload(
          1,
          [makeSponsor("sponsor-21", "Tier One Page Two Company", 1)],
          { page: 2, totalInTier: 25, totalPages: 2, hasMore: false },
        ),
      );
      await Promise.resolve();
    });

    assert.match(container!.textContent ?? "", /Tier One Company/);
    assert.match(container!.textContent ?? "", /Tier One Page Two Company/);
    assert.doesNotMatch(container!.textContent ?? "", /Load More/);
  });

  it("shows the login-required panel for anonymous Tier 2 without calling the API", () => {
    mount(false);

    const silver = findButton(container!, "Silver · 12 sponsors");

    act(() => {
      silver.click();
    });

    assert.equal(silver.getAttribute("aria-expanded"), "true");
    assert.match(
      container!.textContent ?? "",
      /Log in or sign up to view sponsors in this tier\./,
    );
    assert.ok(
      container!.querySelector('a[href="/login?redirect=%2Fevents%2Fexample"]'),
    );
    assert.equal(pendingFetches.length, 0);
  });

  it("fetches the first page when an authenticated user expands Tier 2", async () => {
    mount(true);

    const silver = findButton(container!, "Silver · 12 sponsors");

    act(() => {
      silver.click();
    });

    assert.equal(pendingFetches.length, 1);
    assert.equal(
      pendingFetches[0]!.url,
      `/api/events/${EDITION_ID}/sponsors?tier_rank=2&page=1`,
    );
    assert.match(container!.textContent ?? "", /Loading sponsors…/);

    await act(async () => {
      pendingFetches[0]!.respond(
        tierPagePayload(2, [makeSponsor("sponsor-2", "Silver Sponsor Co", 2)]),
      );
      await Promise.resolve();
    });

    assert.match(container!.textContent ?? "", /Silver Sponsor Co/);
    assert.doesNotMatch(container!.textContent ?? "", /Loading sponsors…/);
    assert.doesNotMatch(container!.textContent ?? "", /Sponsor details are not loaded yet\./);
  });

  it("appends one additional page per click and hides Load More at the end", async () => {
    mount(true);

    const silver = findButton(container!, "Silver · 12 sponsors");
    act(() => {
      silver.click();
    });

    await act(async () => {
      pendingFetches[0]!.respond(
        tierPagePayload(
          2,
          [makeSponsor("sponsor-2", "Silver Page One", 2)],
          { totalInTier: 21, totalPages: 2, hasMore: true },
        ),
      );
      await Promise.resolve();
    });

    const loadMore = findButton(container!, "Load More");
    act(() => {
      loadMore.click();
    });

    assert.equal(pendingFetches.length, 2);
    assert.equal(
      pendingFetches[1]!.url,
      `/api/events/${EDITION_ID}/sponsors?tier_rank=2&page=2`,
    );
    assert.equal(loadMore.disabled, true);
    assert.match(container!.textContent ?? "", /Silver Page One/);

    await act(async () => {
      pendingFetches[1]!.respond(
        tierPagePayload(
          2,
          [makeSponsor("sponsor-22", "Silver Page Two", 2)],
          { page: 2, totalInTier: 21, totalPages: 2, hasMore: false },
        ),
      );
      await Promise.resolve();
    });

    const text = container!.textContent ?? "";
    assert.ok(text.indexOf("Silver Page One") < text.indexOf("Silver Page Two"));
    assert.doesNotMatch(text, /Load More/);
  });

  it("keeps existing rows when Load More fails and retries the same page", async () => {
    mount(true);

    act(() => {
      findButton(container!, "Silver · 12 sponsors").click();
    });
    await act(async () => {
      pendingFetches[0]!.respond(
        tierPagePayload(
          2,
          [makeSponsor("sponsor-2", "Silver Page One", 2)],
          { totalInTier: 21, totalPages: 2, hasMore: true },
        ),
      );
      await Promise.resolve();
    });

    act(() => {
      findButton(container!, "Load More").click();
    });
    await act(async () => {
      pendingFetches[1]!.respond({ ok: false, error: "boom" }, false);
      await Promise.resolve();
    });

    assert.match(container!.textContent ?? "", /Silver Page One/);
    assert.match(
      container!.textContent ?? "",
      /Couldn't load sponsors for this tier\./,
    );

    act(() => {
      findButton(container!, "Retry").click();
    });
    assert.equal(pendingFetches.length, 3);
    assert.match(pendingFetches[2]!.url, /tier_rank=2&page=2$/);
    assert.match(container!.textContent ?? "", /Silver Page One/);

    await act(async () => {
      pendingFetches[2]!.respond(
        tierPagePayload(
          2,
          [makeSponsor("sponsor-22", "Silver Page Two", 2)],
          { page: 2, totalInTier: 21, totalPages: 2, hasMore: false },
        ),
      );
      await Promise.resolve();
    });

    assert.match(container!.textContent ?? "", /Silver Page One/);
    assert.match(container!.textContent ?? "", /Silver Page Two/);
  });

  it("shows a retry state on failure and recovers when retried", async () => {
    mount(true);

    const silver = findButton(container!, "Silver · 12 sponsors");

    act(() => {
      silver.click();
    });

    await act(async () => {
      pendingFetches[0]!.respond({ ok: false, error: "boom" }, false);
      await Promise.resolve();
    });

    assert.match(container!.textContent ?? "", /Couldn't load sponsors for this tier\./);
    const retry = findButton(container!, "Retry");

    act(() => {
      retry.click();
    });

    assert.equal(pendingFetches.length, 2);
    assert.match(container!.textContent ?? "", /Loading sponsors…/);

    await act(async () => {
      pendingFetches[1]!.respond(
        tierPagePayload(2, [makeSponsor("sponsor-2", "Silver Sponsor Co", 2)]),
      );
      await Promise.resolve();
    });

    assert.match(container!.textContent ?? "", /Silver Sponsor Co/);
    assert.doesNotMatch(container!.textContent ?? "", /Retry/);
  });

  it("aborts the in-flight request and ignores its stale response when switching tiers", async () => {
    mount(true);

    const silver = findButton(container!, "Silver · 12 sponsors");
    const bronze = findButton(container!, "Bronze · 7 sponsors");

    act(() => {
      silver.click();
    });
    act(() => {
      bronze.click();
    });

    assert.equal(pendingFetches.length, 2);
    assert.equal(pendingFetches[0]!.signal?.aborted, true);
    assert.equal(pendingFetches[1]!.signal?.aborted, false);
    assert.equal(silver.getAttribute("aria-expanded"), "false");
    assert.equal(bronze.getAttribute("aria-expanded"), "true");

    // Stale Tier 2 payload arrives after the switch; it must not commit.
    await act(async () => {
      pendingFetches[0]!.respond(
        tierPagePayload(2, [makeSponsor("sponsor-2", "Silver Sponsor Co", 2)]),
      );
      await Promise.resolve();
    });

    assert.doesNotMatch(container!.textContent ?? "", /Silver Sponsor Co/);
    assert.match(container!.textContent ?? "", /Loading sponsors…/);

    await act(async () => {
      pendingFetches[1]!.respond(
        tierPagePayload(3, [makeSponsor("sponsor-3", "Bronze Sponsor Co", 3)]),
      );
      await Promise.resolve();
    });

    assert.match(container!.textContent ?? "", /Bronze Sponsor Co/);
    assert.doesNotMatch(container!.textContent ?? "", /Silver Sponsor Co/);
    assert.equal(container!.querySelectorAll('[role="region"]').length, 1);
  });

  it("discards loaded rows and aborts Load More when another tier opens", async () => {
    mount(true);

    act(() => {
      findButton(container!, "Silver · 12 sponsors").click();
    });
    await act(async () => {
      pendingFetches[0]!.respond(
        tierPagePayload(
          2,
          [makeSponsor("sponsor-2", "Silver Page One", 2)],
          { totalInTier: 21, totalPages: 2, hasMore: true },
        ),
      );
      await Promise.resolve();
    });

    act(() => {
      findButton(container!, "Load More").click();
    });
    assert.equal(pendingFetches[1]!.signal?.aborted, false);

    act(() => {
      findButton(container!, "Bronze · 7 sponsors").click();
    });

    assert.equal(pendingFetches[1]!.signal?.aborted, true);
    assert.doesNotMatch(container!.textContent ?? "", /Silver Page One/);
    assert.match(container!.textContent ?? "", /Loading sponsors…/);

    await act(async () => {
      pendingFetches[1]!.respond(
        tierPagePayload(
          2,
          [makeSponsor("sponsor-22", "Stale Silver Page Two", 2)],
          { page: 2, totalInTier: 21, totalPages: 2, hasMore: false },
        ),
      );
      await Promise.resolve();
    });

    assert.doesNotMatch(container!.textContent ?? "", /Stale Silver Page Two/);
  });

  it("discards loaded rows and aborts when a tier is collapsed", async () => {
    mount(true);

    const silver = findButton(container!, "Silver · 12 sponsors");

    act(() => {
      silver.click();
    });

    await act(async () => {
      pendingFetches[0]!.respond(
        tierPagePayload(2, [makeSponsor("sponsor-2", "Silver Sponsor Co", 2)]),
      );
      await Promise.resolve();
    });

    assert.match(container!.textContent ?? "", /Silver Sponsor Co/);

    act(() => {
      silver.click();
    });

    assert.equal(silver.getAttribute("aria-expanded"), "false");
    assert.doesNotMatch(container!.textContent ?? "", /Silver Sponsor Co/);
    assert.equal(pendingFetches.length, 1);
  });
});
