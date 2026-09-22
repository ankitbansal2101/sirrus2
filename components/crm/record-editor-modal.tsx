"use client";

import { useMemo, useState } from "react";
import { IconClose } from "@/components/icons";
import { RecordFieldInput } from "@/components/crm/record-field-input";
import { createRecord, updateRecord } from "@/lib/crm/ops";
import { dispatchCrmEvent } from "@/lib/crm/dispatch-workflows";
import type { CrmModule, CrmRecord, CrmWorkspace } from "@/lib/crm/types";

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
  const [values, setValues] = useState(() => initialValues(mod, record));
  const [error, setError] = useState<string | null>(null);
  const byId = useMemo(() => new Map(mod.fields.map((f) => [f.id, f])), [mod.fields]);
  const editing = Boolean(record);

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
      ).catch(() => {
        /* ignore */
      });
      return;
    }
    const { workspace: next, record: created } = createRecord(workspace, mod.id, values);
    onSave(next);
    onClose();
    void dispatchCrmEvent(
      next,
      { type: "record_created", moduleId: mod.id, recordId: created.id, nextValues: created.values },
      onSave,
    ).catch(() => {
      /* ignore */
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#12100c]/40 p-4 backdrop-blur-[2px] sm:p-8">
      <div className="card w-full max-w-2xl">
        <div className="flex items-center justify-between border-b border-border-soft px-5 py-3.5">
          <div>
            <h2 className="display text-2xl text-ink">
              {editing ? `Edit ${mod.label.toLowerCase()}` : `New ${mod.label.toLowerCase()}`}
            </h2>
            {record ? <p className="text-[11px] text-muted">{record.displayId}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-surface" aria-label="Close">
            <IconClose className="size-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {error ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {mod.formLayout.sections.map((sec) => (
            <section key={sec.id} className="mb-5 last:mb-0">
              <h3 className="mb-3 text-[13px] font-semibold text-ink">{sec.title}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {sec.fieldIds.map((fid) => {
                  const field = byId.get(fid);
                  if (!field || field.dataType === "formula") return null;
                  return (
                    <label key={fid} className={field.dataType === "paragraph" ? "sm:col-span-2" : ""}>
                      <span className="mb-1 block text-xs font-medium text-muted">
                        {field.label}
                        {field.required ? <span className="text-red-500"> *</span> : null}
                      </span>
                      <RecordFieldInput
                        field={field}
                        value={values[field.apiKey] ?? ""}
                        onChange={(next) => setValues((prev) => ({ ...prev, [field.apiKey]: next }))}
                      />
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-border-soft px-5 py-3">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="button" onClick={submit} className="btn-primary">
            {editing ? "Save changes" : `Create ${mod.label.toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
