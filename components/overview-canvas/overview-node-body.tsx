"use client";

import type { ReactNode } from "react";
import { PairAiSummaryStrip } from "@/components/overview-canvas/pair-ai-summary-strip";
import { IconCalendar, IconPhone, IconStar, IconUser } from "@/components/icons";
import { DEMO_AI_SUMMARY_INSIGHT, insightForRecord } from "@/lib/crm/ai-summary-strip";
import { displayFieldValue, fieldById, initialsFromName, recordStageLabel, recordTitle, stagePillStyle } from "@/lib/crm/display";
import type { CustomWidgetSpec, OverviewCanvasNode } from "@/lib/crm/overview-canvas";
import { normalizeWidgetKind } from "@/lib/crm/overview-canvas";
import { fieldCells, rowsForCustomWidget } from "@/lib/crm/overview-widgets";
import type { CrmModule, CrmRecord, CrmWorkspace } from "@/lib/crm/types";

const card =
  "rounded-xl border border-slate-200/50 bg-white p-2 shadow-[0_2px_12px_-6px_rgba(31,23,80,0.06)] sm:p-2.5";

export function OverviewNodeBody({
  node,
  module: mod,
  record: rec,
  workspace,
  onStage,
  demoInsight = false,
}: {
  node: OverviewCanvasNode;
  module: CrmModule;
  record: CrmRecord | null;
  workspace?: CrmWorkspace | null;
  onStage?: (optionId: string) => void;
  /** Builder preview uses the original sample AI copy. */
  demoInsight?: boolean;
}) {
  if (node.type === "field") {
    const field = node.fieldId ? fieldById(mod, node.fieldId) : undefined;
    const value = field && rec ? displayFieldValue(field, rec.values[field.apiKey]) : "—";
    return <StyledFieldRow label={field?.label ?? "Field"} value={value} node={node} />;
  }

  if (node.type === "text") {
    const ts = node.textStyle;
    const content = ts?.content ?? node.content ?? node.label ?? "Text";
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-start overflow-hidden px-2 py-1">
        <div
          className="min-h-0 w-full flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 leading-snug shadow-[inset_0_1px_0_rgba(15,23,42,0.03)]"
          style={{
            fontSize: ts?.fontSizePx ? `${ts.fontSizePx}px` : 13,
            color: ts?.color ?? "#334155",
            backgroundColor: ts?.backgroundColor ?? "#ffffff",
            fontFamily: ts?.fontFamily,
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  if (node.type === "line") {
    const ls = node.lineStyle;
    const horiz = (ls?.orientation ?? "horizontal") === "horizontal";
    const thick = ls?.thicknessPx ?? 2;
    const color = ls?.color ?? "rgba(100,116,139,0.5)";
    if (horiz) {
      return (
        <div className="flex min-h-0 flex-1 items-center justify-center px-2">
          <div className="w-full self-center rounded-full" style={{ height: thick, backgroundColor: color }} />
        </div>
      );
    }
    return (
      <div className="flex min-h-0 flex-1 items-stretch justify-center py-2">
        <div className="h-full min-w-[2px] rounded-full" style={{ width: thick, backgroundColor: color }} />
      </div>
    );
  }

  if (node.type === "icon") {
    const ic = node.iconStyle;
    return (
      <div
        className="flex min-h-0 flex-1 items-center justify-center rounded-md border border-slate-200/90 bg-white p-0.5"
        style={{ backgroundColor: ic?.backgroundColor ?? "#ffffff" }}
      >
        <span className="flex h-7 w-7 items-center justify-center" style={{ color: ic?.iconColor ?? "#475569" }}>
          <IconGlyph glyph={ic?.glyph} />
        </span>
      </div>
    );
  }

  if (node.type === "section") {
    const ids = node.fieldIds ?? [];
    const s = node.style;
    return (
      <div
        className="flex h-full min-h-0 flex-col overflow-auto"
        style={{
          backgroundColor: s?.backgroundColor ?? "#f8fafc",
          borderWidth: s?.borderWidthPx != null ? s.borderWidthPx : 1,
          borderStyle: "solid",
          borderColor: s?.borderColor ?? "#e2e8f0",
          borderRadius: s?.borderRadiusPx != null ? s.borderRadiusPx : 6,
          padding: s?.paddingPx != null ? s.paddingPx : 6,
        }}
      >
        {node.label ? (
          <span className="mb-0.5 shrink-0 text-[11px] font-medium text-[#64748b]">{node.label}</span>
        ) : null}
        {ids.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[10px] leading-snug text-[#94a3b8]">
            Drop fields from Fields configurator into this section.
          </p>
        ) : (
          <FieldGrid module={mod} record={rec} fieldIds={ids} />
        )}
      </div>
    );
  }

  if (node.type === "custom") {
    return (
      <CustomWidgetBody
        title={node.title || "Widget"}
        spec={node.spec}
        module={mod}
        record={rec}
        workspace={workspace}
        hideTitle
      />
    );
  }

  const kind = normalizeWidgetKind(node.kind);
  const insight = demoInsight ? DEMO_AI_SUMMARY_INSIGHT : insightForRecord(mod, rec);

  if (kind === "pair") {
    return (
      <div className="min-h-0 min-w-0 w-full max-w-full flex-1 overflow-auto p-1.5 [scrollbar-width:thin]">
        <PairAiSummaryStrip insight={insight} sections="scores" />
      </div>
    );
  }

  if (kind === "ai-summary") {
    return (
      <div className="min-h-0 min-w-0 w-full max-w-full flex-1 overflow-auto p-1.5 [scrollbar-width:thin]">
        <PairAiSummaryStrip insight={insight} sections="summary" />
      </div>
    );
  }

  if (kind === "change-stage") {
    const stageField = mod.stageFieldApiKey ? mod.fields.find((f) => f.apiKey === mod.stageFieldApiKey) : undefined;
    const current = rec && stageField ? rec.values[stageField.apiKey] : "";
    const currentLabel = rec ? recordStageLabel(mod, rec) || "—" : "—";
    return (
      <div className="mx-1 mb-1 mt-0.5 flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-auto p-1.5 [scrollbar-width:thin]">
        <p className="text-[10px] leading-relaxed text-[#8b87a8]">
          Current: <span className="font-semibold text-[#5c5878]">{currentLabel}</span>
          {onStage ? <span className="block pt-0.5">Tap a stage to preview (blueprint-style).</span> : null}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {mod.blueprint.stages.map((s) => {
            const opt = stageField?.options.find((o) => o.label === s.label);
            const active = opt ? current === opt.id : false;
            return (
              <button
                key={s.id}
                type="button"
                disabled={!opt || !onStage}
                onClick={() => opt && onStage?.(opt.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  active ? "bg-[#0f6b5c] text-white" : "bg-[#f4efe6] text-[#0f6b5c]"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (kind === "lead-details") {
    const ids = node.fieldIds?.length ? node.fieldIds : mod.fields.map((f) => f.id);
    const name = rec ? recordTitle(mod, rec) : mod.label;
    const stage = rec ? recordStageLabel(mod, rec) : "";
    const pill = stage ? stagePillStyle(stage) : null;
    return (
      <div className="relative flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden rounded-b-[10px] bg-[#e8ebf4]">
        <div className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-y-contain [scrollbar-width:thin]">
          <div className="bg-gradient-to-b from-[#f8f9fd] via-[#f4f5fa] to-[#eceef6] px-3 pt-4 pb-3">
            <div className="rounded-2xl border border-slate-200/40 bg-white/95 p-4 shadow-[0_2px_16px_-6px_rgba(31,23,80,0.08)]">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f4efe6] text-[11px] font-semibold text-[#0f6b5c]">
                  {initialsFromName(name)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="min-w-0 text-[17px] leading-tight font-semibold tracking-tight text-[#16140f]">
                    {name}
                  </h2>
                  <p className="mt-1 text-xs tabular-nums tracking-wide text-[#8b87a8]">{rec?.displayId ?? "—"}</p>
                  {pill && stage ? (
                    <div className="mt-3">
                      <span
                        className="inline-flex min-w-0 max-w-full items-center justify-center rounded-md border px-3 py-1.5 text-sm font-semibold"
                        style={{ ...pill, borderColor: "#d5efe6" }}
                      >
                        {stage}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <dl className="mt-3 space-y-2">
              {ids.map((id) => {
                const f = fieldById(mod, id);
                if (!f) return null;
                const v = rec ? displayFieldValue(f, rec.values[f.apiKey]) : "—";
                return (
                  <div key={id} className="min-w-0">
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-[#8b87a8]">{f.label}</dt>
                    <dd className="mt-0.5 truncate rounded-md border border-slate-200/80 bg-white px-2.5 py-1.5 text-[13px] text-[#16140f]">
                      {v}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "timeline") {
    const lines = rec
      ? [`${new Date(rec.createdAt).toLocaleString()} · Created`, `${new Date(rec.updatedAt).toLocaleString()} · Updated`]
      : [];
    return (
      <WidgetCard title="Timeline">
        {lines.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#8b87a8]">No journey events.</p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
            {lines.map((line) => (
              <li
                key={line}
                className="rounded-lg border border-slate-100/90 bg-white px-2 py-1.5 text-[11px] leading-snug text-[#16140f]"
              >
                {line}
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>
    );
  }

  if (kind === "lead-status-history") {
    return (
      <div className="mx-1 mb-1 mt-0.5 min-h-0 min-w-0 w-full max-w-full flex-1 overflow-auto rounded-b-[10px] px-0.5 [scrollbar-width:thin]">
        <div className={`${card} flex min-h-0 flex-1 flex-col`}>
          <h3 className="mb-1.5 shrink-0 border-b border-slate-100 pb-1 text-[11px] font-semibold text-[#16140f]">
            Status history
          </h3>
          <ol className="relative space-y-3 border-l border-slate-100 pl-3">
            <li>
              <p className="text-[12px] font-medium text-[#16140f]">Created</p>
              <p className="text-[11px] text-[#8b87a8]">{rec ? new Date(rec.createdAt).toLocaleString() : "—"}</p>
            </li>
            <li>
              <p className="text-[12px] font-medium text-[#16140f]">Updated</p>
              <p className="text-[11px] text-[#8b87a8]">{rec ? new Date(rec.updatedAt).toLocaleString() : "—"}</p>
            </li>
          </ol>
        </div>
      </div>
    );
  }

  if (kind === "open-tasks") {
    return (
      <WidgetCard title="All tasks" count={0}>
        <p className="py-6 text-center text-xs text-[#8b87a8]">No tasks yet.</p>
      </WidgetCard>
    );
  }

  if (kind === "calls") {
    return (
      <WidgetCard title="Calls" count={0}>
        <p className="py-6 text-center text-xs text-[#8b87a8]">No calls in journey sample.</p>
      </WidgetCard>
    );
  }

  if (kind === "notes") {
    return (
      <WidgetCard title="Remarks" count={0}>
        <p className="py-6 text-center text-xs text-[#8b87a8]">No remarks yet.</p>
      </WidgetCard>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-2 text-center text-[10px] text-[#a8a4b8]">
      Unknown widget type.
    </div>
  );
}

function WidgetCard({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <div className={`${card} mx-1 mb-1 mt-0.5 flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col`}>
      <h3 className="mb-1.5 shrink-0 border-b border-slate-100 pb-1 text-[11px] font-semibold text-[#16140f]">
        {title}
        {count != null ? <span className="font-normal text-[#8b87a8]"> ({count})</span> : null}
      </h3>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-0.5 [scrollbar-width:thin]">{children}</div>
    </div>
  );
}

function textTransformClass(t?: string) {
  if (t === "uppercase") return "uppercase";
  if (t === "lowercase") return "lowercase";
  return "normal-case";
}

function alignClass(a?: string) {
  if (a === "end") return "text-end";
  if (a === "center") return "text-center";
  return "text-start";
}

function StyledFieldRow({ label, value, node }: { label: string; value: string; node: OverviewCanvasNode }) {
  const ls = node.labelStyle;
  const vs = node.valueStyle;
  const labelSize = ls?.fontSizePx ?? 11;
  const valueSize = vs?.fontSizePx ?? 13;
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-start gap-1 overflow-hidden px-2 py-1">
      <div
        className={`shrink-0 font-medium leading-none ${textTransformClass(ls?.textTransform)}`}
        style={{
          fontSize: `${labelSize}px`,
          fontFamily: ls?.fontFamily,
          color: ls?.color ?? "#64748b",
          backgroundColor: ls?.backgroundColor ?? "transparent",
        }}
      >
        {label}
      </div>
      <div
        className={`min-h-0 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(15,23,42,0.03)] ${textTransformClass(vs?.textTransform)} ${alignClass(vs?.align)}`}
        style={{
          fontSize: `${valueSize}px`,
          fontFamily: vs?.fontFamily,
          color: vs?.color ?? "#0f172a",
          backgroundColor: vs?.backgroundColor ?? "#ffffff",
        }}
      >
        <span className="line-clamp-3 break-words font-normal leading-snug">{value}</span>
      </div>
    </div>
  );
}

function IconGlyph({ glyph }: { glyph?: string }) {
  const cls = "h-4 w-4";
  if (glyph === "phone") return <IconPhone className={cls} aria-hidden />;
  if (glyph === "calendar") return <IconCalendar className={cls} aria-hidden />;
  if (glyph === "user") return <IconUser className={cls} aria-hidden />;
  return <IconStar className={cls} aria-hidden />;
}

function FieldGrid({ module: mod, record: rec, fieldIds }: { module: CrmModule; record: CrmRecord | null; fieldIds: string[] }) {
  const cells = fieldCells(mod, rec?.values ?? {}, fieldIds);
  return (
    <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
      {cells.map((c) => (
        <div key={c.id} className="min-w-0">
          <dt className="text-[10px] uppercase tracking-wide text-[#8b87a8]">{c.label}</dt>
          <dd className="mt-0.5 truncate rounded-md border border-slate-200/80 bg-white px-2 py-1 text-[13px] text-[#16140f]">
            {c.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CustomWidgetBody({
  title,
  spec,
  module: mod,
  record: rec,
  workspace,
  hideTitle,
}: {
  title: string;
  spec?: CustomWidgetSpec;
  module: CrmModule;
  record: CrmRecord | null;
  workspace?: CrmWorkspace | null;
  hideTitle?: boolean;
}) {
  const sourceMod =
    spec?.sourceModuleId && workspace
      ? workspace.modules.find((m) => m.id === spec.sourceModuleId) ?? mod
      : mod;
  const rows = rowsForCustomWidget(workspace, mod, rec, spec);
  const fieldIds = spec?.fieldIds ?? [];
  const display = spec?.display ?? "fields";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {hideTitle ? null : (
        <div className="shrink-0 border-b border-slate-200/80 px-3 py-2">
          <p className="text-[11px] font-semibold text-[#16140f]">{title}</p>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {fieldIds.length === 0 ? (
          <p className="text-[12px] text-[#8b87a8]">Select fields from Fields configurator to populate this widget.</p>
        ) : display === "timeline" ? (
          <TimelineRows module={sourceMod} rows={rows} spec={spec!} />
        ) : display === "table" ? (
          <TableRows module={sourceMod} rows={rows} fieldIds={fieldIds} />
        ) : display === "list" ? (
          <ul className="space-y-2">
            {rows.length === 0 ? <li className="text-[12px] text-[#8b87a8]">No rows yet.</li> : null}
            {rows.map((row) => (
              <li key={row.id} className="rounded-lg border border-slate-100/90 bg-white px-2.5 py-2">
                {fieldCells(sourceMod, row.values, fieldIds).map((c) => (
                  <p key={c.id} className="text-[12px] text-[#16140f]">
                    <span className="text-[#8b87a8]">{c.label}: </span>
                    {c.value}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        ) : rows[0] ? (
          <FieldGrid
            module={sourceMod}
            record={{ ...rows[0], displayId: rows[0].id, updatedAt: rows[0].createdAt } as CrmRecord}
            fieldIds={fieldIds}
          />
        ) : rec ? (
          <FieldGrid module={mod} record={rec} fieldIds={fieldIds} />
        ) : (
          <p className="text-[12px] text-[#8b87a8]">No data.</p>
        )}
      </div>
    </div>
  );
}

function TimelineRows({
  module: mod,
  rows,
  spec,
}: {
  module: CrmModule;
  rows: { id: string; values: Record<string, string>; createdAt: string }[];
  spec: CustomWidgetSpec;
}) {
  if (!rows.length) {
    return <p className="text-[12px] text-[#8b87a8]">No timeline entries yet.</p>;
  }
  const dateF = spec.dateFieldId ? fieldById(mod, spec.dateFieldId) : undefined;
  const titleF = spec.titleFieldId ? fieldById(mod, spec.titleFieldId) : undefined;
  const bodyF = spec.bodyFieldId ? fieldById(mod, spec.bodyFieldId) : fieldById(mod, spec.fieldIds[0] ?? "");
  return (
    <ol className="relative space-y-3 border-l border-slate-200 pl-3">
      {rows.map((row) => {
        const when = dateF ? displayFieldValue(dateF, row.values[dateF.apiKey]) : new Date(row.createdAt).toLocaleString();
        const heading = titleF ? displayFieldValue(titleF, row.values[titleF.apiKey]) : when;
        const body = bodyF ? displayFieldValue(bodyF, row.values[bodyF.apiKey]) : "";
        return (
          <li key={row.id} className="relative">
            <span className="absolute -left-[17px] top-1 size-2 rounded-full bg-[#0f6b5c]" />
            <p className="text-[10px] text-[#8b87a8]">{when}</p>
            <p className="text-[13px] font-medium text-[#16140f]">{heading}</p>
            {body && body !== heading ? <p className="mt-0.5 text-[12px] leading-relaxed text-[#8b87a8]">{body}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

function TableRows({
  module: mod,
  rows,
  fieldIds,
}: {
  module: CrmModule;
  rows: { id: string; values: Record<string, string> }[];
  fieldIds: string[];
}) {
  const cols = fieldIds.map((id) => fieldById(mod, id)).filter((f): f is NonNullable<typeof f> => !!f);
  if (!cols.length) return <p className="text-[12px] text-[#8b87a8]">Pick columns from Fields configurator.</p>;
  return (
    <table className="w-full text-left text-[12px]">
      <thead>
        <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-[#8b87a8]">
          {cols.map((c) => (
            <th key={c.id} className="py-1 pr-2 font-medium">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={cols.length} className="py-4 text-[#8b87a8]">
              No rows yet.
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100/70">
              {cols.map((c) => (
                <td key={c.id} className="py-1.5 pr-2 text-[#16140f]">
                  {displayFieldValue(c, row.values[c.apiKey])}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
