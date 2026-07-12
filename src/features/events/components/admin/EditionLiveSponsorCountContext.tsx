"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type EditionLiveSponsorCountContextValue = {
  liveSponsorCount: number;
  setLiveSponsorCount: (count: number) => void;
};

const EditionLiveSponsorCountContext =
  createContext<EditionLiveSponsorCountContextValue | null>(null);

type EditionLiveSponsorCountProviderProps = {
  initialCount: number;
  children: ReactNode;
};

export function EditionLiveSponsorCountProvider({
  initialCount,
  children,
}: EditionLiveSponsorCountProviderProps) {
  const [liveSponsorCount, setLiveSponsorCount] = useState(initialCount);

  return (
    <EditionLiveSponsorCountContext.Provider
      value={{ liveSponsorCount, setLiveSponsorCount }}
    >
      {children}
    </EditionLiveSponsorCountContext.Provider>
  );
}

export function useEditionLiveSponsorCount(): EditionLiveSponsorCountContextValue {
  const context = useContext(EditionLiveSponsorCountContext);
  if (context === null) {
    throw new Error(
      "useEditionLiveSponsorCount must be used within EditionLiveSponsorCountProvider",
    );
  }
  return context;
}

export function EditionLiveSponsorCountLabel() {
  const { liveSponsorCount } = useEditionLiveSponsorCount();
  return <>Live sponsors: {liveSponsorCount}</>;
}
