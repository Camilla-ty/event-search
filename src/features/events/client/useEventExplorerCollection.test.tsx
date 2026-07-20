import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  useEventExplorerCollection,
  type UseEventExplorerCollectionResult,
} from "@/src/features/events/client/useEventExplorerCollection";
import { DEFAULT_EVENT_EXPLORER_FILTERS } from "@/src/features/events/lib/eventExplorerQuery";
import type { EventExplorerRow } from "@/src/features/events/server/eventExplorerTypes";
import type { EventExplorerPageResult } from "@/src/features/events/server/eventExplorerTypes";
import type { EventExplorerParams } from "@/src/features/events/server/eventExplorerParams";

function row(id: string, name: string): EventExplorerRow {
  return {
    id,
    slug: id,
    name,
    href: `/events/${id}`,
    start_date: null,
    end_date: null,
    sponsor_count: 0,
    location_label: "",
    series: null,
    keyword_preview: null,
  };
}

function buildInitial(
  overrides: Partial<EventExplorerPageResult> = {},
): EventExplorerPageResult {
  const params: EventExplorerParams = {
    filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS },
    sort: "recommended",
    page: 1,
  };

  return {
    rows: [],
    total: 0,
    page: 1,
    page_size: 20,
    sort: "recommended",
    filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS },
    facets: { countries: [], topics: [] },
    activeTopic: null,
    topicUnknown: false,
    params,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type FetchHandler = () => Promise<Response> | Response;

