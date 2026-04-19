"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type BlueprintWorkspaceValue = {
  saveBanner: string | null;
  setSaveBanner: (message: string | null) => void;
  registerSaveHandler: (fn: (() => void) | null) => void;
  runSave: () => void;
};

const BlueprintWorkspaceContext = createContext<BlueprintWorkspaceValue | null>(null);

export function BlueprintWorkspaceProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<(() => void) | null>(null);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  const registerSaveHandler = useCallback((fn: (() => void) | null) => {
    handlerRef.current = fn;
  }, []);

  const runSave = useCallback(() => {
    handlerRef.current?.();
  }, []);

  const value = useMemo(
    () => ({
      saveBanner,
      setSaveBanner,
      registerSaveHandler,
      runSave,
    }),
    [saveBanner, registerSaveHandler, runSave],
  );

  return <BlueprintWorkspaceContext.Provider value={value}>{children}</BlueprintWorkspaceContext.Provider>;
}

export function useBlueprintWorkspace(): BlueprintWorkspaceValue {
  const ctx = useContext(BlueprintWorkspaceContext);
  if (!ctx) {
    throw new Error("useBlueprintWorkspace must be used within BlueprintWorkspaceProvider");
  }
  return ctx;
}
