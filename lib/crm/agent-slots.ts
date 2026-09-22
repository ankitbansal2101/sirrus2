import type { CrmAgentMode } from "@/lib/agent/types";
import { findInhouseAgent, INHOUSE_AGENTS } from "@/lib/agent/catalog";
import type { CrmCustomAgent, CrmModule, CrmWorkspace } from "@/lib/crm/types";

function findModule(ws: CrmWorkspace, moduleId: string): CrmModule | undefined {
  return ws.modules.find((m) => m.id === moduleId || m.apiKey === moduleId);
}

function findAgent(ws: CrmWorkspace, agentId: string): CrmCustomAgent | undefined {
  return (ws.agents ?? []).find((a) => a.id === agentId);
}

/** One chat agent per screen. Values are custom agent ids, or null = built-in default for that screen. */
export type AgentPlacements = Record<string, string | null>;

export const MODULE_STUDIO_SURFACES = ["fields", "form", "blueprint", "overview"] as const;
export type ModuleStudioSurface = (typeof MODULE_STUDIO_SURFACES)[number];

export type AgentSlotDef = {
  key: string;
  label: string;
  hint: string;
  group: "Workspace" | "Module operations" | "Module studio" | "Studios";
  defaultInhouseId: string;
  defaultMode: CrmAgentMode;
  moduleScoped?: boolean;
};

export function globalSlot(surface: "workspace" | "widgets" | "charts"): string {
  return `global:${surface}`;
}

export function moduleSlot(moduleId: string, surface: "listing" | "record" | ModuleStudioSurface): string {
  return `module:${moduleId}:${surface}`;
}

export const GLOBAL_AGENT_SLOTS: AgentSlotDef[] = [
  {
    key: globalSlot("workspace"),
    label: "Workspace (left rail)",
    hint: "Sparkle on the dark rail — any module.",
    group: "Workspace",
    defaultInhouseId: "workspace",
    defaultMode: "universal",
  },
  {
    key: globalSlot("widgets"),
    label: "Marketplace widgets studio",
    hint: "Widget agent chat while designing iframe widgets.",
    group: "Studios",
    defaultInhouseId: "crm-config",
    defaultMode: "config",
  },
  {
    key: globalSlot("charts"),
    label: "Charts studio",
    hint: "Agent that helps build charts from module data.",
    group: "Studios",
    defaultInhouseId: "crm-config",
    defaultMode: "config",
  },
];

export const MODULE_OP_SLOTS: Omit<AgentSlotDef, "key">[] = [
  {
    label: "Listing",
    hint: "Pipeline table for this module.",
    group: "Module operations",
    defaultInhouseId: "module-records",
    defaultMode: "records",
    moduleScoped: true,
  },
  {
    label: "Record overview",
    hint: "Single record page — Ask agent in the header.",
    group: "Module operations",
    defaultInhouseId: "module-records",
    defaultMode: "records",
    moduleScoped: true,
  },
];

export const MODULE_STUDIO_SLOT_META: Record<
  ModuleStudioSurface,
  Omit<AgentSlotDef, "key" | "moduleScoped"> & { surface: ModuleStudioSurface }
> = {
  fields: {
    surface: "fields",
    label: "Fields configurator",
    hint: "Add and edit fields for this module.",
    group: "Module studio",
    defaultInhouseId: "crm-config",
    defaultMode: "config",
  },
  form: {
    surface: "form",
    label: "Form layout",
    hint: "Create/edit form — attach a “Form builder” agent here.",
    group: "Module studio",
    defaultInhouseId: "crm-config",
    defaultMode: "config",
  },
  blueprint: {
    surface: "blueprint",
    label: "Blueprint",
    hint: "Pipeline stages and transitions.",
    group: "Module studio",
    defaultInhouseId: "blueprint-builder",
    defaultMode: "config",
  },
  overview: {
    surface: "overview",
    label: "Overview layout",
    hint: "Details page builder widgets and tabs.",
    group: "Module studio",
    defaultInhouseId: "crm-config",
    defaultMode: "config",
  },
};

export function allSlotDefs(ws: CrmWorkspace): AgentSlotDef[] {
  const rows: AgentSlotDef[] = [...GLOBAL_AGENT_SLOTS];
  for (const mod of ws.modules) {
    for (const op of MODULE_OP_SLOTS) {
      rows.push({
        ...op,
        key: op.label === "Listing" ? moduleSlot(mod.id, "listing") : moduleSlot(mod.id, "record"),
        label: `${mod.pluralLabel} · ${op.label}`,
      });
    }
    for (const meta of Object.values(MODULE_STUDIO_SLOT_META)) {
      rows.push({
        ...meta,
        key: moduleSlot(mod.id, meta.surface),
        label: `${mod.pluralLabel} · ${meta.label}`,
        moduleScoped: true,
      });
    }
  }
  return rows;
}

