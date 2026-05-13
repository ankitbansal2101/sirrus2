"use client";

import { useState } from "react";
import type {
  AfterAutoTask,
  AfterAutoTaskDueKind,
  AfterCreateRecord,
  AfterCreateRecordFieldBinding,
  BlueprintAfterBlock,
} from "@/lib/blueprint/types";
import { newEntityId } from "@/lib/blueprint/types";
import { IconPlus, IconTrash } from "@/components/icons";
import { fieldsForConnectedModule } from "@/lib/leads/connected-module-fields";
import type { FieldDefinition } from "@/lib/fields-config/types";
import { optionsSorted, usesOptions } from "@/lib/fields-config/types";

function targetModuleDefs(m: AfterCreateRecord["targetModule"], leadFields: FieldDefinition[]) {
  return m === "leads" ? leadFields : fieldsForConnectedModule("channel_partner");
}

function defaultMandatoryBindings(
  m: AfterCreateRecord["targetModule"],
  leadFields: FieldDefinition[],
): AfterCreateRecordFieldBinding[] {
  return targetModuleDefs(m, leadFields)
    .filter((f) => f.required)
    .map((f) => ({
      id: newEntityId("fb"),
      targetFieldApiKey: f.apiKey,
      valueMode: "literal" as const,
      literalValue: "",
      sourceModule: "leads" as const,
      sourceFieldApiKey: "",
    }));
}

function LiteralValueInput({
  def,
  value,
  onChange,
}: {
  def: FieldDefinition | undefined;
  value: string;
  onChange: (v: string) => void;
}) {
  if (!def) {
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-[11px]"
        placeholder="Static value"
      />
    );
  }
  if ((def.dataType === "picklist" || def.dataType === "radio") && usesOptions(def.dataType)) {
    const opts = optionsSorted(def);
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-[11px]">
        <option value="">— Select —</option>
        {opts.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (def.dataType === "date") {
    return (
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-[11px]" />
    );
  }
  if (def.dataType === "date_time") {
    return (
      <input
        type="datetime-local"
        step={60}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-[11px]"
      />
    );
  }
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-[11px]"
      placeholder="Static value"
    />
  );
}

function newAutoTask(taskTypeOptionId: string): AfterAutoTask {
  return {
    id: newEntityId("at"),
    taskTypeOptionId,
    dueKind: "execution_plus_days",
    dueAnchor: "execution",
    offsetDays: 0,
    dueTimeHm: "",
    customDueDatetime: "",
  };
}

