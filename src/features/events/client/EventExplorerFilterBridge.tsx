"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { EventFilters } from "@/src/features/events/components/explorer/types";
import { buildEventExplorerFilterKey } from "@/src/features/events/lib/eventExplorerQuery";

export type EventExplorerFilterBridge = {
  filters: EventFilters;
  setFilters: (value: EventFilters | ((prev: EventFilters) => EventFilters)) => void;
};

type EventExplorerFilterBridgeContextValue = {
  bridge: EventExplorerFilterBridge | null;
  registerBridge: (bridge: EventExplorerFilterBridge | null) => void;
};

const EventExplorerFilterBridgeContext =
  createContext<EventExplorerFilterBridgeContextValue | null>(null);

/** Compare bridge payloads without depending on object identity for filters. */
export function eventExplorerBridgesEqual(
  left: EventExplorerFilterBridge | null,
  right: EventExplorerFilterBridge | null,
): boolean {
  if (left === right) {
    return true;
  }
  if (left === null || right === null) {
    return false;
  }
  return (
    left.setFilters === right.setFilters &&
    buildEventExplorerFilterKey(left.filters) === buildEventExplorerFilterKey(right.filters)
  );
}

export function EventExplorerFilterBridgeProvider({ children }: { children: ReactNode }) {
  const [bridge, setBridge] = useState<EventExplorerFilterBridge | null>(null);

  const registerBridge = useCallback((next: EventExplorerFilterBridge | null) => {
    setBridge((current) => (eventExplorerBridgesEqual(current, next) ? current : next));
  }, []);

  const value = useMemo(
    () => ({
      bridge,
      registerBridge,
    }),
    [bridge, registerBridge],
  );

  return (
    <EventExplorerFilterBridgeContext.Provider value={value}>
      {children}
    </EventExplorerFilterBridgeContext.Provider>
  );
}

function useEventExplorerFilterBridgeContext(): EventExplorerFilterBridgeContextValue {
  const context = useContext(EventExplorerFilterBridgeContext);
  if (context === null) {
    throw new Error(
      "EventExplorerFilterBridge hooks must be used within EventExplorerFilterBridgeProvider",
    );
  }
  return context;
}

export function useEventExplorerFilterBridgePublisher(
  filters: EventFilters,
  setFilters: EventExplorerFilterBridge["setFilters"],
): void {
  const { registerBridge } = useEventExplorerFilterBridgeContext();
  const setFiltersRef = useRef(setFilters);
  const filtersRef = useRef(filters);

  setFiltersRef.current = setFilters;
  filtersRef.current = filters;

  const stableSetFilters = useCallback<EventExplorerFilterBridge["setFilters"]>((value) => {
    setFiltersRef.current(value);
  }, []);

  const filterKey = buildEventExplorerFilterKey(filters);

  useEffect(() => {
    registerBridge({
      filters: filtersRef.current,
      setFilters: stableSetFilters,
    });
    return () => {
      registerBridge(null);
    };
  }, [filterKey, registerBridge, stableSetFilters]);
}

export function useEventExplorerFilterBridgeConsumer(): EventExplorerFilterBridge | null {
  return useEventExplorerFilterBridgeContext().bridge;
}
