import { usesOptions, type FieldDefinition } from "@/lib/fields-config/types";
import type { CrmModule, CrmModuleIcon, CrmRecord } from "@/lib/crm/types";

export function fieldById(mod: CrmModule, fieldId: string): FieldDefinition | undefined {
  return mod.fields.find((f) => f.id === fieldId);
}

export function fieldByApi(mod: CrmModule, apiKey: string): FieldDefinition | undefined {
  return mod.fields.find((f) => f.apiKey === apiKey);
}

export function displayFieldValue(field: FieldDefinition | undefined, raw: string | undefined): string {
  if (!field || raw == null || raw === "") return "—";
  if (usesOptions(field.dataType)) {
    if (field.dataType === "multi_select") {
      const ids = raw.split(",").filter(Boolean);
      const labels = ids.map((id) => field.options.find((o) => o.id === id)?.label ?? id);
      return labels.join(", ") || "—";
    }
    return field.options.find((o) => o.id === raw)?.label ?? raw;
  }
  return raw;
}

export function recordTitle(mod: CrmModule, rec: CrmRecord): string {
  return rec.values[mod.nameFieldApiKey]?.trim() || rec.displayId;
}

export function recordStageLabel(mod: CrmModule, rec: CrmRecord): string {
  if (!mod.stageFieldApiKey) return "";
  return displayFieldValue(fieldByApi(mod, mod.stageFieldApiKey), rec.values[mod.stageFieldApiKey]);
}

export function recordMatchesStage(mod: CrmModule, rec: CrmRecord, stageId: string): boolean {
  const stage = mod.blueprint.stages.find((s) => s.id === stageId);
  if (!stage || !mod.stageFieldApiKey) return false;
  const field = fieldByApi(mod, mod.stageFieldApiKey);
  const opt = field?.options.find((o) => o.label === stage.label);
  const val = rec.values[mod.stageFieldApiKey] ?? "";
  if (opt) return val === opt.id;
  return val === stage.id || val.toLowerCase() === stage.label.toLowerCase();
}

export function initialsFromName(name: string): string {
  const t = name.trim();
  if (!t) return "NA";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  return t.slice(0, 2).toUpperCase();
}

export function stagePillStyle(label: string): { backgroundColor: string; color: string } {
  const key = label.toLowerCase();
  const ink = "rgb(22, 20, 15)";
  if (key.includes("new lead") || key === "new")
    return { backgroundColor: "rgb(214, 236, 247)", color: ink };
  if (key.includes("site visit") || key.includes("visit"))
    return { backgroundColor: "rgb(247, 232, 176)", color: ink };
  if (key.includes("booked") || key.includes("won") || key.includes("closed"))
    return { backgroundColor: "rgb(196, 232, 210)", color: ink };
  if (key.includes("negotiation") || key.includes("proposal"))
    return { backgroundColor: "rgb(236, 226, 208)", color: ink };
  if (key.includes("dropped") || key.includes("unqualified") || key.includes("lost"))
    return { backgroundColor: "rgb(247, 210, 204)", color: ink };
  if (key.includes("contacted") || key.includes("prospect"))
    return { backgroundColor: "rgb(214, 232, 224)", color: ink };
  return { backgroundColor: "rgb(236, 226, 208)", color: ink };
}

export function moduleIconLabel(icon: CrmModuleIcon): string {
  return icon.replace("_", " ");
}
