"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SponsorDiscoverySearchBridge = {
  query: string;
  submitQuery: (query: string) => void;
};

type SponsorDiscoverySearchBridgeContextValue = {
  bridge: SponsorDiscoverySearchBridge | null;
  registerBridge: (bridge: SponsorDiscoverySearchBridge | null) => void;
};

const SponsorDiscoverySearchBridgeContext =
  createContext<SponsorDiscoverySearchBridgeContextValue | null>(null);

export function SponsorDiscoverySearchBridgeProvider({ children }: { children: ReactNode }) {
  const [bridge, setBridge] = useState<SponsorDiscoverySearchBridge | null>(null);

  const registerBridge = useCallback((next: SponsorDiscoverySearchBridge | null) => {
    setBridge(next);
  }, []);

  const value = useMemo(
    () => ({
      bridge,
      registerBridge,
    }),
    [bridge, registerBridge],
  );

  return (
    <SponsorDiscoverySearchBridgeContext.Provider value={value}>
      {children}
    </SponsorDiscoverySearchBridgeContext.Provider>
  );
}

function useSponsorDiscoverySearchBridgeContext(): SponsorDiscoverySearchBridgeContextValue {
  const context = useContext(SponsorDiscoverySearchBridgeContext);
  if (context === null) {
    throw new Error(
      "SponsorDiscoverySearchBridge hooks must be used within SponsorDiscoverySearchBridgeProvider",
    );
  }
  return context;
}

export function useSponsorDiscoverySearchBridgePublisher(
  query: string,
  submitQuery: SponsorDiscoverySearchBridge["submitQuery"],
): void {
  const { registerBridge } = useSponsorDiscoverySearchBridgeContext();

  useEffect(() => {
    registerBridge({ query, submitQuery });
    return () => {
      registerBridge(null);
    };
  }, [query, registerBridge, submitQuery]);
}

export function useSponsorDiscoverySearchBridgeConsumer(): SponsorDiscoverySearchBridge | null {
  return useSponsorDiscoverySearchBridgeContext().bridge;
}
