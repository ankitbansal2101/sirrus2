/**
 * Standard CRM field layout — default when no saved schema exists.
 * Keep `lead_name` and `stage` apiKeys aligned with Manage Leads and the Standard blueprint.
 *
 * Local option helper avoids a runtime import cycle with `types.ts` (which imports this module).
 */
import type { FieldDefinition, FieldOption } from "@/lib/fields-config/types";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

function optionValueFromLabel(label: string): string {
  const s = slugify(label);
  return s || "choice";
}

function newOptionId(stableId?: string): string {
  if (stableId) return stableId;
  const c = globalThis.crypto;
  if (c && "randomUUID" in c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `opt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createOption(label: string, value?: string, stableId?: string): FieldOption {
  return {
    id: newOptionId(stableId),
    label,
    value: value ?? optionValueFromLabel(label),
  };
}

function pl(labels: string[], idPrefix: string): FieldOption[] {
  return labels.map((label, i) => createOption(label, undefined, `${idPrefix}_${i}`));
}

function f(p: {
  id: string;
  apiKey: string;
  label: string;
  dataType: FieldDefinition["dataType"];
  required?: boolean;
  allowDuplicate?: boolean;
  options?: FieldOption[];
  isSystem?: boolean;
  locked?: boolean;
  defaultOptionId?: string;
  includeInFilters?: boolean;
}): FieldDefinition {
  return {
    id: p.id,
    apiKey: p.apiKey,
    label: p.label,
    dataType: p.dataType,
    required: p.required ?? false,
    allowDuplicate: p.allowDuplicate ?? true,
    options: p.options ?? [],
    defaultOptionId: p.defaultOptionId,
    defaultOptionIds: [],
    orderPreference: "manual",
    formulaExpression: "",
    isSystem: p.isSystem ?? false,
    locked: p.locked ?? false,
    includeInFilters: p.includeInFilters ?? true,
  };
}

/** Stage ids + labels — single source for Standard blueprint and the `stage` picklist. */
export const STANDARD_BLUEPRINT_STATES = [
  { id: "st_new", label: "New" },
  { id: "st_contacted", label: "Contacted" },
  { id: "st_qualified", label: "Qualified" },
  { id: "st_sv_sched", label: "Site Visit Scheduled" },
  { id: "st_sv_done", label: "Site Visit Done" },
  { id: "st_srv_sched", label: "Site Revisit Scheduled" },
  { id: "st_srv_done", label: "Site Revisit done" },
  { id: "st_sv_resched", label: "Site Visit Rescheduled" },
  { id: "st_srv_resched", label: "Site Revisit rescheduled" },
  { id: "st_opp", label: "Opportunity" },
  { id: "st_dropped", label: "Dropped" },
  { id: "st_booked", label: "Booked" },
] as const;

/** Product default lead fields (data types + labels). `Stage` + opportunity date support the Standard blueprint. */
export function createStandardFieldDefinitions(): FieldDefinition[] {
  const stageOptions = STANDARD_BLUEPRINT_STATES.map((s, i) =>
    createOption(s.label, s.label.toLowerCase().replace(/\s+/g, "_"), `opt-stage-${i}`),
  );

  return [
    f({
      id: "fld-lead-name",
      apiKey: "lead_name",
      label: "Full Name",
      dataType: "text",
      allowDuplicate: false,
      isSystem: true,
      locked: false,
    }),
    f({
      id: "fld-project-name",
      apiKey: "project_name",
      label: "Project Name",
      dataType: "picklist",
      options: pl(["Project A", "Project B", "Project C"], "opt-project"),
    }),
    f({
      id: "fld-source",
      apiKey: "source",
      label: "Source",
      dataType: "picklist",
      options: pl(["Website", "Walk-in", "Referral", "Partner", "Campaign"], "opt-source"),
    }),
    f({
      id: "fld-sub-source",
      apiKey: "sub_source",
      label: "Sub Source",
      dataType: "picklist",
      options: pl(["Organic", "Paid", "Direct", "Social"], "opt-subsource"),
    }),
    f({
      id: "fld-stage",
      apiKey: "stage",
      label: "Stage",
      dataType: "picklist",
      allowDuplicate: true,
      options: stageOptions,
      isSystem: true,
      locked: true,
      defaultOptionId: "opt-stage-0",
    }),
    f({
      id: "fld-whatsapp",
      apiKey: "whatsapp_number",
      label: "Whatsapp Number",
      dataType: "number",
      allowDuplicate: true,
    }),
    f({
      id: "fld-alt-phone",
      apiKey: "alternate_number",
      label: "Alternate Number",
      dataType: "number",
      allowDuplicate: true,
    }),
    f({
      id: "fld-email",
      apiKey: "email",
      label: "Email ID",
      dataType: "text",
      allowDuplicate: false,
    }),
    f({
      id: "fld-assigned-to",
      apiKey: "assigned_to",
      label: "Assigned To",
      dataType: "picklist",
      options: pl(["Unassigned", "Agent A", "Agent B", "Agent C"], "opt-assigned"),
      defaultOptionId: "opt-assigned_0",
    }),
    f({
      id: "fld-unit-type",
      apiKey: "preferred_unit_type",
      label: "Preferred Unit Type",
      dataType: "picklist",
      options: pl(["1 BHK", "2 BHK", "3 BHK", "Villa", "Plot"], "opt-unit"),
    }),
    f({
      id: "fld-max-budget",
      apiKey: "max_budget",
      label: "Max Budget",
      dataType: "number",
    }),
    f({
      id: "fld-property-status",
      apiKey: "property_status",
      label: "Property Status",
      dataType: "picklist",
      options: pl(["Under construction", "Ready to move", "Resale"], "opt-propstat"),
    }),
    f({
      id: "fld-other-pref",
      apiKey: "other_preferences",
      label: "Other Preferences",
      dataType: "paragraph",
    }),
    f({
      id: "fld-purpose",
      apiKey: "purpose",
      label: "Purpose",
      dataType: "picklist",
      options: pl(["Investment", "Self use", "Both"], "opt-purpose"),
    }),
    f({
      id: "fld-pref-loc",
      apiKey: "preferred_location",
      label: "Preferred location",
      dataType: "text",
    }),
    f({ id: "fld-age", apiKey: "age", label: "Age", dataType: "number" }),
    f({
      id: "fld-gender",
      apiKey: "gender",
      label: "Gender",
      dataType: "picklist",
      options: pl(["Male", "Female", "Other", "Prefer not to say"], "opt-gender"),
    }),
    f({
      id: "fld-occupation",
      apiKey: "occupation",
      label: "Occupation",
      dataType: "picklist",
      options: pl(["Salaried", "Business", "Professional", "Retired", "Student"], "opt-occ"),
    }),
    f({
      id: "fld-qualification",
      apiKey: "qualification",
      label: "Qualification",
      dataType: "picklist",
      options: pl(["Graduate", "Post graduate", "Other"], "opt-qual"),
    }),
    f({
      id: "fld-funding",
      apiKey: "funding_source",
      label: "Funding Source",
      dataType: "picklist",
      options: pl(["Home loan", "Self funded", "Mix"], "opt-fund"),
    }),
    f({
      id: "fld-dropped-reasons",
      apiKey: "dropped_reason",
      label: "Dropped Reasons",
      dataType: "picklist",
      options: pl(
        ["Price", "Location", "Competition", "Not interested", "Unresponsive", "Other"],
        "opt-drop",
      ),
    }),
    f({
      id: "fld-sv-sched-dt",
      apiKey: "site_visit_scheduled_date",
      label: "Site Visit Scheduled date",
      dataType: "date_time",
    }),
    f({
      id: "fld-srv-sched-dt",
      apiKey: "site_revisit_scheduled_date",
      label: "Site revisit scheduled date",
      dataType: "date_time",
    }),
    f({
      id: "fld-sv-done-dt",
      apiKey: "site_visit_done_date",
      label: "Site visit done date",
      dataType: "date_time",
    }),
    f({
      id: "fld-srv-done-dt",
      apiKey: "site_revisit_done_date",
      label: "Site revisit done date",
      dataType: "date_time",
    }),
    f({
      id: "fld-sv-resched-dt",
      apiKey: "site_visit_rescheduled_date",
      label: "Site visit rescheduled date",
      dataType: "date_time",
    }),
    f({
      id: "fld-srv-resched-dt",
      apiKey: "site_revisit_rescheduled_date",
      label: "Site revisit rescheduled date",
      dataType: "date_time",
    }),
    f({
      id: "fld-dropped-dt",
      apiKey: "dropped_date",
      label: "Dropped date",
      dataType: "date_time",
    }),
    f({
      id: "fld-qualified-dt",
      apiKey: "qualified_date",
      label: "Qualified date",
      dataType: "date_time",
    }),
    f({
      id: "fld-contacted-dt",
      apiKey: "contacted_date",
      label: "Contacted date",
      dataType: "date_time",
    }),
    f({
      id: "fld-opportunity-dt",
      apiKey: "opportunity_date",
      label: "Opportunity date",
      dataType: "date_time",
    }),
  ];
}
