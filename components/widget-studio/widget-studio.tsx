"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCrm } from "@/components/crm/crm-provider";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { IconPlus, IconSparkle, IconTrash } from "@/components/icons";
import { IconMarketplaceWidget } from "@/components/settings-card-icons";
import type { AgentChatMessage } from "@/lib/agent/types";
import {
  addMarketplaceWidget,
  blankWorkspace,
  findModule,
  findWidget,
  removeMarketplaceWidget,
  updateMarketplaceWidget,
  widgetsOf,
} from "@/lib/crm/ops";
import {
  MARKETPLACE_WIDGET_FIELD_TYPES,
  type CrmModule,
  type CrmWorkspace,
  type MarketplaceWidget,
  type MarketplaceWidgetField,
  type MarketplaceWidgetFieldType,
  type MarketplaceWidgetQuery,
} from "@/lib/crm/types";
import type { FieldDefinition } from "@/lib/fields-config/types";
import { newCrmId } from "@/lib/crm/ids";
import {
  compileWidgetDocument,
  defaultQueryWidgetBody,
  defaultWidgetBody,
  embedSnippet,
  fieldKey,
  sampleData,
} from "@/lib/widgets/compile";
import { runWidgetQuery } from "@/lib/widgets/query";

const EXAMPLES = [
  "Create a widget of enquiries assigned to each counsellor",
  "Listing of open leads by owner",
  "Table of deals in Negotiation",
];

const TYPE_LABEL: Record<MarketplaceWidgetFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Select",
  boolean: "Yes / no",
  currency: "Currency",
  image_url: "Image URL",
};

