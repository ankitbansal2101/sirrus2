import {
  BLUEPRINT_CHANGED_EVENT,
  BLUEPRINT_LIBRARY_KEY,
  type BlueprintLibraryV1,
} from "@/lib/blueprint/storage";
import type { BlueprintDocument } from "@/lib/blueprint/types";
import { FIELDS_SCHEMA_CHANGED_EVENT, FIELDS_SCHEMA_STORAGE_KEY } from "@/lib/fields-config/schema-storage";
import { LEAD_FORM_LAYOUT_CHANGED_EVENT, LEAD_FORM_LAYOUT_STORAGE_KEY } from "@/lib/lead-form-layout/storage";
import { LEADS_CHANGED_EVENT, LEADS_STORAGE_KEY } from "@/lib/leads/storage";
import type { PrototypeStateFile } from "@/lib/prototype-persist/types";
function isNonEmptyArray(x: unknown): x is unknown[] {
  return Array.isArray(x) && x.length > 0;
}

function isBlueprintish(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return Array.isArray(o.states) && Array.isArray(o.transitions);
}

function isLeadFormLayoutSnap(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return o.version === 1 && Array.isArray(o.sections);
}

function isLibraryV1(x: unknown): x is BlueprintLibraryV1 {
  if (!x || typeof x !== "object" || (x as BlueprintLibraryV1).version !== 1) return false;
  const o = x as BlueprintLibraryV1;
  return typeof o.activeBlueprintId === "string" && Array.isArray(o.blueprints) && o.blueprints.length > 0;
}

export function applyPrototypeSnapshotToLocalStorage(snap: PrototypeStateFile): void {
  if (typeof window === "undefined") return;

  let touchedFields = false;
  let touchedBlueprint = false;
  let touchedLeads = false;
  let touchedLeadForm = false;

  if (isNonEmptyArray(snap.fieldsSchema)) {
    localStorage.setItem(FIELDS_SCHEMA_STORAGE_KEY, JSON.stringify(snap.fieldsSchema));
    touchedFields = true;
  }
  if (isLibraryV1(snap.blueprintLibrary)) {
    localStorage.setItem(BLUEPRINT_LIBRARY_KEY, JSON.stringify(snap.blueprintLibrary));
    touchedBlueprint = true;
  } else if (isBlueprintish(snap.blueprint)) {
    const doc = snap.blueprint as BlueprintDocument;
    const id = typeof doc.id === "string" ? doc.id : "bp_restored";
    const lib: BlueprintLibraryV1 = {
      version: 1,
      activeBlueprintId: id,
      blueprints: [doc],
    };
    localStorage.setItem(BLUEPRINT_LIBRARY_KEY, JSON.stringify(lib));
    touchedBlueprint = true;
  }
  if (isNonEmptyArray(snap.leads)) {
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(snap.leads));
    touchedLeads = true;
  }
  if (isLeadFormLayoutSnap(snap.leadFormLayout)) {
    localStorage.setItem(LEAD_FORM_LAYOUT_STORAGE_KEY, JSON.stringify(snap.leadFormLayout));
    touchedLeadForm = true;
  }

  if (touchedFields) window.dispatchEvent(new Event(FIELDS_SCHEMA_CHANGED_EVENT));
  if (touchedBlueprint) window.dispatchEvent(new Event(BLUEPRINT_CHANGED_EVENT));
  if (touchedLeads) window.dispatchEvent(new Event(LEADS_CHANGED_EVENT));
  if (touchedLeadForm) window.dispatchEvent(new Event(LEAD_FORM_LAYOUT_CHANGED_EVENT));
}
