"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconArrowUpRight, IconCheckCircle, IconClose, IconSparkle } from "@/components/icons";
import { useCrm } from "@/components/crm/crm-provider";
import type { CrmModule, CrmRecord, CrmWorkspace } from "@/lib/crm/types";

type Channel = "Call" | "WhatsApp" | "Email";
type Action = { leadId: string; channel: Channel; priority: "High" | "Medium" | "Low"; score: number; due: string; reason: string; evidence: string[]; draft: string };
type ActionState = "done" | "snoozed" | "dismissed";
const channelStyle: Record<Channel, string> = { Call: "bg-[#edf2fb] text-[#3c5f9d]", WhatsApp: "bg-[#e8f4ed] text-[#27764c]", Email: "bg-[#f2edf8] text-[#72549a]" };

function fieldValue(module: CrmModule, record: CrmRecord, apiKey: string): string {
  const field = module.fields.find((item) => item.apiKey === apiKey);
  const value = record.values[apiKey] ?? (field ? record.values[field.id] : undefined) ?? "";
  return field?.options.find((option) => option.id === value)?.label ?? value;
}
function dateLabel(value: string): string {
  if (!value) return "No follow-up scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const target = new Date(date); target.setHours(0, 0, 0, 0);
  const day = target.getTime() === today.getTime() ? "Today" : target.getTime() === tomorrow.getTime() ? "Tomorrow" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${day} · ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase(); }

