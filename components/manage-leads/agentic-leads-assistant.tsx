"use client";

import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type SVGProps } from "react";
import type { AgentChatMessage, AgentTraceStep, LeadsAgentResult } from "@/lib/agent/types";
import {
  IconCheckCircle,
  IconClose,
  IconSend,
  IconSparkle,
  IconTable,
  IconTool,
  IconUser,
} from "@/components/icons";
import type { FieldDefinition } from "@/lib/fields-config/types";
import type { LeadRecord } from "@/lib/leads/types";

type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  traces?: AgentTraceStep[];
  summary?: string;
  changed?: boolean;
  matchedCount?: number;
};

type PipelineKey = "intent" | "agent" | "tool" | "data" | "list";

const PIPELINE: { key: PipelineKey; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { key: "intent", label: "Intent", Icon: IconUser },
  { key: "agent", label: "Agent", Icon: IconSparkle },
  { key: "tool", label: "Tool", Icon: IconTool },
  { key: "data", label: "Data", Icon: IconCheckCircle },
  { key: "list", label: "List", Icon: IconTable },
];

const EXAMPLES = [
  "How many leads are there?",
  "How many leads are in Site Visit?",
  "Show me a breakdown by stage",
  "Change the selected lead's assigned to Agent A",
];

function isLeadsResult(x: unknown): x is LeadsAgentResult {
  return !!x && typeof x === "object" && "assistantMessage" in x && "traces" in x;
}

function traceMeta(label: string): { title: string; Icon: ComponentType<SVGProps<SVGSVGElement>> } {
  const l = label.toLowerCase();
  if (l.includes("user request")) return { title: "Intent received", Icon: IconUser };
  if (l.includes("leads agent")) return { title: "Leads Agent", Icon: IconSparkle };
  if (l.includes("selecting tool")) return { title: label.replace("Selecting tool:", "Tool selected:").trim(), Icon: IconTool };
  if (l.includes("calling")) return { title: label, Icon: IconTool };
  if (l.includes("query")) return { title: label, Icon: IconCheckCircle };
  if (l.includes("updated")) return { title: "Leads updated", Icon: IconTable };
  return { title: label, Icon: IconSparkle };
}

function activePipelineKeys(args: { busy: boolean; lastChanged: boolean; lastTraces?: AgentTraceStep[] }): Set<PipelineKey> {
  const keys = new Set<PipelineKey>();
  if (args.busy) {
    keys.add("intent");
    keys.add("agent");
    return keys;
  }
  const labels = (args.lastTraces ?? []).map((t) => t.label.toLowerCase());
  if (labels.some((l) => l.includes("user request"))) keys.add("intent");
  if (labels.some((l) => l.includes("leads agent"))) keys.add("agent");
  if (labels.some((l) => l.includes("tool") || l.includes("calling"))) keys.add("tool");
  if (labels.some((l) => l.includes("query") || l.includes("updated") || l.includes("result"))) keys.add("data");
  if (args.lastChanged || labels.some((l) => l.includes("leads updated"))) keys.add("list");
  if (!keys.size) keys.add("intent");
  return keys;
}