export function WidgetStudio() {
  const { workspace, save } = useCrm();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const widgets = workspace ? widgetsOf(workspace) : [];
  const selectedId = params.get("widget");
  const selected = workspace && selectedId ? findWidget(workspace, selectedId) : undefined;
  const [createOpen, setCreateOpen] = useState(false);

  const open = (id: string | null) => {
    const qs = id ? `?widget=${encodeURIComponent(id)}` : "";
    router.replace(`${pathname}${qs}`);
  };

  const create = (name: string, description: string) => {
    const base = workspace ?? blankWorkspace();
    const { workspace: next, widget } = addMarketplaceWidget(base, { name, description });
    save(next);
    setCreateOpen(false);
    open(widget.id);
  };

  if (selected && workspace) {
    return (
      <WidgetEditor
        workspace={workspace}
        widget={selected}
        origin={typeof window !== "undefined" ? window.location.origin : ""}
        onBack={() => open(null)}
        onPatch={(patch) => save(updateMarketplaceWidget(workspace, selected.id, patch))}
        onDelete={() => {
          if (!confirm(`Delete ${selected.name}?`)) return;
          save(removeMarketplaceWidget(workspace, selected.id));
          open(null);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DeveloperPageHeader
        backHref="/"
        title="Marketplace widgets"
        description="Pick a module, listing columns, and fields yourself — or ask the agent. Then host the iframe."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn-primary text-xs"
          >
            <IconPlus className="size-3.5" />
            New widget
          </button>
        }
      />
      <main className="page-canvas min-h-0 flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto max-w-[1200px]">
          {widgets.length === 0 ? (
            <div className="card px-8 py-14 text-center">
              <IconMarketplaceWidget className="mx-auto size-10 text-accent" />
              <p className="display mt-4 text-3xl text-ink">No marketplace widgets yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                Ask the agent to find the module and listing, query records, and compile an iframe. Try “enquiries assigned to each counsellor”.
              </p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="btn-primary mt-5"
              >
                <IconPlus className="size-4" />
                New widget
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {widgets.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => open(w.id)}
                  className="card card-hover p-5 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-[15px] font-semibold text-ink">{w.name}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        w.published ? "bg-accent/10 text-accent" : "bg-[#f4efe6] text-muted"
                      }`}
                    >
                      {w.published ? "Live" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] text-muted">{w.description || w.uiBrief || "No description"}</p>
                  <p className="mt-4 text-[11px] text-muted">
                    {w.query?.moduleId
                      ? `${findModule(workspace!, w.query.moduleId)?.pluralLabel ?? "Module"} · ${w.query.operation}`
                      : `${w.fields.length} field${w.fields.length === 1 ? "" : "s"}`}{" "}
                    · v{w.version}
                  </p>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex min-h-[140px] flex-col items-center justify-center rounded-2xl border border-dashed border-border-soft bg-surface text-sm font-medium text-muted hover:border-accent/30 hover:text-accent"
              >
                <IconPlus className="mb-2 size-4" />
                New widget
              </button>
            </div>
          )}
        </div>
      </main>
      {createOpen ? <CreateWidgetDialog onClose={() => setCreateOpen(false)} onCreate={create} /> : null}
    </div>
  );
}

function toFieldType(t: string): MarketplaceWidgetFieldType {
  if (t === "number" || t === "currency" || t === "date" || t === "select" || t === "boolean" || t === "image_url") {
    return t;
  }
  return "text";
}

function crmFieldType(dataType: FieldDefinition["dataType"]): MarketplaceWidgetFieldType {
  if (dataType === "number" || dataType === "decimal" || dataType === "formula") return "number";
  if (dataType === "date" || dataType === "date_time") return "date";
  if (dataType === "picklist" || dataType === "radio" || dataType === "multi_select") return "select";
  return "text";
}

function listingFields(mod: CrmModule): FieldDefinition[] {
  const listed = mod.listColumnFieldIds
    .map((id) => mod.fields.find((f) => f.id === id))
    .filter((f): f is FieldDefinition => !!f);
  return listed.length ? listed : mod.fields.slice(0, 5);
}

function widgetFieldsFromCrm(defs: FieldDefinition[]): MarketplaceWidgetField[] {
  return defs.map((f) => ({
    id: newCrmId("wf"),
    key: f.apiKey,
    label: f.label,
    type: crmFieldType(f.dataType),
    options: f.options.map((o) => o.label),
  }));
}

function columnsFromQuery(mod: CrmModule | undefined, query: MarketplaceWidgetQuery | undefined, fields: MarketplaceWidgetField[]) {
  if (query?.listFieldKeys?.length && mod) {
    return query.listFieldKeys.map((key) => {
      const f = mod.fields.find((x) => x.apiKey === key);
      return { key, label: f?.label ?? key };
    });
  }
  return fields.map((f) => ({ key: f.key, label: f.label }));
}

function WidgetEditor({
  workspace,
  widget,
  origin,
  onBack,
  onPatch,
  onDelete,
}: {
  workspace: CrmWorkspace;
  widget: MarketplaceWidget;
  origin: string;
  onBack: () => void;
  onPatch: (patch: Partial<MarketplaceWidget>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(widget.name);
  const [description, setDescription] = useState(widget.description);
  const [uiBrief, setUiBrief] = useState(widget.uiBrief);
  const [fields, setFields] = useState<MarketplaceWidgetField[]>(widget.fields);
  const [embedHeight, setEmbedHeight] = useState(String(widget.embedHeight || 420));
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setName(widget.name);
    setDescription(widget.description);
    setUiBrief(widget.uiBrief);
    setFields(widget.fields);
    setEmbedHeight(String(widget.embedHeight || 420));
  }, [widget.id, widget.name, widget.description, widget.uiBrief, widget.fields, widget.embedHeight]);

  const persistMeta = (next: Partial<MarketplaceWidget>) => {
    onPatch({
      name,
      description,
      uiBrief,
      fields,
      embedHeight: Number(embedHeight) || 420,
      ...next,
    });
  };

  const boundModule = widget.query?.moduleId ? findModule(workspace, widget.query.moduleId) : undefined;

  const previewSrc = useMemo(() => {
    const cols = columnsFromQuery(boundModule, widget.query, fields);
    const html =
      widget.html ||
      (widget.query
        ? defaultQueryWidgetBody({ name }, widget.query, cols)
        : defaultWidgetBody({ name, fields }));
    const draftWidget = { ...widget, name, fields, html };
    const live = runWidgetQuery(workspace, draftWidget);
    return compileWidgetDocument(draftWidget, {
      data: { ...sampleData(fields), ...live.data },
      rows: live.rows,
    });
  }, [widget, name, fields, workspace, boundModule]);

  const snippet = embedSnippet(origin || "https://your-sirrus-host", { ...widget, name, embedHeight: Number(embedHeight) || 420 });

  const runAgent = async (userText: string) => {
    const nextMessages: AgentChatMessage[] = [...messages, { role: "user", content: userText }];
    setMessages(nextMessages);
    setDraft("");
    setBusy(true);
    setError(null);
    persistMeta({});
    try {
      const res = await fetch("/api/widget-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          name,
          description,
          uiBrief,
          fields,
          currentHtml: widget.html,
          workspace,
        }),
      });
      const json = (await res.json()) as {
        assistantMessage?: string;
        html?: string | null;
        fields?: Array<{ key: string; label: string; type?: string; options?: string[] }>;
        query?: MarketplaceWidgetQuery | null;
        name?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || `Agent failed (${res.status})`);
      if (json.assistantMessage) {
        setMessages((prev) => [...prev, { role: "assistant", content: json.assistantMessage ?? "" }]);
      }
      const nextFields =
        json.fields?.length
          ? json.fields.map((f, i) => ({
              id: newCrmId("wf"),
              key: f.key || fieldKey(f.label || `field_${i + 1}`),
              label: f.label || f.key,
              type: toFieldType(f.type || "text"),
              options: f.options,
            }))
          : fields;
      if (json.fields?.length) setFields(nextFields);
      if (json.html || json.query || json.fields?.length) {
        onPatch({
          name: json.name?.trim() || name,
          description,
          uiBrief,
          fields: nextFields,
          embedHeight: Number(embedHeight) || 420,
          html: json.html ?? widget.html,
          query: json.query === undefined ? widget.query : json.query ?? undefined,
        });
      }
      if (json.name?.trim()) setName(json.name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Agent failed.");
    } finally {
      setBusy(false);
    }
  };

  const generate = () => {
    const brief =
      uiBrief.trim() ||
      "Look up the matching module and listing, query live records, and design the iframe from that data.";
    void runAgent(
      `${brief}\nWidget name: ${name}.\nDeclared fields (optional host hooks): ${fields.map((f) => `${f.key} (${f.type})`).join(", ") || "none — discover from the workspace"}.`,
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DeveloperPageHeader
        backHref="/crm/widgets"
        backAriaLabel="Back to widgets"
        title={name || "Untitled widget"}
        description={
          boundModule
            ? `${widget.published ? "Live" : "Draft"} · bound to ${boundModule.pluralLabel}${widget.query?.groupBy ? ` · ${widget.query.operation} by ${widget.query.groupBy}` : ` · ${widget.query?.operation ?? "query"}`}`
            : widget.published
              ? `Live iframe · v${widget.version}`
              : `Draft · v${widget.version} · agent can query every module`
        }
        actions={
          <>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink"
            >
              <IconTrash className="size-3.5" />
              Delete
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={generate}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              <IconSparkle className="size-3.5" />
              {busy ? "Designing…" : widget.html ? "Redesign" : "Design with AI"}
            </button>
            <button
              type="button"
              onClick={() => persistMeta({ published: !widget.published })}
              className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                widget.published ? "bg-ink text-white" : "border border-border-soft bg-white text-ink"
              }`}
            >
              {widget.published ? "Unpublish" : "Publish iframe"}
            </button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)_300px]">
        <aside className="min-h-0 overflow-y-auto border-b border-border-soft bg-surface p-4 lg:border-b-0 lg:border-r">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => persistMeta({})}
            className="mt-1 w-full rounded-lg border border-border-soft bg-white px-2.5 py-1.5 text-sm text-ink"
          />
          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-muted">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => persistMeta({})}
            rows={2}
            className="mt-1 w-full resize-none rounded-lg border border-border-soft bg-white px-2.5 py-1.5 text-sm text-ink"
          />
          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-muted">UI brief</label>
          <textarea
            value={uiBrief}
            onChange={(e) => setUiBrief(e.target.value)}
            onBlur={() => persistMeta({})}
            rows={4}
            placeholder="e.g. Enquiries assigned to each counsellor"
            className="mt-1 w-full resize-none rounded-lg border border-border-soft bg-white px-2.5 py-1.5 text-sm text-ink"
          />
          <ModuleSourcePanel
            workspace={workspace}
            widget={widget}
            fields={fields}
            name={name}
            onBind={(next) => {
              if (next.fields) setFields(next.fields);
              persistMeta(next);
            }}
          />
          <div className="mt-4 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Host fields</h3>
            <button
              type="button"
              onClick={() => {
                const next = [
                  ...fields,
                  { id: newCrmId("wf"), key: fieldKey(`field_${fields.length + 1}`), label: "New field", type: "text" as const },
                ];
                setFields(next);
                onPatch({ fields: next });
              }}
              className="text-[11px] font-semibold text-accent"
            >
              Add field
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted">Optional extras for marketplace hosts (query params / postMessage).</p>
          <div className="mt-2 space-y-2">
            {fields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                onChange={(next) => {
                  const list = fields.map((f) => (f.id === field.id ? next : f));
                  setFields(list);
                }}
                onCommit={(next) => {
                  const list = fields.map((f) => (f.id === field.id ? next : f));
                  setFields(list);
                  onPatch({ fields: list });
                }}
                onRemove={() => {
                  const list = fields.filter((f) => f.id !== field.id);
                  setFields(list);
                  onPatch({ fields: list });
                }}
              />
            ))}
          </div>
        </aside>

        <section className="min-h-0 overflow-hidden bg-[#eef0f5] p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Iframe preview</p>
            <p className="text-[11px] text-muted">
              {boundModule ? `Live ${boundModule.pluralLabel} data` : "Sample data until a module is bound"}
            </p>
          </div>
          <div className="h-[calc(100%-22px)] overflow-hidden rounded-2xl border border-dashed border-[#c9ceda] bg-white">
            <iframe title="Widget preview" className="h-full w-full border-0 bg-transparent" srcDoc={previewSrc} sandbox="allow-scripts" />
          </div>
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden border-t border-border-soft bg-surface lg:border-l lg:border-t-0">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Widget agent</h3>
            <p className="mt-1 text-[11px] leading-snug text-muted">
              Ask in plain language. The agent inspects modules and listings, then queries records before it writes HTML.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  disabled={busy}
                  onClick={() => void runAgent(ex)}
                  className="rounded-full border border-border-soft bg-white px-2.5 py-1 text-[10px] text-muted hover:border-accent/30 hover:text-ink disabled:opacity-40"
                >
                  {ex}
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {messages.length === 0 ? (
                <p className="rounded-xl bg-[#f4f5f8] px-3 py-2 text-[12px] text-muted">
                  Try “enquiries assigned to each counsellor”. The agent will find Enquiries, the Counsellor field, and aggregate the listing.
                </p>
              ) : (
                messages.map((m, i) => (
                  <div
                    key={`${m.role}-${i}`}
                    className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                      m.role === "user" ? "bg-accent/10 text-ink" : "bg-[#f4f5f8] text-ink"
                    }`}
                  >
                    {m.content}
                  </div>
                ))
              )}
            </div>
            {error ? <p className="mt-2 text-[12px] text-red-600">{error}</p> : null}
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const text = draft.trim();
                if (!text || busy) return;
                void runAgent(text);
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Enquiries assigned to each counsellor…"
                className="min-w-0 flex-1 rounded-lg border border-border-soft bg-white px-2.5 py-1.5 text-sm"
              />
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                className="rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                Send
              </button>
            </form>
          </div>
          <div className="border-t border-border-soft p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Host on a marketplace</h3>
              <label className="flex items-center gap-1 text-[11px] text-muted">
                Height
                <input
                  value={embedHeight}
                  onChange={(e) => setEmbedHeight(e.target.value)}
                  onBlur={() => persistMeta({})}
                  className="w-14 rounded border border-border-soft px-1.5 py-0.5 text-[11px] text-ink"
                />
              </label>
            </div>
            {widget.published ? (
              <>
                <p className="mt-1 break-all font-mono text-[10px] text-muted">
                  {origin}/embed/w/{widget.id}
                </p>
                <pre className="mt-2 max-h-36 overflow-auto rounded-lg bg-[#111827] p-2 text-[10px] leading-relaxed text-[#e5e7eb]">
                  {snippet}
                </pre>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(snippet);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="mt-2 text-[11px] font-semibold text-accent"
                >
                  {copied ? "Copied" : "Copy iframe snippet"}
                </button>
              </>
            ) : (
              <p className="mt-2 text-[12px] text-muted">Publish to get a live embed URL other sites can iframe.</p>
            )}
          </div>
        </aside>
      </div>
      <button type="button" className="sr-only" onClick={onBack} aria-hidden>
        Back
      </button>
    </div>
  );
}

function ModuleSourcePanel({
  workspace,
  widget,
  fields,
  name,
  onBind,
}: {
  workspace: CrmWorkspace;
  widget: MarketplaceWidget;
  fields: MarketplaceWidgetField[];
  name: string;
  onBind: (next: Partial<MarketplaceWidget>) => void;
}) {
  const moduleId = widget.query?.moduleId ?? "";
  const mod = moduleId ? findModule(workspace, moduleId) : undefined;
  const operation = widget.query?.operation ?? "list";
  const groupBy = widget.query?.groupBy ?? mod?.stageFieldApiKey ?? "owner";
  const listing = mod ? listingFields(mod) : [];
  const selectedKeys = new Set(widget.query?.listFieldKeys ?? listing.map((f) => f.apiKey));

  const apply = (patch: {
    moduleId?: string;
    operation?: MarketplaceWidgetQuery["operation"];
    groupBy?: string;
    listFieldKeys?: string[];
    layout?: boolean;
  }) => {
    const nextMod = findModule(workspace, patch.moduleId ?? moduleId);
    if (!nextMod) {
      onBind({ query: undefined });
      return;
    }
    const nextOp = patch.operation ?? operation;
    const nextGroup = patch.groupBy ?? groupBy;
    const nextKeys = patch.listFieldKeys ?? [...selectedKeys];
    const defs =
      nextOp === "aggregate"
        ? nextMod.fields.filter((f) => f.apiKey === nextGroup)
        : nextMod.fields.filter((f) => nextKeys.includes(f.apiKey));
    const nextFields = defs.length ? widgetFieldsFromCrm(defs) : fields;
    const query: MarketplaceWidgetQuery = {
      moduleId: nextMod.id,
      operation: nextOp,
      groupBy: nextOp === "aggregate" ? nextGroup : undefined,
      listFieldKeys: nextOp === "list" ? nextKeys : undefined,
      limit: 50,
    };
    const cols = columnsFromQuery(nextMod, query, nextFields);
    onBind({
      fields: nextFields,
      query,
      html: patch.layout || !widget.html ? defaultQueryWidgetBody({ name }, query, cols) : widget.html,
    });
  };

  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Module & listing</h3>
      <select
        value={moduleId}
        onChange={(e) => {
          const next = findModule(workspace, e.target.value);
          const keys = next ? listingFields(next).map((f) => f.apiKey) : [];
          apply({ moduleId: e.target.value, listFieldKeys: keys, layout: true });
        }}
        className="w-full rounded-lg border border-border-soft bg-white px-2.5 py-1.5 text-sm"
      >
        <option value="">Select a module</option>
        {workspace.modules.map((m) => (
          <option key={m.id} value={m.id}>
            {m.pluralLabel} ({m.records.length})
          </option>
        ))}
      </select>

      {mod ? (
        <>
          <p className="text-[11px] leading-snug text-muted">
            {mod.fields.length} fields · listing {listing.map((f) => f.label).join(", ") || "none"} ·{" "}
            {mod.blueprint.stages.length} stages
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {(["list", "aggregate", "count"] as const).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => apply({ operation: op, layout: true })}
                className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold ${
                  operation === op ? "bg-accent text-white" : "border border-border-soft bg-white text-muted"
                }`}
              >
                {op === "list" ? "Listing" : op === "aggregate" ? "Group by" : "Count"}
              </button>
            ))}
          </div>
          {operation === "aggregate" ? (
            <select
              value={groupBy}
              onChange={(e) => apply({ groupBy: e.target.value, layout: true })}
              className="w-full rounded-lg border border-border-soft bg-white px-2.5 py-1.5 text-sm"
            >
              {mod.fields.map((f) => (
                <option key={f.id} value={f.apiKey}>
                  {f.label}
                </option>
              ))}
            </select>
          ) : null}

          {operation === "list" ? (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Listing columns</p>
                <button
                  type="button"
                  onClick={() => apply({ listFieldKeys: listing.map((f) => f.apiKey), layout: true })}
                  className="text-[11px] font-semibold text-accent"
                >
                  Use module listing
                </button>
              </div>
              <div className="space-y-1">
                {listing.map((f) => (
                  <label key={f.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-[12px]">
                    <span className="text-ink">
                      {f.label} <span className="font-mono text-[10px] text-muted">{f.apiKey}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(f.apiKey)}
                      onChange={() => {
                        const next = selectedKeys.has(f.apiKey)
                          ? [...selectedKeys].filter((k) => k !== f.apiKey)
                          : [...selectedKeys, f.apiKey];
                        apply({ listFieldKeys: next, layout: !widget.html });
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">All fields</p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border-soft bg-white p-1.5">
              {mod.fields.map((f) => {
                const on = selectedKeys.has(f.apiKey) || (operation === "aggregate" && f.apiKey === groupBy);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      if (operation === "aggregate") {
                        apply({ groupBy: f.apiKey, layout: true });
                        return;
                      }
                      const next = selectedKeys.has(f.apiKey)
                        ? [...selectedKeys].filter((k) => k !== f.apiKey)
                        : [...selectedKeys, f.apiKey];
                      apply({ listFieldKeys: next, layout: !widget.html });
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-[12px] ${
                      on ? "bg-accent/10 text-ink" : "text-muted hover:bg-[#f4f5f8]"
                    }`}
                  >
                    <span>
                      {f.label}
                      <span className="ml-1 font-mono text-[10px]">{f.apiKey}</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-wide">{f.dataType.replace("_", " ")}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => apply({ layout: true })}
            className="w-full rounded-lg border border-border-soft bg-white py-1.5 text-[12px] font-semibold text-ink"
          >
            Apply listing layout
          </button>
        </>
      ) : (
        <p className="text-[11px] leading-snug text-muted">
          Pick a module to see its listing columns and fields, or ask the agent to find them.
        </p>
      )}
    </div>
  );
}

function FieldRow({
  field,
  onChange,
  onCommit,
  onRemove,
}: {
  field: MarketplaceWidgetField;
  onChange: (next: MarketplaceWidgetField) => void;
  onCommit: (next: MarketplaceWidgetField) => void;
  onRemove: () => void;
}) {
  const commitKey = (label: string, key: string) => {
    const next = { ...field, label, key: fieldKey(key || label, fieldKey(label)) };
    onCommit(next);
  };
  return (
    <div className="rounded-xl border border-border-soft bg-white p-2.5">
      <div className="flex gap-1.5">
        <input
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          onBlur={(e) => commitKey(e.target.value, field.key)}
          className="min-w-0 flex-1 rounded border border-transparent px-1.5 py-1 text-[13px] font-medium text-ink hover:border-border-soft"
        />
        <button type="button" onClick={onRemove} className="text-muted hover:text-ink" aria-label="Remove field">
          <IconTrash className="size-3.5" />
        </button>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <input
          value={field.key}
          onChange={(e) => onChange({ ...field, key: e.target.value })}
          onBlur={(e) => commitKey(field.label, e.target.value)}
          className="rounded border border-border-soft px-1.5 py-1 font-mono text-[11px] text-muted"
        />
        <select
          value={field.type}
          onChange={(e) => onCommit({ ...field, type: e.target.value as MarketplaceWidgetFieldType })}
          className="rounded border border-border-soft bg-white px-1.5 py-1 text-[11px]"
        >
          {MARKETPLACE_WIDGET_FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      {field.type === "select" ? (
        <input
          value={(field.options ?? []).join(", ")}
          onChange={(e) => onChange({ ...field, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          onBlur={(e) =>
            onCommit({ ...field, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
          }
          placeholder="Options, comma separated"
          className="mt-1.5 w-full rounded border border-border-soft px-1.5 py-1 text-[11px]"
        />
      ) : null}
    </div>
  );
}

function CreateWidgetDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}) {
  const [name, setName] = useState("Listing card");
  const [description, setDescription] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form
        className="w-full max-w-md rounded-2xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onCreate(name.trim() || "Untitled widget", description.trim());
        }}
      >
        <h2 className="text-sm font-semibold text-ink">New marketplace widget</h2>
        <p className="mt-1 text-xs text-muted">Then ask the agent to query a module listing and design the iframe.</p>
        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-muted">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border-soft px-2.5 py-1.5 text-sm"
        />
        <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-muted">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-none rounded-lg border border-border-soft px-2.5 py-1.5 text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted">
            Cancel
          </button>
          <button type="submit" className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white">
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
