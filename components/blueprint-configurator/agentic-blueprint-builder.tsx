"use client";

import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type SVGProps } from "react";
import type { AgentChatMessage, AgentTraceStep, BuilderAgentResult } from "@/lib/agent/types";
import { resolveFieldDefinitions } from "@/lib/blueprint/from-fields-schema";
import { getClientSirrusMetadata } from "@/lib/blueprint/metadata/client-metadata";
import { loadBlueprintById, saveBlueprint, setActiveBlueprint } from "@/lib/blueprint/storage";
import type { BlueprintDocument } from "@/lib/blueprint/types";
import { validateBlueprint } from "@/lib/blueprint/validator/validate-blueprint";
import { useBlueprintWorkspace } from "@/components/blueprint-configurator/blueprint-workspace-context";
import {
  IconBraces,
  IconCheckCircle,
  IconClose,
  IconEye,
  IconFlow,
  IconSend,
  IconShieldCheck,
  IconSparkle,
  IconTool,
  IconUser,
} from "@/components/icons";

type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  traces?: AgentTraceStep[];
  summary?: string;
  validation?: BuilderAgentResult["validation"];
  changed?: boolean;
};

type PipelineKey = "intent" | "agent" | "tool" | "json" | "canvas" | "approve";

const PIPELINE: { key: PipelineKey; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { key: "intent", label: "Intent", Icon: IconUser },
  { key: "agent", label: "Agent", Icon: IconSparkle },
  { key: "tool", label: "Tool", Icon: IconTool },
  { key: "json", label: "JSON", Icon: IconBraces },
  { key: "canvas", label: "Canvas", Icon: IconFlow },
  { key: "approve", label: "Approve", Icon: IconShieldCheck },
];

const EXAMPLES = [
  "Create a sales workflow for leads. New → Contacted → Qualified → Site Visit → Proposal → Negotiation → Closed Won. Lost Reason is mandatory when marked Lost.",
  "Add a Site Visit Date requirement before Site Visit.",
  "Add an approval before Negotiation.",
];

function isBuilderResult(x: unknown): x is BuilderAgentResult {
  return !!x && typeof x === "object" && "assistantMessage" in x && "traces" in x;
}

function traceMeta(label: string): { title: string; Icon: ComponentType<SVGProps<SVGSVGElement>> } {
  const l = label.toLowerCase();
  if (l.includes("user request")) return { title: "Intent received", Icon: IconUser };
  if (l.includes("builder agent")) return { title: "Builder Agent", Icon: IconSparkle };
  if (l.includes("selecting tool")) return { title: label.replace("Selecting tool:", "Tool selected:").trim(), Icon: IconTool };
  if (l.includes("calling") || l.includes("buildblueprint")) return { title: "buildBlueprint()", Icon: IconBraces };
  if (l.includes("generated")) return { title: "Blueprint JSON ready", Icon: IconFlow };
  if (l.includes("validation passed")) return { title: "Validation passed", Icon: IconCheckCircle };
  if (l.includes("validation")) return { title: label, Icon: IconShieldCheck };
  return { title: label, Icon: IconSparkle };
}

function activePipelineKeys(args: {
  busy: boolean;
  pendingApproval: boolean;
  lastChanged: boolean;
  lastTraces?: AgentTraceStep[];
}): Set<PipelineKey> {
  const keys = new Set<PipelineKey>();
  if (args.busy) {
    keys.add("intent");
    keys.add("agent");
    return keys;
  }
  const labels = (args.lastTraces ?? []).map((t) => t.label.toLowerCase());
  if (labels.some((l) => l.includes("user request"))) keys.add("intent");
  if (labels.some((l) => l.includes("builder agent"))) keys.add("agent");
  if (labels.some((l) => l.includes("tool") || l.includes("buildblueprint"))) {
    keys.add("tool");
    keys.add("json");
  }
  if (args.lastChanged || labels.some((l) => l.includes("generated"))) keys.add("canvas");
  if (args.pendingApproval) keys.add("approve");
  if (!keys.size) keys.add("intent");
  return keys;
}

