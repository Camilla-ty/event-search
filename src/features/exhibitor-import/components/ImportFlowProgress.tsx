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

type ImportFlowProgressContextValue = {
  progressLabel: string | null;
  setProgressLabel: (label: string | null) => void;
};

const ImportFlowProgressContext = createContext<ImportFlowProgressContextValue | null>(null);

export function ImportFlowProgressProvider({ children }: { children: ReactNode }) {
  const [progressLabel, setProgressLabelState] = useState<string | null>(null);

  const setProgressLabel = useCallback((label: string | null) => {
    setProgressLabelState(label);
  }, []);

  const value = useMemo(
    () => ({ progressLabel, setProgressLabel }),
    [progressLabel, setProgressLabel],
  );

  return (
    <ImportFlowProgressContext.Provider value={value}>
      {children}
    </ImportFlowProgressContext.Provider>
  );
}

export function useImportFlowProgress() {
  const context = useContext(ImportFlowProgressContext);
  if (!context) {
    throw new Error("useImportFlowProgress must be used within ImportFlowProgressProvider");
  }
  return context;
}

export function useImportProgressLabel(active: boolean, label: string | null) {
  const { setProgressLabel } = useImportFlowProgress();

  useEffect(() => {
    if (!active || !label) {
      setProgressLabel(null);
      return;
    }

    setProgressLabel(label);
    return () => {
      setProgressLabel(null);
    };
  }, [active, label, setProgressLabel]);
}
