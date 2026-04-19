import type { FormulaPlan } from "@/lib/fields-config/formula-types";
import { defaultFormulaPlan } from "@/lib/fields-config/formula-types";

export const FIELD_DATA_TYPES = [
  "text",
  "paragraph",
  "email",
  "phone",
  "picklist",
  "multi_select",
  "date",
  "date_time",
  "number",
  "decimal",
  "formula",
  "radio",
] as const;

export type FieldDataType = (typeof FIELD_DATA_TYPES)[number];

export type PicklistOrderPreference = "manual" | "alphabetical";

export type FieldOption = {
  id: string;
  label: string;
  /** Derived from label in the UI unless set explicitly (seeded defaults). */
  value: string;
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

/** Machine-readable value from the option label (hidden in the configurator UI). */
export function optionValueFromLabel(label: string): string {
  const s = slugify(label);
  return s || "choice";
}

export type FieldDefinition = {
  id: string;
  apiKey: string;
  label: string;
  dataType: FieldDataType;
  required: boolean;
  allowDuplicate: boolean;
  options: FieldOption[];
  /** picklist, radio: one option id */
  defaultOptionId?: string;
  /** multi_select: option ids */
  defaultOptionIds: string[];
  orderPreference: PicklistOrderPreference;
  formulaExpression: string;
  /** When `dataType` is `formula` — structured builder; drives `formulaExpression` when set. */
  formulaPlan?: FormulaPlan;
  isSystem: boolean;
  /** System fields stay on canvas; user can still edit allowed props */
  locked: boolean;
};

function newOptionId(stableId?: string): string {
  if (stableId) return stableId;
  const c = globalThis.crypto;
  if (c && "randomUUID" in c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `opt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function newFieldId(): string {
  return newOptionId();
}

export function createOption(label: string, value?: string, stableId?: string): FieldOption {
  return {
    id: newOptionId(stableId),
    label,
    value: value ?? optionValueFromLabel(label),
  };
}

function baseField(partial: Omit<FieldDefinition, "defaultOptionIds" | "orderPreference" | "formulaExpression">): FieldDefinition {
  return {
    ...partial,
    defaultOptionIds: [],
    orderPreference: "manual",
    formulaExpression: "",
  };
}

export function createDefaultLeadFields(): FieldDefinition[] {
  return [
    baseField({
      id: "sys-lead-owner",
      apiKey: "lead_owner",
      label: "Lead Owner",
      dataType: "picklist",
      required: false,
      allowDuplicate: true,
      options: [
        createOption("Unassigned", "unassigned", "opt-owner-unassigned"),
        createOption("Round robin", "round_robin", "opt-owner-rr"),
        createOption("Queue: Sales", "queue_sales", "opt-owner-queue"),
      ],
      defaultOptionId: undefined,
      isSystem: true,
      locked: true,
    }),
    baseField({
      id: "sys-lead-name",
      apiKey: "lead_name",
      label: "Lead Name",
      dataType: "text",
      required: true,
      allowDuplicate: true,
      options: [],
      isSystem: true,
      locked: true,
    }),
    baseField({
      id: "sys-phone",
      apiKey: "phone",
      label: "Phone",
      dataType: "phone",
      required: false,
      allowDuplicate: false,
      options: [],
      isSystem: true,
      locked: true,
    }),
    baseField({
      id: "sys-email",
      apiKey: "email",
      label: "Email",
      dataType: "email",
      required: false,
      allowDuplicate: false,
      options: [],
      isSystem: true,
      locked: true,
    }),
    baseField({
      id: "sys-source",
      apiKey: "source",
      label: "Source",
      dataType: "picklist",
      required: false,
      allowDuplicate: true,
      options: [
        createOption("Website", "website", "opt-src-web"),
        createOption("Partner", "partner", "opt-src-partner"),
        createOption("Event", "event", "opt-src-event"),
        createOption("Cold outreach", "cold_outreach", "opt-src-cold"),
      ],
      defaultOptionId: undefined,
      isSystem: true,
      locked: true,
    }),
    baseField({
      id: "sys-stage",
      apiKey: "stage",
      label: "Stage",
      dataType: "picklist",
      required: true,
      allowDuplicate: true,
      options: [
        createOption("New", "new", "opt-stage-new"),
        createOption("Contacted", "contacted", "opt-stage-contacted"),
        createOption("Qualified", "qualified", "opt-stage-qualified"),
        createOption("Proposal", "proposal", "opt-stage-proposal"),
        createOption("Won", "won", "opt-stage-won"),
        createOption("Lost", "lost", "opt-stage-lost"),
      ],
      defaultOptionId: undefined,
      isSystem: true,
      locked: true,
    }),
  ];
}

const TYPE_DEFAULT_LABEL: Record<FieldDataType, string> = {
  text: "Text field",
  paragraph: "Paragraph field",
  email: "Email field",
  phone: "Phone field",
  picklist: "Picklist field",
  multi_select: "Multi-select field",
  date: "Date field",
  date_time: "Date & time field",
  number: "Number field",
  decimal: "Decimal field",
  formula: "Calculated field",
  radio: "Radio field",
};

export function createFieldFromDataType(dataType: FieldDataType): FieldDefinition {
  const id = newFieldId();
  const baseLabel = TYPE_DEFAULT_LABEL[dataType];
  const apiKey = `${slugify(baseLabel)}_${id.slice(0, 8)}`;

  const withOptions =
    dataType === "picklist" || dataType === "multi_select" || dataType === "radio";

  if (dataType === "formula") {
    return baseField({
      id,
      apiKey,
      label: baseLabel,
      dataType,
      required: false,
      allowDuplicate: true,
      options: [],
      defaultOptionId: undefined,
      isSystem: false,
      locked: false,
      formulaPlan: defaultFormulaPlan(),
    });
  }

  return baseField({
    id,
    apiKey,
    label: baseLabel,
    dataType,
    required: false,
    allowDuplicate: true,
    options: withOptions
      ? [createOption("First choice"), createOption("Second choice")]
      : [],
    defaultOptionId: undefined,
    isSystem: false,
    locked: false,
  });
}

export function optionsSorted(field: FieldDefinition): FieldOption[] {
  const copy = [...field.options];
  if (field.orderPreference === "alphabetical") {
    copy.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }
  return copy;
}

export const OPTION_TYPES: FieldDataType[] = ["picklist", "multi_select", "radio"];

export function usesOptions(dataType: FieldDataType) {
  return OPTION_TYPES.includes(dataType);
}
