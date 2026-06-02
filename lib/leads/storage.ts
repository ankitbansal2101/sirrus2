import { loadBlueprint } from "@/lib/blueprint/storage";
import { schedulePrototypeDiskPush } from "@/lib/prototype-persist/push";
import type { BlueprintDocument } from "@/lib/blueprint/types";
import { defaultBlueprintDocument } from "@/lib/blueprint/standard-blueprint";
import { resolveStageField } from "@/lib/blueprint/from-fields-schema";
import { createDefaultLeadFields, type FieldDefinition } from "@/lib/fields-config/types";
import { loadFieldsSchema } from "@/lib/fields-config/schema-storage";
import type { LeadRecord, LeadRelatedDemoRow } from "@/lib/leads/types";
import { defaultSubstageIdForState, stateToStageOptionId, substageFieldApiKey } from "@/lib/leads/stage-bridge";

export const LEADS_STORAGE_KEY = "sirrus2_leads_v1";

export const LEADS_CHANGED_EVENT = "sirrus2-leads-changed";

function loadBlueprintForSeed(): BlueprintDocument {
  if (typeof window === "undefined") return defaultBlueprintDocument();
  return loadBlueprint() ?? defaultBlueprintDocument();
}

function newLeadId(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c && typeof c.randomUUID === "function") return c.randomUUID();
  return `lead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Deterministic sample related rows for connected-module filters in the prototype. */
export function seedRelatedDemoForLead(index: number): NonNullable<LeadRecord["relatedDemo"]> {
  const baseTime = Date.now() - index * 3600000;
  const iso = (offsetH: number) => new Date(baseTime + offsetH * 3600000).toISOString();

  const calls: LeadRelatedDemoRow[] =
    index % 3 === 0
      ? []
      : [
          {
            call_start_time: iso(-2),
            call_end_time: iso(-1),
            call_duration_seconds: String(120 + index * 10),
            call_owner: index % 2 === 0 ? "co_a" : "co_b",
            call_type: "ct_in",
            call_status: "cs_comp",
          },
        ];

  const tasks: LeadRelatedDemoRow[] =
    index % 4 === 1
      ? []
      : [
          {
            task_type: "tt_fu",
            due_date: iso(24),
            task_status: index % 2 === 0 ? "ts_open" : "ts_done",
            task_owner: "to_a",
          },
        ];

  const channel_partner: LeadRelatedDemoRow[] =
    index % 5 === 2
      ? []
      : [
          {
            cp_name: `Partner ${index}`,
            cp_tier: "tier_gold",
            cp_region: "reg_n",
          },
        ];

  return { calls, tasks, channel_partner };
}

function nextDisplayId(seq: number) {
  const d = new Date();
  const y = d.getFullYear() % 100;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `L${String(y).padStart(2, "0")}${m}${day}${String(seq).padStart(4, "0")}`;
}

function maxDisplaySeq(leads: LeadRecord[]): number {
  let max = 2600;
  for (const l of leads) {
    const m = /^L\d{6}(\d{4})$/.exec(l.displayId ?? "");
    if (m) max = Math.max(max, Number.parseInt(m[1]!, 10));
  }
  return max;
}

type TestLeadSpec = {
  name: string;
  stateLabel: string;
  substageLabel?: string;
};

/** Sample leads spread across main stages (and sub-stages when the active blueprint defines them). */
export function buildBlueprintTestLeads(
  fields: FieldDefinition[],
  doc: BlueprintDocument,
  existing: LeadRecord[],
): LeadRecord[] {
  const stageField = resolveStageField(fields, doc.stageField);
  const substageKey = substageFieldApiKey(doc);
  const specs: TestLeadSpec[] = [
    { name: "Substage Test — New", stateLabel: "New" },
    { name: "Substage Test — Contacted", stateLabel: "Contacted" },
    { name: "Substage Test — Qualified", stateLabel: "Qualified" },
    { name: "Substage Test — SV Scheduled", stateLabel: "Site Visit", substageLabel: "Scheduled" },
    { name: "Substage Test — SV Done", stateLabel: "Site Visit", substageLabel: "Done" },
    { name: "Substage Test — SV Cancelled", stateLabel: "Site Visit", substageLabel: "Cancelled" },
    { name: "Substage Test — SV No Show", stateLabel: "Site Visit", substageLabel: "No Show" },
    { name: "Substage Test — Opportunity", stateLabel: "Opportunity" },
  ];

  const assignField = fields.find((f) => f.apiKey === "assigned_to") ?? fields.find((f) => f.apiKey === "lead_owner");
  const ownerOpt = assignField?.options[0];
  const sourceField = fields.find((f) => f.apiKey === "source");
  const srcOpts = sourceField?.options ?? [];
  let seq = maxDisplaySeq(existing) + 1;

  return specs.map((spec, i) => {
    const state = doc.states.find((s) => s.label.trim().toLowerCase() === spec.stateLabel.trim().toLowerCase());
    const stageOptionId = state && stageField ? stateToStageOptionId(stageField, state) ?? "" : "";
    let substageId = "";
    if (state && spec.substageLabel) {
      const hit = state.substages?.find(
        (ss) => ss.label.trim().toLowerCase() === spec.substageLabel!.trim().toLowerCase(),
      );
      substageId = hit?.id ?? defaultSubstageIdForState(state);
    } else if (state?.substages?.length) {
      substageId = defaultSubstageIdForState(state);
    }

    const values: Record<string, string> = {};
    for (const f of fields) {
      if (f.apiKey === "lead_name") values[f.apiKey] = spec.name;
      else if (f.apiKey === "whatsapp_number" || f.apiKey === "phone")
        values[f.apiKey] = `91000${String(20000 + i).slice(-4)}`;
      else if (f.apiKey === "alternate_number") values[f.apiKey] = "";
      else if (f.apiKey === "email") values[f.apiKey] = `substage.test${i + 1}@example.com`;
      else if (f.apiKey === "assigned_to" && ownerOpt) values[f.apiKey] = ownerOpt.id;
      else if (f.apiKey === "lead_owner" && ownerOpt) values[f.apiKey] = ownerOpt.id;
      else if (f.apiKey === "source" && srcOpts.length) values[f.apiKey] = srcOpts[i % srcOpts.length]!.id;
      else if (f.apiKey === doc.stageField || f.apiKey === "stage") values[f.apiKey] = stageOptionId;
      else if (f.apiKey === substageKey) values[f.apiKey] = substageId;
      else values[f.apiKey] = "";
    }

    const now = new Date(Date.now() - i * 3600000).toISOString();
    const baseIndex = existing.length + i;
    return {
      id: newLeadId(),
      displayId: nextDisplayId(seq++),
      values,
      createdAt: now,
      updatedAt: now,
      relatedDemo: seedRelatedDemoForLead(baseIndex),
    };
  });
}

/** Append blueprint test leads to localStorage (for Manage leads / sub-stage flows). */
export function appendBlueprintTestLeads(): LeadRecord[] {
  const fields = loadFieldsSchema() ?? createDefaultLeadFields();
  const doc = loadBlueprintForSeed();
  const existing = loadLeads();
  const added = buildBlueprintTestLeads(fields, doc, existing);
  const merged = [...existing, ...added];
  saveLeads(merged);
  return merged;
}

function seedLeads(): LeadRecord[] {
  const fields = loadFieldsSchema() ?? createDefaultLeadFields();
  const doc = loadBlueprintForSeed();
  const stageField = resolveStageField(fields, doc.stageField);
  const nonNone = doc.states.filter((s) => !/^-\s*none\s*-$/i.test(s.label.trim()));
  const pool = nonNone.length ? nonNone : doc.states;

  const pickStage = (i: number) => {
    const s = pool[i % Math.max(1, pool.length)] ?? pool[0];
    const oid = stageField && s ? stateToStageOptionId(stageField, s) : undefined;
    return { stateLabel: s?.label ?? "New", optionId: oid ?? "" };
  };

  const names = [
    "Rangeet BookingTest",
    "Sunit Auto",
    "PerfTestingw",
    "Dev Test one",
    "srikant singh",
    "Amit Singh",
    "Dishant",
    "Sparsh",
  ];

  const rows: LeadRecord[] = names.map((name, i) => {
    const { optionId } = pickStage(i);
    const assignField = fields.find((f) => f.apiKey === "assigned_to") ?? fields.find((f) => f.apiKey === "lead_owner");
    const ownerOpt = assignField?.options[0];
    const sourceField = fields.find((f) => f.apiKey === "source");
    const srcOpts = sourceField?.options ?? [];
    const srcOpt = srcOpts.length ? srcOpts[i % srcOpts.length] : undefined;
    const values: Record<string, string> = {};
    for (const f of fields) {
      if (f.apiKey === "lead_name") values[f.apiKey] = name;
      else if (f.apiKey === "whatsapp_number" || f.apiKey === "phone")
        values[f.apiKey] = `90000${String(10000 + i).slice(-4)}`;
      else if (f.apiKey === "alternate_number") values[f.apiKey] = "";
      else if (f.apiKey === "email") values[f.apiKey] = `lead${i + 1}@example.com`;
      else if (f.apiKey === "assigned_to" && ownerOpt) values[f.apiKey] = ownerOpt.id;
      else if (f.apiKey === "lead_owner" && ownerOpt) values[f.apiKey] = ownerOpt.id;
      else if (f.apiKey === "source" && srcOpt) values[f.apiKey] = srcOpt.id;
      else if (f.apiKey === "stage") values[f.apiKey] = optionId;
      else values[f.apiKey] = "";
    }
    const now = new Date(Date.now() - i * 86400000 * 3).toISOString();
    return {
      id: newLeadId(),
      displayId: nextDisplayId(2600 + i),
      values,
      createdAt: now,
      updatedAt: now,
      relatedDemo: seedRelatedDemoForLead(i),
    };
  });
  return rows;
}

export function loadLeads(): LeadRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEADS_STORAGE_KEY);
    if (!raw) {
      const seeded = seedLeads();
      window.localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(seeded));
      schedulePrototypeDiskPush();
      return seeded;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = seedLeads();
      window.localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(seeded));
      schedulePrototypeDiskPush();
      return seeded;
    }
    return parsed
      .filter((x) => x && typeof x === "object")
      .map((x, idx) => {
        const o = x as Record<string, unknown>;
        const relatedRaw = o.relatedDemo;
        const baseRel = seedRelatedDemoForLead(idx);
        let relatedDemo: LeadRecord["relatedDemo"];
        if (relatedRaw && typeof relatedRaw === "object") {
          const r = relatedRaw as Record<string, unknown>;
          relatedDemo = {
            calls: Array.isArray(r.calls) ? (r.calls as LeadRelatedDemoRow[]) : baseRel.calls,
            tasks: Array.isArray(r.tasks) ? (r.tasks as LeadRelatedDemoRow[]) : baseRel.tasks,
            channel_partner: Array.isArray(r.channel_partner)
              ? (r.channel_partner as LeadRelatedDemoRow[])
              : baseRel.channel_partner,
          };
        } else {
          relatedDemo = baseRel;
        }
        return {
          id: String(o.id ?? newLeadId()),
          displayId: String(o.displayId ?? ""),
          values: (o.values && typeof o.values === "object" ? (o.values as Record<string, string>) : {}) ?? {},
          createdAt: String(o.createdAt ?? new Date().toISOString()),
          updatedAt: String(o.updatedAt ?? new Date().toISOString()),
          relatedDemo,
        };
      });
  } catch {
    return seedLeads();
  }
}

export function saveLeads(leads: LeadRecord[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(leads));
    window.dispatchEvent(new Event(LEADS_CHANGED_EVENT));
    schedulePrototypeDiskPush();
    return true;
  } catch {
    return false;
  }
}

export function upsertLead(leads: LeadRecord[], next: LeadRecord): LeadRecord[] {
  const i = leads.findIndex((l) => l.id === next.id);
  if (i === -1) return [...leads, next];
  const copy = [...leads];
  copy[i] = next;
  return copy;
}
