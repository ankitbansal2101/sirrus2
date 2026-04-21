"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LeadFormPreview } from "@/components/lead-form-customiser/lead-form-preview";
import { newEntityId } from "@/lib/blueprint/types";
import { FIELDS_SCHEMA_CHANGED_EVENT, loadFieldsSchema } from "@/lib/fields-config/schema-storage";
import { createDefaultLeadFields } from "@/lib/fields-config/types";
import type { FieldDefinition } from "@/lib/fields-config/types";
import { buildDefaultLeadFormLayout } from "@/lib/lead-form-layout/default-layout";
import {
  LEAD_FORM_LAYOUT_CHANGED_EVENT,
  LEAD_FORM_LAYOUT_STORAGE_KEY,
  loadLeadFormLayoutRaw,
  resolveLeadFormLayout,
  saveLeadFormLayout,
  sanitizeLeadFormLayout,
} from "@/lib/lead-form-layout/storage";
import type { LeadFormLayoutV1 } from "@/lib/lead-form-layout/types";

const MIME = "application/x-sirrus-lead-form";

type DragPayload = { fieldId: string; from: "pool" | string };

function parseDrag(dt: DataTransfer): DragPayload | null {
  try {
    const raw = dt.getData(MIME);
    if (!raw) return null;
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

function stripField(layout: LeadFormLayoutV1, fieldId: string): LeadFormLayoutV1 {
  return {
    version: 1,
    sections: layout.sections.map((s) => ({
      ...s,
      fieldIds: s.fieldIds.filter((id) => id !== fieldId),
    })),
  };
}

function insertFieldAt(layout: LeadFormLayoutV1, sectionId: string, fieldId: string, index: number): LeadFormLayoutV1 {
  const cleared = stripField(layout, fieldId);
  return {
    version: 1,
    sections: cleared.sections.map((s) => {
      if (s.id !== sectionId) return s;
      const next = [...s.fieldIds];
      const i = Math.max(0, Math.min(index, next.length));
      next.splice(i, 0, fieldId);
      return { ...s, fieldIds: next };
    }),
  };
}

export function CustomiseLeadFormClient() {
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [layout, setLayout] = useState<LeadFormLayoutV1 | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);

  const reload = useCallback(() => {
    const f = loadFieldsSchema() ?? createDefaultLeadFields();
    setFields(f);
    setLayout(resolveLeadFormLayout(f));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const on = () => reload();
    window.addEventListener(FIELDS_SCHEMA_CHANGED_EVENT, on);
    window.addEventListener(LEAD_FORM_LAYOUT_CHANGED_EVENT, on);
    return () => {
      window.removeEventListener(FIELDS_SCHEMA_CHANGED_EVENT, on);
      window.removeEventListener(LEAD_FORM_LAYOUT_CHANGED_EVENT, on);
    };
  }, [reload]);

  const fieldsById = useMemo(() => new Map(fields.map((x) => [x.id, x])), [fields]);

  const usedIds = useMemo(() => {
    if (!layout) return new Set<string>();
    return new Set(layout.sections.flatMap((s) => s.fieldIds));
  }, [layout]);

  const pool = useMemo(() => fields.filter((f) => !usedIds.has(f.id)), [fields, usedIds]);

  const commit = useCallback((next: LeadFormLayoutV1) => {
    const clean = sanitizeLeadFormLayout(next, fields);
    setLayout(clean);
  }, [fields]);

  const onDragStart = (fieldId: string, from: DragPayload["from"]) => (e: React.DragEvent) => {
    e.dataTransfer.setData(MIME, JSON.stringify({ fieldId, from } satisfies DragPayload));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDropSection =
    (sectionId: string, insertIndex?: number) => (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverSection(null);
      const payload = parseDrag(e.dataTransfer);
      if (!payload || !layout) return;
      const idx = insertIndex ?? layout.sections.find((s) => s.id === sectionId)?.fieldIds.length ?? 0;
      commit(insertFieldAt(layout, sectionId, payload.fieldId, idx));
    };

  const onDragOverSection = (sectionId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSection(sectionId);
  };

  const onDragLeaveSection = () => setDragOverSection(null);

  const moveInSection = (sectionId: string, fieldId: string, delta: -1 | 1) => {
    if (!layout) return;
    const sec = layout.sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const i = sec.fieldIds.indexOf(fieldId);
    const ni = i + delta;
    if (i < 0 || ni < 0 || ni >= sec.fieldIds.length) return;
    const nextIds = [...sec.fieldIds];
    const t = nextIds[i]!;
    nextIds[i] = nextIds[ni]!;
    nextIds[ni] = t;
    commit({
      version: 1,
      sections: layout.sections.map((s) => (s.id === sectionId ? { ...s, fieldIds: nextIds } : s)),
    });
  };

  const removeFromForm = (fieldId: string) => {
    if (!layout) return;
    commit(stripField(layout, fieldId));
  };

  const addSection = () => {
    if (!layout) return;
    commit({
      version: 1,
      sections: [...layout.sections, { id: newEntityId("sec"), title: "New section", fieldIds: [] }],
    });
  };

  const renameSection = (sectionId: string, title: string) => {
    if (!layout) return;
    commit({
      version: 1,
      sections: layout.sections.map((s) => (s.id === sectionId ? { ...s, title } : s)),
    });
  };

  const deleteSection = (sectionId: string) => {
    if (!layout) return;
    if (layout.sections.length <= 1) {
      setBanner("Keep at least one section.");
      window.setTimeout(() => setBanner(null), 2400);
      return;
    }
    commit({
      version: 1,
      sections: layout.sections.filter((s) => s.id !== sectionId),
    });
  };

  const moveSection = (sectionId: string, delta: -1 | 1) => {
    if (!layout) return;
    const i = layout.sections.findIndex((s) => s.id === sectionId);
    const ni = i + delta;
    if (i < 0 || ni < 0 || ni >= layout.sections.length) return;
    const next = [...layout.sections];
    const a = next[i]!;
    const b = next[ni]!;
    next[i] = b;
    next[ni] = a;
    commit({ version: 1, sections: next });
  };

  const handleSave = () => {
    if (!layout) return;
    if (saveLeadFormLayout(layout)) {
      setBanner("Saved create-lead layout to this browser.");
      window.setTimeout(() => setBanner(null), 2800);
    }
  };

  const handleResetDefaults = () => {
    const f = loadFieldsSchema() ?? createDefaultLeadFields();
    const next = buildDefaultLeadFormLayout(f);
    setFields(f);
    commit(sanitizeLeadFormLayout(next, f));
    setBanner("Restored default sections — click Save layout to persist.");
    window.setTimeout(() => setBanner(null), 3200);
  };

  const handleResetSaved = () => {
    if (!window.confirm("Remove saved create-lead layout and reload from schema defaults?")) return;
    try {
      localStorage.removeItem(LEAD_FORM_LAYOUT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(LEAD_FORM_LAYOUT_CHANGED_EVENT));
    reload();
  };

  if (!layout) {
    return <p className="p-6 text-sm text-muted">Loading…</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-2 py-3 sm:px-3 lg:px-4">
      {banner ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-medium text-emerald-900">
          {banner}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-accent/90"
        >
          Save layout
        </button>
        <button
          type="button"
          onClick={handleResetDefaults}
          className="rounded-md border border-border-soft bg-white px-3 py-2 text-xs font-medium text-ink shadow-sm hover:bg-zinc-50"
        >
          Reset to default sections
        </button>
        {loadLeadFormLayoutRaw() ? (
          <button
            type="button"
            onClick={handleResetSaved}
            className="rounded-md border border-border-soft bg-white px-3 py-2 text-xs font-medium text-ink shadow-sm hover:bg-zinc-50"
          >
            Clear saved layout
          </button>
        ) : null}
        <button
          type="button"
          onClick={addSection}
          className="rounded-md border border-dashed border-accent/50 px-3 py-2 text-xs font-medium text-accent hover:bg-rail-active/30"
        >
          + New section
        </button>
      </div>

      {/* Pool (all off-form fields) + sections + preview */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(12rem,15rem)_minmax(14rem,18rem)_minmax(0,1fr)] xl:items-start xl:gap-4">
        <aside className="flex min-h-0 min-w-0 flex-col gap-1.5 rounded-lg border border-border-soft bg-surface p-2 xl:max-h-[calc(100vh-9.5rem)] xl:overflow-y-auto">
          <h2 className="text-[11px] font-semibold leading-tight text-ink">Available fields</h2>
          <p className="text-[9px] leading-snug text-muted">
            Drag into a section. Fields already on the form are hidden here.
          </p>
          <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto max-h-[50vh] xl:max-h-none">
            {pool.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  draggable
                  title={`${f.label} (${f.dataType})`}
                  onDragStart={onDragStart(f.id, "pool")}
                  className="flex w-full cursor-grab items-center rounded border border-border-soft bg-white px-1.5 py-1 text-left text-[11px] font-medium leading-tight text-ink active:cursor-grabbing"
                >
                  <span className="truncate">{f.label}</span>
                </button>
              </li>
            ))}
            {pool.length === 0 ? (
              <li className="text-[10px] leading-snug text-muted">All fields are on the form.</li>
            ) : null}
          </ul>
        </aside>

        <div className="min-h-0 min-w-0 space-y-2 xl:max-h-[calc(100vh-9.5rem)] xl:overflow-y-auto">
          <h2 className="text-[11px] font-semibold text-ink">Sections</h2>
          <p className="mb-1 text-[9px] text-muted">Reorder sections with ↑↓; drag fields between sections.</p>
          {layout.sections.map((sec, secIdx) => (
            <section
              key={sec.id}
              onDragOver={onDragOverSection(sec.id)}
              onDragLeave={onDragLeaveSection}
              onDrop={onDropSection(sec.id)}
              className={`rounded-lg border bg-field-surface/80 p-2 transition ${
                dragOverSection === sec.id ? "border-accent ring-1 ring-accent/30" : "border-border-soft"
              }`}
            >
              <div className="mb-1.5 flex items-center gap-1">
                <button
                  type="button"
                  className="shrink-0 rounded border border-border-soft px-0.5 py-0.5 text-[10px] text-muted hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => moveSection(sec.id, -1)}
                  disabled={secIdx === 0}
                  aria-label="Move section up"
                  title="Move section up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded border border-border-soft px-0.5 py-0.5 text-[10px] text-muted hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => moveSection(sec.id, 1)}
                  disabled={secIdx >= layout.sections.length - 1}
                  aria-label="Move section down"
                  title="Move section down"
                >
                  ↓
                </button>
                <input
                  value={sec.title}
                  onChange={(e) => renameSection(sec.id, e.target.value)}
                  className="min-w-0 flex-1 rounded border border-border-soft bg-white px-1.5 py-0.5 text-[11px] font-semibold text-ink"
                />
                <button
                  type="button"
                  onClick={() => deleteSection(sec.id)}
                  className="shrink-0 rounded border border-border-soft px-1 py-0.5 text-[10px] text-red-600 hover:bg-red-50"
                  title="Remove section"
                >
                  ×
                </button>
              </div>
              <p className="mb-1 text-[9px] text-muted">Drop or reorder fields.</p>
              <ul className="space-y-0.5">
                {sec.fieldIds.map((fid, idx) => {
                  const f = fieldsById.get(fid);
                  if (!f) return null;
                  return (
                    <li
                      key={fid}
                      draggable
                      onDragStart={onDragStart(f.id, sec.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const p = parseDrag(e.dataTransfer);
                        if (!p || !layout) return;
                        commit(insertFieldAt(layout, sec.id, p.fieldId, idx));
                      }}
                      className="flex items-center gap-0.5 rounded border border-border-soft bg-white px-1 py-1 text-[10px]"
                      title={`${f.label} (${f.dataType})`}
                    >
                      <span className="cursor-grab select-none text-muted" aria-hidden>
                        ⋮
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">{f.label}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded px-0.5 text-[10px] text-muted hover:bg-zinc-100"
                        onClick={() => moveInSection(sec.id, fid, -1)}
                        disabled={idx === 0}
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="shrink-0 rounded px-0.5 text-[10px] text-muted hover:bg-zinc-100"
                        onClick={() => moveInSection(sec.id, fid, 1)}
                        disabled={idx >= sec.fieldIds.length - 1}
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="shrink-0 px-0.5 text-[10px] text-red-600 hover:underline"
                        onClick={() => removeFromForm(fid)}
                        aria-label="Remove from form"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="min-h-0 min-w-0 xl:sticky xl:top-2 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
          <LeadFormPreview fieldsById={fieldsById} layout={layout} />
        </div>
      </div>
    </div>
  );
}
