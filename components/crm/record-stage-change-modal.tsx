"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TransitionFieldInput } from "@/components/crm/transition-field-input";
import { IconClose } from "@/components/icons";
import { dispatchCrmEvent } from "@/lib/crm/dispatch-workflows";
import { recordStageLabel, recordTitle } from "@/lib/crm/display";
import { ensureModuleBlueprint } from "@/lib/crm/module-blueprint";
import { findModule } from "@/lib/crm/ops";
import {
  applyCrmTransition,
  outgoingTransitions,
  stateFromStageValue,
  transitionFormDraftKey,
  transitionTargetDisplayLabel,
  validateTransitionAutomation,
} from "@/lib/crm/record-transition-runtime";
import type { CrmModule, CrmRecord, CrmWorkspace } from "@/lib/crm/types";
import { BLUEPRINT_CHANGED_EVENT } from "@/lib/blueprint/storage";
import type { BlueprintDocument, BlueprintTransition } from "@/lib/blueprint/types";
import { stageFieldForBlueprint } from "@/lib/leads/stage-bridge";
import { transitionToolDraftKey } from "@/lib/blueprint/transition-tools";

type Props = {
  open: boolean;
  onClose: () => void;
  workspace: CrmWorkspace;
  mod: CrmModule;
  record: CrmRecord;
  onSaved: (next: CrmWorkspace) => void;
};

export function RecordStageChangeModal({ open, onClose, workspace, mod, record, onSaved }: Props) {
  const [mounted, setMounted] = useState(false);
  const [doc, setDoc] = useState<BlueprintDocument | null>(null);
  const [selected, setSelected] = useState<BlueprintTransition | null>(null);
  const [formDraft, setFormDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stageField = useMemo(() => (doc ? stageFieldForBlueprint(mod.fields, doc) : undefined), [doc, mod.fields]);
  const currentState = useMemo(() => {
    if (!doc || !stageField) return null;
    return stateFromStageValue(doc, stageField, record.values[stageField.apiKey]);
  }, [doc, stageField, record.values]);

  const allowed = useMemo(() => {
    if (!doc || !currentState) return [];
    return outgoingTransitions(doc, currentState.id);
  }, [doc, currentState]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setDoc(ensureModuleBlueprint(mod));
    setSelected(null);
    setFormDraft({});
    setError(null);
  }, [open, mod]);

  useEffect(() => {
    if (!open) return;
    const refresh = () => setDoc(ensureModuleBlueprint(mod));
    window.addEventListener(BLUEPRINT_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(BLUEPRINT_CHANGED_EVENT, refresh);
  }, [open, mod]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const pickTransition = (t: BlueprintTransition) => {
    setSelected(t);
    setFormDraft((prev) => {
      const next = { ...prev };
      for (const f of t.form.fields) {
        const k = transitionFormDraftKey(t, f);
        if (next[k] === undefined) next[k] = record.values[f.fieldId] ?? "";
      }
      if (t.form.includeRemark) next[`${t.id}:__remark__`] = next[`${t.id}:__remark__`] ?? "";
      if (t.form.includeTasks) {
        next[`${t.id}:__task_date__`] = next[`${t.id}:__task_date__`] ?? "";
        next[`${t.id}:__task_time__`] = next[`${t.id}:__task_time__`] ?? "";
      }
      for (const tool of t.form.tools ?? []) {
        const k = transitionToolDraftKey(t.id, tool.id);
        if (next[k] === undefined) next[k] = "";
      }
      return next;
    });
  };

  const save = () => {
    if (!doc || !selected || !stageField) return;
    const err = validateTransitionAutomation(selected, formDraft, mod.fields, record);
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const previousValues = { ...record.values };
      const next = applyCrmTransition({
        workspace,
        mod,
        record,
        doc,
        kind: "main",
        transition: selected,
        formDraft,
      });
      onSaved(next);
      const updated = findModule(next, mod.id)?.records.find((r) => r.id === record.id);
      void dispatchCrmEvent(
        next,
        {
          type: "stage_changed",
          moduleId: mod.id,
          recordId: record.id,
          previousValues,
          nextValues: updated?.values ?? previousValues,
        },
        onSaved,
      ).catch(() => undefined);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply transition.");
    } finally {
      setBusy(false);
    }
  };

  if (!open || !mounted) return null;

  const title = recordTitle(mod, record);
  const stage = recordStageLabel(mod, record);

  const panel = (
    <div className="fixed inset-0 z-[100] flex h-svh items-center justify-center bg-[#12100c]/40 p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border-soft bg-surface shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border-soft px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">Change stage</h2>
            <p className="mt-0.5 truncate text-[13px] text-muted">
              {title} · {stage || "No stage"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-zinc-100" aria-label="Close">
            <IconClose className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {!doc || !stageField ? (
            <p className="text-sm text-muted">Add a stage field and blueprint for this module in Settings.</p>
          ) : (
            <>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">Allowed moves</p>
              {allowed.length === 0 ? (
                <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
                  No outgoing transitions from this stage. Draw transitions in the blueprint configurator.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {allowed.map((tr) => {
                    const active = selected?.id === tr.id;
                    const label = transitionTargetDisplayLabel(doc, tr);
                    return (
                      <button
                        key={tr.id}
                        type="button"
                        onClick={() => pickTransition(tr)}
                        className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${
                          active ? "border-accent bg-accent/10 text-ink" : "border-border-soft bg-white text-ink hover:border-accent/40"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {selected ? (
                <div className="mt-5 space-y-4">
                  {selected.form.message ? <p className="text-[13px] text-muted">{selected.form.message}</p> : null}
                  {selected.form.fields.map((f) => (
                    <TransitionFieldInput
                      key={f.id}
                      field={f}
                      definitions={mod.fields}
                      value={formDraft[transitionFormDraftKey(selected, f)] ?? ""}
                      onChange={(v) =>
                        setFormDraft((d) => ({ ...d, [transitionFormDraftKey(selected, f)]: v }))
                      }
                    />
                  ))}
                  {selected.form.includeRemark ? (
                    <label className="block text-sm font-medium text-ink">
                      Notes
                      {selected.form.remarkMandatory ? <span className="text-red-600"> *</span> : null}
                      <textarea
                        rows={3}
                        value={formDraft[`${selected.id}:__remark__`] ?? ""}
                        onChange={(e) => setFormDraft((d) => ({ ...d, [`${selected.id}:__remark__`]: e.target.value }))}
                        className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-accent"
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}

              {error ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{error}</p> : null}
            </>
          )}
        </div>

        <footer className="flex gap-2 border-t border-border-soft bg-[#f7f1e6] px-4 py-3">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected || busy}
            onClick={save}
            className="btn-primary flex-1 justify-center disabled:opacity-50"
          >
            {busy ? "Saving…" : "Apply transition"}
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
