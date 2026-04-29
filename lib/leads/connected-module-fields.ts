import type { ConnectedModuleId } from "@/lib/leads/lead-filter-types";
import type { FieldDefinition, FieldOption } from "@/lib/fields-config/types";

export const CONNECTED_MODULE_LABELS: Record<ConnectedModuleId, string> = {
  calls: "Calls",
  tasks: "Tasks",
  channel_partner: "Channel Partner",
};

function opt(id: string, label: string): FieldOption {
  return { id, label, value: label.toLowerCase().replace(/\s+/g, "_") };
}

function pl(opts: FieldOption[]): FieldOption[] {
  return opts;
}

/** Demo field schemas for connected modules (mirrors future per-module configurators). */
function callsFields(): FieldDefinition[] {
  return [
    {
      id: "cm-call-start",
      apiKey: "call_start_time",
      label: "Call start time",
      dataType: "date_time",
      required: false,
      allowDuplicate: true,
      options: [],
      defaultOptionIds: [],
      orderPreference: "manual",
      formulaExpression: "",
      isSystem: true,
      locked: true,
      includeInFilters: true,
    },
    {
      id: "cm-call-end",
      apiKey: "call_end_time",
      label: "Call end time",
      dataType: "date_time",
      required: false,
      allowDuplicate: true,
      options: [],
      defaultOptionIds: [],
      orderPreference: "manual",
      formulaExpression: "",
      isSystem: true,
      locked: true,
      includeInFilters: true,
    },
    {
      id: "cm-call-dur",
      apiKey: "call_duration_seconds",
      label: "Call duration (seconds)",
      dataType: "number",
      required: false,
      allowDuplicate: true,
      options: [],
      defaultOptionIds: [],
      orderPreference: "manual",
      formulaExpression: "",
      isSystem: true,
      locked: true,
      includeInFilters: true,
    },
    {
      id: "cm-call-owner",
      apiKey: "call_owner",
      label: "Call owner",
      dataType: "picklist",
      required: false,
      allowDuplicate: true,
      options: pl([opt("co_a", "Agent A"), opt("co_b", "Agent B"), opt("co_c", "Agent C")]),
      defaultOptionIds: [],
      orderPreference: "manual",
      formulaExpression: "",
      isSystem: true,
      locked: true,
      includeInFilters: true,
    },
    {
      id: "cm-call-type",
      apiKey: "call_type",
      label: "Call type",
      dataType: "picklist",
      required: false,
      allowDuplicate: true,
      options: pl([opt("ct_in", "Inbound"), opt("ct_out", "Outbound"), opt("ct_fu", "Follow-up")]),
      defaultOptionIds: [],
      orderPreference: "manual",
      formulaExpression: "",
      isSystem: true,
      locked: true,
      includeInFilters: true,
    },
    {
      id: "cm-call-status",
      apiKey: "call_status",
      label: "Call status",
      dataType: "picklist",
      required: false,
      allowDuplicate: true,
      options: pl([opt("cs_comp", "Completed"), opt("cs_miss", "Missed"), opt("cs_vm", "Voicemail")]),
      defaultOptionIds: [],
      orderPreference: "manual",
      formulaExpression: "",
      isSystem: true,
      locked: true,
      includeInFilters: true,
    },
  ];
}

function tasksFields(): FieldDefinition[] {
  return [
    {
      id: "cm-task-type",
      apiKey: "task_type",
      label: "Task type",
      dataType: "picklist",
      required: false,
      allowDuplicate: true,
      options: pl([opt("tt_sv", "Site visit"), opt("tt_fu", "Follow-up"), opt("tt_doc", "Document")]),
      defaultOptionIds: [],
      orderPreference: "manual",
      formulaExpression: "",
      isSystem: true,
      locked: true,
      includeInFilters: true,
    },
    {
      id: "cm-task-due",
      apiKey: "due_date",
      label: "Due date",
      dataType: "date_time",
      required: false,
      allowDuplicate: true,
      options: [],
      defaultOptionIds: [],
      orderPreference: "manual",
      formulaExpression: "",
      isSystem: true,
      locked: true,
      includeInFilters: true,
    },
    {
      id: "cm-task-status",
      apiKey: "task_status",
      label: "Status",
      dataType: "picklist",
      required: false,
      allowDuplicate: true,
      options: pl([opt("ts_open", "Open"), opt("ts_done", "Done"), opt("ts_over", "Overdue")]),
      defaultOptionIds: [],
      orderPreference: "manual",
      formulaExpression: "",
      isSystem: true,
      locked: true,
      includeInFilters: true,
    },
    {
      id: "cm-task-owner",
      apiKey: "task_owner",
      label: "Task owner",
      dataType: "picklist",
      required: false,
      allowDuplicate: true,
      options: pl([opt("to_a", "Owner A"), opt("to_b", "Owner B")]),
      defaultOptionIds: [],
      orderPreference: "manual",
      formulaExpression: "",
      isSystem: true,
      locked: true,
      includeInFilters: true,
    },
  ];
}

function channelPartnerFields(): FieldDefinition[] {
  return [
    {
      id: "cm-cp-name",
      apiKey: "cp_name",
      label: "Partner name",
      dataType: "text",
      required: false,
      allowDuplicate: true,
      options: [],
      defaultOptionIds: [],
      orderPreference: "manual",
      formulaExpression: "",
      isSystem: true,
      locked: true,
      includeInFilters: true,
    },
    {
      id: "cm-cp-tier",
      apiKey: "cp_tier",
      label: "Tier",
      dataType: "picklist",
      required: false,
      allowDuplicate: true,
      options: pl([opt("tier_gold", "Gold"), opt("tier_silv", "Silver"), opt("tier_bronz", "Bronze")]),
      defaultOptionIds: [],
      orderPreference: "manual",
      formulaExpression: "",
      isSystem: true,
      locked: true,
      includeInFilters: true,
    },
    {
      id: "cm-cp-region",
      apiKey: "cp_region",
      label: "Region",
      dataType: "picklist",
      required: false,
      allowDuplicate: true,
      options: pl([opt("reg_n", "North"), opt("reg_s", "South"), opt("reg_e", "East"), opt("reg_w", "West")]),
      defaultOptionIds: [],
      orderPreference: "manual",
      formulaExpression: "",
      isSystem: true,
      locked: true,
      includeInFilters: true,
    },
  ];
}

export function fieldsForConnectedModule(id: ConnectedModuleId): FieldDefinition[] {
  switch (id) {
    case "calls":
      return callsFields();
    case "tasks":
      return tasksFields();
    case "channel_partner":
      return channelPartnerFields();
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function connectedModulePresenceLabel(id: ConnectedModuleId): string {
  switch (id) {
    case "calls":
      return "any calls";
    case "tasks":
      return "any tasks";
    case "channel_partner":
      return "any Channel Partner";
    default: {
      const _e: never = id;
      return _e;
    }
  }
}
