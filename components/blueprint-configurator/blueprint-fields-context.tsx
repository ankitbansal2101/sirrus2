"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FIELDS_SCHEMA_CHANGED_EVENT,
  FIELDS_SCHEMA_STORAGE_KEY,
  resolveFieldDefinitions,
} from "@/lib/blueprint/from-fields-schema";
import type { FieldDefinition } from "@/lib/fields-config/types";

type BlueprintFieldsValue = {
  fields: FieldDefinition[];
  persist?: (next: FieldDefinition[]) => boolean;
};

const BlueprintFieldsContext = createContext<BlueprintFieldsValue | null>(null);

export function BlueprintFieldsProvider({
  fields,
  onPersistFields,
  children,
}: {
  fields: FieldDefinition[];
  onPersistFields?: (next: FieldDefinition[]) => boolean;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ fields, persist: onPersistFields }),
    [fields, onPersistFields],
  );
  return <BlueprintFieldsContext.Provider value={value}>{children}</BlueprintFieldsContext.Provider>;
}

/** Module-scoped blueprint editor uses CRM module fields; legacy Manage Leads uses the fields schema store. */
export function useBlueprintFieldContext(): BlueprintFieldsValue | null {
  return useContext(BlueprintFieldsContext);
}

export function useBlueprintFieldRows(): FieldDefinition[] {
  const scoped = useContext(BlueprintFieldsContext);
  const [legacy, setLegacy] = useState<FieldDefinition[]>(() => resolveFieldDefinitions());

  useEffect(() => {
    if (scoped) return;
    const refresh = () => setLegacy(resolveFieldDefinitions());
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === FIELDS_SCHEMA_STORAGE_KEY || e.key === null) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    window.addEventListener(FIELDS_SCHEMA_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(FIELDS_SCHEMA_CHANGED_EVENT, refresh);
    };
  }, [scoped]);

  return scoped?.fields ?? legacy;
}

export function usePersistBlueprintFields(): ((next: FieldDefinition[]) => boolean) | null {
  const scoped = useContext(BlueprintFieldsContext);
  return scoped?.persist ?? null;
}
