import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  eventCollectionHasFilterOrSearchParams,
  getCollectionIndexability,
  getCompanyIndexability,
  getEventEditionIndexability,
  getSeriesIndexability,
  getTopicIndexability,
  normalizeSeriesLifecycle,
  robotsForIndexability,
  sponsorCollectionHasFilterOrSearchParams,
} from "@/src/lib/seo/indexability";
import { resolveMergedSeriesSuccessorWithLoader } from "@/src/lib/seo/resolveSeriesPublicAccess";

describe("getCompanyIndexability", () => {
  it("noindexes and excludes 0 sponsored editions", () => {
    const decision = getCompanyIndexability({
      restricted: false,
      sponsoredEditionCount: 0,
    });
    assert.equal(decision.indexable, false);
    assert.equal(decision.includeInSitemap, false);
    assert.deepEqual(decision.robots, { index: false, follow: true });
  });

  it("indexes and includes 1+ sponsored editions", () => {
    const decision = getCompanyIndexability({
      restricted: false,
      sponsoredEditionCount: 1,
    });
    assert.equal(decision.indexable, true);
    assert.equal(decision.includeInSitemap, true);
  });

  it("never indexes restricted companies even with sponsors", () => {
    const decision = getCompanyIndexability({
      restricted: true,
      sponsoredEditionCount: 40,
    });
    assert.equal(decision.indexable, false);
    assert.equal(decision.includeInSitemap, false);
  });
});

describe("getEventEditionIndexability", () => {
  it("noindexes and excludes 0 sponsors", () => {
    const decision = getEventEditionIndexability({ sponsorCount: 0 });
    assert.equal(decision.indexable, false);
    assert.equal(decision.includeInSitemap, false);
  });

  it("indexes and includes 1+ sponsors", () => {
    const decision = getEventEditionIndexability({ sponsorCount: 12 });
    assert.equal(decision.indexable, true);
    assert.equal(decision.includeInSitemap, true);
  });
});

describe("getSeriesIndexability", () => {
  it("indexes active and discontinued series", () => {
    assert.equal(
      getSeriesIndexability({ lifecycleStatus: "active" }).indexable,
      true,
    );
    assert.equal(
      getSeriesIndexability({ lifecycleStatus: "discontinued" }).indexable,
      true,
    );
    assert.equal(
      getSeriesIndexability({ lifecycleStatus: null }).indexable,
      true,
    );
  });

  it("noindexes merged series destinations", () => {
    const decision = getSeriesIndexability({
      lifecycleStatus: "merged",
      treatAsMergedNonDestination: true,
    });
    assert.equal(decision.indexable, false);
    assert.equal(decision.includeInSitemap, false);
  });
});

describe("getTopicIndexability", () => {
  it("indexes public topics", () => {
    assert.equal(getTopicIndexability().indexable, true);
    assert.equal(getTopicIndexability().includeInSitemap, true);
  });
});

describe("collection filter indexability", () => {
  it("keeps clean /events and /sponsors indexable", () => {
    assert.equal(
      getCollectionIndexability({ hasFilterOrSearchParams: false }).indexable,
      true,
    );
    assert.equal(eventCollectionHasFilterOrSearchParams({}), false);
    assert.equal(sponsorCollectionHasFilterOrSearchParams({}), false);
  });

  it("noindexes search/filter parameter versions", () => {
    assert.equal(
      eventCollectionHasFilterOrSearchParams({ q: "bitcoin" }),
      true,
    );
    assert.equal(
      eventCollectionHasFilterOrSearchParams({ topic: ["defi"], page: "2" }),
      true,
    );
    assert.equal(
      sponsorCollectionHasFilterOrSearchParams({ event: "btc-prague-2025" }),
      true,
    );
    assert.equal(
      getCollectionIndexability({ hasFilterOrSearchParams: true }).indexable,
      false,
    );
    assert.deepEqual(
      robotsForIndexability(
        getCollectionIndexability({ hasFilterOrSearchParams: true }),
      ),
      { index: false, follow: true },
    );
  });
});

describe("robotsForIndexability", () => {
  it("omits robots when indexable", () => {
    assert.equal(
      robotsForIndexability(getCompanyIndexability({
        restricted: false,
        sponsoredEditionCount: 3,
      })),
      undefined,
    );
  });
});

describe("normalizeSeriesLifecycle", () => {
  it("treats empty/null as active", () => {
    assert.equal(normalizeSeriesLifecycle(null), "active");
    assert.equal(normalizeSeriesLifecycle(""), "active");
  });
});

describe("resolveMergedSeriesSuccessorWithLoader", () => {
  it("redirects merged series to a valid successor", async () => {
    const result = await resolveMergedSeriesSuccessorWithLoader(
      {
        id: "a",
        slug: "old-brand",
        lifecycle_status: "merged",
        merged_into_series_id: "b",
      },
      async (id) => {
        if (id === "b") {
          return {
            id: "b",
            slug: "new-brand",
            lifecycle_status: "active",
            merged_into_series_id: null,
          };
        }
        return null;
      },
    );
    assert.equal(result.kind, "redirect");
    if (result.kind === "redirect") {
      assert.equal(result.path, "/events/series/new-brand");
      assert.equal(result.successorId, "b");
    }
  });

  it("collapses redirect chains to the final successor", async () => {
    const result = await resolveMergedSeriesSuccessorWithLoader(
      {
        id: "a",
        slug: "a",
        lifecycle_status: "merged",
        merged_into_series_id: "b",
      },
      async (id) => {
        if (id === "b") {
          return {
            id: "b",
            slug: "b",
            lifecycle_status: "merged",
            merged_into_series_id: "c",
          };
        }
        if (id === "c") {
          return {
            id: "c",
            slug: "final",
            lifecycle_status: "discontinued",
            merged_into_series_id: null,
          };
        }
        return null;
      },
    );
    assert.equal(result.kind, "redirect");
    if (result.kind === "redirect") {
      assert.equal(result.path, "/events/series/final");
    }
  });

  it("returns tombstone when successor is missing", async () => {
    const result = await resolveMergedSeriesSuccessorWithLoader(
      {
        id: "a",
        slug: "a",
        lifecycle_status: "merged",
        merged_into_series_id: "missing",
      },
      async () => null,
    );
    assert.equal(result.kind, "tombstone");
  });

  it("protects against redirect loops", async () => {
    const result = await resolveMergedSeriesSuccessorWithLoader(
      {
        id: "a",
        slug: "a",
        lifecycle_status: "merged",
        merged_into_series_id: "b",
      },
      async (id) => {
        if (id === "b") {
          return {
            id: "b",
            slug: "b",
            lifecycle_status: "merged",
            merged_into_series_id: "a",
          };
        }
        return null;
      },
    );
    assert.equal(result.kind, "tombstone");
  });
});
