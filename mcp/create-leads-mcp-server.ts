import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  compactWorkspace,
  resolveModule,
} from "@/lib/crm/agent/tools";
import { compactRecord, queryModuleRecords, queryWorkspaceRecords } from "@/lib/crm/agent/query-records";
import { compactFieldCatalog } from "@/lib/leads/agent/lead-match";
import { loadMcpWorkspace, mcpWorkspaceSummary, saveMcpWorkspace } from "@/lib/crm/mcp-snapshot";
import { updateRecord } from "@/lib/crm/ops";
import type { CrmModule, CrmWorkspace } from "@/lib/crm/types";

const filterSchema = z.object({
  field: z.string().describe("Field apiKey or label, e.g. stage, source, owner, counsellor"),
  op: z.enum(["eq", "neq", "contains", "starts_with", "is_empty", "is_not_empty"]).optional(),
  value: z.string().optional(),
});

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function findLeadsModule(ws: CrmWorkspace): CrmModule | undefined {
  return (
    resolveModule(ws, "leads") ??
    resolveModule(ws, "lead") ??
    ws.modules.find((m) => m.apiKey.includes("lead") || m.pluralLabel.toLowerCase() === "leads")
  );
}

function noLeadsHint(ws: CrmWorkspace) {
  const modules = ws.modules.map((m) => `${m.pluralLabel} (${m.apiKey}, ${m.records.length} records)`);
  return {
    success: false,
    error: "There is no Leads module in the live workspace. Call list_workspace, then query_records with the module the user named.",
    modules,
  };
}

function applyFilters(filters: Array<{ field: string; value?: string; op?: string }> | undefined) {
  return (filters ?? [])
    .filter((f) => f.field)
    .map((f) => ({ field: f.field, value: f.value ?? "" }));
}

