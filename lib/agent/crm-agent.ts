import { compactWorkspace, CRM_AGENT_TOOLS, CRM_RECORD_TOOLS } from "@/lib/crm/agent/tools";
import { findAgent } from "@/lib/crm/ops";
import { ToolRegistry } from "@/lib/agent/tool-registry";
import type { AgentTraceStep, CrmAgentMode, CrmAgentRequest, CrmAgentResult } from "@/lib/agent/types";
import type { CrmCustomAgent, CrmWorkspace } from "@/lib/crm/types";
import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam } from "openai/resources/chat/completions";

const CONFIG_SYSTEM = `You are the Sirrus CRM configuration agent.

You configure an industry-agnostic CRM workspace: modules (objects), fields, create-record forms, blueprints (pipelines), list columns, overview widgets, and records.

Rules:
- Always call tools. Never invent modules, fields, stages, or record counts from memory.
- Call list_workspace before changing schema if you are unsure what exists.
- Prefer the user's wording for labels. Do not rename modules unless asked.
- Picklist/radio/multi_select fields need options.
- Blueprints need at least two ordered stages.
- After mutations, briefly say what changed so a product manager can demo it.
- Never claim a change was saved unless a tool returned success: true.
- If a requested field does not exist, add it first, then map it onto forms/overview.`;

const RECORDS_SYSTEM = `You are the records agent for a single CRM module.

You help the user inspect, count, filter, create, and update records of THIS module only.

Rules:
- Always call tools (query_records, list_records, create_record, update_record). Never invent counts, names, or field values.
- query_records is preferred for "how many", filters, stage breakdowns, and lookups.
- Update records by id, displayId, or name. Use option labels for picklists and stages.
- You cannot create modules, fields, forms, or blueprints. If asked, say that lives in Settings → Modules.
- After an update, briefly confirm what changed.`;

const UNIVERSAL_SYSTEM = `You are the workspace records agent for this CRM.

You can query and update records across EVERY module (Leads, Deals, or any custom object).

Rules:
- Always call tools. Never invent modules, counts, or record names.
- If the user does not name a module, call query_records without a module (or list_workspace) to see counts, then proceed or ask.
- Use query_records for counts, filters, breakdowns, and search. Use update_record / create_record for writes — always pass the module.
- You cannot create modules, fields, forms, or blueprints. If asked, say that lives in Settings → Modules.
- After an update, briefly confirm the module, record, and fields changed.`;

function createRegistry(mode: CrmAgentMode, custom?: CrmCustomAgent): ToolRegistry {
  const registry = new ToolRegistry();
  if (mode === "custom" && custom) {
    const byName = new Map(CRM_AGENT_TOOLS.map((t) => [t.name, t]));
    for (const name of custom.tools) {
      const tool = byName.get(name);
      if (tool) registry.register(tool);
    }
    return registry;
  }
  const tools = mode === "config" ? CRM_AGENT_TOOLS : CRM_RECORD_TOOLS;
  for (const t of tools) registry.register(t);
  return registry;
}

function systemFor(mode: CrmAgentMode, custom?: CrmCustomAgent): string {
  if (mode === "custom" && custom) return custom.instructions.trim() || `You are ${custom.name}.`;
  if (mode === "records") return RECORDS_SYSTEM;
  if (mode === "universal") return UNIVERSAL_SYSTEM;
  return CONFIG_SYSTEM;
}

function newTrace(label: string, status: AgentTraceStep["status"] = "ok", detail?: string): AgentTraceStep {
  return { id: `tr_${Math.random().toString(36).slice(2, 10)}`, label, detail, status };
}

