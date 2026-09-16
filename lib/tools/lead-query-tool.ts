import { parseLeadQueryInput, queryLeads } from "@/lib/leads/agent/query-leads";
import type { RegisteredTool, ToolExecuteContext } from "@/lib/agent/tool-registry";

export const LEAD_QUERY_TOOL_NAME = "lead_query";

export const LEAD_QUERY_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    operation: {
      type: "string",
      enum: ["count", "list", "aggregate", "find"],
      description: "count totals, list matching leads, aggregate/group counts, or find a specific lead.",
    },
    intent: {
      type: "string",
      description: "The user's question in their own words.",
    },
    filters: {
      type: "array",
      description: "Match leads by field. Prefer apiKey (stage, source, assigned_to, lead_name) and option labels.",
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
    groupBy: {
      type: "string",
      description: "Field to group by for aggregate (e.g. stage, source, assigned_to).",
    },
    limit: { type: "number", description: "Max rows to return for list/find (default 25, max 50)." },
  },
  required: ["operation", "intent"],
};

export const leadQueryTool: RegisteredTool = {
  name: LEAD_QUERY_TOOL_NAME,
  description:
    "Read the current Manage Leads dataset. Use for counts, lists, lookups, and breakdowns (by stage, source, owner). Never guess a count — always call this tool. Does not change data.",
  inputSchema: LEAD_QUERY_INPUT_SCHEMA,
  execute: (input: unknown, ctx: ToolExecuteContext) => {
    return queryLeads(parseLeadQueryInput(input), ctx.leads ?? [], ctx.fieldDefinitions ?? []);
  },
};