function CreateRecordEditorBody({
  rec,
  onRecChange,
  leadFieldDefinitions,
}: {
  rec: AfterCreateRecord;
  onRecChange: (next: AfterCreateRecord) => void;
  leadFieldDefinitions: FieldDefinition[];
}) {
  const defs = targetModuleDefs(rec.targetModule, leadFieldDefinitions);
  const boundKeys = new Set(rec.fieldBindings.map((b) => b.targetFieldApiKey));
  const addable = defs.filter((d) => !boundKeys.has(d.apiKey));

  return (
    <div className="max-h-[min(70vh,28rem)] space-y-3 overflow-y-auto pr-1">
      <div>
        <label className="block text-[10px] font-medium text-muted">Module</label>
        <select
          value={rec.targetModule}
          onChange={(e) => {
            const tm = e.target.value as AfterCreateRecord["targetModule"];
            onRecChange({ ...rec, targetModule: tm, fieldBindings: defaultMandatoryBindings(tm, leadFieldDefinitions) });
          }}
          className="mt-0.5 w-full rounded-md border border-border-soft bg-white px-2 py-1.5 text-sm"
        >
          <option value="channel_partner">Channel Partner</option>
          <option value="leads">Leads</option>
        </select>
      </div>
      <ul className="space-y-2">
        {rec.fieldBindings.map((b) => {
          const def = defs.find((d) => d.apiKey === b.targetFieldApiKey);
          return (
            <li key={b.id} className="rounded-md border border-dashed border-border-soft bg-surface/40 p-2">
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold text-ink">{def?.label ?? b.targetFieldApiKey}</span>
                <button
                  type="button"
                  className="text-[10px] text-red-600 hover:underline"
                  onClick={() => onRecChange({ ...rec, fieldBindings: rec.fieldBindings.filter((fb) => fb.id !== b.id) })}
                >
                  Remove
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="flex cursor-pointer items-center gap-1 text-[10px] text-ink">
                  <input
                    type="radio"
                    name={`cm-${rec.id}-${b.id}`}
                    checked={b.valueMode === "literal"}
                    onChange={() =>
                      onRecChange({
                        ...rec,
                        fieldBindings: rec.fieldBindings.map((fb) =>
                          fb.id === b.id ? { ...fb, valueMode: "literal", sourceFieldApiKey: "" } : fb,
                        ),
                      })
                    }
                  />
                  Static
                </label>
                <label className="flex cursor-pointer items-center gap-1 text-[10px] text-ink">
                  <input
                    type="radio"
                    name={`cm-${rec.id}-${b.id}`}
                    checked={b.valueMode === "map"}
                    onChange={() =>
                      onRecChange({
                        ...rec,
                        fieldBindings: rec.fieldBindings.map((fb) =>
                          fb.id === b.id ? { ...fb, valueMode: "map", literalValue: "" } : fb,
                        ),
                      })
                    }
                  />
                  Map from lead
                </label>
              </div>
              {b.valueMode === "literal" ? (
                <div className="mt-1.5">
                  <LiteralValueInput
                    def={def}
                    value={b.literalValue}
                    onChange={(v) =>
                      onRecChange({
                        ...rec,
                        fieldBindings: rec.fieldBindings.map((fb) => (fb.id === b.id ? { ...fb, literalValue: v } : fb)),
                      })
                    }
                  />
                </div>
              ) : (
                <div className="mt-1.5">
                  <label className="text-[10px] text-muted">Lead field</label>
                  <select
                    value={b.sourceFieldApiKey}
                    onChange={(e) =>
                      onRecChange({
                        ...rec,
                        fieldBindings: rec.fieldBindings.map((fb) =>
                          fb.id === b.id ? { ...fb, sourceFieldApiKey: e.target.value } : fb,
                        ),
                      })
                    }
                    className="mt-0.5 w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-[11px]"
                  >
                    <option value="">— Select lead field —</option>
                    {leadFieldDefinitions.map((f) => (
                      <option key={f.id} value={f.apiKey}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {addable.length > 0 ? (
        <div>
          <label className="block text-[10px] text-muted">Add field</label>
          <select
            defaultValue=""
            onChange={(e) => {
              const api = e.target.value;
              if (!api) return;
              e.target.value = "";
              onRecChange({
                ...rec,
                fieldBindings: [
                  ...rec.fieldBindings,
                  {
                    id: newEntityId("fb"),
                    targetFieldApiKey: api,
                    valueMode: "literal",
                    literalValue: "",
                    sourceModule: "leads",
                    sourceFieldApiKey: "",
                  },
                ],
              });
            }}
            className="mt-0.5 w-full rounded-md border border-border-soft bg-white px-2 py-1.5 text-sm"
          >
            <option value="">+ Add other field…</option>
            {addable.map((f) => (
              <option key={f.id} value={f.apiKey}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

export function AfterAutomationPanel({
  after,
  leadFieldDefinitions,
  onChange,
}: {
  after: BlueprintAfterBlock;
  leadFieldDefinitions: FieldDefinition[];
  onChange: (next: BlueprintAfterBlock) => void;
}) {
  const taskTypeDef = fieldsForConnectedModule("tasks").find((f) => f.apiKey === "task_type");
  const taskTypeOpts = taskTypeDef && usesOptions(taskTypeDef.dataType) ? optionsSorted(taskTypeDef) : [];

  const [createModal, setCreateModal] = useState<null | { mode: "create" } | { mode: "edit"; id: string }>(null);
  const [createDraft, setCreateDraft] = useState<AfterCreateRecord | null>(null);

  function openCreateRecordModal() {
    setCreateDraft({
      id: newEntityId("cr"),
      targetModule: "channel_partner",
      fieldBindings: defaultMandatoryBindings("channel_partner", leadFieldDefinitions),
    });
    setCreateModal({ mode: "create" });
  }

  function openEditRecordModal(id: string) {
    const rec = after.createRecords.find((x) => x.id === id);
    if (!rec) return;
    setCreateDraft(JSON.parse(JSON.stringify(rec)) as AfterCreateRecord);
    setCreateModal({ mode: "edit", id });
  }

  function closeCreateModal() {
    setCreateModal(null);
    setCreateDraft(null);
  }

  function saveCreateModal() {
    if (!createDraft) return;
    if (createModal?.mode === "create") {
      onChange({ ...after, createRecords: [...after.createRecords, createDraft] });
    } else if (createModal?.mode === "edit") {
      onChange({
        ...after,
        createRecords: after.createRecords.map((x) => (x.id === createModal.id ? createDraft : x)),
      });
    }
    closeCreateModal();
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-muted">Auto tasks</h3>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md border border-border-soft bg-white text-accent shadow-sm transition hover:bg-zinc-50"
            aria-label="Add auto task"
            onClick={() => {
              const first = taskTypeOpts[0]?.id ?? "tt_fu";
              onChange({
                ...after,
                autoTasks: [...after.autoTasks, newAutoTask(first)],
              });
            }}
          >
            <IconPlus className="size-4" />
          </button>
        </div>
        <p className="text-[9px] leading-snug text-muted">
          Tasks are created when the transition completes. Choose execution day + days, created date + days, or a fixed custom date/time.
        </p>
        <ul className="space-y-2">
          {after.autoTasks.map((task) => (
            <li key={task.id} className="rounded-lg border border-border-soft bg-white p-2 shadow-sm">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-muted">Task</span>
                  <button
                    type="button"
                    className="rounded p-0.5 text-red-600 hover:bg-red-50"
                    aria-label="Remove task"
                    onClick={() => onChange({ ...after, autoTasks: after.autoTasks.filter((x) => x.id !== task.id) })}
                  >
                    <IconTrash className="size-3.5" />
                  </button>
                </div>
                <label className="block text-[10px] text-muted">Type</label>
                <select
                  value={task.taskTypeOptionId}
                  onChange={(e) =>
                    onChange({
                      ...after,
                      autoTasks: after.autoTasks.map((x) => (x.id === task.id ? { ...x, taskTypeOptionId: e.target.value } : x)),
                    })
                  }
                  className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-[11px]"
                >
                  {taskTypeOpts.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <label className="block text-[10px] text-muted">Due date</label>
                <select
                  value={task.dueKind}
                  onChange={(e) => {
                    const dueKind = e.target.value as AfterAutoTaskDueKind;
                    onChange({
                      ...after,
                      autoTasks: after.autoTasks.map((x) =>
                        x.id === task.id
                          ? {
                              ...x,
                              dueKind,
                              dueAnchor:
                                dueKind === "execution_plus_days"
                                  ? "execution"
                                  : dueKind === "anchor_plus_days"
                                    ? "created"
                                    : x.dueAnchor,
                            }
                          : x,
                      ),
                    });
                  }}
                  className="w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-[11px]"
                >
                  <option value="execution_plus_days">Execution day + days (optional time)</option>
                  <option value="anchor_plus_days">Created date + days</option>
                  <option value="custom_datetime">Custom date and time</option>
                </select>
                {task.dueKind === "custom_datetime" ? (
                  <div>
                    <label className="block text-[10px] text-muted">When due</label>
                    <input
                      type="datetime-local"
                      step={60}
                      value={task.customDueDatetime}
                      onChange={(e) =>
                        onChange({
                          ...after,
                          autoTasks: after.autoTasks.map((x) =>
                            x.id === task.id ? { ...x, customDueDatetime: e.target.value } : x,
                          ),
                        })
                      }
                      className="mt-0.5 w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-[11px]"
                    />
                  </div>
                ) : null}
                {task.dueKind !== "custom_datetime" ? (
                  <div className="flex flex-wrap gap-2">
                    <div className="min-w-[5rem] flex-1">
                      <label className="block text-[10px] text-muted">+ days</label>
                      <input
                        type="number"
                        value={task.offsetDays}
                        onChange={(e) =>
                          onChange({
                            ...after,
                            autoTasks: after.autoTasks.map((x) =>
                              x.id === task.id ? { ...x, offsetDays: Number.parseInt(e.target.value, 10) || 0 } : x,
                            ),
                          })
                        }
                        className="mt-0.5 w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-[11px]"
                      />
                    </div>
                    <div className="min-w-[6rem] flex-1">
                      <label className="block text-[10px] text-muted">Due time (optional)</label>
                      <input
                        type="time"
                        step={60}
                        value={task.dueTimeHm}
                        onChange={(e) =>
                          onChange({
                            ...after,
                            autoTasks: after.autoTasks.map((x) => (x.id === task.id ? { ...x, dueTimeHm: e.target.value } : x)),
                          })
                        }
                        className="mt-0.5 w-full rounded-md border border-border-soft bg-white px-1.5 py-1 text-[11px]"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-muted">Create record</h3>
          <button
            type="button"
            onClick={openCreateRecordModal}
            className="rounded-md border border-border-soft bg-accent px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            Create a record…
          </button>
        </div>
        <p className="text-[9px] leading-snug text-muted">
          Opens a form to choose module, map fields from the lead, or set static values. Mandatory fields are included by default.
        </p>
        <ul className="space-y-1.5">
          {after.createRecords.map((rec) => (
            <li
              key={rec.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border-soft bg-white px-2 py-1.5 text-[11px]"
            >
              <span className="min-w-0 truncate text-ink">
                <span className="font-semibold">{rec.targetModule === "channel_partner" ? "Channel Partner" : "Lead"}</span>
                <span className="text-muted"> · {rec.fieldBindings.length} field(s)</span>
              </span>
              <span className="flex shrink-0 gap-1">
                <button type="button" className="text-[10px] font-semibold text-accent hover:underline" onClick={() => openEditRecordModal(rec.id)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="text-[10px] font-semibold text-red-600 hover:underline"
                  onClick={() => onChange({ ...after, createRecords: after.createRecords.filter((x) => x.id !== rec.id) })}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {createModal && createDraft ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="presentation">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={closeCreateModal} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-record-modal-title"
            className="relative z-[201] w-full max-w-md rounded-xl border border-border-soft bg-white p-4 shadow-xl"
          >
            <h2 id="create-record-modal-title" className="text-sm font-semibold text-ink">
              {createModal.mode === "create" ? "Create a record" : "Edit create record"}
            </h2>
            <p className="mt-1 text-[10px] text-muted">Configure how a related row is created after this transition.</p>
            <div className="mt-3">
              <CreateRecordEditorBody rec={createDraft} onRecChange={setCreateDraft} leadFieldDefinitions={leadFieldDefinitions} />
            </div>
            <div className="mt-4 flex justify-end gap-2 border-t border-border-soft pt-3">
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-md border border-border-soft bg-white px-3 py-1.5 text-[11px] font-semibold text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCreateModal}
                className="rounded-md bg-accent px-3 py-1.5 text-[11px] font-semibold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