export function AgenticLeadsAssistant({
  open,
  onClose,
  leads,
  fields,
  selectedLeadId,
  onLeadsUpdated,
}: {
  open: boolean;
  onClose: () => void;
  leads: LeadRecord[];
  fields: FieldDefinition[];
  selectedLeadId: string | null;
  onLeadsUpdated: (next: LeadRecord[]) => void;
}) {
  const listId = useId();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries, busy]);

  const lastAssistant = [...entries].reverse().find((e) => e.role === "assistant");
  const pipelineActive = useMemo(
    () =>
      activePipelineKeys({
        busy,
        lastChanged: lastAssistant?.changed ?? false,
        lastTraces: lastAssistant?.traces,
      }),
    [busy, lastAssistant],
  );

  if (!open) return null;

  const sendText = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    setError(null);
    const userEntry: ChatEntry = { id: `u_${Date.now()}`, role: "user", content };
    setEntries((prev) => [...prev, userEntry]);
    setBusy(true);

    const history: AgentChatMessage[] = [...entries, userEntry].map((e) => ({
      role: e.role,
      content: e.content,
    }));

    try {
      const res = await fetch("/api/leads-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          leads,
          fieldDefinitions: fields,
          selectedLeadId,
        }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          json && typeof json === "object" && "error" in json && typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : `Request failed (${res.status}).`;
        setError(message);
        setEntries((prev) => [
          ...prev,
          { id: `a_${Date.now()}`, role: "assistant", content: message },
        ]);
        return;
      }
      if (!isLeadsResult(json)) {
        setError("Unexpected response from the Leads Agent.");
        return;
      }
      if (json.changed && json.leads) {
        onLeadsUpdated(json.leads);
      }
      setEntries((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: json.assistantMessage,
          traces: json.traces,
          summary: json.summary,
          changed: json.changed,
          matchedCount: json.matchedCount,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not reach the Leads Agent.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="ai-builder-panel flex w-[min(100%,24rem)] shrink-0 flex-col self-stretch border-r border-border-soft bg-white text-ink sm:w-[26rem]">
      <header className="shrink-0 border-b border-border-soft bg-[linear-gradient(180deg,#f6f6ff_0%,#ffffff_100%)] px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-sm">
            <IconSparkle className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold leading-tight tracking-tight text-ink">Leads Agent</h2>
            <p className="mt-0.5 text-[13px] leading-snug text-muted">
              Ask about the current list, or update a lead. Answers come from tools, not guesses.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-zinc-100 hover:text-ink"
            aria-label="Close Leads Agent"
          >
            <IconClose className="size-4" />
          </button>
        </div>
      </header>

      <div className="shrink-0 border-b border-border-soft px-3 py-2.5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">How it works</p>
        <div className="relative">
          <div className="absolute left-[10%] right-[10%] top-4 h-px bg-border-soft" aria-hidden />
          <ol className="relative grid grid-cols-5 gap-1">
            {PIPELINE.map((step) => {
              const on = pipelineActive.has(step.key);
              const Icon = step.Icon;
              return (
                <li key={step.key} className="flex min-w-0 flex-col items-center gap-1.5">
                  <span
                    className={`flex size-8 items-center justify-center rounded-full border text-xs shadow-sm ${
                      on ? "border-accent bg-accent text-white" : "border-border-soft bg-white text-muted"
                    }`}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className={`text-center text-[11px] font-semibold leading-none ${on ? "text-ink" : "text-muted"}`}>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3" aria-labelledby={listId}>
        <p id={listId} className="sr-only">
          Conversation
        </p>
        {entries.length === 0 ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-border-soft bg-[#f7f7fb] px-3.5 py-3">
              <p className="text-[13px] font-semibold text-ink">{leads.length} leads in this list</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                The agent calls <span className="font-medium text-ink">lead_query</span> or{" "}
                <span className="font-medium text-ink">lead_update</span>. Updates write the same stored leads the table already uses.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-semibold text-ink">Try one</p>
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void sendText(example)}
                  className="rounded-xl border border-border-soft bg-white px-3 py-2.5 text-left text-[13px] leading-relaxed text-ink shadow-sm transition hover:border-accent/40 hover:bg-[#f7f7ff]"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {entries.map((e) => (
          <article key={e.id} className={`mb-3 flex gap-2.5 ${e.role === "user" ? "flex-row-reverse" : ""}`}>
            <span
              className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                e.role === "user" ? "bg-ink text-white" : "bg-accent text-white"
              }`}
            >
              {e.role === "user" ? <IconUser className="size-3.5" /> : <IconSparkle className="size-3.5" />}
            </span>
            <div className={`min-w-0 flex-1 ${e.role === "user" ? "items-end" : ""}`}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                {e.role === "user" ? "You" : "Leads Agent"}
              </p>
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed text-ink ${
                  e.role === "user" ? "rounded-tr-md bg-[#ececff]" : "rounded-tl-md border border-border-soft bg-white"
                }`}
              >
                <p className="whitespace-pre-wrap">{e.content}</p>
              </div>

              {e.traces?.length ? (
                <div className="mt-2 rounded-xl border border-border-soft bg-[#f7f7fb] px-3 py-2.5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Activity</p>
                  <ol className="space-y-2">
                    {e.traces.map((t, idx) => {
                      const meta = traceMeta(t.label);
                      const Icon = meta.Icon;
                      return (
                        <li key={t.id} className="flex gap-2">
                          <span className="flex w-4 shrink-0 flex-col items-center">
                            <span
                              className={`flex size-4 items-center justify-center rounded-full ${
                                t.status === "error" ? "bg-red-600 text-white" : t.status === "warn" ? "bg-amber-500 text-white" : "bg-accent text-white"
                              }`}
                            >
                              <Icon className="size-2.5" />
                            </span>
                            {idx < (e.traces?.length ?? 0) - 1 ? <span className="mt-1 h-full min-h-2 w-px bg-border-soft" /> : null}
                          </span>
                          <div className="min-w-0 pb-0.5">
                            <p
                              className={`text-[13px] font-medium leading-snug ${
                                t.status === "error" ? "text-red-700" : t.status === "warn" ? "text-amber-800" : "text-ink"
                              }`}
                            >
                              {meta.title}
                            </p>
                            {t.detail ? <p className="mt-0.5 text-[12px] leading-snug text-muted">{t.detail}</p> : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : null}

              {e.summary ? (
                <p className="mt-2 rounded-xl bg-[#f7f7fb] px-3 py-2 text-[13px] leading-relaxed text-ink">{e.summary}</p>
              ) : null}

              {e.changed ? (
                <p className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-accent">
                  <IconTable className="size-3.5" />
                  Lead list updated
                  {typeof e.matchedCount === "number" ? ` · ${e.matchedCount} record${e.matchedCount === 1 ? "" : "s"}` : ""}
                </p>
              ) : null}
            </div>
          </article>
        ))}

        {busy ? (
          <div className="mb-3 flex gap-2.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-white">
              <IconSparkle className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-border-soft bg-white px-3.5 py-3">
              <p className="text-[13px] font-medium text-ink">Leads Agent is working</p>
              <p className="mt-1 text-[13px] text-muted">Reading intent, selecting a tool, then querying or updating leads…</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-accent" />
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{error}</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border-soft bg-[#fbfbfe] px-3 py-3">
        <p className="mb-2.5 rounded-xl border border-border-soft bg-white px-3 py-2 text-[13px] text-muted">
          {leads.length} lead{leads.length === 1 ? "" : "s"} loaded
          {selectedLeadId ? " · a lead is open" : ""}
        </p>
        <form
          className="relative"
          onSubmit={(ev) => {
            ev.preventDefault();
            void sendText(input);
          }}
        >
          <label className="sr-only" htmlFor="ai-leads-input">
            Ask about or update leads
          </label>
          <textarea
            id="ai-leads-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendText(input);
              }
            }}
            rows={3}
            placeholder="Ask how many leads, or tell the agent what to update…"
            className="w-full resize-none rounded-xl border border-border-soft bg-white py-3 pl-3.5 pr-12 text-[13px] leading-relaxed text-ink shadow-sm outline-none ring-accent placeholder:text-muted/80 focus:ring-2"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="absolute bottom-3 right-2.5 flex size-8 items-center justify-center rounded-lg bg-accent text-white shadow-sm transition enabled:hover:opacity-95 disabled:bg-zinc-300"
          >
            <IconSend className="size-3.5" />
          </button>
        </form>
      </div>
    </aside>
  );
}