export function createLeadsMcpServer(): McpServer {
  const server = new McpServer(
    { name: "sirrus-crm", version: "2.0.0" },
    {
      instructions:
        "Query and update the LIVE Sirrus CRM workspace. There is no org auth — the snapshot is whatever the app last saved (crmWorkspace). Modules are not fixed: the user can add, rename, or delete any module at any time. Always call list_workspace at the start of a task and again if a module is missing. Never assume Leads, Enquiries, or any earlier module still exists. Use query_records with the module the user named. If a name is gone, use the current module list from the tool result. lead_query / list_lead_fields / lead_update are legacy aliases and only work if a Leads module is present right now.",
    },
  );

  server.registerResource(
    "workspace-catalog",
    "crm://workspace",
    {
      title: "Live CRM workspace",
      description: "Modules, fields, listing columns, and record counts from the live snapshot.",
      mimeType: "application/json",
    },
    async () => {
      const snap = await loadMcpWorkspace();
      return {
        contents: [
          {
            uri: "crm://workspace",
            mimeType: "application/json",
            text: JSON.stringify({ ...mcpWorkspaceSummary(snap), workspace: compactWorkspace(snap.workspace) }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "list_workspace",
    {
      title: "List live modules",
      description:
        "Inspect the live CRM workspace: every module, its fields, listing columns, stages, and record counts. Call this before querying. Do not assume Leads exists.",
    },
    async () => {
      const snap = await loadMcpWorkspace();
      return jsonResult({
        note: "This is the current live catalog. Modules added or removed in the app replace this list. Do not reuse module names from earlier in the conversation unless they appear here.",
        ...mcpWorkspaceSummary(snap),
        workspace: compactWorkspace(snap.workspace),
      });
    },
  );

  server.registerTool(
    "describe_module",
    {
      title: "Describe a module",
      description: "Look up one live module by id, apiKey, or label. Returns fields, listing columns, stages, and sample records.",
      inputSchema: z.object({
        module: z.string().describe("Module id, apiKey, or label, e.g. Enquiries, enquiries, Applications."),
      }),
    },
    async (args) => {
      const snap = await loadMcpWorkspace();
      const mod = resolveModule(snap.workspace, args.module);
      if (!mod) {
        return jsonResult({
          success: false,
          error: `Module "${args.module}" not found.`,
          modules: snap.workspace.modules.map((m) => m.pluralLabel),
        });
      }
      return jsonResult({
        success: true,
        savedAt: snap.savedAt,
        source: snap.source,
        module: {
          id: mod.id,
          apiKey: mod.apiKey,
          label: mod.label,
          pluralLabel: mod.pluralLabel,
          recordCount: mod.records.length,
          nameFieldApiKey: mod.nameFieldApiKey,
          stageFieldApiKey: mod.stageFieldApiKey,
          listingColumns: mod.listColumnFieldIds
            .map((id) => mod.fields.find((f) => f.id === id)?.label)
            .filter(Boolean),
          stages: mod.blueprint.stages.map((s) => s.label),
          fields: compactFieldCatalog(mod.fields),
          sampleRecords: mod.records.slice(0, 8).map((r) => compactRecord(mod, r)),
        },
      });
    },
  );

  server.registerTool(
    "query_records",
    {
      title: "Query records",
      description:
        "Count, list, or group records on a live module. Pass module (id, apiKey, or label). Omit module to query every module. Never guess counts.",
      inputSchema: z.object({
        module: z.string().optional().describe("Module id, apiKey, or label. Omit to search all modules."),
        operation: z.enum(["count", "list", "aggregate"]),
        intent: z.string().describe("The user's question in their own words."),
        filters: z.array(filterSchema).optional(),
        groupBy: z.string().optional(),
        contains: z.string().optional(),
        limit: z.number().optional(),
      }),
    },
    async (args) => {
      const snap = await loadMcpWorkspace();
      const payload = {
        operation: args.operation,
        contains: args.contains,
        filters: applyFilters(args.filters),
        groupBy: args.groupBy,
        limit: args.limit,
      };
      if (!args.module?.trim()) {
        return jsonResult({
          savedAt: snap.savedAt,
          source: snap.source,
          ...queryWorkspaceRecords(snap.workspace, payload),
        });
      }
      const mod = resolveModule(snap.workspace, args.module);
      if (!mod) {
        return jsonResult({
          success: false,
          error: `Module "${args.module}" not found.`,
          modules: snap.workspace.modules.map((m) => `${m.pluralLabel} (${m.apiKey})`),
        });
      }
      return jsonResult({
        savedAt: snap.savedAt,
        source: snap.source,
        ...queryModuleRecords(mod, {
          ...payload,
          filters: applyFilters(args.filters),
        }),
      });
    },
  );

  server.registerTool(
    "update_record",
    {
      title: "Update a record",
      description: "Change field values on a record in any live module. Identify by id, displayId, or name. Picklist values must be option labels.",
      inputSchema: z.object({
        module: z.string(),
        record: z.string().describe("Record id, displayId, or name."),
        updates: z.array(z.object({ field: z.string(), value: z.string() })),
        intent: z.string().describe("The user's update request in their own words."),
      }),
    },
    async (args) => {
      const snap = await loadMcpWorkspace();
      const mod = resolveModule(snap.workspace, args.module);
      if (!mod) {
        return jsonResult({
          success: false,
          error: `Module "${args.module}" not found.`,
          modules: snap.workspace.modules.map((m) => m.pluralLabel),
        });
      }
      const recRef = args.record.trim().toLowerCase();
      const rec = mod.records.find((r) => {
        const name = (r.values[mod.nameFieldApiKey] ?? "").toLowerCase();
        return r.id === args.record || r.displayId.toLowerCase() === recRef || name === recRef || name.includes(recRef);
      });
      if (!rec) return jsonResult({ success: false, error: `Record "${args.record}" not found on ${mod.pluralLabel}.` });
      const values: Record<string, string> = {};
      for (const u of args.updates) {
        const field = mod.fields.find(
          (f) => f.apiKey.toLowerCase() === u.field.toLowerCase() || f.label.toLowerCase() === u.field.toLowerCase() || f.id === u.field,
        );
        if (!field) continue;
        const opt = field.options.find((o) => o.label.toLowerCase() === u.value.toLowerCase() || o.id === u.value);
        values[field.apiKey] = opt?.id ?? u.value;
      }
      const next = updateRecord(snap.workspace, mod.id, rec.id, values);
      const persisted = await saveMcpWorkspace(next);
      return jsonResult({
        success: true,
        persisted,
        summary: `Updated ${rec.displayId} on ${mod.pluralLabel}.`,
        values,
      });
    },
  );

  server.registerTool(
    "list_lead_fields",
    {
      title: "List lead fields (legacy)",
      description:
        "Legacy alias. Returns fields for a Leads module if one exists; otherwise lists live modules so you can call describe_module.",
    },
    async () => {
      const snap = await loadMcpWorkspace();
      const mod = findLeadsModule(snap.workspace);
      if (!mod) return jsonResult(noLeadsHint(snap.workspace));
      return jsonResult({
        savedAt: snap.savedAt,
        path: snap.path,
        source: snap.source,
        module: { apiKey: mod.apiKey, pluralLabel: mod.pluralLabel },
        leadCount: mod.records.length,
        fields: compactFieldCatalog(mod.fields),
      });
    },
  );

  server.registerTool(
    "lead_query",
    {
      title: "Query leads (legacy)",
      description:
        "Legacy alias for a Leads module only. If Leads is missing, this fails and tells you to use list_workspace + query_records.",
      inputSchema: z.object({
        operation: z.enum(["count", "list", "aggregate", "find"]),
        intent: z.string(),
        filters: z.array(filterSchema).optional(),
        groupBy: z.string().optional(),
        limit: z.number().optional(),
      }),
    },
    async (args) => {
      const snap = await loadMcpWorkspace();
      const mod = findLeadsModule(snap.workspace);
      if (!mod) return jsonResult(noLeadsHint(snap.workspace));
      const operation = args.operation === "find" ? "list" : args.operation;
      return jsonResult({
        savedAt: snap.savedAt,
        source: snap.source,
        ...queryModuleRecords(mod, {
          operation,
          filters: applyFilters(args.filters),
          groupBy: args.groupBy,
          limit: args.limit,
        }),
      });
    },
  );

  server.registerTool(
    "lead_update",
    {
      title: "Update leads (legacy)",
      description: "Legacy alias. Updates a record on a Leads module if one exists; otherwise use update_record.",
      inputSchema: z.object({
        intent: z.string(),
        leadId: z.string().optional(),
        displayId: z.string().optional(),
        name: z.string().optional(),
        filters: z.array(filterSchema).optional(),
        updates: z.array(z.object({ field: z.string(), value: z.string() })),
      }),
    },
    async (args) => {
      const snap = await loadMcpWorkspace();
      const mod = findLeadsModule(snap.workspace);
      if (!mod) return jsonResult(noLeadsHint(snap.workspace));
      const ref = args.leadId || args.displayId || args.name;
      if (!ref) return jsonResult({ success: false, error: "Pass leadId, displayId, or name." });
      const recRef = ref.trim().toLowerCase();
      const rec = mod.records.find((r) => {
        const name = (r.values[mod.nameFieldApiKey] ?? "").toLowerCase();
        return r.id === ref || r.displayId.toLowerCase() === recRef || name === recRef || name.includes(recRef);
      });
      if (!rec) return jsonResult({ success: false, error: `Lead "${ref}" not found.` });
      const values: Record<string, string> = {};
      for (const u of args.updates) {
        const field = mod.fields.find(
          (f) => f.apiKey.toLowerCase() === u.field.toLowerCase() || f.label.toLowerCase() === u.field.toLowerCase(),
        );
        if (!field) continue;
        const opt = field.options.find((o) => o.label.toLowerCase() === u.value.toLowerCase() || o.id === u.value);
        values[field.apiKey] = opt?.id ?? u.value;
      }
      const next = updateRecord(snap.workspace, mod.id, rec.id, values);
      const persisted = await saveMcpWorkspace(next);
      return jsonResult({ success: true, persisted, summary: `Updated ${rec.displayId}.`, values });
    },
  );

  return server;
}
