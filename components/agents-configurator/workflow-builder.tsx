"use client";

import { useState } from "react";
import { useCrm } from "@/components/crm/crm-provider";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { IconPlus, IconTrash } from "@/components/icons";
import {
  addWorkflow,
  agentsOf,
  findModule,
  findWorkflow,
  removeWorkflow,
  updateWorkflow,
} from "@/lib/crm/ops";
import {
  AUTOMATION_TRIGGER_CATALOG,
  emptyWorkflow,
  emptyWorkflowStep,
  stepLabel,
  triggerMeta,
} from "@/lib/crm/workflows";
import type { AgentWorkflow, AgentWorkflowStep, AutomationTriggerType, WorkflowStepType } from "@/lib/crm/types";

export function WorkflowBuilder({ workflowId, backHref }: { workflowId: string; backHref: string }) {
  const { workspace, save } = useCrm();
  const wf = workspace ? findWorkflow(workspace, workflowId) : undefined;
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  if (!workspace || !wf) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted">Automation not found.</div>
    );
  }

  const mod = findModule(workspace, wf.moduleId);
  const patch = (p: Partial<AgentWorkflow>) => save(updateWorkflow(workspace, wf.id, p));

  const simulate = async (type: AutomationTriggerType) => {
    const rec = mod?.records[0];
    if (!mod || !rec) {
      setBanner("Create a record in this module first, then simulate.");
      return;
    }
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch("/api/crm-workflows/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace,
          workflowId: wf.id,
          event: {
            type,
            moduleId: mod.id,
            recordId: rec.id,
            previousValues: rec.values,
            nextValues: rec.values,
          },
        }),
      });
      const data = (await res.json()) as { workspace?: typeof workspace; run?: { summary: string }; error?: string };
      if (!res.ok) throw new Error(data.error || "Run failed");
      if (data.workspace) save(data.workspace);
      setBanner(data.run?.summary || "Ran.");
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DeveloperPageHeader
        backHref={backHref}
        title={wf.name || "Automation"}
        description="When a trigger fires, run an agent, then follow-up actions (change stage, update a field)."
        actions={
          <label className="flex items-center gap-2 text-xs font-medium text-ink">
            <input type="checkbox" checked={wf.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
            Enabled
          </label>
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto bg-canvas px-8 py-8">
        <div className="mx-auto max-w-[720px] space-y-4">
          <section className="rounded-[24px] border border-border-soft bg-surface p-5 shadow-md">
            <label className="block text-xs font-medium text-muted">
              Name
              <input
                value={wf.name}
                onChange={(e) => patch({ name: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink"
              />
            </label>
          </section>

          <FlowCard tone="when" title="When">
            <label className="block text-xs font-medium text-muted">
              Module
              <select
                value={wf.moduleId}
                onChange={(e) => patch({ moduleId: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm"
              >
                {workspace.modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.pluralLabel}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs font-medium text-muted">
              Trigger
              <select
                value={wf.triggerType}
                onChange={(e) => patch({ triggerType: e.target.value as AutomationTriggerType })}
                className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm"
              >
                {AUTOMATION_TRIGGER_CATALOG.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                    {t.showcase ? " (showcase)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-[12px] text-muted">{triggerMeta(wf.triggerType)?.description}</p>
            {wf.triggerType === "stage_changed" && mod?.stageFieldApiKey ? (
              <label className="mt-3 block text-xs font-medium text-muted">
                Only when stage becomes
                <select
                  value={wf.triggerStageOptionId ?? ""}
                  onChange={(e) => patch({ triggerStageOptionId: e.target.value || null })}
                  className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm"
                >
                  <option value="">Any stage</option>
                  {mod.fields
                    .find((f) => f.apiKey === mod.stageFieldApiKey)
                    ?.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
          </FlowCard>

          {wf.steps.map((step, idx) => (
            <div key={step.id}>
              <div className="mx-auto h-6 w-px bg-border-soft" />
              <FlowCard
                tone="then"
                title={`Then ${idx + 1}`}
                onRemove={() => patch({ steps: wf.steps.filter((s) => s.id !== step.id) })}
              >
                <StepEditor
                  step={step}
                  workflow={wf}
                  onChange={(next) =>
                    patch({ steps: wf.steps.map((s) => (s.id === step.id ? next : s)) })
                  }
                />
                <p className="mt-2 text-[11px] text-muted">{stepLabel(step, workspace)}</p>
              </FlowCard>
            </div>
          ))}

          <div className="flex flex-wrap gap-2 pt-1">
            {(
              [
                ["run_agent", "Run agent"],
                ["change_stage", "Change stage"],
                ["update_field", "Update field"],
                ["log", "Log note"],
              ] as const
            ).map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => patch({ steps: [...wf.steps, emptyWorkflowStep(type)] })}
                className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-ink ring-1 ring-border-soft"
              >
                <IconPlus className="size-3" />
                {label}
              </button>
            ))}
          </div>

          <section className="rounded-[24px] border border-border-soft bg-surface p-5 shadow-md">
            <h2 className="text-sm font-semibold text-ink">Test this automation</h2>
            <p className="mt-1 text-[12px] text-muted">
              Showcase triggers (call / chat) have no telephony. Simulate them on the first record in {mod?.pluralLabel ?? "this module"}.
            </p>
            {banner ? <p className="mt-3 rounded-xl bg-rail-inactive px-3 py-2 text-[12px] text-ink">{banner}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {(["record_created", "stage_changed", "incoming_call", "call_completed", "incoming_chat", "manual"] as const).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={busy}
                    onClick={() => simulate(t)}
                    className="rounded-full px-3 py-1.5 text-[11px] font-medium text-accent ring-1 ring-border-soft disabled:opacity-40"
                  >
                    Simulate {triggerMeta(t)?.label}
                  </button>
                ),
              )}
            </div>
          </section>

          <section className="rounded-[24px] border border-border-soft bg-surface p-5 shadow-md">
            <h2 className="text-sm font-semibold text-ink">Recent runs</h2>
            {wf.runs.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No runs yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {wf.runs.slice(0, 8).map((r) => (
                  <li key={r.id} className="rounded-xl border border-border-soft bg-white px-3 py-2 text-[12px]">
                    <span className={`font-semibold ${r.status === "ok" ? "text-accent" : r.status === "error" ? "text-red-600" : "text-muted"}`}>
                      {r.status}
                    </span>
                    <span className="text-muted"> · {new Date(r.at).toLocaleString()}</span>
                    <p className="mt-1 text-ink">{r.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <button
            type="button"
            onClick={() => {
              if (!confirm(`Delete ${wf.name}?`)) return;
              save(removeWorkflow(workspace, wf.id));
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-700"
          >
            <IconTrash className="size-3.5" />
            Delete automation
          </button>
        </div>
      </main>
    </div>
  );
}

function FlowCard({
  tone,
  title,
  children,
  onRemove,
}: {
  tone: "when" | "then";
  title: string;
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <section className="rounded-[24px] border border-border-soft bg-surface p-5 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            tone === "when" ? "bg-accent/10 text-accent" : "bg-rail-inactive text-ink"
          }`}
        >
          {title}
        </span>
        {onRemove ? (
          <button type="button" onClick={onRemove} className="text-[11px] text-red-600">
            Remove
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function StepEditor({
  step,
  workflow,
  onChange,
}: {
  step: AgentWorkflowStep;
  workflow: AgentWorkflow;
  onChange: (s: AgentWorkflowStep) => void;
}) {
  const { workspace } = useCrm();
  const agents = workspace ? agentsOf(workspace) : [];
  const mod = workspace ? findModule(workspace, workflow.moduleId) : undefined;
  const type = step.type as WorkflowStepType;

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-muted">
        Action
        <select
          value={type}
          onChange={(e) => onChange({ ...step, type: e.target.value as WorkflowStepType })}
          className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm"
        >
          <option value="run_agent">Run AI agent</option>
          <option value="change_stage">Change stage</option>
          <option value="update_field">Update field</option>
          <option value="log">Log note</option>
        </select>
      </label>
      {type === "run_agent" ? (
        <>
          <label className="block text-xs font-medium text-muted">
            Agent
            <select
              value={step.agentId ?? ""}
              onChange={(e) => onChange({ ...step, agentId: e.target.value || undefined })}
              className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm"
            >
              <option value="">Choose…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.kind === "automation" ? "" : " (on-call)"}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-muted">
            Prompt to the agent
            <textarea
              value={step.prompt ?? ""}
              onChange={(e) => onChange({ ...step, prompt: e.target.value })}
              rows={3}
              placeholder="Qualify this record and move it to the right stage."
              className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm"
            />
          </label>
        </>
      ) : null}
      {type === "change_stage" ? (
        <label className="block text-xs font-medium text-muted">
          New stage
          <select
            value={step.stageLabel ?? ""}
            onChange={(e) => onChange({ ...step, stageLabel: e.target.value })}
            className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm"
          >
            <option value="">Choose…</option>
            {mod?.blueprint.stages.map((s) => (
              <option key={s.id} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {type === "update_field" ? (
        <>
          <label className="block text-xs font-medium text-muted">
            Field
            <select
              value={step.fieldId ?? ""}
              onChange={(e) => onChange({ ...step, fieldId: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm"
            >
              <option value="">Choose…</option>
              {mod?.fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-muted">
            Value
            <input
              value={step.value ?? ""}
              onChange={(e) => onChange({ ...step, value: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm"
            />
          </label>
        </>
      ) : null}
      {type === "log" ? (
        <label className="block text-xs font-medium text-muted">
          Note
          <input
            value={step.message ?? ""}
            onChange={(e) => onChange({ ...step, message: e.target.value })}
            placeholder="Logged after agent finished"
            className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm"
          />
        </label>
      ) : null}
    </div>
  );
}

export function createBlankAutomation(workspace: Parameters<typeof addWorkflow>[0], moduleId: string, agentId?: string) {
  const wf = emptyWorkflow(moduleId, "Lead created → qualify");
  if (agentId) {
    wf.steps = [{ ...emptyWorkflowStep("run_agent"), agentId }];
  }
  return addWorkflow(workspace, wf);
}