function isMutating(name: string) {
  return name !== "list_workspace" && name !== "list_records" && name !== "query_records";
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

export function createCrmAgentClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

export async function runCrmAgent(req: CrmAgentRequest, client: OpenAI, defaultModel: string): Promise<CrmAgentResult> {
  const custom =
    req.mode === "custom" && req.customAgentId ? findAgent(req.workspace, req.customAgentId) : undefined;
  const mode: CrmAgentMode = custom ? "custom" : req.mode && req.mode !== "custom" ? req.mode : "config";
  if (req.mode === "custom" && !custom) {
    return {
      assistantMessage: "That custom agent was not found in this workspace.",
      traces: [newTrace("Custom agent missing", "error")],
      workspace: null,
      changed: false,
    };
  }

  const registry = createRegistry(mode, custom);
  const agentLabel = custom?.name ?? (mode === "records" ? "Module records agent" : mode === "universal" ? "Workspace agent" : "CRM Agent");
  const traces: AgentTraceStep[] = [newTrace("User request received"), newTrace(agentLabel)];
  let workspace: CrmWorkspace = req.workspace;
  let changed = false;
  let summary: string | undefined;
  const model = custom?.model.trim() || defaultModel;
  const openaiTools = registry.list().length ? registry.toOpenAITools() : undefined;

  const focus = req.focusModuleId
    ? workspace.modules.find((m) => m.id === req.focusModuleId || m.apiKey === req.focusModuleId)
    : undefined;

  const openaiMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemFor(mode, custom) },
    {
      role: "system",
      content: `Workspace snapshot (do not invent beyond this; call tools for live records):\n${JSON.stringify(compactWorkspace(workspace))}`,
    },
  ];
  if (mode === "records" && focus) {
    openaiMessages.push({
      role: "system",
      content: `Locked to module "${focus.pluralLabel}" (apiKey ${focus.apiKey}, id ${focus.id}). Pass this module on every tool call. Do not query other modules.`,
    });
  } else if (focus) {
    openaiMessages.push({
      role: "system",
      content: `The user is currently looking at module "${focus.pluralLabel}" (apiKey ${focus.apiKey}, id ${focus.id}). Prefer that module unless they name another.`,
    });
  }

  for (const m of req.messages) {
    if (m.role === "user" || m.role === "assistant") {
      openaiMessages.push({ role: m.role, content: m.content });
    }
  }

  let assistantMessage = "";

  for (let round = 0; round < 6; round++) {
    const params: ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: openaiMessages,
    };
    if (openaiTools) {
      params.tools = openaiTools;
      const choice = custom?.modelSettings.toolChoice ?? "auto";
      params.tool_choice = custom?.resetToolChoice && round > 0 ? "auto" : choice;
    }
    if (custom?.modelSettings.temperature != null) params.temperature = custom.modelSettings.temperature;
    if (custom?.modelSettings.topP != null) params.top_p = custom.modelSettings.topP;
    if (custom?.modelSettings.maxTokens != null) params.max_completion_tokens = custom.modelSettings.maxTokens;

    const completion = await client.chat.completions.create(params);

    const msg = completion.choices[0]?.message;
    if (!msg) {
      traces.push(newTrace("OpenAI returned an empty response", "error"));
      break;
    }

    openaiMessages.push({
      role: "assistant",
      content: msg.content,
      tool_calls: msg.tool_calls,
    });

    const toolCalls = msg.tool_calls ?? [];
    if (toolCalls.length === 0) {
      assistantMessage = msg.content?.trim() ?? assistantMessage;
      break;
    }

    const callsToRun = custom?.toolUseBehavior === "stop_on_first_tool" ? toolCalls.slice(0, 1) : toolCalls;

    for (const call of callsToRun) {
      if (call.type !== "function") continue;
      const toolName = call.function.name;
      traces.push(newTrace(`Selecting tool: ${toolName}`));

      let parsedArgs: unknown = {};
      try {
        parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        parsedArgs = {};
      }

      if (mode === "records" && focus && isRecord(parsedArgs) && ["query_records", "list_records", "create_record", "update_record"].includes(toolName)) {
        parsedArgs.module = focus.apiKey;
      }

      traces.push(newTrace(`Calling: ${toolName}()`));

      const result = await registry.execute(toolName, parsedArgs, { workspace });
      const rec = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
      const success = rec.success === true;
      const nextWs = rec.workspace as CrmWorkspace | undefined;
      const toolSummary = typeof rec.summary === "string" ? rec.summary : undefined;
      const error = typeof rec.error === "string" ? rec.error : undefined;

      if (success && nextWs && isMutating(toolName)) {
        workspace = nextWs;
        changed = true;
        summary = toolSummary ?? summary;
        traces.push(newTrace("Records updated", "ok", toolSummary));
      } else if (success) {
        traces.push(newTrace("Tool result ready", "ok", toolSummary));
        summary = toolSummary ?? summary;
      } else {
        traces.push(newTrace("Tool failed", "error", error ?? toolSummary));
      }

      const forModel = { ...rec, workspace: undefined };
      openaiMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(forModel),
      });

      if (custom?.toolUseBehavior === "stop_on_first_tool") {
        assistantMessage = toolSummary || (success ? "Tool completed." : error) || "Tool completed.";
        break;
      }
    }

    if (custom?.toolUseBehavior === "stop_on_first_tool") break;
  }

  if (!assistantMessage) {
    assistantMessage = changed ? "Records were updated." : "I could not complete that request from the current workspace.";
  }

  return {
    assistantMessage,
    traces,
    workspace: changed ? workspace : null,
    changed,
    summary,
  };
}
