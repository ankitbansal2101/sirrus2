"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CRM_CHANGED_EVENT, loadCrmWorkspace, saveCrmWorkspace } from "@/lib/crm/storage";
import type { CrmWorkspace } from "@/lib/crm/types";
import { addDemoLeads } from "@/lib/crm/sample-leads";

type CrmContextValue = {
  workspace: CrmWorkspace | null;
  ready: boolean;
  save: (next: CrmWorkspace) => void;
  reload: () => void;
};

const CrmContext = createContext<CrmContextValue | null>(null);

export function CrmProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<CrmWorkspace | null>(null);
  const [ready, setReady] = useState(false);

  const reload = useCallback(() => {
    const loaded = loadCrmWorkspace();
    if (loaded?.industryId === "real_estate" && loaded.modules.some((module) => module.apiKey === "leads" || module.pluralLabel.toLowerCase() === "leads")) {
      const migrated = addDemoLeads(loaded).workspace;
      if (JSON.stringify(loaded) !== JSON.stringify(migrated)) saveCrmWorkspace(migrated);
      setWorkspace(migrated);
    } else {
      setWorkspace(loaded);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    reload();
    const onChange = () => setWorkspace(loadCrmWorkspace());
    window.addEventListener(CRM_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CRM_CHANGED_EVENT, onChange);
  }, [reload]);

  const save = useCallback((next: CrmWorkspace) => {
    saveCrmWorkspace(next);
    setWorkspace(next);
  }, []);

  const value = useMemo(() => ({ workspace, ready, save, reload }), [workspace, ready, save, reload]);
  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm(): CrmContextValue {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrm must be used inside CrmProvider");
  return ctx;
}