function installFetchMock(handlers: Record<string, FetchHandler>): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL) => {
    const url = new URL(String(input), "http://localhost");
    const sort = url.searchParams.get("sort") ?? "recommended";
    const handler = handlers[sort];
    if (!handler) {
      throw new Error(`No mock fetch handler registered for sort=${sort}`);
    }
    const result = handler();
    return result instanceof Promise ? result : Promise.resolve(result);
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useEventExplorerCollection sort behavior", () => {
  let container: HTMLDivElement;
  let root: Root;
  let restoreFetch: (() => void) | null = null;

  afterEach(() => {
    if (restoreFetch) {
      restoreFetch();
      restoreFetch = null;
    }
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function mount(initial: EventExplorerPageResult) {
    const snapshots: UseEventExplorerCollectionResult[] = [];

    function Harness() {
      const result = useEventExplorerCollection(initial);
      useEffect(() => {
        snapshots.push(result);
      });
      return null;
    }

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<Harness />);
    });

    return {
      latest: () => snapshots[snapshots.length - 1]!,
    };
  }

  async function flush(rounds = 3) {
    for (let index = 0; index < rounds; index += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  }

  it("Name → Recommended: a successful fetch restores recommended order", async () => {
    const recommendedRows = [row("r1", "Recommended First"), row("r2", "Recommended Second")];
    const nameRows = [row("n1", "Alpha"), row("n2", "Beta")];

    restoreFetch = installFetchMock({
      name: () =>
        jsonResponse(
          buildInitial({
            rows: nameRows,
            total: nameRows.length,
            sort: "name",
            params: {
              filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS },
              sort: "name",
              page: 1,
            },
          }),
        ),
      recommended: () =>
        jsonResponse(
          buildInitial({
            rows: recommendedRows,
            total: recommendedRows.length,
            sort: "recommended",
            params: {
              filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS },
              sort: "recommended",
              page: 1,
            },
          }),
        ),
    });

    const initial = buildInitial({
      rows: recommendedRows,
      total: recommendedRows.length,
    });

    const harness = mount(initial);
    await flush();

    act(() => {
      harness.latest().setSort("name");
    });
    await flush();

    assert.equal(harness.latest().params.sort, "name");
    assert.deepEqual(harness.latest().rows.map((r) => r.id), ["n1", "n2"]);
    assert.equal(harness.latest().error, null);

    act(() => {
      harness.latest().setSort("recommended");
    });
    await flush();

    assert.equal(harness.latest().params.sort, "recommended");
    assert.deepEqual(harness.latest().rows.map((r) => r.id), ["r1", "r2"]);
    assert.equal(harness.latest().error, null);
  });

  it("sort change followed by a failed fetch restores the last successful full params (filters, page, and sort)", async () => {
    const initialRows = [row("n1", "Alpha"), row("n2", "Beta")];

    const handlers: Record<string, FetchHandler> = {
      date_desc: () => jsonResponse({ ok: false, error: "Explorer fetch failed." }, 500),
    };
    restoreFetch = installFetchMock(handlers);

    const initial = buildInitial({
      rows: initialRows,
      total: initialRows.length,
      sort: "name",
      filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS, query: "abc" },
      params: {
        filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS, query: "abc" },
        sort: "name",
        page: 2,
      },
    });

    const harness = mount(initial);
    await flush();

    act(() => {
      harness.latest().setSort("date_desc");
    });
    await flush();

    // Rows are untouched by the failed fetch.
    assert.deepEqual(harness.latest().rows.map((r) => r.id), ["n1", "n2"]);
    // The full params object is restored, not just the sort field.
    assert.deepEqual(harness.latest().params, initial.params);
    assert.equal(harness.latest().params.filters.query, "abc");
    assert.equal(harness.latest().params.page, 2);
    assert.equal(harness.latest().params.sort, "name");
    // The failure is surfaced.
    assert.notEqual(harness.latest().error, null);
    assert.match(harness.latest().error ?? "", /Explorer fetch failed\./);

    // Retry replays the same failed attempt without introducing a second
    // source of truth: it just re-applies the params that previously failed.
    const dateDescRows = [row("d1", "Newest"), row("d2", "Older")];
    handlers.date_desc = () =>
      jsonResponse(
        buildInitial({
          rows: dateDescRows,
          total: dateDescRows.length,
          sort: "date_desc",
          filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS, query: "abc" },
          params: {
            filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS, query: "abc" },
            sort: "date_desc",
            page: 1,
          },
        }),
      );

    act(() => {
      harness.latest().retry();
    });
    await flush();

    assert.equal(harness.latest().error, null);
    assert.deepEqual(harness.latest().rows.map((r) => r.id), ["d1", "d2"]);
    assert.equal(harness.latest().params.sort, "date_desc");
  });

  it("shows no visible error initially, and only surfaces one after a non-abort failure", async () => {
    restoreFetch = installFetchMock({
      name: () => jsonResponse({ ok: false, error: "Server unavailable." }, 503),
    });

    const initial = buildInitial({
      rows: [row("r1", "Recommended First")],
      total: 1,
    });

    const harness = mount(initial);
    await flush();

    assert.equal(harness.latest().error, null);

    act(() => {
      harness.latest().setSort("name");
    });
    await flush();

    assert.equal(harness.latest().error, "Server unavailable.");
    // Dropdown/params fall back to the last successful (initial) state.
    assert.equal(harness.latest().params.sort, "recommended");
    assert.deepEqual(harness.latest().rows.map((r) => r.id), ["r1"]);
  });

  it("rapid sort changes only apply the latest successful response", async () => {
    const recommendedRows = [row("r1", "Recommended First")];
    const dateDescRows = [row("d1", "Newest")];
    const dateAscRows = [row("a1", "Oldest")];

    const deferredAsc = createDeferred<Response>();

    restoreFetch = installFetchMock({
      date_asc: () => deferredAsc.promise,
      date_desc: () =>
        jsonResponse(
          buildInitial({
            rows: dateDescRows,
            total: dateDescRows.length,
            sort: "date_desc",
            params: {
              filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS },
              sort: "date_desc",
              page: 1,
            },
          }),
        ),
    });

    const initial = buildInitial({
      rows: recommendedRows,
      total: recommendedRows.length,
    });

    const harness = mount(initial);
    await flush();

    act(() => {
      harness.latest().setSort("date_asc");
    });
    await flush(1);

    act(() => {
      harness.latest().setSort("date_desc");
    });
    await flush();

    assert.equal(harness.latest().params.sort, "date_desc");
    assert.deepEqual(harness.latest().rows.map((r) => r.id), ["d1"]);
    assert.equal(harness.latest().error, null);

    // The stale "date_asc" response arrives late; it must be ignored because a
    // newer request (date_desc) has already superseded it.
    act(() => {
      deferredAsc.resolve(
        jsonResponse(
          buildInitial({
            rows: dateAscRows,
            total: dateAscRows.length,
            sort: "date_asc",
            params: {
              filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS },
              sort: "date_asc",
              page: 1,
            },
          }),
        ),
      );
    });
    await flush();

    assert.equal(harness.latest().params.sort, "date_desc");
    assert.deepEqual(harness.latest().rows.map((r) => r.id), ["d1"]);
    assert.equal(harness.latest().error, null);
  });
});
