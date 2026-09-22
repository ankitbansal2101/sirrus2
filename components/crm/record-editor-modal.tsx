"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "@/components/icons";
import { RecordFieldInput } from "@/components/crm/record-field-input";
import { createRecord, updateRecord } from "@/lib/crm/ops";
import { dispatchCrmEvent } from "@/lib/crm/dispatch-workflows";
import type { CrmModule, CrmRecord, CrmWorkspace } from "@/lib/crm/types";
import type { FieldDefinition } from "@/lib/fields-config/types";

function initialValues(mod: CrmModule, record?: CrmRecord | null): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of mod.fields) {
    if (record) {
      values[f.apiKey] = record.values[f.apiKey] ?? "";
      continue;
    }
    if (f.defaultOptionId) values[f.apiKey] = f.defaultOptionId;
    else if (f.defaultOptionIds?.length) values[f.apiKey] = f.defaultOptionIds.join(",");
    else values[f.apiKey] = "";
  }
  return values;
}

function sectionsForForm(mod: CrmModule) {
  const inLayout = new Set(mod.formLayout.sections.flatMap((s) => s.fieldIds));
  const orphanIds = mod.fields.filter((f) => f.dataType !== "formula" && !inLayout.has(f.id)).map((f) => f.id);
  const sections = [...mod.formLayout.sections];
  if (orphanIds.length) {
    sections.push({ id: "__orphan__", title: "Additional fields", fieldIds: orphanIds });
  }
  return sections;
}

function fieldGridClass(field: FieldDefinition) {
  if (field.dataType === "paragraph") return "sm:col-span-2";
  return "";
}

export function RecordEditorModal({
  workspace,
  module: mod,
  record,
  onClose,
  onSave,
}: {
  workspace: CrmWorkspace;
  module: CrmModule;
  record?: CrmRecord | null;
  onClose: () => void;
  onSave: (next: CrmWorkspace) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [values, setValues] = useState(() => initialValues(mod, record));
  const [error, setError] = useState<string | null>(null);
  const byId = useMemo(() => new Map(mod.fields.map((f) => [f.id, f])), [mod.fields]);
  const sections = useMemo(() => sectionsForForm(mod), [mod]);
  const fieldCount = useMemo(
    () => sections.reduce((n, s) => n + s.fieldIds.filter((id) => byId.get(id)?.dataType !== "formula").length, 0),
    [sections, byId],
  );
  const editing = Boolean(record);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    const missing = mod.fields.filter((f) => f.required && !String(values[f.apiKey] ?? "").trim());
    if (missing.length) {
      setError(`Required: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    if (editing && record) {
      const previousValues = record.values;
      const next = updateRecord(workspace, mod.id, record.id, values);
      onSave(next);
      onClose();
      void dispatchCrmEvent(
        next,
        { type: "record_updated", moduleId: mod.id, recordId: record.id, previousValues, nextValues: values },
        onSave,
      ).catch(() => undefined);
      return;
    }
    const { workspace: next, record: created } = createRecord(workspace, mod.id, values);
    onSave(next);
    onClose();
    void dispatchCrmEvent(
      next,
      { type: "record_created", moduleId: mod.id, recordId: created.id, nextValues: created.values },
      onSave,
    ).catch(() => undefined);
  };

  if (!mounted) return null;

  const panel = (
    <div className="fixed inset-0 z-[100] flex justify-end bg-[#12100c]/40 backdrop-blur-[2px]">
      <button type="button" className="min-h-0 flex-1 cursor-default" aria-label="Close form" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-editor-title"
        className="flex h-svh max-h-svh min-h-0 w-[min(100%,44rem)] flex-col border-l border-border-soft bg-surface shadow-[-24px_0_60px_-28px_rgba(22,20,15,0.35)]"
      >
        <header className="shrink-0 border-b border-border-soft bg-surface px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                {editing ? "Edit record" : "Create record"}
              </p>
              <h2 id="record-editor-title" className="display text-[26px] leading-tight text-ink">
                {editing ? mod.label : `New ${mod.label.toLowerCase()}`}
              </h2>
              <p className="mt-1 text-[13px] text-muted">
                {record ? record.displayId : mod.pluralLabel}
                <span className="mx-1.5 text-border-soft">·</span>
                {fieldCount} field{fieldCount === 1 ? "" : "s"}
                {mod.formLayout.sections.length > 1 ? (
                  <>
                    <span className="mx-1.5 text-border-soft">·</span>
                    {mod.formLayout.sections.length} sections
                  </>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-muted hover:bg-[#f7f1e6]"
              aria-label="Close"
            >
              <IconClose className="size-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-canvas px-5 py-5 sm:px-6">
          {error ? (
            <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-800">{error}</p>
          ) : null}

          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {sections.map((sec) => {
              const fields = sec.fieldIds.map((fid) => byId.get(fid)).filter((f): f is FieldDefinition => !!f && f.dataType !== "formula");
              if (!fields.length) return null;
              return (
                <section key={sec.id} className="rounded-2xl border border-border-soft bg-surface p-4 shadow-sm sm:p-5">
                  <h3 className="mb-4 border-b border-border-soft pb-2 text-[14px] font-semibold text-ink">{sec.title}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {fields.map((field) => (
                      <label key={field.id} className={`block min-w-0 ${fieldGridClass(field)}`}>
                        <span className="mb-1.5 block text-[12px] font-medium text-muted">
                          {field.label}
                          {field.required ? <span className="text-red-600"> *</span> : null}
                        </span>
                        <RecordFieldInput
                          field={field}
                          value={values[field.apiKey] ?? ""}
                          onChange={(next) => setValues((prev) => ({ ...prev, [field.apiKey]: next }))}
                        />
                      </label>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <footer className="shrink-0 border-t border-border-soft bg-[#f7f1e6] px-5 py-4 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-ghost min-w-[6rem] justify-center">
              Cancel
            </button>
            <button type="button" onClick={submit} className="btn-primary min-w-[9rem] justify-center">
              {editing ? "Save changes" : `Create ${mod.label.toLowerCase()}`}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );

  return createPortal(panel, document.body);
}
