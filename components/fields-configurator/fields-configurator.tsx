"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FieldCanvas } from "@/components/fields-configurator/field-canvas";
import { FieldPalette, readDraggedDataType } from "@/components/fields-configurator/field-palette";
import { PropertiesPanel } from "@/components/fields-configurator/properties-panel";
import { IconSettings } from "@/components/icons";
import { loadFieldsSchema, saveFieldsSchema } from "@/lib/fields-config/schema-storage";
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

  useEffect(() => {
    const loaded = loadFieldsSchema();
    if (loaded?.length) {
      setFields(loaded);
      setSelectedId(loaded[0]?.id ?? null);
    }
  }, []);

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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-4 sm:gap-3 sm:p-6">
        {saveBanner ? (
          <div
            className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-900"
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
          title="Show properties"
          aria-label="Show properties panel"
          onClick={() => setPropertiesOpen(true)}
          className="flex w-12 shrink-0 flex-col items-center justify-center gap-2 border-l border-border-soft bg-surface py-6 text-accent shadow-sm transition hover:bg-rail-active/40"
        >
          <IconSettings className="size-6" />
          <span className="max-w-[2.75rem] text-center text-[9px] font-semibold uppercase leading-tight tracking-wide text-muted">
            Properties
          </span>
        </button>
      )}
    </div>
  );
}
