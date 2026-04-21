"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BLUEPRINT_CHANGED_EVENT, loadBlueprint } from "@/lib/blueprint/storage";
import type { BlueprintDocument, BlueprintTransition, TransitionFormField } from "@/lib/blueprint/types";
import { defaultBlueprintDocument } from "@/lib/blueprint/standard-blueprint";
import { FIELDS_SCHEMA_CHANGED_EVENT, loadFieldsSchema } from "@/lib/fields-config/schema-storage";
import type { FieldDefinition } from "@/lib/fields-config/types";
import { createDefaultLeadFields, optionsSorted, usesOptions } from "@/lib/fields-config/types";
import { applyAfterFieldUpdates } from "@/lib/leads/apply-after-updates";
import { chipPaletteIndex, formatLeadFieldValue } from "@/lib/leads/display-value";
import {
  outgoingTransitions,
  stageFieldForBlueprint,
  stateFromStageValue,
  stateToStageOptionId,
  targetState,
} from "@/lib/leads/stage-bridge";
import { isLeadFilterConditionReady, leadMatchesFilterConfig } from "@/lib/leads/evaluate-lead-filters";
import type { LeadFilterConfig } from "@/lib/leads/lead-filter-types";
import { LEADS_CHANGED_EVENT, loadLeads, saveLeads, upsertLead } from "@/lib/leads/storage";
import type { LeadRecord } from "@/lib/leads/types";
import { LeadFiltersDrawer } from "@/components/manage-leads/lead-filters-drawer";
import { SavedLeadFiltersBar } from "@/components/manage-leads/saved-lead-filters-bar";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";

type TabId = "ai-insights" | "lead-journey" | "overview" | "change-stage" | "quotations";

function formatDrawerDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function stageTargetDotColor(label: string): string {
  const k = label.toLowerCase();
  const pairs: [string, string][] = [
    ["new lead", "rgb(197, 235, 255)"],
    ["new", "rgb(197, 235, 255)"],
    ["contacted", "rgb(252, 186, 116)"],
    ["prospect", "rgb(216, 223, 255)"],
    ["site visit", "rgb(253, 240, 171)"],
    ["negotiation", "rgb(242, 210, 255)"],
    ["booked", "rgb(194, 250, 213)"],
    ["dropped", "rgb(255, 180, 164)"],
    ["unqualified", "rgb(255, 167, 205)"],
    ["cp", "rgb(189, 178, 253)"],
  ];
  for (const [needle, color] of pairs) {
    if (k.includes(needle)) return color;
  }
  const palette = [
    "rgb(252, 186, 116)",
    "rgb(216, 223, 255)",
    "rgb(253, 240, 171)",
    "rgb(242, 210, 255)",
    "rgb(194, 250, 213)",
  ];
  return palette[chipPaletteIndex(label) % palette.length] ?? "rgb(193, 192, 203)";
}

function orderedTableFields(fields: FieldDefinition[]) {
  const name = fields.find((f) => f.apiKey === "lead_name");
  const stage = fields.find((f) => f.apiKey === "stage");
  const mid = fields.filter((f) => f.apiKey !== "lead_name" && f.apiKey !== "stage");
  return { name, stage, mid };
}

