import { CRM_AGENT_TOOLS, CRM_RECORD_TOOLS } from "@/lib/crm/agent/tools";
import { blueprintBuilderTool } from "@/lib/tools/blueprint-builder-tool";
import { leadQueryTool } from "@/lib/tools/lead-query-tool";
import { leadUpdateTool } from "@/lib/tools/lead-update-tool";

export type InhouseAgentDef = {
  id: string;
  name: string;
  description: string;
  usedAt: string;
  api: string;
  tools: string[];
};

export type RegistryTool = {
  name: string;
  description: string;
  group: string;
  sources: string[];
};

const MCP_TOOLS: RegistryTool[] = [
  {
    name: "list_workspace",
    description: "Inspect the live CRM workspace: modules, fields, listings, and record counts. Call this first.",
    group: "MCP (workspace)",
    sources: ["MCP /mcp"],
  },
  {
    name: "describe_module",
    description: "Look up one live module: fields, listing columns, stages, sample records.",
    group: "MCP (workspace)",
    sources: ["MCP /mcp"],
  },
  {
    name: "query_records",
    description: "Count, list, or group records on any live module. Never guess a count.",
    group: "MCP (workspace)",
    sources: ["MCP /mcp"],
  },
  {
    name: "update_record",
    description: "Change field values on a record in any live module.",
    group: "MCP (workspace)",
    sources: ["MCP /mcp"],
  },
  {
    name: "list_lead_fields",
    description: "Legacy alias. Leads module only — fails with live module list if Leads is missing.",
    group: "MCP (legacy leads)",
    sources: ["MCP /mcp"],
  },
  {
    name: "lead_query",
    description: "Legacy alias. Leads module only — use query_records for other objects.",
    group: "MCP (legacy leads)",
    sources: ["MCP /mcp"],
  },
  {
    name: "lead_update",
    description: "Legacy alias. Leads module only — use update_record for other objects.",
    group: "MCP (legacy leads)",
    sources: ["MCP /mcp"],
  },
];

export const INHOUSE_AGENTS: InhouseAgentDef[] = [
  {
    id: "module-records",
    name: "Module records agent",
    description: "Talk about, filter, create, and update records for the module you are viewing. Does not change fields, forms, or blueprints.",
    usedAt: "Every module listing → Ask agent (unless a custom agent is attached)",
    api: "/api/crm-agent · mode=records",
    tools: CRM_RECORD_TOOLS.map((t) => t.name),
  },
  {
    id: "workspace",
    name: "Workspace agent",
    description: "Query and update records across every module in the org.",
    usedAt: "Left-rail sparkle (unless a custom agent is attached)",
    api: "/api/crm-agent · mode=universal",
    tools: CRM_RECORD_TOOLS.map((t) => t.name),
  },
  {
    id: "crm-config",
    name: "CRM configuration agent",
    description: "Create modules and configure fields, forms, blueprints, overviews, and list columns via tools.",
    usedAt: "Internal config mode (not on listings)",
    api: "/api/crm-agent · mode=config",
    tools: CRM_AGENT_TOOLS.map((t) => t.name),
  },
  {
    id: "leads",
    name: "Leads agent",
    description: "Query and update the legacy Manage Leads dataset with deterministic query/update tools.",
    usedAt: "Manage Leads listing (route now redirects to the module listing)",
    api: "/api/leads-agent",
    tools: [leadQueryTool.name, leadUpdateTool.name],
  },
  {
    id: "blueprint-builder",
    name: "Blueprint builder agent",
    description: "Create or modify a pipeline from a business-process description, then validate the blueprint.",
    usedAt: "Settings → Modules → Blueprint canvas",
    api: "/api/builder-agent",
    tools: [blueprintBuilderTool.name],
  },
];

export function findInhouseAgent(id: string): InhouseAgentDef | undefined {
  return INHOUSE_AGENTS.find((a) => a.id === id);
}

function toolUsedBy(name: string): string[] {
  return INHOUSE_AGENTS.filter((a) => a.tools.includes(name)).map((a) => a.name);
}

export function fullToolRegistry(): { group: string; tools: (RegistryTool & { usedBy: string[] })[] }[] {
  const recordNames = new Set(CRM_RECORD_TOOLS.map((t) => t.name));
  const rows: RegistryTool[] = [
    ...CRM_RECORD_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      group: "Records",
      sources: ["CRM agent"],
    })),
    ...CRM_AGENT_TOOLS.filter((t) => !recordNames.has(t.name)).map((t) => ({
      name: t.name,
      description: t.description,
      group: "Metadata",
      sources: ["CRM agent"],
    })),
    {
      name: leadQueryTool.name,
      description: leadQueryTool.description,
      group: "Leads (legacy)",
      sources: ["Leads agent"],
    },
    {
      name: leadUpdateTool.name,
      description: leadUpdateTool.description,
      group: "Leads (legacy)",
      sources: ["Leads agent"],
    },
    {
      name: blueprintBuilderTool.name,
      description: blueprintBuilderTool.description,
      group: "Blueprint",
      sources: ["Blueprint builder agent"],
    },
    ...MCP_TOOLS,
  ];

  const grouped = new Map<string, (RegistryTool & { usedBy: string[] })[]>();
  for (const row of rows) {
    const usedBy = [...toolUsedBy(row.name)];
    if (row.sources.includes("MCP /mcp") && !usedBy.includes("MCP sirrus-crm")) {
      usedBy.push("MCP sirrus-crm");
    }
    const list = grouped.get(row.group) ?? [];
    list.push({ ...row, usedBy });
    grouped.set(row.group, list);
  }

  return [...grouped.entries()].map(([group, tools]) => ({ group, tools }));
}
