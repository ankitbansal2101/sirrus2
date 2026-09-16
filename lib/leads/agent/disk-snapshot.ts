import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createDefaultLeadFields, type FieldDefinition } from "@/lib/fields-config/types";
import type { LeadRecord } from "@/lib/leads/types";
import type { PrototypeStateFile } from "@/lib/prototype-persist/types";
import bundledSnapshot from "@/data/mcp-snapshot.json";

export const PROTOTYPE_STATE_FILE = join(process.cwd(), "data", "prototype-state.json");

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function parseLeads(raw: unknown): LeadRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l): l is Record<string, unknown> => isRecord(l) && typeof l.id === "string")
    .map((l) => ({
      id: String(l.id),
      displayId: typeof l.displayId === "string" ? l.displayId : "",
      values: isRecord(l.values) ? (l.values as Record<string, string>) : {},
      createdAt: typeof l.createdAt === "string" ? l.createdAt : new Date().toISOString(),
      updatedAt: typeof l.updatedAt === "string" ? l.updatedAt : new Date().toISOString(),
      relatedDemo: isRecord(l.relatedDemo) ? (l.relatedDemo as LeadRecord["relatedDemo"]) : undefined,
    }));
}

function parseFields(raw: unknown): FieldDefinition[] {
  if (!Array.isArray(raw) || raw.length === 0) return createDefaultLeadFields();
  const rows = raw.filter(
    (f): f is Record<string, unknown> => isRecord(f) && typeof f.apiKey === "string" && typeof f.label === "string",
  );
  if (!rows.length) return createDefaultLeadFields();
  return rows.map((f) => ({
    ...(f as unknown as FieldDefinition),
    apiKey: String(f.apiKey),
    label: String(f.label),
    dataType: (typeof f.dataType === "string" ? f.dataType : "text") as FieldDefinition["dataType"],
    options: Array.isArray(f.options) ? (f.options as FieldDefinition["options"]) : [],
  }));
}

function fromRaw(raw: unknown, path: string): LeadsDiskSnapshot {
  if (!isRecord(raw)) {
    return { leads: [], fields: createDefaultLeadFields(), savedAt: null, path };
  }
  return {
    leads: parseLeads(raw.leads),
    fields: parseFields(raw.fieldsSchema),
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : null,
    path,
  };
}

export type LeadsDiskSnapshot = {
  leads: LeadRecord[];
  fields: FieldDefinition[];
  savedAt: string | null;
  path: string;
};

function vercelHosted() {
  const v = process.env.VERCEL;
  return v === "1" || v === "true";
}

export function loadLeadsDiskSnapshot(): LeadsDiskSnapshot {
  if (!vercelHosted()) {
    try {
      const raw = readFileSync(PROTOTYPE_STATE_FILE, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const snap = fromRaw(parsed, PROTOTYPE_STATE_FILE);
      if (snap.leads.length) return snap;
    } catch {
      /* fall through to bundled snapshot */
    }
  }
  return fromRaw(bundledSnapshot, "data/mcp-snapshot.json");
}

/** Write updated leads back into the prototype snapshot. Returns false on Vercel (read-only). */
export function saveLeadsDiskSnapshot(leads: LeadRecord[]): boolean {
  if (vercelHosted()) return false;
  let previous: Record<string, unknown> = {};
  try {
    const raw = readFileSync(PROTOTYPE_STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (isRecord(parsed)) previous = parsed;
  } catch {
    previous = { version: 1, fieldsSchema: createDefaultLeadFields() };
  }

  const next: PrototypeStateFile = {
    version: 1,
    savedAt: new Date().toISOString(),
    fieldsSchema: previous.fieldsSchema ?? createDefaultLeadFields(),
    blueprint: previous.blueprint ?? null,
    blueprintLibrary: previous.blueprintLibrary,
    leads,
    leadFormLayout: previous.leadFormLayout,
  };

  try {
    mkdirSync(dirname(PROTOTYPE_STATE_FILE), { recursive: true });
    writeFileSync(PROTOTYPE_STATE_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}
