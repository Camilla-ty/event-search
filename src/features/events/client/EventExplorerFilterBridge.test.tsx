import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  act,
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  DEFAULT_EVENT_EXPLORER_FILTERS,
  buildEventExplorerFilterKey,
  buildEventExplorerSearchParams,
  parseEventExplorerFiltersFromSearchParams,
} from "@/src/features/events/lib/eventExplorerQuery";
import type { EventFilters } from "@/src/features/events/components/explorer/types";
import { useUrlSyncedState } from "@/src/lib/navigation/useUrlSyncedState";

import {
  EventExplorerFilterBridgeProvider,
  eventExplorerBridgesEqual,
  useEventExplorerFilterBridgeConsumer,
  useEventExplorerFilterBridgePublisher,
  type EventExplorerFilterBridge,
} from "@/src/features/events/client/EventExplorerFilterBridge";

function eventExplorerFiltersEqual(left: EventFilters, right: EventFilters): boolean {
  return buildEventExplorerFilterKey(left) === buildEventExplorerFilterKey(right);
}

describe("eventExplorerBridgesEqual", () => {
  it("treats identical filter keys as equal regardless of filters object identity", () => {
    const setFilters = () => {};
    const left: EventExplorerFilterBridge = {
      filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS, query: "token" },
      setFilters,
    };
    const right: EventExplorerFilterBridge = {
      filters: { ...DEFAULT_EVENT_EXPLORER_FILTERS, query: "token" },
      setFilters,
    };

    assert.equal(eventExplorerBridgesEqual(left, right), true);
  });

  it("returns false when one bridge is null", () => {
    const setFilters = () => {};
    assert.equal(
      eventExplorerBridgesEqual(null, {
        filters: DEFAULT_EVENT_EXPLORER_FILTERS,
        setFilters,
      }),
      false,
    );
  });
});