export function AgenticBlueprintBuilder({ blueprintId }: { blueprintId: string }) {
  const {
    aiPanelOpen,
    setAiPanelOpen,
    pendingApproval,
    setPendingApproval,
    lastValidation,
    setLastValidation,
    getLiveDocument,
    applyLiveDocument,
    reviewOnCanvas,
    setSaveBanner,
  } = useBlueprintWorkspace();
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
        pendingApproval,
        lastChanged: Boolean(lastAssistant?.changed),
        lastTraces: lastAssistant?.traces,
      }),
    [busy, pendingApproval, lastAssistant],
  );

  if (!aiPanelOpen) return null;

  const resolveDoc = (): BlueprintDocument | null => getLiveDocument() ?? loadBlueprintById(blueprintId);

  const persistDraft = (doc: BlueprintDocument) => {
    saveBlueprint({ ...doc, status: "draft" });
    applyLiveDocument({ ...doc, status: "draft" });
    setPendingApproval(true);
  };

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    setError(null);
    const userEntry: ChatEntry = { id: `u_${Date.now()}`, role: "user", content: trimmed };
    const history: AgentChatMessage[] = [...entries, userEntry].map((e) => ({ role: e.role, content: e.content }));
    setEntries((prev) => [...prev, userEntry]);
    setBusy(true);

    try {
      const res = await fetch("/api/builder-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          currentBlueprint: resolveDoc(),
          metadata: getClientSirrusMetadata(),
          fieldDefinitions: resolveFieldDefinitions(),
        }),
      });
      const payload: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          payload && typeof payload === "object" && "error" in payload && typeof (payload as { error: unknown }).error === "string"
            ? (payload as { error: string }).error
            : `Request failed (${res.status}).`;
        throw new Error(msg);
      }
      if (!isBuilderResult(payload)) throw new Error("Unexpected agent response.");

      if (payload.changed && payload.blueprint) {
        persistDraft(payload.blueprint);
        reviewOnCanvas();
      }
      if (payload.validation) setLastValidation(payload.validation);

      setEntries((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: payload.assistantMessage,
          traces: payload.traces,
          summary: payload.summary,
          validation: payload.validation,
          changed: payload.changed,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not reach the Builder Agent.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const onValidate = () => {
    const doc = resolveDoc();
    if (!doc) {
      setSaveBanner("Open a Blueprint first");
      window.setTimeout(() => setSaveBanner(null), 2800);
      return;
    }
    const result = validateBlueprint(doc, getClientSirrusMetadata());
    setLastValidation(result);
    setSaveBanner(result.valid ? "Validation passed" : "Validation found issues");
    window.setTimeout(() => setSaveBanner(null), 2800);
  };

  const onApprove = () => {
    const doc = resolveDoc();
    if (!doc) return;
    const result = validateBlueprint(doc, getClientSirrusMetadata());
    setLastValidation(result);
    if (!result.valid) {
      setSaveBanner("Fix validation errors before activation");
      window.setTimeout(() => setSaveBanner(null), 3200);
      return;
    }
    const next: BlueprintDocument = { ...doc, status: "active" };
    if (!saveBlueprint(next) || !setActiveBlueprint(next.id)) {
      setSaveBanner("Could not activate (storage unavailable)");
      window.setTimeout(() => setSaveBanner(null), 3200);
      return;
    }
    applyLiveDocument(next);
    setPendingApproval(false);
    setSaveBanner("Approved and activated");
    window.setTimeout(() => setSaveBanner(null), 2800);
  };

  const validationTone = lastValidation
    ? lastValidation.valid
      ? "passed"
      : "failed"
    : pendingApproval
      ? "draft"
      : "idle";

  return (
    <aside className="ai-builder-panel flex w-[min(100%,24rem)] shrink-0 flex-col self-stretch border-r border-border-soft bg-white text-ink sm:w-[26rem]">
      <header className="shrink-0 border-b border-border-soft bg-[linear-gradient(180deg,#f6f6ff_0%,#ffffff_100%)] px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-sm">
            <IconSparkle className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold leading-tight tracking-tight text-ink">AI Blueprint Builder</h2>
            <p className="mt-0.5 text-[13px] leading-snug text-muted">Describe the process. The agent picks a tool. The canvas shows the result.</p>
          </div>
          <button
            type="button"
            onClick={() => setAiPanelOpen(false)}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-zinc-100 hover:text-ink"
            aria-label="Close AI Blueprint Builder"
          >
            <IconClose className="size-4" />
          </button>
        </div>
      </header>

      <div className="shrink-0 border-b border-border-soft px-3 py-2.5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">How it works</p>
        <div className="relative">
          <div className="absolute left-[8%] right-[8%] top-4 h-px bg-border-soft" aria-hidden />
          <ol className="relative grid grid-cols-6 gap-1">
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
              <p className="text-[13px] font-semibold text-ink">Start with a process</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                The agent does not click the canvas. It calls <span className="font-medium text-ink">blueprint_builder</span>, which returns Blueprint JSON. That JSON appears on the visual builder to the right.
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
                {e.role === "user" ? "You" : "Builder Agent"}
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
                  <IconFlow className="size-3.5" />
                  Canvas updated · still a draft until you approve
                </p>
              ) : null}

              {e.validation && !e.validation.valid ? (
                <ul className="mt-2 space-y-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
                  {e.validation.errors.map((err) => (
                    <li key={`${err.code}-${err.message}`}>{err.message}</li>
                  ))}
                </ul>
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
              <p className="text-[13px] font-medium text-ink">Builder Agent is working</p>
              <p className="mt-1 text-[13px] text-muted">Reading intent, selecting a tool, then generating Blueprint JSON…</p>
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
        <div
          className={`mb-2.5 rounded-xl px-3 py-2 text-[13px] ${
            validationTone === "failed"
              ? "border border-red-200 bg-red-50 text-red-800"
              : validationTone === "passed"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                : validationTone === "draft"
                  ? "border border-amber-200 bg-amber-50 text-amber-950"
                  : "border border-border-soft bg-white text-muted"
          }`}
        >
          {validationTone === "failed"
            ? `${lastValidation?.errors.length ?? 0} validation error(s) — fix before activation`
            : validationTone === "passed"
              ? `Validated${lastValidation?.warnings.length ? ` · ${lastValidation.warnings.length} warning(s)` : ""} · still needs Approve & Activate`
              : validationTone === "draft"
                ? "Draft on canvas · review, then Approve & Activate"
                : "No generated draft yet"}
        </div>

        <div className="mb-3 grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => reviewOnCanvas()}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border-soft bg-white px-2 py-2 text-[12px] font-semibold text-ink shadow-sm transition hover:border-accent/35"
          >
            <IconEye className="size-3.5 text-accent" />
            Review
          </button>
          <button
            type="button"
            onClick={onValidate}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border-soft bg-white px-2 py-2 text-[12px] font-semibold text-ink shadow-sm transition hover:border-accent/35"
          >
            <IconCheckCircle className="size-3.5 text-accent" />
            Validate
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={!pendingApproval}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-2 py-2 text-[12px] font-semibold text-white shadow-sm transition enabled:hover:opacity-95 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            <IconShieldCheck className="size-3.5" />
            Activate
          </button>
        </div>

        <form
          className="relative"
          onSubmit={(ev) => {
            ev.preventDefault();
            void sendText(input);
          }}
        >
          <label className="sr-only" htmlFor="ai-blueprint-input">
            Describe your process
          </label>
          <textarea
            id="ai-blueprint-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendText(input);
              }
            }}
            rows={3}
            placeholder="Tell Sirrus how this process should work…"
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
