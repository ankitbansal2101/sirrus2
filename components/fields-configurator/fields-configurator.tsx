"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FieldCanvas } from "@/components/fields-configurator/field-canvas";
import { FieldPalette, readDraggedDataType } from "@/components/fields-configurator/field-palette";
import { PropertiesPanel } from "@/components/fields-configurator/properties-panel";
import { IconSettings } from "@/components/icons";
import {
  clearSavedFieldsSchema,
  FIELDS_SCHEMA_CHANGED_EVENT,
  loadFieldsSchema,
  saveFieldsSchema,
} from "@/lib/fields-config/schema-storage";
import { createDefaultLeadFields, createFieldFromDataType } from "@/lib/fields-config/types";
import type { FieldDataType, FieldDefinition } from "@/lib/fields-config/types";

export function FieldsConfigurator() {
  const seedFields = useMemo(() => createDefaultLeadFields(), []);
  const [fields, setFields] = useState<FieldDefinition[]>(() => seedFields);
  const [selectedId, setSelectedId] = useState<string | null>(() => seedFields[0]?.id ?? null);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [dropHighlight, setDropHighlight] = useState(false);
  /** `getData` is empty during `dragover` for custom MIME types; ref allows `preventDefault` so drop fires. */
  const draggingPaletteTypeRef = useRef<FieldDataType | null>(null);

  const reloadFromStorage = useCallback(() => {
    const loaded = loadFieldsSchema();
    if (loaded?.length) {
      setFields(loaded);
      setSelectedId(loaded[0]?.id ?? null);
    } else {
      const next = createDefaultLeadFields();
      setFields(next);
      setSelectedId(next[0]?.id ?? null);
    }
  }, []);

  useEffect(() => {
    reloadFromStorage();
  }, [reloadFromStorage]);

  useEffect(() => {
    const onSchemaChanged = () => reloadFromStorage();
    window.addEventListener(FIELDS_SCHEMA_CHANGED_EVENT, onSchemaChanged);
    return () => window.removeEventListener(FIELDS_SCHEMA_CHANGED_EVENT, onSchemaChanged);
  }, [reloadFromStorage]);

  const selected = useMemo(
    () => fields.find((f) => f.id === selectedId) ?? null,
    [fields, selectedId],
  );

  const updateField = useCallback((next: FieldDefinition) => {
    setFields((prev) => prev.map((f) => (f.id === next.id ? next : f)));
  }, []);

  const removeField = useCallback(
    (id: string) => {
      setFields((prev) => prev.filter((f) => f.id !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [],
  );

  const appendField = useCallback((f: FieldDefinition) => {
    setFields((prev) => [...prev, f]);
    setSelectedId(f.id);
    setPropertiesOpen(true);
  }, []);

  const selectField = useCallback((id: string) => {
    setSelectedId(id);
    setPropertiesOpen(true);
  }, []);

  const handleSaveSchema = useCallback(() => {
    if (saveFieldsSchema(fields)) {
      setSaveBanner("Saved to this browser");
      setPropertiesOpen(false);
      setSelectedId(null);
    } else {
      setSaveBanner("Could not save (storage unavailable)");
    }
    window.setTimeout(() => setSaveBanner(null), 2800);
  }, [fields]);

  const handleClosePanel = useCallback(() => {
    setPropertiesOpen(false);
    setSelectedId(null);
  }, []);

  const handleResetToDefaults = useCallback(() => {
    if (
      !window.confirm(
        "Discard the saved field layout in this browser and load the full product default schema? This cannot be undone.",
      )
    ) {
      return;
    }
    clearSavedFieldsSchema();
    reloadFromStorage();
    setSaveBanner("Loaded product defaults — click Save layout when ready.");
    window.setTimeout(() => setSaveBanner(null), 4000);
  }, [reloadFromStorage]);

  const onDragOverCanvas = (e: React.DragEvent) => {
    if (!draggingPaletteTypeRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropHighlight(true);
  };

  const onDragLeaveCanvas = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as Node).contains(related)) return;
    setDropHighlight(false);
  };

  const onDropCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    setDropHighlight(false);
    const type = readDraggedDataType(e.dataTransfer) ?? draggingPaletteTypeRef.current;
    draggingPaletteTypeRef.current = null;
    if (!type) return;
    appendField(createFieldFromDataType(type));
  };

  return (
    <div className="flex min-h-0 flex-1 bg-canvas">
      <FieldPalette
        onDragTypeSession={(t) => {
          draggingPaletteTypeRef.current = t;
        }}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 p-1.5 sm:p-2">
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="rounded-md border border-border-soft bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink shadow-sm hover:bg-zinc-50"
          >
            Reset to product defaults
          </button>
        </div>
        {saveBanner ? (
          <div
            className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-center text-[11px] font-medium text-emerald-900"
            role="status"
          >
            {saveBanner}
          </div>
        ) : null}
        <FieldCanvas
          fields={fields}
          selectedId={selectedId}
          onSelect={selectField}
          onRemove={removeField}
          isDropTarget={dropHighlight}
          onDragOverCanvas={onDragOverCanvas}
          onDropCanvas={onDropCanvas}
          onDragLeaveCanvas={onDragLeaveCanvas}
        />
      </div>
      {propertiesOpen ? (
        <PropertiesPanel
          field={selected}
          allFields={fields}
          onChange={updateField}
          onSaveSchema={handleSaveSchema}
          onClosePanel={handleClosePanel}
        />
      ) : (
        <button
          type="button"
          title="Show properties panel"
          aria-label="Show properties panel"
          onClick={() => setPropertiesOpen(true)}
          className="flex w-9 shrink-0 items-center justify-center border-l border-border-soft bg-surface py-6 text-accent shadow-sm transition hover:bg-rail-active/40"
        >
          <IconSettings className="size-5" />
        </button>
      )}
    </div>
  );
}
