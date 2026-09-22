import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createDefaultLeadFields, type FieldDefinition } from "@/lib/fields-config/types";
import type { CrmModule, CrmRecord, CrmWorkspace } from "@/lib/crm/types";
import { compactWorkspace } from "@/lib/crm/agent/tools";
import { loadLivePrototypeState, parsePrototypeState, saveLivePrototypeState } from "@/lib/prototype-persist/live-store";
import type { PrototypeStateFile } from "@/lib/prototype-persist/types";
import bundledSnapshot from "@/data/mcp-snapshot.json";

export const PROTOTYPE_STATE_FILE = join(process.cwd(), "data", "prototype-state.json");

export type McpWorkspaceSnap = {
  workspace: CrmWorkspace;
  savedAt: string | null;
  path: string;
  source: "crmWorkspace" | "legacy-leads";
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function vercelHosted() {
  const v = process.env.VERCEL;
  return v === "1" || v === "true";
}

export function isCrmWorkspace(x: unknown): x is CrmWorkspace {
  if (!isRecord(x)) return false;
  return x.version === 1 && typeof x.orgName === "string" && Array.isArray(x.modules);
}

function readLocalDiskRaw(): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(readFileSync(PROTOTYPE_STATE_FILE, "utf8")) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseLeads(raw: unknown): CrmRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l): l is Record<string, unknown> => isRecord(l) && typeof l.id === "string")
    .map((l) => ({
      id: String(l.id),
      displayId: typeof l.displayId === "string" ? l.displayId : "",
      values: isRecord(l.values) ? (l.values as Record<string, string>) : {},
      createdAt: typeof l.createdAt === "string" ? l.createdAt : new Date().toISOString(),
      updatedAt: typeof l.updatedAt === "string" ? l.updatedAt : new Date().toISOString(),
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

function workspaceFromLegacyLeads(raw: Record<string, unknown>, path: string): McpWorkspaceSnap {
  const fields = parseFields(raw.fieldsSchema);
  const records = parseLeads(raw.leads);
  const nameField = fields.find((f) => f.apiKey === "lead_name" || f.apiKey === "name") ?? fields[0];
  const stageField = fields.find((f) => f.apiKey === "stage");
  const now = typeof raw.savedAt === "string" ? raw.savedAt : new Date().toISOString();
  const mod: CrmModule = {
    id: "mod_legacy_leads",
    apiKey: "leads",
    label: "Lead",
    pluralLabel: "Leads",
    description: "Legacy Manage Leads snapshot — no crmWorkspace was present.",
    icon: "leads",
    nameFieldApiKey: nameField?.apiKey ?? "name",
    stageFieldApiKey: stageField?.apiKey ?? null,
    fields,
    formLayout: { version: 1, sections: [] },
    blueprint: { stages: [], transitions: [] },
    overviewLayout: { widgets: [] },
    listColumnFieldIds: fields.slice(0, 6).map((f) => f.id),
    records,
    createdAt: now,
  };
  return {
    source: "legacy-leads",
    path,
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : null,
    workspace: {
      version: 1,
      orgName: typeof raw.orgName === "string" ? raw.orgName : "Sirrus",
      industryId: "legacy",
      industryLabel: "Legacy leads",
      onboardedAt: now,
      modules: [mod],
      agents: [],
      workflows: [],
      marketplaceWidgets: [],
      charts: [],
    },
  };
}

function fromPrototype(raw: unknown, path: string): McpWorkspaceSnap | null {
  if (!isRecord(raw)) return null;
  if (isCrmWorkspace(raw.crmWorkspace)) {
    return {
      source: "crmWorkspace",
      path,
      savedAt: typeof raw.savedAt === "string" ? raw.savedAt : null,
      workspace: raw.crmWorkspace,
    };
  }
  if (Array.isArray(raw.leads) && raw.leads.length) {
    return workspaceFromLegacyLeads(raw, path);
  }
  return null;
}

export async function loadMcpWorkspace(): Promise<McpWorkspaceSnap> {
  try {
    const live = await loadLivePrototypeState();
    if (live) {
      const snap = fromPrototype(live, "vercel-blob:sirrus/prototype-state.json");
      if (snap) return snap;
    }
  } catch {
    /* ignore blob */
  }
  if (!vercelHosted()) {
    const disk = readLocalDiskRaw();
    if (disk) {
      const snap = fromPrototype(disk, PROTOTYPE_STATE_FILE);
      if (snap) return snap;
    }
  }
  const bundled = fromPrototype(bundledSnapshot, "data/mcp-snapshot.json");
  if (bundled) return bundled;
  return workspaceFromLegacyLeads({ version: 1, leads: [], fieldsSchema: createDefaultLeadFields() }, "empty");
}

function writeLocalDisk(next: PrototypeStateFile): boolean {
  if (vercelHosted()) return false;
  try {
    mkdirSync(dirname(PROTOTYPE_STATE_FILE), { recursive: true });
    writeFileSync(PROTOTYPE_STATE_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}

function previousState(): PrototypeStateFile {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    fieldsSchema: createDefaultLeadFields(),
    blueprint: null,
    leads: [],
  };
}

export async function saveMcpWorkspace(workspace: CrmWorkspace): Promise<boolean> {
  let previous: PrototypeStateFile = previousState();
  try {
    const live = await loadLivePrototypeState();
    if (live) previous = live;
    else {
      const disk = readLocalDiskRaw();
      const parsed = disk ? parsePrototypeState(disk) : null;
      if (parsed) previous = parsed;
    }
  } catch {
    /* keep previous */
  }
  const next: PrototypeStateFile = {
    ...previous,
    version: 1,
    savedAt: new Date().toISOString(),
    crmWorkspace: workspace,
  };
  const savedLive = await saveLivePrototypeState(next);
  const savedDisk = writeLocalDisk(next);
  return savedLive.ok || savedDisk;
}

export function mcpWorkspaceSummary(snap: McpWorkspaceSnap) {
  const compact = compactWorkspace(snap.workspace);
  return {
    savedAt: snap.savedAt,
    path: snap.path,
    source: snap.source,
    orgName: compact.orgName,
    industryLabel: compact.industryLabel,
    modules: compact.modules.map((m) => ({
      id: m.id,
      apiKey: m.apiKey,
      label: m.label,
      pluralLabel: m.pluralLabel,
      recordCount: m.recordCount,
      fieldCount: m.fields.length,
      listingColumns: m.listColumns,
    })),
  };
}
