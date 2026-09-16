import { parseLeadUpdateInput, updateLeads } from "@/lib/leads/agent/update-leads";
import type { RegisteredTool, ToolExecuteContext } from "@/lib/agent/tool-registry";

export const LEAD_UPDATE_TOOL_NAME = "lead_update";

export const LEAD_UPDATE_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: {
      type: "string",
      description: "The user's update request in their own words.",
    },
    leadId: { type: "string", description: "Internal lead uuid when known." },
    displayId: { type: "string", description: "Human lead id such as L0426002674." },
    name: { type: "string", description: "Lead name (lead_name) when the user named a person." },
    filters: {
      type: "array",
      description: "Update every matching lead (bulk). Use when the user says all leads in a stage/source/owner.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          field: { type: "string" },
          op: { type: "string", enum: ["eq", "neq", "contains", "starts_with", "is_empty", "is_not_empty"] },
          value: { type: "string" },
        },
        required: ["field"],
      },
    },
    updates: {
      type: "array",
      description: "Fields to write. For picklists, pass the option label (e.g. Site Visit, Agent A).",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          field: { type: "string", description: "Field apiKey or label." },
          value: { type: "string", description: "New value. Picklist labels are resolved to option ids." },
        },
        required: ["field", "value"],
      },
    },
  },
  required: ["intent", "updates"],
};

export const leadUpdateTool: RegisteredTool = {
  name: LEAD_UPDATE_TOOL_NAME,
  description:
    "Update one or more leads in the current Manage Leads dataset. Identify the lead by name, display id, or filters, then set field values. Picklist values must be existing option labels. Returns the full updated lead list. Do not use for questions — use lead_query instead.",
  inputSchema: LEAD_UPDATE_INPUT_SCHEMA,
  execute: (input: unknown, ctx: ToolExecuteContext) => {
    return updateLeads(
      parseLeadUpdateInput(input),
      ctx.leads ?? [],
      ctx.fieldDefinitions ?? [],
      ctx.selectedLeadId,
    );
  },
};
