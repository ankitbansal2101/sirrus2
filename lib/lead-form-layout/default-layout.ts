import type { FieldDefinition } from "@/lib/fields-config/types";
import type { LeadFormLayoutV1, LeadFormSection } from "@/lib/lead-form-layout/types";

/** Default create-lead grouping (matches common CRM “Lead Info / Preferences / Profile”). */
const INFO_API_ORDER = [
  "lead_name",
  "project_name",
  "source",
  "sub_source",
  "stage",
  "whatsapp_number",
  "alternate_number",
  "email",
  "assigned_to",
  "lead_owner",
  "phone",
] as const;

const PREF_API_ORDER = [
  "preferred_unit_type",
  "max_budget",
  "property_status",
  "other_preferences",
  "purpose",
  "preferred_location",
] as const;

const PROFILE_API_ORDER = ["age", "gender", "occupation", "qualification", "funding_source"] as const;

function idsForApiOrder(fields: FieldDefinition[], order: readonly string[]): string[] {
  const out: string[] = [];
  for (const api of order) {
    const f = fields.find((x) => x.apiKey === api);
    if (f) out.push(f.id);
  }
  return out;
}

export function buildDefaultLeadFormLayout(fields: FieldDefinition[]): LeadFormLayoutV1 {
  const info = idsForApiOrder(fields, INFO_API_ORDER);
  const pref = idsForApiOrder(fields, PREF_API_ORDER);
  const prof = idsForApiOrder(fields, PROFILE_API_ORDER);

  /** Other schema fields stay off the form until dragged in (see customise-lead-form pool). */
  const sections: LeadFormSection[] = [
    { id: "sec-lead-info", title: "Lead Info", fieldIds: info },
    { id: "sec-preferences", title: "Preferences", fieldIds: pref },
    { id: "sec-profile", title: "Profile", fieldIds: prof },
  ];
  return { version: 1, sections };
}
