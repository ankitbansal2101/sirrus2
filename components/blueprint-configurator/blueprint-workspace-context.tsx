"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { BlueprintDocument } from "@/lib/blueprint/types";
import type { BlueprintValidationResult } from "@/lib/blueprint/validator/validate-blueprint";

export type BlueprintCanvasAdapter = {
  getDocument: () => BlueprintDocument;
  applyDocument: (doc: BlueprintDocument) => void;
  fitView: () => void;
};

type BlueprintWorkspaceValue = {
  saveBanner: string | null;
  setSaveBanner: (message: string | null) => void;
  registerSaveHandler: (fn: (() => void) | null) => void;
  runSave: () => void;
  aiPanelOpen: boolean;
  setAiPanelOpen: (open: boolean) => void;
  pendingApproval: boolean;
  setPendingApproval: (pending: boolean) => void;
  lastValidation: BlueprintValidationResult | null;
  setLastValidation: (result: BlueprintValidationResult | null) => void;
  registerCanvasAdapter: (adapter: BlueprintCanvasAdapter | null) => void;
  getLiveDocument: () => BlueprintDocument | null;
  applyLiveDocument: (doc: BlueprintDocument) => void;
  reviewOnCanvas: () => void;
};

const BlueprintWorkspaceContext = createContext<BlueprintWorkspaceValue | null>(null);

export function BlueprintWorkspaceProvider({
  children,
  initialAiPanelOpen = false,
}: {
  children: ReactNode;
  initialAiPanelOpen?: boolean;
}) {
  const handlerRef = useRef<(() => void) | null>(null);
  const canvasRef = useRef<BlueprintCanvasAdapter | null>(null);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(initialAiPanelOpen);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [lastValidation, setLastValidation] = useState<BlueprintValidationResult | null>(null);

  const registerSaveHandler = useCallback((fn: (() => void) | null) => {
    handlerRef.current = fn;
  }, []);

  const runSave = useCallback(() => {
    handlerRef.current?.();
  }, []);

  const registerCanvasAdapter = useCallback((adapter: BlueprintCanvasAdapter | null) => {
    canvasRef.current = adapter;
  }, []);

  const getLiveDocument = useCallback(() => canvasRef.current?.getDocument() ?? null, []);

  const applyLiveDocument = useCallback((doc: BlueprintDocument) => {
    canvasRef.current?.applyDocument(doc);
  }, []);

  const reviewOnCanvas = useCallback(() => {
    canvasRef.current?.fitView();
  }, []);

  const value = useMemo(
    () => ({
      saveBanner,
      setSaveBanner,
      registerSaveHandler,
      runSave,
      aiPanelOpen,
      setAiPanelOpen,
      pendingApproval,
      setPendingApproval,
      lastValidation,
      setLastValidation,
      registerCanvasAdapter,
      getLiveDocument,
      applyLiveDocument,
      reviewOnCanvas,
    }),
    [
      saveBanner,
      registerSaveHandler,
      runSave,
      aiPanelOpen,
      pendingApproval,
      lastValidation,
      registerCanvasAdapter,
      getLiveDocument,
      applyLiveDocument,
      reviewOnCanvas,
    ],
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