function nextDisplayIdForLeads(leads: LeadRecord[]): string {
  const d = new Date();
  const y = d.getFullYear() % 100;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const prefix = `L${String(y).padStart(2, "0")}${m}${day}`;
  let maxSeq = 0;
  for (const l of leads) {
    if (l.displayId.startsWith(prefix)) {
      const n = Number.parseInt(l.displayId.slice(prefix.length), 10);
      if (!Number.isNaN(n)) maxSeq = Math.max(maxSeq, n);
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

function newLeadUuid(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c && typeof c.randomUUID === "function") return c.randomUUID();
  return `lead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function initialsFromDisplayName(name: string): string {
  const t = name.trim();
  if (!t) return "NA";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  return t.slice(0, 2).toUpperCase();
}

function stagePillStyle(label: string): { backgroundColor: string; color: string } {
  const key = label.toLowerCase();
  if (key.includes("new lead") || key === "new")
    return { backgroundColor: "rgb(197, 235, 255)", color: "rgb(31, 23, 80)" };
  if (key.includes("site visit")) return { backgroundColor: "rgb(253, 240, 171)", color: "rgb(31, 23, 80)" };
  if (key.includes("booked")) return { backgroundColor: "rgb(194, 250, 213)", color: "rgb(31, 23, 80)" };
  if (key.includes("negotiation")) return { backgroundColor: "rgb(229, 230, 241)", color: "rgb(31, 23, 80)" };
  if (key.includes("dropped") || key.includes("unqualified"))
    return { backgroundColor: "rgb(255, 214, 214)", color: "rgb(31, 23, 80)" };
  return { backgroundColor: "rgb(229, 230, 241)", color: "rgb(31, 23, 80)" };
}

function warmthFieldFromSchema(fields: FieldDefinition[]): FieldDefinition | undefined {
  return fields.find(
    (f) =>
      ["lead_rating", "temperature", "rating"].includes(f.apiKey) ||
      /\b(hot|warm|cold)\b/i.test(f.label) ||
      /\b(rating|priority)\b/i.test(f.label),
  );
}

function paginationPages(current: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  if (current >= totalPages - 3)
    return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", totalPages];
}

function transitionFormDraftKey(t: BlueprintTransition, row: TransitionFormField) {
  return `${t.id}:${row.id}`;
}

/** Heading for the task date/time block — mirrors admin “Task type” preset (no rep-facing picker). */
function transitionTaskScheduleHeading(taskPresetType: string): string {
  const s = taskPresetType.trim().toLowerCase();
  if (s === "site visit" || s.includes("site visit")) return "Site Visit Date and Time";
  return "Follow up date and time";
}

function parseMultiIds(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function toggleMultiId(current: string, optId: string): string {
  const set = new Set(parseMultiIds(current));
  if (set.has(optId)) set.delete(optId);
  else set.add(optId);
  return [...set].join(",");
}

function validateTransition(
  t: BlueprintTransition,
  draft: Record<string, string>,
  fieldDefs: FieldDefinition[],
): string | null {
  for (const f of t.form.fields) {
    const k = transitionFormDraftKey(t, f);
    const v = draft[k] ?? "";
    const def = fieldDefs.find((x) => x.apiKey === f.fieldId);
    if (def?.dataType === "multi_select") {
      if (f.mandatory && parseMultiIds(v).length === 0) return `Fill “${f.label}”.`;
      continue;
    }
    if (f.mandatory && !v.trim()) return `Fill “${f.label}”.`;
  }
  if (t.form.includeRemark && t.form.remarkMandatory) {
    const r = (draft[`${t.id}:__remark__`] ?? "").trim();
    if (!r) return "Notes are required for this move.";
  }
  if (t.form.includeTasks && t.form.taskMandatory) {
    const d = (draft[`${t.id}:__task_date__`] ?? "").trim();
    const tm = (draft[`${t.id}:__task_time__`] ?? "").trim();
    if (!d || !tm) return "Follow-up date and time are required.";
  }
  return null;
}

function applyTransitionToLead(
  lead: LeadRecord,
  t: BlueprintTransition,
  doc: BlueprintDocument,
  stageField: FieldDefinition | undefined,
  draft: Record<string, string>,
): LeadRecord {
  const tgt = targetState(doc, t);
  if (!tgt || !stageField) return lead;

  let nextValues = { ...lead.values };
  for (const f of t.form.fields) {
    const key = transitionFormDraftKey(t, f);
    nextValues[f.fieldId] = draft[key] ?? "";
  }

  const opt = stateToStageOptionId(stageField, tgt);
  if (opt) nextValues[stageField.apiKey] = opt;

  nextValues = applyAfterFieldUpdates(nextValues, t.after.fieldUpdates);

  return {
    ...lead,
    values: nextValues,
    updatedAt: new Date().toISOString(),
  };
}

export function ManageLeadsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");
  const tabParam = searchParams.get("tab");

  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [blueprint, setBlueprint] = useState<BlueprintDocument | null>(null);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [tab, setTab] = useState<TabId>("overview");
  const [banner, setBanner] = useState<string | null>(null);

  const [selectedTransition, setSelectedTransition] = useState<BlueprintTransition | null>(null);
  const [formDraft, setFormDraft] = useState<Record<string, string>>({});

  const [stageTab, setStageTab] = useState<"all" | string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [warmthFilter, setWarmthFilter] = useState<"all" | "hot" | "warm" | "cold">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [appliedLeadFilters, setAppliedLeadFilters] = useState<LeadFilterConfig | null>(null);

  const reload = useCallback(() => {
    setFields(loadFieldsSchema() ?? createDefaultLeadFields());
    setBlueprint(loadBlueprint() ?? defaultBlueprintDocument());
    setLeads(loadLeads());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const onFields = () => reload();
    window.addEventListener(FIELDS_SCHEMA_CHANGED_EVENT, onFields);
    window.addEventListener(BLUEPRINT_CHANGED_EVENT, onFields);
    window.addEventListener(LEADS_CHANGED_EVENT, onFields);
    return () => {
      window.removeEventListener(FIELDS_SCHEMA_CHANGED_EVENT, onFields);
      window.removeEventListener(BLUEPRINT_CHANGED_EVENT, onFields);
      window.removeEventListener(LEADS_CHANGED_EVENT, onFields);
    };
  }, [reload]);

  useEffect(() => {
    if (!selectedId) return;
    if (tabParam === "change-stage") setTab("change-stage");
    else setTab("overview");
    setSelectedTransition(null);
    setFormDraft({});
  }, [selectedId, tabParam]);

  useEffect(() => {
    if (tab !== "change-stage") {
      setSelectedTransition(null);
      setFormDraft({});
    }
  }, [tab]);

  /** After blueprint reload, keep the open transition in sync with saved doc (form flags + fields). */
  useEffect(() => {
    if (!blueprint || !selectedTransition) return;
    const next = blueprint.transitions.find((tr) => tr.id === selectedTransition.id);
    if (!next) {
      setSelectedTransition(null);
      setFormDraft({});
      return;
    }
    if (next !== selectedTransition) setSelectedTransition(next);
  }, [blueprint, selectedTransition]);

  useEffect(() => {
    setPage(1);
  }, [stageTab, searchQuery, warmthFilter, pageSize, appliedLeadFilters]);

  const activeAdvancedFilter =
    appliedLeadFilters &&
    appliedLeadFilters.conditions.some((c) => isLeadFilterConditionReady(c, fields))
      ? appliedLeadFilters
      : null;

  const stageField = useMemo(
    () => (blueprint ? stageFieldForBlueprint(fields, blueprint) : undefined),
    [fields, blueprint],
  );

  const selectedLead = useMemo(() => leads.find((l) => l.id === selectedId) ?? null, [leads, selectedId]);

  const closeDrawer = useCallback(() => {
    const q = new URLSearchParams(searchParams.toString());
    q.delete("id");
    q.delete("tab");
    router.push(`/developer/manage-leads${q.toString() ? `?${q}` : ""}`);
    setSelectedTransition(null);
    setFormDraft({});
  }, [router, searchParams]);

  const navigateDrawerTab = useCallback(
    (t: TabId) => {
      setTab(t);
      if (!selectedId) return;
      const q = new URLSearchParams(searchParams.toString());
      q.set("id", selectedId);
      if (t === "change-stage") q.set("tab", "change-stage");
      else q.delete("tab");
      router.replace(`/developer/manage-leads?${q.toString()}`);
    },
    [router, searchParams, selectedId],
  );

  const { name: nameField, stage: stageFieldCol, mid: midFields } = useMemo(
    () => orderedTableFields(fields),
    [fields],
  );

  const currentState = useMemo(() => {
    if (!selectedLead || !blueprint) return null;
    const sid = stageField ? selectedLead.values[stageField.apiKey] : undefined;
    return stateFromStageValue(blueprint, stageField, sid);
  }, [selectedLead, blueprint, stageField]);

  const allowed = useMemo(() => {
    if (!blueprint || !currentState) return [];
    return outgoingTransitions(blueprint, currentState.id);
  }, [blueprint, currentState]);

  const pickTransition = useCallback((t: BlueprintTransition) => {
    setSelectedTransition(t);
    setFormDraft((prev) => {
      const next = { ...prev };
      for (const f of t.form.fields) {
        const k = transitionFormDraftKey(t, f);
        if (next[k] === undefined) next[k] = "";
      }
      if (t.form.includeRemark) next[`${t.id}:__remark__`] = next[`${t.id}:__remark__`] ?? "";
      if (t.form.includeTasks) {
        next[`${t.id}:__task_date__`] = next[`${t.id}:__task_date__`] ?? "";
        next[`${t.id}:__task_time__`] = next[`${t.id}:__task_time__`] ?? "";
      }
      return next;
    });
  }, []);

  const onSaveTransition = useCallback(() => {
    if (!selectedLead || !selectedTransition || !blueprint || !stageField) return;
    const err = validateTransition(selectedTransition, formDraft, fields);
    if (err) {
      setBanner(err);
      window.setTimeout(() => setBanner(null), 4000);
      return;
    }
    const updated = applyTransitionToLead(selectedLead, selectedTransition, blueprint, stageField, formDraft);
    const list = upsertLead(leads, updated);
    setLeads(list);
    saveLeads(list);
    setBanner("Stage updated (saved in this browser).");
    window.setTimeout(() => setBanner(null), 3200);
    setSelectedTransition(null);
    setFormDraft({});
    setTab("overview");
  }, [selectedLead, selectedTransition, blueprint, stageField, formDraft, leads]);

  const stageLabelForLead = useCallback(
    (lead: LeadRecord) => {
      if (!stageField) return "—";
      return formatLeadFieldValue(stageField, lead.values[stageField.apiKey]);
    },
    [stageField],
  );

  const warmthFieldDef = useMemo(() => warmthFieldFromSchema(fields), [fields]);

  const filteredLeads = useMemo(() => {
    let list = [...leads];
    if (stageTab !== "all" && stageField) {
      list = list.filter((l) => (l.values[stageField.apiKey] ?? "") === stageTab);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((l) => {
        const hay: string[] = [l.displayId.toLowerCase()];
        if (nameField) hay.push(formatLeadFieldValue(nameField, l.values[nameField.apiKey]).toLowerCase());
        for (const f of midFields) hay.push(formatLeadFieldValue(f, l.values[f.apiKey]).toLowerCase());
        return hay.some((h) => h.includes(q));
      });
    }
    if (warmthFilter !== "all" && warmthFieldDef && usesOptions(warmthFieldDef.dataType)) {
      list = list.filter((l) =>
        formatLeadFieldValue(warmthFieldDef, l.values[warmthFieldDef.apiKey])
          .toLowerCase()
          .includes(warmthFilter),
      );
    }
    if (activeAdvancedFilter) {
      list = list.filter((l) => leadMatchesFilterConfig(l, activeAdvancedFilter, fields));
    }
    return list;
  }, [
    leads,
    stageTab,
    stageField,
    searchQuery,
    nameField,
    midFields,
    warmthFilter,
    warmthFieldDef,
    activeAdvancedFilter,
    fields,
  ]);

  const stageTabRows = useMemo(() => {
    const allCount = leads.length;
    const rows: { id: "all" | string; label: string; count: number }[] = [
      { id: "all", label: "All Leads", count: allCount },
    ];
    if (stageField && usesOptions(stageField.dataType)) {
      for (const opt of optionsSorted(stageField)) {
        const count = leads.filter((l) => (l.values[stageField.apiKey] ?? "") === opt.id).length;
        rows.push({ id: opt.id, label: opt.label, count });
      }
    }
    return rows;
  }, [leads, stageField]);

  const totalFiltered = filteredLeads.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, safePage, pageSize]);

  const warmthCounts = useMemo(() => {
    if (!warmthFieldDef || !usesOptions(warmthFieldDef.dataType)) return null;
    const countFor = (key: "hot" | "warm" | "cold") =>
      leads.filter((l) =>
        formatLeadFieldValue(warmthFieldDef, l.values[warmthFieldDef.apiKey])
          .toLowerCase()
          .includes(key),
      ).length;
    return { hot: countFor("hot"), warm: countFor("warm"), cold: countFor("cold") };
  }, [leads, warmthFieldDef]);

  const onAddLead = useCallback(() => {
    if (!fields.length) return;
    const id = newLeadUuid();
    const now = new Date().toISOString();
    const values: Record<string, string> = {};
    for (const f of fields) values[f.apiKey] = f.apiKey === "lead_name" ? "New lead" : "";
    if (stageField && usesOptions(stageField.dataType)) {
      const opts = optionsSorted(stageField);
      const first = opts[0];
      if (first) values[stageField.apiKey] = first.id;
    }
    const newLead: LeadRecord = {
      id,
      displayId: nextDisplayIdForLeads(leads),
      values,
      createdAt: now,
      updatedAt: now,
    };
    const list = upsertLead(leads, newLead);
    setLeads(list);
    saveLeads(list);
    router.push(`/developer/manage-leads?id=${encodeURIComponent(id)}`);
  }, [fields, leads, stageField, router]);

  const onBulkUpload = useCallback(() => {
    setBanner("Bulk upload is not wired in this prototype.");
    window.setTimeout(() => setBanner(null), 3200);
  }, []);

  const canSaveTransition = useMemo(() => {
    if (!selectedTransition) return false;
    return validateTransition(selectedTransition, formDraft, fields) === null;
  }, [selectedTransition, formDraft, fields]);

  const borderCell = "border-b border-border-soft";
  const headText = "text-[10px] font-semibold uppercase tracking-wider text-muted";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      {banner ? (
        <div
          className="shrink-0 border-b border-amber-200/90 bg-amber-50 px-3 py-1.5 text-center text-[11px] font-medium text-amber-950"
          role="status"
        >
          {banner}
        </div>
      ) : null}

      <DeveloperPageHeader
        backHref="/"
        backAriaLabel="Back to settings"
        title="Manage leads"
        description="List and update leads; stage changes follow your active blueprint."
        actions={
          <>
            <button
              type="button"
              className="hidden h-9 min-w-[9rem] max-w-[12rem] cursor-default items-center justify-between rounded-lg border border-border-soft bg-white px-2.5 text-left text-xs font-medium text-ink shadow-sm sm:inline-flex"
              aria-hidden
            >
              <span className="truncate">You</span>
              <svg className="size-3.5 shrink-0 text-muted" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M7 10l5 5 5-5H7z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onAddLead}
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-white shadow-sm transition hover:opacity-95"
            >
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" d="M12 5v14M5 12h14" />
              </svg>
              Add lead
            </button>
            <button
              type="button"
              onClick={onBulkUpload}
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border-soft bg-white px-3 text-xs font-semibold text-ink shadow-sm transition hover:border-accent/30"
            >
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M9 16h6v-5h4l-7-7-7 7h4v5zm-4 2h14v2H5v-2z" />
              </svg>
              Bulk upload
            </button>
          </>
        }
      />

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-3 pb-4 pt-1 sm:px-4">
        <div className="shrink-0 pt-1">
          <div className="w-full overflow-x-auto overflow-y-hidden">
            <div className="inline-flex min-w-max gap-px rounded-t-lg border border-b-0 border-border-soft bg-border-soft p-px">
              {stageTabRows.map((row) => {
                const active = stageTab === row.id;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setStageTab(row.id)}
                    className={[
                      "relative shrink-0 whitespace-nowrap rounded-t-md px-3 py-1.5 pr-7 text-xs font-medium transition-colors min-w-[5.5rem]",
                      active ? "bg-surface font-semibold text-ink shadow-sm" : "bg-transparent text-muted hover:bg-white/70 hover:text-ink",
                    ].join(" ")}
                  >
                    {row.label}
                    <span
                      className={[
                        "ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                        active ? "bg-accent/12 text-accent" : "bg-white/90 text-muted",
                      ].join(" ")}
                    >
                      {row.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-b-lg rounded-tr-lg border border-t-0 border-border-soft bg-surface shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-border-soft px-2 py-2 sm:px-3">
            <div className="flex h-9 min-w-[min(100%,18rem)] flex-1 items-center rounded-lg border border-border-soft bg-white pl-2.5 pr-2 shadow-sm">
              <svg className="mr-1 size-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
              <input
                id="lead-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search leads…"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-muted"
              />
            </div>
            {warmthCounts ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {(["hot", "warm", "cold"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setWarmthFilter((f) => (f === key ? "all" : key))}
                    className={[
                      "flex h-8 shrink-0 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-medium text-ink",
                      warmthFilter === key ? "border-accent bg-accent/10" : "border-border-soft bg-white shadow-sm",
                    ].join(" ")}
                  >
                    <span className="capitalize">{key}</span>
                    <span className="tabular-nums text-[10px] text-muted">({warmthCounts[key]})</span>
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setFilterDrawerOpen(true)}
              className={`relative flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium shadow-sm ${
                activeAdvancedFilter
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border-soft bg-white text-ink"
              }`}
            >
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
              </svg>
              Filters
              {activeAdvancedFilter ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold leading-none text-white">
                  {activeAdvancedFilter.conditions.filter((c) => isLeadFilterConditionReady(c, fields)).length}
                </span>
              ) : null}
            </button>
          </div>

          <SavedLeadFiltersBar applied={appliedLeadFilters} onApplySaved={(c) => setAppliedLeadFilters(c)} />

          <div className="relative isolate overflow-x-auto">
            <table className="border-separate text-left" style={{ borderSpacing: 0, minWidth: "100%", width: "max-content" }}>
              <thead className="sticky top-0 z-[13] bg-surface">
                <tr className={borderCell}>
                  <th
                    className={`sticky left-0 z-[14] box-border w-14 min-w-[3.5rem] max-w-[3.5rem] whitespace-nowrap px-2 py-2.5 text-left ${headText} ${borderCell} bg-surface`}
                  >
                    <span className="sr-only">Select</span>
                    <span className="inline-block size-4 rounded border border-[#dbdbe8] bg-white" aria-hidden />
                  </th>
                  {nameField ? (
                    <th
                      className={`sticky left-14 z-[14] box-border w-[220px] min-w-[220px] max-w-[220px] whitespace-nowrap px-2 py-2.5 text-left ${headText} ${borderCell} bg-surface`}
                    >
                      {nameField.label.toUpperCase()}
                    </th>
                  ) : null}
                  <th
                    className={`sticky left-[276px] z-[14] box-border w-[150px] min-w-[150px] max-w-[150px] whitespace-nowrap px-2 py-2.5 text-left ${headText} ${borderCell} bg-surface`}
                  >
                    LEAD ID
                  </th>
                  <th
                    className={`sticky left-[426px] z-[14] box-border w-[270px] min-w-[270px] max-w-[270px] whitespace-nowrap border-r border-border-soft px-2 py-2.5 text-left ${headText} ${borderCell} bg-surface`}
                  >
                    COMMUNICATIONS
                  </th>
                  {midFields.map((f) => (
                    <th key={f.id} className={`whitespace-nowrap px-2 py-2.5 text-left ${headText} ${borderCell} bg-surface`}>
                      {f.label.toUpperCase()}
                    </th>
                  ))}
                  {stageFieldCol ? (
                    <th className={`min-w-[9.6875rem] whitespace-nowrap px-2 py-2.5 text-left ${headText} ${borderCell} bg-surface`}>
                      {stageFieldCol.label.toUpperCase()}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {pageSlice.map((lead) => {
                  const stageLabel = stageLabelForLead(lead);
                  const pill = stagePillStyle(stageLabel);
                  const displayName = nameField
                    ? formatLeadFieldValue(nameField, lead.values[nameField.apiKey])
                    : "—";
                  const ini = initialsFromDisplayName(displayName);
                  const warmRaw = warmthFieldDef
                    ? formatLeadFieldValue(warmthFieldDef, lead.values[warmthFieldDef.apiKey]).toLowerCase()
                    : "";
                  const ringStyle =
                    warmRaw.includes("hot")
                      ? "conic-gradient(from -2.39deg, rgb(252, 122, 40) 0deg, rgb(255, 174, 98) 266.82deg, rgb(252, 122, 40) 360deg)"
                      : warmRaw.includes("warm")
                        ? "conic-gradient(from 214.42deg, rgb(252, 122, 40) -93.18deg, rgb(255, 174, 98) 149.2deg, rgb(252, 122, 40) 266.82deg, rgb(255, 174, 98) 509.2deg)"
                        : "conic-gradient(from -2.39deg, rgb(130, 129, 145) 0deg, rgb(76, 75, 86) 266.82deg, rgb(130, 129, 145) 360deg)";
                  const innerBg = warmRaw.includes("warm") || warmRaw.includes("hot") ? "#fff6e0" : "#e4e5e6";
                  const iniColor =
                    warmRaw.includes("warm") || warmRaw.includes("hot") ? "rgb(151, 97, 10)" : "rgba(31, 23, 80, 0.75)";
                  return (
                    <tr key={lead.id} className="border-border-soft hover:bg-white/40">
                      <td
                        className={`sticky left-0 z-[11] box-border min-h-11 w-14 min-w-[3.5rem] max-w-[3.5rem] whitespace-nowrap px-2 py-2 ${borderCell} bg-surface`}
                      >
                        <span className="inline-block size-4 rounded border border-[#dbdbe8] bg-white" aria-hidden />
                      </td>
                      {nameField ? (
                        <td
                          className={`sticky left-14 z-[11] box-border min-h-11 w-[220px] min-w-[220px] max-w-[220px] whitespace-nowrap px-2 py-2 ${borderCell} bg-surface`}
                        >
                          <Link
                            href={`/developer/manage-leads?id=${encodeURIComponent(lead.id)}`}
                            className="flex h-full min-h-[2.375rem] items-center gap-2 text-muted no-underline hover:text-accent"
                          >
                            <div className="relative flex size-[45px] shrink-0 items-center justify-center">
                              <div className="absolute size-[45px] rounded-full" style={{ background: ringStyle }} />
                              <div
                                className="relative flex size-[41px] items-center justify-center rounded-full font-outfit text-[13px] font-semibold leading-none"
                                style={{ backgroundColor: innerBg, color: iniColor }}
                              >
                                {ini}
                              </div>
                            </div>
                            <span className="max-w-[9.375rem] truncate text-sm text-ink" title={displayName}>
                              {displayName}
                            </span>
                          </Link>
                        </td>
                      ) : null}
                      <td
                        className={`sticky left-[276px] z-[11] box-border min-h-11 w-[150px] min-w-[150px] max-w-[150px] whitespace-nowrap px-2 py-2 ${borderCell} bg-surface`}
                      >
                        <Link
                          href={`/developer/manage-leads?id=${encodeURIComponent(lead.id)}`}
                          className="text-sm text-ink no-underline hover:text-accent hover:underline"
                        >
                          {lead.displayId}
                        </Link>
                      </td>
                      <td
                        className={`sticky left-[426px] z-[11] box-border min-h-11 w-[270px] min-w-[270px] max-w-[270px] overflow-visible whitespace-nowrap border-r border-border-soft px-2 py-2 ${borderCell} bg-surface`}
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="inline-flex h-7 cursor-default items-center gap-1 rounded-md border border-border-soft bg-white px-2 text-[11px] font-medium text-ink shadow-sm">
                            Chat
                          </span>
                          <span className="inline-flex h-7 cursor-default items-center gap-1 rounded-md border border-border-soft bg-white px-2 text-[11px] font-medium text-ink shadow-sm">
                            Call
                          </span>
                        </div>
                      </td>
                      {midFields.map((f) => (
                        <td
                          key={f.id}
                          className={`max-w-[12rem] truncate whitespace-nowrap px-2 py-2 text-sm text-ink ${borderCell} bg-surface`}
                          title={formatLeadFieldValue(f, lead.values[f.apiKey])}
                        >
                          {formatLeadFieldValue(f, lead.values[f.apiKey])}
                        </td>
                      ))}
                      {stageFieldCol ? (
                        <td className={`min-h-11 w-[155px] min-w-[9.6875rem] whitespace-nowrap px-2 py-2 ${borderCell} bg-surface`}>
                          <Link
                            href={`/developer/manage-leads?id=${encodeURIComponent(lead.id)}&tab=change-stage`}
                            className="inline-flex min-w-28 justify-center rounded-md px-2 py-1 text-center text-xs font-medium no-underline"
                            style={pill}
                          >
                            {stageLabel}
                          </Link>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-soft px-2 py-2 sm:px-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="relative inline-block">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-8 cursor-pointer appearance-none rounded-lg border border-border-soft bg-white py-1 pl-2 pr-8 text-xs text-muted shadow-sm outline-none"
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-muted">
                Showing {totalFiltered === 0 ? 0 : (safePage - 1) * pageSize + 1} –{" "}
                {Math.min(safePage * pageSize, totalFiltered)} of {totalFiltered}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-full px-1 py-1 disabled:opacity-40"
                style={{ background: safePage <= 1 ? "rgb(232, 231, 238)" : "rgba(118, 121, 255, 0.3)" }}
                aria-label="Previous page"
              >
                <svg className="size-[22px] text-accent" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z" />
                </svg>
              </button>
              {paginationPages(safePage, totalPages).map((item, idx) =>
                item === "ellipsis" ? (
                  <span key={`e-${idx}`} className="px-1.5 text-xs text-muted">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className={[
                      "rounded-md px-2 py-0.5 text-xs font-medium",
                      item === safePage ? "bg-accent text-white" : "bg-transparent text-muted",
                    ].join(" ")}
                  >
                    {item}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-full px-1 py-1 disabled:opacity-40"
                style={{ background: safePage >= totalPages ? "transparent" : "rgba(118, 121, 255, 0.3)" }}
                aria-label="Next page"
              >
                <svg className="size-[22px] text-accent" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                </svg>
              </button>
            </div>
          </div>

          <p className="px-2 pb-2 text-center text-[10px] leading-snug text-muted">
            Stage tabs and the table follow your active blueprint. Change stage from a row or the drawer respects
            allowed transitions.
          </p>
        </div>
      </div>

      {selectedLead && blueprint ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md transition-opacity duration-300"
          style={{ backgroundColor: "rgba(217, 217, 217, 0.25)" }}
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close"
            onClick={closeDrawer}
          />
          <aside
            className="pointer-events-auto fixed right-0 top-0 z-[51] flex h-full max-h-screen w-[80%] max-w-[90rem] flex-col shadow-lg"
            style={{ backgroundColor: "rgb(227, 227, 227)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-drawer-title"
          >
            <div className="absolute left-0 top-0 z-10 -translate-x-full rounded-l-xl px-5 pb-4 pt-5" style={{ backgroundColor: "rgb(227, 227, 227)" }}>
              <button
                type="button"
                onClick={closeDrawer}
                className="text-[#1f1750]"
                aria-label="Close drawer"
              >
                <svg viewBox="0 0 15 15" width="24" height="24" fill="currentColor" aria-hidden>
                  <path d="M10.9688 3.21871C11.1933 2.99416 11.5567 2.99416 11.7813 3.21871C12.0056 3.44328 12.0057 3.80673 11.7813 4.03121L8.31251 7.49996L11.7813 10.9687L11.8555 11.0586C12.0026 11.2817 11.9777 11.5848 11.7813 11.7812C11.5849 11.9776 11.2818 12.0026 11.0586 11.8554L10.9688 11.7812L7.50001 8.31246L4.03126 11.7812C3.80677 12.0057 3.44332 12.0056 3.21876 11.7812C2.99421 11.5567 2.99421 11.1933 3.21876 10.9687L6.68751 7.49996L3.21876 4.03121L3.14454 3.94137C2.99723 3.71819 3.0223 3.41517 3.21876 3.21871C3.41522 3.02225 3.71823 2.99719 3.94141 3.14449L4.03126 3.21871L7.50001 6.68746L10.9688 3.21871Z" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mt-5 flex gap-5 px-5">
                <div className="flex min-w-0 flex-1 space-x-4 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                  <div
                    className="w-48 shrink-0 cursor-pointer rounded-2xl border-2 px-5 py-2"
                    style={{ backgroundColor: "rgba(248, 248, 248, 0.698)", borderColor: "rgb(52, 54, 156)" }}
                  >
                    <div className="truncate text-base font-normal text-[#1f1750]">
                      {nameField ? formatLeadFieldValue(nameField, selectedLead.values[nameField.apiKey]) : "Lead"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBanner("Assign project is not wired in this prototype.");
                      window.setTimeout(() => setBanner(null), 3200);
                    }}
                    className="flex min-w-[12rem] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#7e7a95] bg-surface px-[14px] py-2 text-[#1f1750]"
                  >
                    <svg className="size-[23px] shrink-0 text-accent" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2"
                      />
                    </svg>
                    Assign Project
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col px-5 pb-6">
                <div className="w-full rounded-3xl bg-[#fafafa] px-6">
                  {(() => {
                    const emailFd = fields.find((f) => f.apiKey === "email");
                    const phoneFd =
                      fields.find((f) => f.apiKey === "phone") ?? fields.find((f) => f.apiKey === "whatsapp_number");
                    const ownerFd =
                      fields.find((f) => f.apiKey === "lead_owner") ?? fields.find((f) => f.apiKey === "assigned_to");
                    const sourceFd = fields.find((f) => f.apiKey === "source");
                    const subFd = fields.find((f) => f.apiKey === "sub_source" || /\bsub\s*source\b/i.test(f.label));
                    const drawerName = nameField
                      ? formatLeadFieldValue(nameField, selectedLead.values[nameField.apiKey])
                      : "Lead";
                    const ini = initialsFromDisplayName(drawerName);
                    const warmRaw = warmthFieldDef
                      ? formatLeadFieldValue(warmthFieldDef, selectedLead.values[warmthFieldDef.apiKey]).toLowerCase()
                      : "";
                    const ringStyle =
                      warmRaw.includes("hot")
                        ? "conic-gradient(from -2.39deg, rgb(252, 122, 40) 0deg, rgb(255, 174, 98) 266.82deg, rgb(252, 122, 40) 360deg)"
                        : warmRaw.includes("warm")
                          ? "conic-gradient(from 214.42deg, rgb(252, 122, 40) -93.18deg, rgb(255, 174, 98) 149.2deg, rgb(252, 122, 40) 266.82deg, rgb(255, 174, 98) 509.2deg)"
                          : "conic-gradient(from -2.39deg, rgb(130, 129, 145) 0deg, rgb(76, 75, 86) 266.82deg, rgb(130, 129, 145) 360deg)";
                    const innerBg = warmRaw.includes("warm") || warmRaw.includes("hot") ? "#fff6e0" : "#e4e5e6";
                    const iniColor =
                      warmRaw.includes("warm") || warmRaw.includes("hot") ? "rgb(151, 97, 10)" : "rgba(31, 23, 80, 0.75)";
                    return (
                      <>
                        <div className="my-4 flex flex-wrap items-center justify-between gap-4">
                          <div className="flex flex-wrap items-center gap-8 text-[#c2bce4]">
                            <div className="flex shrink-0 items-center gap-3">
                              <div className="relative flex size-[50px] shrink-0 items-center justify-center">
                                <div className="absolute size-[50px] rounded-full" style={{ background: ringStyle }} />
                                <div
                                  className="relative flex size-[46px] items-center justify-center rounded-full text-[13px] font-semibold leading-none"
                                  style={{ backgroundColor: innerBg, color: iniColor }}
                                >
                                  {ini}
                                </div>
                              </div>
                              <h2 id="lead-drawer-title" className="whitespace-nowrap text-xl font-semibold text-[#1f1750]">
                                {drawerName}
                              </h2>
                            </div>
                            <div className="flex flex-row flex-wrap items-center gap-8">
                              <div className="flex shrink-0 flex-row items-center gap-1">
                                <span className="whitespace-nowrap text-sm text-[#7e7a95]">Lead Stage: </span>
                                <span className="whitespace-nowrap text-sm font-normal text-[#7e7a95]">
                                  {stageLabelForLead(selectedLead)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigateDrawerTab("overview")}
                            className="flex shrink-0 cursor-pointer items-center justify-center rounded-3xl border py-2 pl-3 pr-3 text-sm font-normal text-accent"
                            style={{ borderColor: "rgb(52, 54, 156)", borderWidth: "0.8px", backgroundColor: "rgb(252, 253, 255)" }}
                          >
                            <span className="mr-2 inline-flex size-5 items-center justify-center rounded bg-accent/10 text-xs font-bold text-accent" aria-hidden>
                              ✎
                            </span>
                            Edit Lead Form
                          </button>
                        </div>

                        <div className="mb-4">
                          <div className="flex flex-wrap items-center gap-10">
                            {emailFd ? (
                              <div className="flex min-w-[12rem] flex-1 flex-row items-center gap-2">
                                <span className="whitespace-nowrap text-sm font-normal text-[#7e7a95]">Email id:</span>
                                <span className="text-sm font-normal text-[#1f1750]">
                                  {formatLeadFieldValue(emailFd, selectedLead.values[emailFd.apiKey])}
                                </span>
                              </div>
                            ) : null}
                            {phoneFd ? (
                              <div className="flex min-w-[12rem] flex-[1.2] flex-row items-center gap-2">
                                <span className="whitespace-nowrap text-sm font-normal text-[#7e7a95]">Phone Number:</span>
                                <span className="text-sm font-normal text-[#1f1750]">
                                  {formatLeadFieldValue(phoneFd, selectedLead.values[phoneFd.apiKey])}
                                </span>
                              </div>
                            ) : null}
                            {ownerFd ? (
                              <div className="flex min-w-[10rem] flex-1 flex-row items-center gap-2">
                                <span className="w-[90px] shrink-0 whitespace-nowrap text-sm font-normal text-[#7e7a95]">
                                  Assigned to:
                                </span>
                                <span className="text-sm font-normal text-[#1f1750]">
                                  {formatLeadFieldValue(ownerFd, selectedLead.values[ownerFd.apiKey])}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="flex flex-wrap gap-10">
                            <div className="flex min-w-[8rem] flex-1 flex-col">
                              <span className="text-sm font-normal text-[#7e7a95]">Lead ID</span>
                              <span className="mt-0.5 text-sm font-medium text-[#1f1750]">{selectedLead.displayId}</span>
                            </div>
                            <div className="flex min-w-[8rem] flex-[1.2] flex-col">
                              <span className="text-sm font-normal text-[#7e7a95]">Create Date</span>
                              <span className="mt-0.5 text-sm font-medium text-[#1f1750]" title={selectedLead.createdAt}>
                                {formatDrawerDate(selectedLead.createdAt)}
                              </span>
                            </div>
                            <div className="flex min-w-[8rem] flex-1 flex-col">
                              <span className="text-sm font-normal text-[#7e7a95]">Update Date</span>
                              <span className="mt-0.5 text-sm font-medium text-[#1f1750]" title={selectedLead.updatedAt}>
                                {formatDrawerDate(selectedLead.updatedAt)}
                              </span>
                            </div>
                            {sourceFd ? (
                              <div className="flex min-w-[8rem] flex-1 flex-col">
                                <span className="text-sm font-normal text-[#7e7a95]">Source</span>
                                <span className="mt-0.5 text-sm font-medium text-[#1f1750]">
                                  {formatLeadFieldValue(sourceFd, selectedLead.values[sourceFd.apiKey])}
                                </span>
                              </div>
                            ) : null}
                            {subFd ? (
                              <div className="flex min-w-[8rem] flex-1 flex-col">
                                <span className="text-sm font-normal text-[#7e7a95]">Sub Source</span>
                                <span className="mt-0.5 text-sm font-medium text-[#1f1750]">
                                  {formatLeadFieldValue(subFd, selectedLead.values[subFd.apiKey])}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="border-b-2 border-[#d4d3df]" />

                        <div className="my-4 flex flex-row flex-wrap items-center gap-3">
                          <span className="inline-flex h-9 cursor-default items-center gap-2 rounded-xl border border-[#cdcddc] bg-[#e5e6f1] px-3 py-2 text-xs text-[#1f1750]">
                            Call
                          </span>
                          <span className="inline-flex h-9 cursor-default items-center gap-2 rounded-xl border border-[#cdcddc] bg-[#e5e6f1] px-3 py-2 text-xs text-[#1f1750]">
                            Chat
                          </span>
                          <span className="inline-flex h-9 cursor-default items-center gap-2 rounded-xl border border-[#cdcddc] bg-[#e5e6f1] px-3 py-2 text-xs text-[#1f1750]">
                            Add comment
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="p-6 pt-2">
                  <div className="w-full overflow-x-auto overflow-y-hidden">
                    <div className="flex min-w-max">
                      {(
                        [
                          { id: "ai-insights" as const, label: "AI Insights" },
                          { id: "lead-journey" as const, label: "Lead Journey" },
                          { id: "overview" as const, label: "Lead Overview" },
                          { id: "change-stage" as const, label: "Change Stage" },
                          { id: "quotations" as const, label: "Quotations" },
                        ] as const
                      ).map((row) => {
                        const active = tab === row.id;
                        return (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => navigateDrawerTab(row.id)}
                            className={[
                              "relative min-w-[8.125rem] flex-shrink-0 whitespace-nowrap rounded-t-2xl rounded-tr-[2.125rem] py-3 pl-3 pr-10 text-sm",
                              active ? "bg-[#fafafa] font-bold text-[#1f1750]" : "bg-[#eeeff0] font-normal text-[#1f1750]",
                            ].join(" ")}
                          >
                            {row.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    {tab === "overview" ? (
                      <div className="rounded-b-2xl rounded-tr-2xl bg-[#fafafa] p-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                          {fields.map((f) => (
                            <div key={f.id} className="rounded-xl border border-[#cdcddc] bg-white px-4 py-3">
                              <div className="text-xs font-medium uppercase tracking-wide text-[#7e7a95]">{f.label}</div>
                              <div className="mt-1 text-sm font-medium text-[#1f1750]">
                                {formatLeadFieldValue(f, selectedLead.values[f.apiKey])}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {tab === "change-stage" ? (
                      <div className="rounded-b-2xl rounded-tr-2xl bg-[#fafafa] p-6">
                        <h3 className="mb-4 text-sm font-medium text-[#1f1750]">Status</h3>
                        <p className="mb-3 text-xs text-[#7e7a95]">
                          From <strong className="text-[#1f1750]">{currentState?.label ?? "—"}</strong> only blueprint
                          transitions listed below are allowed.
                        </p>
                        {allowed.length === 0 ? (
                          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                            No outgoing transitions from this stage. Add edges in the blueprint configurator.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            {allowed.map((tr) => {
                              const tgt = targetState(blueprint, tr);
                              const label = tgt?.label ?? tr.name;
                              const active = selectedTransition?.id === tr.id;
                              const dot = stageTargetDotColor(label);
                              return (
                                <button
                                  key={tr.id}
                                  type="button"
                                  onClick={() => pickTransition(tr)}
                                  className="flex cursor-pointer items-center rounded-full border-[1.5px] px-5 py-2"
                                  style={{
                                    borderColor: active ? "rgb(52, 54, 156)" : "rgb(193, 192, 203)",
                                  }}
                                >
                                  <span className="mr-2 size-4 shrink-0 rounded-full" style={{ backgroundColor: dot }} aria-hidden />
                                  <span className="text-sm text-[#1f1750]">{label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {selectedTransition ? (
                          <div className="mt-6 space-y-6">
                            {selectedTransition.form.message ? (
                              <p className="text-sm text-[#7e7a95]">{selectedTransition.form.message}</p>
                            ) : null}

                            {selectedTransition.form.fields.map((f) => (
                              <TransitionFieldInput
                                key={f.id}
                                variant="drawer"
                                field={f}
                                definitions={fields}
                                value={formDraft[transitionFormDraftKey(selectedTransition, f)] ?? ""}
                                onChange={(v) =>
                                  setFormDraft((d) => ({ ...d, [transitionFormDraftKey(selectedTransition, f)]: v }))
                                }
                              />
                            ))}

                            {selectedTransition.form.includeRemark ? (
                              <div className="mb-2">
                                <label
                                  className="mb-2 block text-sm font-medium text-[#1f1750]"
                                  htmlFor={`rm-${selectedTransition.id}`}
                                >
                                  Notes
                                  {selectedTransition.form.remarkMandatory ? (
                                    <span className="text-[#ff6678]"> *</span>
                                  ) : null}
                                </label>
                                <div className="relative rounded-lg pb-5" style={{ backgroundColor: "rgb(239, 239, 241)" }}>
                                  <textarea
                                    id={`rm-${selectedTransition.id}`}
                                    rows={4}
                                    maxLength={5000}
                                    value={formDraft[`${selectedTransition.id}:__remark__`] ?? ""}
                                    onChange={(e) =>
                                      setFormDraft((d) => ({ ...d, [`${selectedTransition.id}:__remark__`]: e.target.value }))
                                    }
                                    className="w-full resize-none rounded-lg border-none bg-transparent p-4 text-sm text-[#1f1750] outline-none"
                                    style={{ backgroundColor: "rgb(239, 239, 241)" }}
                                    placeholder="Notes for this stage change…"
                                  />
                                  <div className="absolute bottom-2 left-4 text-xs text-[#7e7a95]">Character limit - 5000</div>
                                </div>
                              </div>
                            ) : null}

                            {selectedTransition.form.includeTasks ? (
                              <div className="space-y-2">
                                <div className="mb-2 text-sm font-medium text-[#1f1750]">
                                  {transitionTaskScheduleHeading(selectedTransition.form.taskPresetType)}
                                  {selectedTransition.form.taskMandatory ? <span className="text-[#ff6678]"> *</span> : null}
                                </div>
                                <div className="flex flex-wrap gap-4">
                                  <div className="w-full min-w-[10rem] sm:w-[35%]">
                                    <label
                                      className="mb-2 ml-5 block text-sm text-[#7e7a95]"
                                      htmlFor={`td-${selectedTransition.id}`}
                                    >
                                      Date
                                      {selectedTransition.form.taskMandatory ? <span className="text-[#ff6678]"> *</span> : null}
                                    </label>
                                    <input
                                      id={`td-${selectedTransition.id}`}
                                      type="date"
                                      value={formDraft[`${selectedTransition.id}:__task_date__`] ?? ""}
                                      onChange={(e) =>
                                        setFormDraft((d) => ({
                                          ...d,
                                          [`${selectedTransition.id}:__task_date__`]: e.target.value,
                                        }))
                                      }
                                      className="flex w-full cursor-pointer items-center justify-between rounded-full border-0 px-5 py-2.5 text-base font-semibold text-[#1f1750] outline-none"
                                      style={{ backgroundColor: "rgb(228, 229, 230)" }}
                                    />
                                  </div>
                                  <div className="w-full min-w-[10rem] sm:w-[35%]">
                                    <label
                                      className="mb-2 ml-5 block text-sm text-[#7e7a95]"
                                      htmlFor={`tt-${selectedTransition.id}`}
                                    >
                                      Time
                                      {selectedTransition.form.taskMandatory ? <span className="text-[#ff6678]"> *</span> : null}
                                    </label>
                                    <input
                                      id={`tt-${selectedTransition.id}`}
                                      type="time"
                                      value={formDraft[`${selectedTransition.id}:__task_time__`] ?? ""}
                                      onChange={(e) =>
                                        setFormDraft((d) => ({
                                          ...d,
                                          [`${selectedTransition.id}:__task_time__`]: e.target.value,
                                        }))
                                      }
                                      className="flex w-full cursor-pointer items-center justify-between rounded-full border-0 px-5 py-2.5 text-base font-semibold text-[#1f1750] outline-none"
                                      style={{ backgroundColor: "rgb(228, 229, 230)" }}
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            <div className="mt-8 flex gap-4">
                              <button
                                type="button"
                                onClick={() => setSelectedTransition(null)}
                                className="flex flex-1 cursor-pointer items-center justify-center rounded-full border py-3 text-sm font-semibold text-accent"
                                style={{ borderColor: "rgb(52, 54, 156)", backgroundColor: "rgb(250, 250, 250)" }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={!canSaveTransition}
                                onClick={onSaveTransition}
                                className="flex flex-1 cursor-pointer items-center justify-center rounded-full py-3 text-sm font-semibold text-[#f5f5f5] disabled:pointer-events-none disabled:opacity-50"
                                style={{ backgroundColor: "rgb(52, 54, 156)" }}
                              >
                                <svg className="mr-2 size-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                  <path fill="none" d="M0 0h24v24H0V0z" />
                                  <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                                </svg>
                                Save
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {tab === "ai-insights" || tab === "lead-journey" || tab === "quotations" ? (
                      <div className="rounded-b-2xl rounded-tr-2xl bg-[#fafafa] p-10 text-center text-sm text-[#7e7a95]">
                        {tab === "ai-insights" ? "AI Insights is not part of this prototype." : null}
                        {tab === "lead-journey" ? "Lead Journey is not part of this prototype." : null}
                        {tab === "quotations" ? "Quotations is not part of this prototype." : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <LeadFiltersDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        fields={fields}
        applied={appliedLeadFilters}
        onApply={(c) => setAppliedLeadFilters(c)}
        onClearApplied={() => setAppliedLeadFilters(null)}
      />
    </div>
  );
}

/** Picklist options for a transition row: full schema list, or subset when the blueprint row lists allowed labels. */
function picklistOptionsForTransition(
  field: TransitionFormField,
  def: FieldDefinition | undefined,
): ReturnType<typeof optionsSorted> | null {
  if (!def || (def.dataType !== "picklist" && def.dataType !== "radio")) return null;
  const all = optionsSorted(def);
  if (field.kind === "picklist" && field.picklistOptions.length > 0) {
    const filtered = all.filter((o) => field.picklistOptions.includes(o.label));
    return filtered.length > 0 ? filtered : all;
  }
  return all;
}

function TransitionFieldInput({
  field,
  definitions,
  value,
  onChange,
  variant = "default",
}: {
  field: TransitionFormField;
  definitions: FieldDefinition[];
  value: string;
  onChange: (v: string) => void;
  variant?: "default" | "drawer";
}) {
  const def = definitions.find((d) => d.apiKey === field.fieldId);
  const d = variant === "drawer";
  const lb = d ? "mb-2 block text-sm font-medium text-[#1f1750]" : "mb-1 block text-sm font-medium text-ink";
  const ast = d ? "text-[#ff6678]" : "text-red-500";
  const inp = d
    ? "w-full rounded-full border-0 bg-[#e4e5e6] px-5 py-2.5 text-base text-[#1f1750] outline-none focus:ring-2 focus:ring-[#34369c]/25"
    : "w-full rounded-full border border-border-soft bg-[#e4e5e6] px-3 py-2 text-sm outline-none focus:border-accent";
  const txa = d
    ? "w-full resize-y rounded-lg border-0 bg-[#efeff1] p-4 text-sm text-[#1f1750] outline-none focus:ring-2 focus:ring-[#34369c]/25"
    : "w-full resize-y rounded-lg border border-border-soft bg-field-surface px-3 py-2 text-sm outline-none focus:border-accent";
  const box = d
    ? "max-h-40 space-y-2 overflow-y-auto rounded-lg border-0 bg-[#efeff1] px-3 py-2"
    : "max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border-soft bg-field-surface px-3 py-2";
  const rowLabel = d ? "flex cursor-pointer items-center gap-2 text-sm text-[#1f1750]" : "flex cursor-pointer items-center gap-2 text-sm text-ink";
  const roInp = d
    ? "w-full cursor-not-allowed rounded-full border-0 bg-[#e4e5e6]/70 px-5 py-2.5 text-sm text-[#7e7a95]"
    : "w-full cursor-not-allowed rounded-full border border-border-soft bg-muted/30 px-3 py-2 text-sm text-muted";

  const label = (
    <label className={lb}>
      {def?.label ?? field.label}
      {field.mandatory ? <span className={ast}> *</span> : null}
    </label>
  );

  if (field.kind === "remark" || field.kind === "textarea") {
    return (
      <div>
        {label}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={txa}
        />
      </div>
    );
  }

  if (field.kind === "picklist") {
    const opts = picklistOptionsForTransition(field, def);
    if (opts) {
      return (
        <div>
          {label}
          <select value={value} onChange={(e) => onChange(e.target.value)} className={inp}>
            <option value="">— Select —</option>
            {opts.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (field.picklistOptions.length > 0) {
      return (
        <div>
          {label}
          <select value={value} onChange={(e) => onChange(e.target.value)} className={inp}>
            <option value="">— Select —</option>
            {field.picklistOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }
  }

  if (field.kind === "multi_select") {
    if (def?.dataType === "multi_select") {
      const opts = optionsSorted(def);
      return (
        <div>
          {label}
          <div className={box}>
            {opts.map((opt) => {
              const on = parseMultiIds(value).includes(opt.id);
              return (
                <label key={opt.id} className={rowLabel}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onChange(toggleMultiId(value, opt.id))}
                    className="size-4 shrink-0 rounded border-border-soft text-accent"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <div>
        {label}
        <p className="text-xs text-muted">
          This transition uses multi-select, but field <code className="rounded bg-black/5 px-0.5">{field.fieldId}</code>{" "}
          is not multi-select in Fields. Update the field or the transition row.
        </p>
      </div>
    );
  }

  if (def) {
    if (def.dataType === "paragraph") {
      return (
        <div>
          {label}
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className={txa}
          />
        </div>
      );
    }
    if (def.dataType === "picklist" || def.dataType === "radio") {
      const opts = picklistOptionsForTransition(field, def) ?? optionsSorted(def);
      return (
        <div>
          {label}
          <select value={value} onChange={(e) => onChange(e.target.value)} className={inp}>
            <option value="">— Select —</option>
            {opts.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (def.dataType === "multi_select") {
      const opts = optionsSorted(def);
      return (
        <div>
          {label}
          <div className={box}>
            {opts.map((opt) => {
              const on = parseMultiIds(value).includes(opt.id);
              return (
                <label key={opt.id} className={rowLabel}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onChange(toggleMultiId(value, opt.id))}
                    className="size-4 shrink-0 rounded border-border-soft text-accent"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>
      );
    }
    if (def.dataType === "url") {
      return (
        <div>
          {label}
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://"
            className={inp}
          />
        </div>
      );
    }
    if (def.dataType === "email") {
      return (
        <div>
          {label}
          <input
            type="email"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inp}
          />
        </div>
      );
    }
    if (def.dataType === "phone") {
      return (
        <div>
          {label}
          <input
            type="tel"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inp}
          />
        </div>
      );
    }
    if (def.dataType === "number") {
      return (
        <div>
          {label}
          <input
            type="number"
            step={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inp}
          />
        </div>
      );
    }
    if (def.dataType === "decimal") {
      return (
        <div>
          {label}
          <input
            type="number"
            step="any"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inp}
          />
        </div>
      );
    }
    if (def.dataType === "date") {
      return (
        <div>
          {label}
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inp}
          />
        </div>
      );
    }
    if (def.dataType === "date_time") {
      return (
        <div>
          {label}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ISO or yyyy-mm-ddThh:mm"
            className={inp}
          />
        </div>
      );
    }
    if (def.dataType === "formula") {
      return (
        <div>
          {label}
          <input
            type="text"
            readOnly
            value={value}
            className={roInp}
            title="Formula fields are computed; not edited on transitions."
          />
        </div>
      );
    }

    return (
      <div>
        {label}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inp}
        />
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inp}
      />
    </div>
  );
}