function legacyPlacement(ws: CrmWorkspace, slotKey: string): string | null | undefined {
  if (slotKey === globalSlot("workspace")) return ws.workspaceAgentId ?? null;
  const modMatch = /^module:([^:]+):(listing|record)$/.exec(slotKey);
  if (!modMatch) return undefined;
  const mod = findModule(ws, modMatch[1]!);
  if (!mod) return null;
  return modMatch[2] === "listing" ? (mod.listingAgentId ?? null) : (mod.recordAgentId ?? null);
}

export function getSlotAssignment(ws: CrmWorkspace, slotKey: string): string | null {
  const map = ws.agentPlacements ?? {};
  if (slotKey in map) return map[slotKey] ?? null;
  const legacy = legacyPlacement(ws, slotKey);
  if (legacy !== undefined) return legacy;
  return null;
}

export function setSlotAssignment(ws: CrmWorkspace, slotKey: string, customAgentId: string | null): CrmWorkspace {
  const next: CrmWorkspace = {
    ...ws,
    agentPlacements: { ...(ws.agentPlacements ?? {}), [slotKey]: customAgentId },
  };
  const valid = customAgentId && findAgent(next, customAgentId) ? customAgentId : null;
  next.agentPlacements![slotKey] = valid;

  if (slotKey === globalSlot("workspace")) next.workspaceAgentId = valid;
  const modMatch = /^module:([^:]+):(listing|record)$/.exec(slotKey);
  if (modMatch) {
    const mod = findModule(next, modMatch[1]!);
    if (mod) {
      if (modMatch[2] === "listing") mod.listingAgentId = valid;
      else mod.recordAgentId = valid;
    }
  }
  return next;
}

export function slotDefForKey(ws: CrmWorkspace, slotKey: string): AgentSlotDef | undefined {
  return allSlotDefs(ws).find((s) => s.key === slotKey);
}

export function resolveSlotAgent(ws: CrmWorkspace, slotKey: string): {
  slot: AgentSlotDef;
  customAgentId: string | null;
  mode: CrmAgentMode;
  focusModuleId: string | null;
  defaultInhouseName: string;
  displayName: string;
} {
  const slot = slotDefForKey(ws, slotKey);
  if (!slot) {
    return {
      slot: {
        key: slotKey,
        label: slotKey,
        hint: "",
        group: "Workspace",
        defaultInhouseId: "crm-config",
        defaultMode: "config",
      },
      customAgentId: null,
      mode: "config",
      focusModuleId: null,
      defaultInhouseName: "CRM configuration agent",
      displayName: "CRM configuration agent",
    };
  }
  const customAgentId = getSlotAssignment(ws, slotKey);
  const custom = customAgentId ? findAgent(ws, customAgentId) : undefined;
  const inhouse = findInhouseAgent(slot.defaultInhouseId);
  const defaultInhouseName = inhouse?.name ?? "Built-in agent";
  const modMatch = /^module:([^:]+):/.exec(slotKey);
  const focusModuleId = modMatch?.[1] ?? null;
  return {
    slot,
    customAgentId: custom?.id ?? null,
    mode: custom ? "custom" : slot.defaultMode,
    focusModuleId,
    defaultInhouseName,
    displayName: custom?.name ?? defaultInhouseName,
  };
}

export function slotsUsingAgent(ws: CrmWorkspace, agentId: string): AgentSlotDef[] {
  return allSlotDefs(ws).filter((s) => getSlotAssignment(ws, s.key) === agentId);
}

export function clearAgentFromAllSlots(ws: CrmWorkspace, agentId: string): CrmWorkspace {
  let next = ws;
  const keys = Object.keys(next.agentPlacements ?? {}).filter((k) => next.agentPlacements![k] === agentId);
  for (const k of keys) next = setSlotAssignment(next, k, null);
  if (next.workspaceAgentId === agentId) next = setSlotAssignment(next, globalSlot("workspace"), null);
  for (const mod of next.modules) {
    if (mod.listingAgentId === agentId) next = setSlotAssignment(next, moduleSlot(mod.id, "listing"), null);
    if (mod.recordAgentId === agentId) next = setSlotAssignment(next, moduleSlot(mod.id, "record"), null);
  }
  return next;
}

export function onCallAgentsForSlot(ws: CrmWorkspace): { id: string; name: string }[] {
  return (ws.agents ?? [])
    .filter((a) => (a.kind ?? "on_call") === "on_call")
    .map((a) => ({ id: a.id, name: a.name }));
}

export function moduleLabelForSlot(ws: CrmWorkspace, slotKey: string): string | undefined {
  const modMatch = /^module:([^:]+):/.exec(slotKey);
  if (!modMatch) return undefined;
  return findModule(ws, modMatch[1]!)?.pluralLabel;
}
