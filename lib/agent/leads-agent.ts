import { LEADS_AGENT_SYSTEM_PROMPT } from "@/lib/agent/leads-system-prompt";
import { ToolRegistry } from "@/lib/agent/tool-registry";
import type { AgentTraceStep, LeadsAgentRequest, LeadsAgentResult } from "@/lib/agent/types";
import { compactFieldCatalog } from "@/lib/leads/agent/lead-match";
import type { LeadQueryResult } from "@/lib/leads/agent/query-leads";
import type { LeadUpdateResult } from "@/lib/leads/agent/update-leads";
import type { LeadRecord } from "@/lib/leads/types";
import { leadQueryTool } from "@/lib/tools/lead-query-tool";
import { leadUpdateTool } from "@/lib/tools/lead-update-tool";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

function createLeadsToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(leadQueryTool);
  registry.register(leadUpdateTool);
  return registry;
}

function newTrace(label: string, status: AgentTraceStep["status"] = "ok", detail?: string): AgentTraceStep {
  return { id: `tr_${Math.random().toString(36).slice(2, 10)}`, label, detail, status };
}

function isQueryResult(x: unknown): x is LeadQueryResult {
  return !!x && typeof x === "object" && (x as LeadQueryResult).operation === "query";
}

function isUpdateResult(x: unknown): x is LeadUpdateResult {
  return !!x && typeof x === "object" && (x as LeadUpdateResult).operation === "update";
}

export function createLeadsAgentClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

/**
 * Runs one Leads Agent turn with OpenAI tool calling.
 * Query/update stay deterministic in-process; the model never mutates the UI.
 */
export async function runLeadsAgent(req: LeadsAgentRequest, client: OpenAI, model: string): Promise<LeadsAgentResult> {
  const registry = createLeadsToolRegistry();
  const traces: AgentTraceStep[] = [newTrace("User request received"), newTrace("Leads Agent")];

  const catalog = compactFieldCatalog(req.fieldDefinitions);
  const selected = req.selectedLeadId
    ? req.leads.find((l) => l.id === req.selectedLeadId)
    : undefined;

  const openaiMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: LEADS_AGENT_SYSTEM_PROMPT },
    {
      role: "system",
      content: `Lead field catalog (do not invent apiKeys or option labels):\n${JSON.stringify(catalog)}`,
    },
    {
      role: "system",
      content: `Dataset snapshot: ${req.leads.length} leads in memory. ${
        selected
          ? `A lead is open: ${selected.values.lead_name ?? "(unnamed)"} (${selected.displayId}).`
          : "No lead is open in the drawer."
      } Always call lead_query or lead_update — do not answer counts from this sentence.`,
    },
  ];

  for (const m of req.messages) {
    if (m.role === "user" || m.role === "assistant") {
      openaiMessages.push({ role: m.role, content: m.content });
    }
  }

  let leads: LeadRecord[] | null = null;
  let changed = false;
  let summary: string | undefined;
  let matchedCount: number | undefined;
  let assistantMessage = "";

  for (let round = 0; round < 4; round++) {
    const completion = await client.chat.completions.create({
      model,
      messages: openaiMessages,
      tools: registry.toOpenAITools(),
      tool_choice: "auto",
    });

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

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const toolName = call.function.name;
      traces.push(newTrace(`Selecting tool: ${toolName}`));

      let parsedArgs: unknown = {};
      try {
        parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        parsedArgs = {};
      }

      traces.push(newTrace(`Calling: ${toolName}()`));

      const result = await registry.execute(toolName, parsedArgs, {
        fieldDefinitions: req.fieldDefinitions,
        leads: leads ?? req.leads,
        selectedLeadId: req.selectedLeadId,
      });

      if (isQueryResult(result)) {
        matchedCount = result.matched;
        summary = result.summary ?? summary;
        if (result.success) {
          traces.push(newTrace("Query result ready", "ok", result.summary));
        } else {
          traces.push(newTrace("Query failed", "error", result.error ?? result.summary));
        }
      }

      if (isUpdateResult(result)) {
        matchedCount = result.matched;
        summary = result.summary ?? summary;
        if (result.success && result.changed && result.leads) {
          leads = result.leads;
          changed = true;
          traces.push(newTrace("Leads updated", "ok", result.summary));
          for (const w of result.warnings) {
            traces.push(newTrace(w, "warn"));
          }
        } else if (!result.success) {
          traces.push(newTrace("Update failed", "error", result.error ?? result.summary));
        }
      }

      const forModel =
        isUpdateResult(result) && result.leads
          ? { ...result, leads: undefined }
          : result;

      openaiMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(forModel),
      });
    }
  }

  if (!assistantMessage) {
    assistantMessage = changed
      ? "The lead list was updated."
      : "I could not complete that request from the current leads data.";
  }

  return {
    assistantMessage,
    traces,
    leads: changed ? leads : null,
    changed,
    summary,
    matchedCount,
  };
}