export default function NextBestActionPage() {
  const { workspace, save } = useCrm();
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [states, setStates] = useState<Record<string, ActionState>>({});
  const [actions, setActions] = useState<Action[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [notice, setNotice] = useState("");

  const leadModule = workspace?.modules.find((module) => module.apiKey === "leads" || module.pluralLabel.toLowerCase() === "leads") ?? null;
  const records = leadModule?.records ?? [];
  const pending = useMemo(() => actions.filter((action) => !states[action.leadId]), [actions, states]);

  async function generateActions() {
    if (!workspace || !leadModule || !records.length) return;
    setAiBusy(true); setAiError("");
    const signals = records.map((record) => ({
      id: record.id,
      stage: fieldValue(leadModule, record, "stage"),
      intent: fieldValue(leadModule, record, "intent"),
      budget: fieldValue(leadModule, record, "budget_range") || fieldValue(leadModule, record, "budget"),
      location: fieldValue(leadModule, record, "preferred_location"),
      unitType: fieldValue(leadModule, record, "unit_type"),
      visitOutcome: fieldValue(leadModule, record, "visit_outcome"),
      preferredChannel: fieldValue(leadModule, record, "preferred_channel"),
      followUpDue: fieldValue(leadModule, record, "next_follow_up"),
      callAttempts: fieldValue(leadModule, record, "call_attempts"),
      lastCallOutcome: fieldValue(leadModule, record, "last_call_outcome"),
      callHistory: fieldValue(leadModule, record, "call_history"),
      whatsappMessageCount: fieldValue(leadModule, record, "whatsapp_message_count"),
      whatsappResponse: fieldValue(leadModule, record, "whatsapp_response"),
      whatsappHistory: fieldValue(leadModule, record, "whatsapp_history"),
      emailEngagement: fieldValue(leadModule, record, "email_engagement"),
      buyingBlocker: fieldValue(leadModule, record, "buying_blocker"),
    }));
    const nbaAgent = workspace.agents?.find((agent) => /next\s*best|\bnba\b/i.test(agent.name));
    try {
      const response = await fetch("/api/next-best-actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leads: signals, agent: nbaAgent ? { name: nbaAgent.name, instructions: nbaAgent.instructions, model: nbaAgent.model } : undefined }) });
      const result = await response.json() as { actions?: Action[]; error?: string };
      if (!response.ok) throw new Error(result.error || "AI recommendations could not be generated.");
      const validIds = new Set(records.map((record) => record.id));
      const nextActions = (result.actions ?? []).filter((action) => validIds.has(action.leadId) && ["Call", "WhatsApp", "Email"].includes(action.channel));
      setActions(nextActions);
      setStates({}); setDrafts({});
    } catch (error) { setAiError(error instanceof Error ? error.message : "AI recommendations could not be generated."); }
    finally { setAiBusy(false); }
  }

  function logAction(action: Action, state: ActionState) {
    if (!workspace || !leadModule) return;
    const lead = leadModule.records.find((record) => record.id === action.leadId);
    if (!lead) return;
    if (state !== "dismissed") {
      const nextWorkspace: CrmWorkspace = structuredClone(workspace);
      const crmModule = nextWorkspace.modules.find((item) => item.id === leadModule.id)!;
      const row = crmModule.records.find((item) => item.id === action.leadId)!;
      const now = new Date();
      if (state === "snoozed") {
        const followUp = crmModule.fields.find((field) => field.apiKey === "next_follow_up");
        if (followUp) row.values[followUp.apiKey] = new Date(now.getTime() + 86400000).toISOString();
      } else {
        const summaryField = crmModule.fields.find((field) => field.apiKey === "interaction_summary");
        const lastContact = crmModule.fields.find((field) => field.apiKey === "last_contacted");
        const prior = summaryField ? row.values[summaryField.apiKey] : "";
        if (summaryField) row.values[summaryField.apiKey] = `${prior}${prior ? "\n" : ""}${now.toLocaleString()}: ${action.channel} logged by CRM user.`;
        if (lastContact) row.values[lastContact.apiKey] = now.toISOString();
      }
      save(nextWorkspace);
    }
    setStates((current) => ({ ...current, [action.leadId]: state }));
    const label = state === "done" ? `${action.channel} activity logged to the lead record` : state === "snoozed" ? "Follow-up moved to tomorrow" : "Suggestion dismissed";
    setNotice(label); window.setTimeout(() => setNotice(""), 2800); setEditing(null);
  }

  return (
    <main className="page-canvas min-h-full flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-9">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 rise">
          <div>
            <div className="mb-2 flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-xl bg-[#dcece5] text-accent"><IconSparkle className="size-4" /></span><p className="kicker">AI prioritized tasks</p></div>
            <h1 className="display text-4xl text-ink sm:text-[46px]">Next best actions</h1>
          </div>
          {leadModule && records.length ? <button className="btn-accent" disabled={aiBusy} onClick={generateActions}><IconSparkle className="size-4"/>{aiBusy ? "Prioritizing…" : actions.length ? "Refresh priorities" : "Prioritize tasks"}</button> : null}
        </div>

        {!leadModule || records.length === 0 ? <section className="card px-6 py-12 text-center rise-2"><h2 className="display text-2xl">No prioritized tasks yet</h2><p className="mt-2 text-sm text-muted">Add leads to this workspace to generate next best actions.</p></section> : <>
          {aiError && <div role="alert" className="mb-4 rounded-2xl border border-[#e8c9b7] bg-[#fff5ed] px-4 py-3 text-sm text-[#8b4526]">{aiError}</div>}
          <section className="card overflow-hidden rise-3">
            <div className="flex items-center justify-between gap-3 border-b border-border-soft px-5 py-4 sm:px-6">
              <h2 className="display text-2xl text-ink">Prioritized tasks</h2><span className="rounded-full bg-[#f4efe6] px-3 py-1.5 text-xs font-semibold text-muted">{pending.length} to review</span>
            </div>
            <div className="divide-y divide-border-soft">
              {!actions.length ? <div className="px-6 py-12 text-center"><IconSparkle className="mx-auto size-8 text-accent"/><p className="mt-3 text-sm text-muted">Prioritize the lead follow-ups that matter most.</p></div> : pending.length === 0 ? <div className="px-6 py-14 text-center"><IconCheckCircle className="mx-auto size-9 text-accent"/><h3 className="display mt-3 text-2xl">All tasks complete</h3></div> : pending.map((action, index) => {
                const lead = records.find((record) => record.id === action.leadId)!;
                const name = fieldValue(leadModule, lead, "name") || lead.displayId;
                const leadHref = `/crm/modules/${leadModule.id}/records/${lead.id}`;
                const draft = drafts[action.leadId] ?? action.draft;
                const score = Math.max(0, Math.min(100, Number(action.score) || 0));
                return <article key={action.leadId} className="grid gap-4 px-5 py-5 sm:grid-cols-[46px_minmax(190px,0.85fr)_minmax(260px,1.4fr)_minmax(210px,1fr)] sm:px-6">
                  <div className="flex items-start gap-3 sm:block"><div className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? "bg-[#fae8df] text-[#a64b25]" : "bg-[#e9e4d8] text-accent"}`}>{String(index + 1).padStart(2, "0")}</div><div className="mt-2 hidden h-7 w-px bg-border-soft sm:block" /></div>
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="avatar size-8">{initials(name)}</span><h3 className="text-sm font-semibold text-ink">{name}</h3></div>
                    <p className="mt-2 text-xs font-medium text-ink">{fieldValue(leadModule, lead, "unit_type")} · {fieldValue(leadModule, lead, "preferred_location")}</p><p className="mt-1 text-[11px] text-muted">{fieldValue(leadModule, lead, "stage")} · {fieldValue(leadModule, lead, "owner")}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${channelStyle[action.channel]}`}>{action.channel}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${action.priority === "High" ? "bg-[#fae8df] text-[#a64b25]" : "bg-[#f4efe6] text-[#786246]"}`}>{action.priority} · {score}</span></div>
                    <p className="mt-2 text-[11px] text-muted">◷ {action.due || dateLabel(fieldValue(leadModule, lead, "next_follow_up"))}</p>
                  </div>
                  <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Why this action</p><p className="mt-1.5 text-[13px] font-semibold leading-snug text-ink">{action.reason}</p><ul className="mt-2 space-y-1">{action.evidence.map((item) => <li key={item} className="flex gap-2 text-[11px] leading-relaxed text-muted"><span className="mt-[5px] size-1 shrink-0 rounded-full bg-[#bca778]" />{item}</li>)}</ul><Link href={leadHref} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline">Open lead record <IconArrowUpRight className="size-3"/></Link></div>
                  <div className="min-w-0 rounded-2xl bg-[#f8f5ee] p-3.5"><div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted"><IconSparkle className="size-3 text-accent"/>AI prepared {action.channel.toLowerCase()}</span><button className="text-[10px] font-semibold text-accent hover:underline" onClick={() => setEditing(editing === action.leadId ? null : action.leadId)}>{editing === action.leadId ? "Preview" : "Edit"}</button></div>
                    {editing === action.leadId ? <textarea aria-label={`Edit draft for ${name}`} className="input min-h-28 resize-y rounded-xl bg-white text-xs leading-relaxed" value={draft} onChange={(event) => setDrafts((current) => ({ ...current, [action.leadId]: event.target.value }))}/> : <p className="line-clamp-5 whitespace-pre-line text-xs leading-relaxed text-[#514b42]">{draft}</p>}
                    <div className="mt-3 flex flex-wrap gap-1.5"><button className="btn-accent rounded-full px-3 py-1.5 text-[11px]" onClick={() => logAction(action, "done")}>Log {action.channel}</button><button className="rounded-full border border-border-soft bg-white px-3 py-1.5 text-[11px] font-semibold text-ink hover:bg-[#f7f1e6]" onClick={() => logAction(action, "snoozed")}>Snooze</button><button title="Dismiss suggestion" aria-label="Dismiss suggestion" className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-white hover:text-ink" onClick={() => logAction(action, "dismissed")}><IconClose className="size-3.5"/></button></div>
                  </div>
                </article>;
              })}
            </div>
          </section>
        </>}
        {notice && <div role="status" className="fixed bottom-5 right-5 z-20 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-xl">{notice}</div>}
      </div>
    </main>
  );
}
