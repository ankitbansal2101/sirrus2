"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AgentChatMessage, AgentTraceStep, CrmAgentMode, CrmAgentResult } from "@/lib/agent/types";
import { IconClose, IconSend, IconSparkle, IconTable, IconTool, IconUser } from "@/components/icons";
import { useCrm } from "@/components/crm/crm-provider";

type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  traces?: AgentTraceStep[];
  summary?: string;
  changed?: boolean;
};

const CONFIG_EXAMPLES = [
  "Create a Tickets module with Priority picklist High/Medium/Low",
  "Add a Budget number field to Leads and show it on the overview",
  "Set the Leads pipeline to New → Qualified → Visit → Booked → Lost",
  "How many modules and records are in this workspace?",
];

const UNIVERSAL_EXAMPLES = [
  "How many records are there across all modules?",
  "Show a breakdown of leads by stage",
  "Find records named John",
  "Update a lead’s stage to Qualified",
];

function isCrmResult(x: unknown): x is CrmAgentResult {
  return !!x && typeof x === "object" && "assistantMessage" in x && "traces" in x;
}

function copyFor(mode: CrmAgentMode, moduleLabel?: string) {
  if (mode === "records") {
    const name = moduleLabel || "this module";
    return {
      title: `${name} agent`,
      subtitle: `Ask about ${name.toLowerCase()}, filter them, or update a record.`,
      placeholder: `Ask about ${name.toLowerCase()}…`,
      working: "Looking up records…",
      examples: [
        `How many ${name.toLowerCase()} are there?`,
        `Show a breakdown by stage`,
        `Find a ${name.replace(/s$/i, "").toLowerCase()} by name`,
        `Update a record’s stage`,
      ],
    };
  }
  if (mode === "universal") {
    return {
      title: "Workspace agent",
      subtitle: "Query and update records across every module.",
      placeholder: "Ask about any module’s records…",
      working: "Workspace agent is working…",
      examples: UNIVERSAL_EXAMPLES,
    };
  }
  return {
    title: "CRM Agent",
    subtitle: "Create modules, fields, forms, blueprints, and overview widgets via tools.",
    placeholder: "Ask to create a module, add fields, or reshape a pipeline…",
    working: "CRM Agent is working…",
    examples: CONFIG_EXAMPLES,
  };
}

export function CrmAgentPanel({
  open,
  onClose,
  focusModuleId,
  moduleLabel,
  mode = "config",
  customAgentId,
}: {
  open: boolean;
  onClose: () => void;
  focusModuleId?: string | null;
  moduleLabel?: string;
  mode?: CrmAgentMode;
  customAgentId?: string | null;
}) {
  const { workspace, save } = useCrm();
  const listId = useId();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const custom = customAgentId ? workspace?.agents?.find((a) => a.id === customAgentId) : undefined;
  const resolvedMode: CrmAgentMode = custom ? "custom" : mode;
  const copy = custom
    ? {
        title: custom.name,
        subtitle: custom.handoffDescription || "Custom agent from Settings → Agents.",
        placeholder: `Message ${custom.name}…`,
        working: `${custom.name} is working…`,
        examples: custom.instructions
          ? ["What can you help me with?", "Query records in this workspace", "Update a record"]
          : [],
      }
    : copyFor(resolvedMode, moduleLabel);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries, busy]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !workspace || !mounted) return null;

  const sendText = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    setError(null);
    const userEntry: ChatEntry = { id: `u_${Date.now()}`, role: "user", content };
    setEntries((prev) => [...prev, userEntry]);
    setBusy(true);
    const history: AgentChatMessage[] = [...entries, userEntry].map((e) => ({ role: e.role, content: e.content }));

    try {
      const res = await fetch("/api/crm-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          workspace,
          focusModuleId: focusModuleId ?? null,
          mode: resolvedMode,
          customAgentId: custom?.id ?? null,
        }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          json && typeof json === "object" && "error" in json && typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : `Request failed (${res.status}).`;
        setError(message);
        setEntries((prev) => [...prev, { id: `a_${Date.now()}`, role: "assistant", content: message }]);
        return;
      }
      if (!isCrmResult(json)) {
        setError("Unexpected response from the agent.");
        return;
      }
      if (json.changed && json.workspace) save(json.workspace);
      setEntries((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: json.assistantMessage,
          traces: json.traces,
          summary: json.summary,
          changed: json.changed,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not reach the agent.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const panel = (
    <div className="fixed inset-0 z-[100] flex h-svh max-h-svh justify-end bg-[#12100c]/35 backdrop-blur-[2px]">
      <button type="button" className="min-h-0 flex-1 cursor-default" aria-label="Close agent" onClick={onClose} />
      <aside className="flex h-svh max-h-svh min-h-0 w-[min(100%,26rem)] flex-col border-l border-border-soft bg-surface shadow-[-24px_0_60px_-28px_rgba(22,20,15,0.4)]">
        <header className="shrink-0 border-b border-border-soft px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
              <IconSparkle className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-semibold text-ink">{copy.title}</h2>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">{copy.subtitle}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-zinc-100" aria-label="Close">
              <IconClose className="size-4" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3" aria-labelledby={listId}>
          <p id={listId} className="sr-only">
            Conversation
          </p>
          {entries.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-semibold text-ink">Try one</p>
              {copy.examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void sendText(example)}
                  className="card px-3 py-2.5 text-left text-[13px] leading-relaxed text-ink hover:border-accent/40"
                >
                  {example}
                </button>
              ))}
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
              <div className="min-w-0 flex-1">
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    e.role === "user" ? "rounded-tr-md bg-[#efe8dc]" : "rounded-tl-md border border-border-soft bg-white"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{e.content}</p>
                </div>
                {e.traces?.length ? (
                  <ol className="mt-2 space-y-1 rounded-xl border border-border-soft bg-[#f7f1e6] px-3 py-2">
                    {e.traces.map((t) => (
                      <li key={t.id} className="flex items-start gap-2 text-[12px] text-muted">
                        <IconTool className="mt-0.5 size-3 shrink-0" />
                        <span>
                          {t.label}
                          {t.detail ? ` — ${t.detail}` : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : null}
                {e.changed ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-accent">
                    <IconTable className="size-3.5" />
                    Records updated
                  </p>
                ) : null}
              </div>
            </article>
          ))}

          {busy ? <p className="mb-2 text-[13px] text-muted">{copy.working}</p> : null}
          {error ? <p className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{error}</p> : null}
          <div ref={bottomRef} />
        </div>

        <form
          className="relative shrink-0 border-t border-border-soft bg-[#f7f1e6] p-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            void sendText(input);
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendText(input);
              }
            }}
            rows={3}
            placeholder={copy.placeholder}
            className="w-full resize-none rounded-xl border border-border-soft bg-white py-3 pl-3.5 pr-12 text-[13px] outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="absolute bottom-6 right-5 flex size-8 items-center justify-center rounded-lg bg-accent text-white disabled:bg-zinc-300"
            aria-label="Send"
          >
            <IconSend className="size-3.5" />
          </button>
        </form>
      </aside>
    </div>
  );

  return createPortal(panel, document.body);
}
