import {
  createFieldFromDataType,
  createOption,
  type FieldDataType,
  type FieldDefinition,
} from "@/lib/fields-config/types";
import type { LeadFormLayoutV1 } from "@/lib/lead-form-layout/types";
import { newCrmId, slugifyCrm } from "@/lib/crm/ids";
import type {
  CrmBlueprint,
  CrmModule,
  CrmModuleIcon,
  CrmRecord,
  OverviewLayout,
} from "@/lib/crm/types";

export function crmField(
  dataType: FieldDataType,
  label: string,
  apiKey: string,
  extra: Partial<FieldDefinition> = {},
): FieldDefinition {
  const base = createFieldFromDataType(dataType);
  const options = extra.options ?? base.options;
  return {
    ...base,
    ...extra,
    label,
    apiKey,
    options,
    required: extra.required ?? false,
  };
}

export function picklist(label: string, apiKey: string, optionLabels: string[], required = false): FieldDefinition {
  const options = optionLabels.map((l) => createOption(l));
  return crmField("picklist", label, apiKey, {
    required,
    options,
    defaultOptionId: options[0]?.id,
  });
}

export function defaultFormLayout(fields: FieldDefinition[], title = "Record info"): LeadFormLayoutV1 {
  return {
    version: 1,
    sections: [
      {
        id: newCrmId("sec"),
        title,
        fieldIds: fields.filter((f) => !f.locked || f.required).slice(0, 10).map((f) => f.id),
      },
    ],
  };
}

export function linearBlueprint(stageLabels: string[]): CrmBlueprint {
  const stages = stageLabels.map((label) => ({ id: newCrmId("st"), label }));
  const transitions = stages.slice(0, -1).map((from, i) => ({
    id: newCrmId("tr"),
    fromStageId: from.id,
    toStageId: stages[i + 1]!.id,
  }));
  return { stages, transitions };
}

export function defaultOverview(fields: FieldDefinition[], nameApi: string, stageApi: string | null): OverviewLayout {
  const byApi = (api: string) => fields.find((f) => f.apiKey === api)?.id;
  const nameId = byApi(nameApi);
  const stageId = stageApi ? byApi(stageApi) : undefined;
  const rest = fields.filter((f) => f.apiKey !== nameApi && f.apiKey !== stageApi).slice(0, 8).map((f) => f.id);
  const widgets = [
    {
      id: newCrmId("wg"),
      type: "header" as const,
      title: "Summary",
      fieldIds: [nameId, stageId].filter((x): x is string => !!x),
    },
    ...(stageId
      ? [{ id: newCrmId("wg"), type: "status" as const, title: "Pipeline", fieldIds: [stageId] }]
      : []),
    {
      id: newCrmId("wg"),
      type: "details" as const,
      title: "Details",
      fieldIds: rest,
    },
    {
      id: newCrmId("wg"),
      type: "activity" as const,
      title: "Activity",
      fieldIds: [],
    },
  ];
  return { widgets };
}

export function record(
  displayId: string,
  values: Record<string, string>,
  createdAt?: string,
): CrmRecord {
  const now = createdAt ?? new Date().toISOString();
  return { id: newCrmId("rec"), displayId, values, createdAt: now, updatedAt: now };
}

export function buildModule(input: {
  label: string;
  pluralLabel?: string;
  apiKey?: string;
  description: string;
  icon: CrmModuleIcon;
  nameFieldApiKey?: string;
  stageFieldApiKey?: string | null;
  fields: FieldDefinition[];
  stageLabels?: string[];
  records?: CrmRecord[];
}): CrmModule {
  const apiKey = input.apiKey ?? slugifyCrm(input.pluralLabel ?? input.label);
  const nameFieldApiKey = input.nameFieldApiKey ?? "name";
  const stageFieldApiKey = input.stageFieldApiKey === undefined ? "stage" : input.stageFieldApiKey;
  const fields = input.fields;
  const listColumnFieldIds = fields
    .filter((f) => [nameFieldApiKey, stageFieldApiKey, "email", "phone", "source", "owner"].includes(f.apiKey))
    .map((f) => f.id);
  const uniqueCols = [...new Set(listColumnFieldIds.length ? listColumnFieldIds : fields.slice(0, 4).map((f) => f.id))];
  return {
    id: newCrmId("mod"),
    apiKey,
    label: input.label,
    pluralLabel: input.pluralLabel ?? `${input.label}s`,
    description: input.description,
    icon: input.icon,
    nameFieldApiKey,
    stageFieldApiKey,
    fields,
    formLayout: defaultFormLayout(fields, `${input.label} info`),
    blueprint: linearBlueprint(input.stageLabels ?? ["New", "In progress", "Won", "Lost"]),
    overviewLayout: defaultOverview(fields, nameFieldApiKey, stageFieldApiKey),
    listColumnFieldIds: uniqueCols,
    records: input.records ?? [],
    createdAt: new Date().toISOString(),
  };
}

export function emptyCustomModule(label: string): CrmModule {
  const name = crmField("text", `${label} name`, "name", { required: true, isSystem: true, locked: true });
  const stage = picklist("Stage", "stage", ["New", "In progress", "Won", "Lost"], true);
  const email = crmField("email", "Email", "email");
  const phone = crmField("phone", "Phone", "phone");
  const owner = crmField("text", "Owner", "owner");
  return buildModule({
    label,
    description: `Custom ${label.toLowerCase()} module`,
    icon: "custom",
    fields: [name, stage, email, phone, owner],
    records: [],
  });
}
