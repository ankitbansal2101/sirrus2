import type { FieldDefinition } from "@/lib/fields-config/types";
import { buildDefaultLeadFormLayout } from "@/lib/lead-form-layout/default-layout";
import type { LeadFormLayoutV1, LeadFormSection } from "@/lib/lead-form-layout/types";
import { schedulePrototypeDiskPush } from "@/lib/prototype-persist/push";

export const LEAD_FORM_LAYOUT_STORAGE_KEY = "sirrus2_lead_form_layout_v1";

export const LEAD_FORM_LAYOUT_CHANGED_EVENT = "sirrus2-lead-form-layout-changed";

function isLayout(x: unknown): x is LeadFormLayoutV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (!Array.isArray(o.sections)) return false;
  return o.sections.every(
    (s) =>
      s &&
      typeof s === "object" &&
      typeof (s as LeadFormSection).id === "string" &&
      typeof (s as LeadFormSection).title === "string" &&
      Array.isArray((s as LeadFormSection).fieldIds),
  );
}

/**
 * Remove unknown / duplicate field ids.
 * Legacy `sec-additional` is dropped (its fields return to the off-form pool in the editor).
 * New schema fields are not auto-placed — they stay unused until the user adds them.
 */
export function sanitizeLeadFormLayout(layout: LeadFormLayoutV1, fields: FieldDefinition[]): LeadFormLayoutV1 {
  const valid = new Set(fields.map((f) => f.id));
  const withoutLegacyAdditional = layout.sections.filter((s) => s.id !== "sec-additional");
  const seen = new Set<string>();
  const sections = withoutLegacyAdditional.map((s) => ({
    ...s,
    fieldIds: s.fieldIds.filter((id) => {
      if (!valid.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    }),
  }));
  return { version: 1, sections };
}

export function loadLeadFormLayoutRaw(): LeadFormLayoutV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEAD_FORM_LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isLayout(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Resolved layout for the current field schema (persisted + merge + defaults). */
export function resolveLeadFormLayout(fields: FieldDefinition[]): LeadFormLayoutV1 {
  const raw = loadLeadFormLayoutRaw();
  const base = raw ?? buildDefaultLeadFormLayout(fields);
  return sanitizeLeadFormLayout(base, fields);
}

/** Field ids in create-lead order (sections top-to-bottom, fields left-to-right in preview grid). */
export function flattenLeadFormFieldIds(layout: LeadFormLayoutV1): string[] {
  return layout.sections.flatMap((s) => s.fieldIds);
}

export function saveLeadFormLayout(layout: LeadFormLayoutV1): boolean {
  if (typeof window === "undefined") return false;
  if (!isLayout(layout)) return false;
  try {
    localStorage.setItem(LEAD_FORM_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    window.dispatchEvent(new Event(LEAD_FORM_LAYOUT_CHANGED_EVENT));
    schedulePrototypeDiskPush();
    return true;
  } catch {
    return false;
  }
}
