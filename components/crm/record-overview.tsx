"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { PageAgentBar } from "@/components/crm/page-agent-bar";
import { moduleSlot } from "@/lib/crm/agent-slots";
import { RecordEditorModal } from "@/components/crm/record-editor-modal";
import { OverviewNodeBody } from "@/components/overview-canvas/overview-node-body";
import { PairAiSummaryStrip } from "@/components/overview-canvas/pair-ai-summary-strip";
import { IconChevronLeft, IconPencil } from "@/components/icons";
import { insightForRecord } from "@/lib/crm/ai-summary-strip";
import { dispatchCrmEvent } from "@/lib/crm/dispatch-workflows";
import { displayFieldValue, fieldById, initialsFromName, recordStageLabel, recordTitle, stagePillStyle } from "@/lib/crm/display";
import { formatDateTime, formatRelativeTime } from "@/lib/crm/format";
import { useCrm } from "@/components/crm/crm-provider";
import { findModule, updateRecord } from "@/lib/crm/ops";
import { normalizeWidgetKind, resolveOverviewCanvas, type OverviewCanvasNode } from "@/lib/crm/overview-canvas";
import type { CrmModule, CrmRecord, CrmWorkspace } from "@/lib/crm/types";

export function RecordOverview({ moduleId, recordId }: { moduleId: string; recordId: string }) {
  const { workspace, save } = useCrm();
  const mod = workspace ? findModule(workspace, moduleId) : undefined;
  const rec = mod?.records.find((r) => r.id === recordId || r.displayId === recordId);
  const canvas = useMemo(
    () => (mod ? resolveOverviewCanvas(mod.overviewLayout, mod.overviewCanvas) : null),
    [mod],
  );
  const [tab, setTab] = useState<"overview" | "activity" | string>("overview");
  const [editOpen, setEditOpen] = useState(false);

  if (!workspace || !mod || !rec || !canvas) {
    return (
      <div className="page-canvas flex flex-1 items-center justify-center text-sm text-muted">
        Record not found.{" "}
        <Link href={`/crm/modules/${moduleId}`} className="ml-1 font-medium text-accent">
          Back to list
        </Link>
      </div>
    );
  }

  const title = recordTitle(mod, rec);
  const extraTabs = canvas.tabs.filter((t) => {
    const slug = t.label.toLowerCase();
    if (slug === "overview" || slug === "lead overview") return false;
    return t.nodes.length > 0;
  });
  const activeTab = extraTabs.some((t) => t.id === tab) ? tab : tab === "activity" ? "activity" : "overview";
  const extraNodes = (canvas.tabs.find((t) => t.id === activeTab)?.nodes ?? []).filter(isExtraNode);

  const setStage = (optionId: string) => {
    if (!mod.stageFieldApiKey) return;
    const previousValues = rec.values;
    const next = updateRecord(workspace, mod.id, rec.id, { [mod.stageFieldApiKey]: optionId });
    save(next);
    const updated = findModule(next, mod.id)?.records.find((r) => r.id === rec.id);
    void dispatchCrmEvent(
      next,
      {
        type: "stage_changed",
        moduleId: mod.id,
        recordId: rec.id,
        previousValues,
        nextValues: updated?.values ?? { ...previousValues, [mod.stageFieldApiKey]: optionId },
      },
      save,
    ).catch(() => {
      /* ignore */
    });
  };

  return (
    <div className="page-canvas flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-border-soft bg-surface/90 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={`/crm/modules/${mod.id}`}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-soft bg-surface text-ink hover:bg-[#f7f1e6]"
              aria-label={`Back to ${mod.pluralLabel}`}
            >
              <IconChevronLeft className="size-4" />
            </Link>
            <span className="avatar size-11 text-[13px]">{initialsFromName(title)}</span>
            <div className="min-w-0">
              <h1 className="display truncate text-[28px] text-ink">{title}</h1>
              <p className="mt-0.5 text-[12px] text-muted">
                {rec.displayId}
                <span className="mx-1.5 text-border-soft">·</span>
                {mod.label}
                <span className="mx-1.5 text-border-soft">·</span>
                Updated {formatRelativeTime(rec.updatedAt)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mod.stageFieldApiKey ? <StageSelect module={mod} record={rec} onStage={setStage} /> : null}
            <PageAgentBar slotKey={moduleSlot(mod.id, "record")} moduleLabel={mod.label} compact />
            <button type="button" onClick={() => setEditOpen(true)} className="btn-primary">
              <IconPencil className="size-3.5" />
              Edit
            </button>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto px-4 sm:px-6">
          <TabBtn active={activeTab === "overview"} onClick={() => setTab("overview")}>
            Overview
          </TabBtn>
          <TabBtn active={activeTab === "activity"} onClick={() => setTab("activity")}>
            Activity
          </TabBtn>
          {extraTabs.map((t) => (
            <TabBtn key={t.id} active={activeTab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </TabBtn>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-start">
          {activeTab === "overview" ? (
            <>
              <aside className="w-full shrink-0 lg:w-[280px]">
                <DetailsCard module={mod} record={rec} />
              </aside>
              <div className="min-w-0 flex-1 space-y-4">
                <section className="card p-3 sm:p-4">
                  <PairAiSummaryStrip insight={insightForRecord(mod, rec)} sections="scores" />
                </section>
                <section className="card p-2 sm:p-3">
                  <PairAiSummaryStrip insight={insightForRecord(mod, rec)} sections="summary" />
                </section>
                <InformationCard module={mod} record={rec} />
                <ExtraWidgetStack
                  nodes={canvas.tabs[0]?.nodes.filter(isExtraNode) ?? []}
                  module={mod}
                  record={rec}
                  workspace={workspace}
                  onStage={setStage}
                />
              </div>
            </>
          ) : null}

          {activeTab === "activity" ? (
            <ActivityPane module={mod} record={rec} />
          ) : null}

          {activeTab !== "overview" && activeTab !== "activity" ? (
            <div className="min-w-0 flex-1 space-y-4">
              {extraNodes.length === 0 ? (
                <EmptyTab label={extraTabs.find((t) => t.id === activeTab)?.label ?? "This tab"} />
              ) : (
                <ExtraWidgetStack nodes={extraNodes} module={mod} record={rec} workspace={workspace} onStage={setStage} />
              )}
            </div>
          ) : null}
        </div>
      </div>

      {editOpen ? (
        <RecordEditorModal workspace={workspace} module={mod} record={rec} onClose={() => setEditOpen(false)} onSave={save} />
      ) : null}
    </div>
  );
}

function isExtraNode(n: OverviewCanvasNode): boolean {
  if (n.type === "custom" || n.type === "section") return true;
  if (n.type !== "widget") return false;
  const kind = normalizeWidgetKind(n.kind);
  return kind !== "pair" && kind !== "ai-summary" && kind !== "lead-details";
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-medium ${
        active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function StageSelect({
  module: mod,
  record: rec,
  onStage,
}: {
  module: CrmModule;
  record: CrmRecord;
  onStage: (optionId: string) => void;
}) {
  const stageField = mod.stageFieldApiKey ? mod.fields.find((f) => f.apiKey === mod.stageFieldApiKey) : undefined;
  const current = stageField ? rec.values[stageField.apiKey] : "";
  const label = recordStageLabel(mod, rec);
  const pill = stagePillStyle(label);
  return (
    <label className="relative inline-flex items-center">
      <span className="inline-flex min-w-[8rem] items-center justify-center rounded-lg border px-3 py-1.5 text-[12px] font-semibold" style={{ ...pill, borderColor: "transparent" }}>
        {label || "Set stage"}
      </span>
      <select
        aria-label="Change stage"
        value={current}
        onChange={(e) => {
          if (e.target.value) onStage(e.target.value);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {stageField?.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetailsCard({ module: mod, record: rec }: { module: CrmModule; record: CrmRecord }) {
  const title = recordTitle(mod, rec);
  const stage = recordStageLabel(mod, rec);
  const skip = new Set([mod.nameFieldApiKey, mod.stageFieldApiKey].filter(Boolean) as string[]);
  const sectionIds = mod.formLayout.sections[0]?.fieldIds ?? [];
  const ids = (sectionIds.length ? sectionIds : mod.fields.map((f) => f.id)).slice(0, 10);
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <span className="avatar size-12 text-[13px]">{initialsFromName(title)}</span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-ink">{title}</p>
          <p className="mt-0.5 text-[12px] tabular-nums text-muted">{rec.displayId}</p>
          {stage ? (
            <span className="mt-2 inline-flex rounded-md px-2.5 py-1 text-[12px] font-semibold" style={stagePillStyle(stage)}>
              {stage}
            </span>
          ) : null}
        </div>
      </div>
      <dl className="mt-4 space-y-3 border-t border-border-soft pt-3">
        {ids.map((id) => {
          const f = fieldById(mod, id);
          if (!f || skip.has(f.apiKey)) return null;
          const raw = rec.values[f.apiKey] ?? "";
          const value = displayFieldValue(f, raw);
          return (
            <div key={id}>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{f.label}</dt>
              <dd className="mt-0.5 break-words text-[13px] text-ink">
                <FieldLink fieldType={f.dataType} raw={raw} display={value} />
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function InformationCard({ module: mod, record: rec }: { module: CrmModule; record: CrmRecord }) {
  const skip = new Set([mod.nameFieldApiKey, mod.stageFieldApiKey].filter(Boolean) as string[]);
  const sections = mod.formLayout.sections.length
    ? mod.formLayout.sections
    : [{ id: "all", title: "Information", fieldIds: mod.fields.map((f) => f.id) }];
  return (
    <section className="card p-5">
      <h2 className="mb-4 font-display text-xl text-ink">Information</h2>
      <div className="space-y-5">
        {sections.map((sec) => {
          const fields = sec.fieldIds.map((id) => fieldById(mod, id)).filter((f): f is NonNullable<typeof f> => !!f && !skip.has(f.apiKey));
          if (!fields.length) return null;
          return (
            <div key={sec.id}>
              {sections.length > 1 ? <h3 className="mb-2 text-[12px] font-semibold text-muted">{sec.title}</h3> : null}
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {fields.map((f) => (
                  <div key={f.id} className={f.dataType === "paragraph" ? "sm:col-span-2" : ""}>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{f.label}</dt>
                    <dd className="mt-0.5 break-words text-[13px] text-ink">
                      <FieldLink fieldType={f.dataType} raw={rec.values[f.apiKey] ?? ""} display={displayFieldValue(f, rec.values[f.apiKey])} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FieldLink({ fieldType, raw, display }: { fieldType: string; raw: string; display: string }) {
  if (!raw || display === "—") return <>{display}</>;
  if (fieldType === "email") {
    return (
      <a href={`mailto:${raw}`} className="text-accent hover:underline">
        {display}
      </a>
    );
  }
  if (fieldType === "phone") {
    return (
      <a href={`tel:${raw}`} className="text-accent hover:underline">
        {display}
      </a>
    );
  }
  if (fieldType === "url") {
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    return (
      <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline">
        {display}
      </a>
    );
  }
  return <>{display}</>;
}

function ExtraWidgetStack({
  nodes,
  module: mod,
  record,
  workspace,
  onStage,
}: {
  nodes: OverviewCanvasNode[];
  module: CrmModule;
  record: CrmRecord;
  workspace: CrmWorkspace;
  onStage?: (optionId: string) => void;
}) {
  if (!nodes.length) return null;
  return (
    <div className="space-y-4">
      {nodes.map((n) => (
        <section key={n.id} className="card overflow-hidden">
          {n.title || n.label ? (
            <div className="border-b border-border-soft px-4 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">{n.title || n.label}</h2>
            </div>
          ) : null}
          <div className="min-h-[8rem] p-2">
            <OverviewNodeBody node={n} module={mod} record={record} workspace={workspace} onStage={onStage} />
          </div>
        </section>
      ))}
    </div>
  );
}

function ActivityPane({ module: mod, record: rec }: { module: CrmModule; record: CrmRecord }) {
  return (
    <section className="card w-full p-5">
      <h2 className="font-display text-xl text-ink">Activity</h2>
      <ol className="relative mt-4 space-y-4 border-l border-border-soft pl-4">
        <li>
          <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-accent" />
          <p className="text-[13px] font-medium text-ink">Updated</p>
          <p className="text-[12px] text-muted">{formatDateTime(rec.updatedAt)}</p>
        </li>
        <li>
          <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-gold" />
          <p className="text-[13px] font-medium text-ink">{mod.label} created</p>
          <p className="text-[12px] text-muted">{formatDateTime(rec.createdAt)}</p>
        </li>
      </ol>
    </section>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="card flex min-h-[16rem] w-full flex-col items-center justify-center border-dashed px-6 text-center">
      <p className="text-sm font-medium text-ink">Nothing on {label} yet</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted">Add widgets for this tab in Settings → Modules → Overview layout.</p>
    </div>
  );
}
