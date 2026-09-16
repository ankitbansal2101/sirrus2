import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { compactFieldCatalog } from "@/lib/leads/agent/lead-match";
import { loadLeadsDiskSnapshot, saveLeadsDiskSnapshot } from "@/lib/leads/agent/disk-snapshot";
import { parseLeadQueryInput, queryLeads } from "@/lib/leads/agent/query-leads";
import { parseLeadUpdateInput, updateLeads } from "@/lib/leads/agent/update-leads";

const filterSchema = z.object({
  field: z.string().describe("Field apiKey or label, e.g. stage, source, assigned_to, lead_name"),
  op: z.enum(["eq", "neq", "contains", "starts_with", "is_empty", "is_not_empty"]).optional(),
  value: z.string().optional(),
});

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createLeadsMcpServer(): McpServer {
  const server = new McpServer(
    { name: "sirrus-leads", version: "1.0.0" },
    {
      instructions:
        "Query and update Sirrus Manage Leads data. Always call lead_query for counts/lists/breakdowns — never guess. This is the live snapshot from the Sirrus app, not a frozen copy. Use list_lead_fields for the field catalog. Use lead_update only when the user asks to change a lead.",
    },
  );

  server.registerResource(
    "lead-catalog",
    "leads://catalog",
    {
      title: "Lead field catalog",
      description: "apiKeys, labels, and picklist options for the current lead schema.",
      mimeType: "application/json",
    },
    async () => {
      const snap = await loadLeadsDiskSnapshot();
      return {
        contents: [
          {
            uri: "leads://catalog",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                savedAt: snap.savedAt,
                leadCount: snap.leads.length,
                fields: compactFieldCatalog(snap.fields),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "list_lead_fields",
    {
      title: "List lead fields",
      description: "Return the lead field catalog (apiKey, label, type, picklist options) and how many leads are loaded.",
    },
    async () => {
      const snap = await loadLeadsDiskSnapshot();
      return jsonResult({
        savedAt: snap.savedAt,
        path: snap.path,
        leadCount: snap.leads.length,
        fields: compactFieldCatalog(snap.fields),
      });
    },
  );

  server.registerTool(
    "lead_query",
    {
      title: "Query leads",
      description:
        "Read Manage Leads data. Use for how many leads, lists, lookups, and breakdowns by stage/source/owner. Never guess a count.",
      inputSchema: z.object({
        operation: z.enum(["count", "list", "aggregate", "find"]),
        intent: z.string().describe("The user's question in their own words."),
        filters: z.array(filterSchema).optional(),
        groupBy: z.string().optional().describe("Field to group by for aggregate, e.g. stage"),
        limit: z.number().optional(),
      }),
    },
    async (args) => {
      const snap = await loadLeadsDiskSnapshot();
      const result = queryLeads(parseLeadQueryInput(args), snap.leads, snap.fields);
      return jsonResult(result);
    },
  );

  server.registerTool(
    "lead_update",
    {
      title: "Update leads",
      description:
        "Change field values on matching leads. Identify by name, displayId, or filters. Picklist values must be existing option labels.",
      inputSchema: z.object({
        intent: z.string().describe("The user's update request in their own words."),
        leadId: z.string().optional(),
        displayId: z.string().optional(),
        name: z.string().optional(),
        filters: z.array(filterSchema).optional(),
        updates: z.array(
          z.object({
            field: z.string(),
            value: z.string(),
          }),
        ),
      }),
    },
    async (args) => {
      const snap = await loadLeadsDiskSnapshot();
      const result = updateLeads(parseLeadUpdateInput(args), snap.leads, snap.fields);
      let persisted = false;
      if (result.success && result.changed && result.leads) {
        persisted = await saveLeadsDiskSnapshot(result.leads);
      }
      return jsonResult({
        ...result,
        leads: undefined,
        persisted,
      });
    },
  );

  return server;
}