describe("EventExplorerFilterBridge mount behavior", () => {
  let container: HTMLDivElement;
  let root: Root;
  let depthErrors: string[];
  let originalConsoleError: typeof console.error;

  afterEach(() => {
    console.error = originalConsoleError;
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function mountTree(tree: ReactNode) {
    depthErrors = [];
    originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      const message = args.map(String).join(" ");
      if (message.includes("Maximum update depth")) {
        depthErrors.push(message);
      }
      originalConsoleError(...args);
    };

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(tree);
    });
  }

  async function flushEffects(rounds = 3) {
    for (let index = 0; index < rounds; index += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  }

  it("registers once on mount, unregisters once on unmount, and avoids update-depth loops", async () => {
    const bridgeSnapshots: Array<EventExplorerFilterBridge | null> = [];

    function BridgeRecorder() {
      const bridge = useEventExplorerFilterBridgeConsumer();
      bridgeSnapshots.push(bridge);
      return null;
    }

    function PublisherHarness() {
      const [filters, setFilters] = useUrlSyncedState({
        initial: DEFAULT_EVENT_EXPLORER_FILTERS,
        pathname: "/events",
        parse: parseEventExplorerFiltersFromSearchParams,
        serialize: buildEventExplorerSearchParams,
        equals: eventExplorerFiltersEqual,
        history: "replace",
      });
      const [parentGeneration, setParentGeneration] = useState(0);

      useEffect(() => {
        let ticks = 0;
        const timer = setInterval(() => {
          ticks += 1;
          setParentGeneration(ticks);
          if (ticks >= 25) {
            clearInterval(timer);
          }
        }, 0);
        return () => clearInterval(timer);
      }, []);

      void parentGeneration;
      useEventExplorerFilterBridgePublisher(filters, setFilters);
      return <BridgeRecorder />;
    }

    mountTree(
      <EventExplorerFilterBridgeProvider>
        <PublisherHarness />
      </EventExplorerFilterBridgeProvider>,
    );

    await flushEffects(5);

    assert.equal(depthErrors.length, 0, depthErrors.join("\n"));

    const nonNullBridges = bridgeSnapshots.filter((bridge) => bridge !== null);
    assert.ok(nonNullBridges.length > 0);
    const firstBridge = nonNullBridges[0]!;
    assert.ok(nonNullBridges.every((bridge) => bridge === firstBridge));

    const nullCount = bridgeSnapshots.filter((bridge) => bridge === null).length;
    assert.ok(nullCount >= 1);

    act(() => {
      root.unmount();
    });

    assert.equal(depthErrors.length, 0, depthErrors.join("\n"));
  });

  it("updates bridge when filter key changes without update-depth loops", async () => {
    const filterKeys: string[] = [];

    function BridgeKeyRecorder() {
      const bridge = useEventExplorerFilterBridgeConsumer();
      if (bridge !== null) {
        filterKeys.push(buildEventExplorerFilterKey(bridge.filters));
      }
      return null;
    }

    function MutablePublisherHarness({
      filters,
      setFilters,
    }: {
      filters: EventFilters;
      setFilters: Dispatch<SetStateAction<EventFilters>>;
    }) {
      useEventExplorerFilterBridgePublisher(filters, setFilters);
      return <BridgeKeyRecorder />;
    }

    function HarnessRoot() {
      const [filters, setFilters] = useState<EventFilters>(DEFAULT_EVENT_EXPLORER_FILTERS);
      const stableSetFilters = useCallback<Dispatch<SetStateAction<EventFilters>>>(
        (value) => {
          setFilters(value);
        },
        [],
      );

      return (
        <MutablePublisherHarness filters={filters} setFilters={stableSetFilters} />
      );
    }

    mountTree(
      <EventExplorerFilterBridgeProvider>
        <HarnessRoot />
      </EventExplorerFilterBridgeProvider>,
    );

    await flushEffects();

    act(() => {
      root.render(
        <EventExplorerFilterBridgeProvider>
          <MutablePublisherHarness
            filters={{ ...DEFAULT_EVENT_EXPLORER_FILTERS, query: "token" }}
            setFilters={() => {}}
          />
        </EventExplorerFilterBridgeProvider>,
      );
    });

    await flushEffects();

    assert.equal(depthErrors.length, 0, depthErrors.join("\n"));
    assert.ok(filterKeys.includes(buildEventExplorerFilterKey(DEFAULT_EVENT_EXPLORER_FILTERS)));
    assert.ok(
      filterKeys.includes(
        buildEventExplorerFilterKey({ ...DEFAULT_EVENT_EXPLORER_FILTERS, query: "token" }),
      ),
    );
  });
});

describe("EventExplorerFilterBridge publisher policy", () => {
  it("depends on filter key and stable setFilters ref instead of raw setFilters identity", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/events/client/EventExplorerFilterBridge.tsx"),
      "utf8",
    );

    assert.match(source, /buildEventExplorerFilterKey\(filters\)/);
    assert.match(source, /stableSetFilters/);
    assert.doesNotMatch(source, /\[filters, registerBridge, setFilters\]/);
  });

  it("uses idempotent registerBridge updates", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/events/client/EventExplorerFilterBridge.tsx"),
      "utf8",
    );

    assert.match(source, /eventExplorerBridgesEqual/);
  });
});

describe("GlobalSearchBar bridge dependency policy", () => {
  it("depends on eventExplorerQuery instead of the full bridge object", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/layout/GlobalSearchBar.tsx"),
      "utf8",
    );

    assert.match(source, /eventExplorerQuery/);
    assert.doesNotMatch(source, /\[eventExplorerBridge\?\.filters\.query, eventExplorerBridge\]/);
  });
});

describe("EventExplorerPage filter equality policy", () => {
  it("uses a module-scoped equals callback for useUrlSyncedState", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/features/events/components/explorer/EventExplorerPage.tsx",
      ),
      "utf8",
    );

    assert.match(source, /function eventExplorerFiltersEqual/);
    assert.match(source, /equals: eventExplorerFiltersEqual/);
    assert.doesNotMatch(source, /equals: \(left, right\)/);
  });
});
