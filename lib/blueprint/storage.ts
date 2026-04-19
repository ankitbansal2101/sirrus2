import { migrateBlueprintDocument } from "@/lib/blueprint/migrate";
import type { BlueprintDocument } from "@/lib/blueprint/types";
import { defaultBlueprintDocument } from "@/lib/blueprint/types";
import { loadFieldsSchema } from "@/lib/fields-config/schema-storage";
import { createDefaultLeadFields } from "@/lib/fields-config/types";

export const BLUEPRINT_STORAGE_KEY = "sirrus2_blueprint_v1";

export function saveBlueprint(doc: BlueprintDocument): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(BLUEPRINT_STORAGE_KEY, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

export function loadBlueprint(): BlueprintDocument | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BLUEPRINT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed?.states || !Array.isArray(parsed.states) || !Array.isArray(parsed.transitions)) return null;
    const doc: BlueprintDocument = {
      id: String(parsed.id ?? "bp_doc"),
      name: String(parsed.name ?? ""),
      module: String(parsed.module ?? ""),
      stageField: String(parsed.stageField ?? "stage"),
      states: parsed.states as BlueprintDocument["states"],
      transitions: parsed.transitions as BlueprintDocument["transitions"],
    };
    const fieldRows = loadFieldsSchema() ?? createDefaultLeadFields();
    return migrateBlueprintDocument(doc, fieldRows);
  } catch {
    return null;
  }
}

export function loadBlueprintOrDefault(): BlueprintDocument {
  return loadBlueprint() ?? defaultBlueprintDocument();
}
