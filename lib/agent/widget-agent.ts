import type { AgentTraceStep, WidgetAgentField, WidgetAgentQuery, WidgetAgentRequest, WidgetAgentResult } from "@/lib/agent/types";
import { ToolRegistry } from "@/lib/agent/tool-registry";
import { compactWorkspace, resolveModule, WIDGET_AGENT_TOOLS } from "@/lib/crm/agent/tools";
import { extractWidgetBody } from "@/lib/widgets/compile";
import type { CrmWorkspace } from "@/lib/crm/types";
import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam } from "openai/resources/chat/completions";

const SYSTEM = `You design embeddable marketplace widgets for Sirrus CRM that show LIVE workspace data.

You have tools. Always use them before writing HTML:
1. list_workspace — see every module, field, listing column, and record count.
2. describe_module — inspect one module (fields + listing columns + sample records). Use this to match the user's words (Enquiries, counsellor, owner, stage).
3. query_records — count, list, or aggregate. For "assigned to each counsellor/owner" use operation=aggregate and groupBy=that field.
4. list_records — sample rows for a listing widget.
5. publish_widget — save the finished HTML, fields, and the CRM query that feeds the iframe.

Never invent modules, field keys, counsellor names, or counts. Tool results are the only source of truth.

"Enquiries assigned to each counsellor" means:
- describe_module on Enquiries (or the closest module)
- find the assignment field (Counsellor, Owner, owner)
- query_records operation=aggregate groupBy=that field
- publish_widget with a list bound to that query

HTML rules:
- Fragment only (style + markup). No <html> or <body>.
- Scalars: data-field="key" (module, total, groupBy).
- Repeating rows: a [data-rows] host containing one [data-row-template] child. Cells use data-col="group" / data-col="count" / data-col="{apiKey}".
- The host clones the template for each queried row at runtime.
- No external scripts, iframes, fetch, cookies, or localStorage.
- Flat, compact, one accent, no gradients, no emoji.

If the user only wants a static card from declared fields (no CRM query), you may publish with query omitted — still call list_workspace first in case they named a module.`;

function newTrace(label: string, status: AgentTraceStep["status"] = "ok", detail?: string): AgentTraceStep {
  return { id: `tr_${Math.random().toString(36).slice(2, 10)}`, label, detail, status };
}

export function createWidgetAgentClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

function createRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of WIDGET_AGENT_TOOLS) registry.register(tool);
  registry.register({
    name: "publish_widget",
    description:
      "Publish the finished widget: HTML fragment, display fields, and the CRM query that fills [data-rows] at runtime.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["html"],
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        html: { type: "string", description: "Widget body: style + markup with data-field / data-rows / data-col." },
        fields: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key", "label"],
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              type: { type: "string" },
              options: { type: "array", items: { type: "string" } },
            },
          },
        },
        query: {
          type: "object",
          additionalProperties: false,
          properties: {
            module: { type: "string", description: "Module id, apiKey, or label." },
            operation: { type: "string", enum: ["list", "aggregate", "count"] },
            groupBy: { type: "string" },
            contains: { type: "string" },
            limit: { type: "number" },
            listFields: { type: "array", items: { type: "string" } },
            filters: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["field", "value"],
                properties: { field: { type: "string" }, value: { type: "string" } },
              },
            },
          },
        },
      },
    },
    execute: (input) => {
      if (!input || typeof input !== "object" || typeof (input as { html?: unknown }).html !== "string") {
        return { success: false, error: "html is required.", summary: "publish_widget needs html." };
      }
      return { success: true, summary: "Widget spec captured.", published: true };
    },
  });
  return registry;
}

function parseFields(raw: unknown): WidgetAgentField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object" && typeof (f as { key?: unknown }).key === "string")
    .map((f) => ({
      key: String(f.key),
      label: typeof f.label === "string" ? f.label : String(f.key),
      type: typeof f.type === "string" ? f.type : "text",
      options: Array.isArray(f.options) ? f.options.map(String) : undefined,
    }));
}

function parseQuery(raw: unknown, ws: CrmWorkspace): WidgetAgentQuery | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const moduleRef = typeof o.module === "string" ? o.module : typeof o.moduleId === "string" ? o.moduleId : "";
  const mod = moduleRef ? resolveModule(ws, moduleRef) : undefined;
  if (!mod) return null;
  const op = o.operation === "list" || o.operation === "count" || o.operation === "aggregate" ? o.operation : "list";
  return {
    moduleId: mod.id,
    operation: op,
    groupBy: typeof o.groupBy === "string" ? o.groupBy : undefined,
    contains: typeof o.contains === "string" ? o.contains : undefined,
    limit: typeof o.limit === "number" ? o.limit : undefined,
    listFieldKeys: Array.isArray(o.listFields)
      ? o.listFields.map(String)
      : Array.isArray(o.listFieldKeys)
        ? o.listFieldKeys.map(String)
        : undefined,
    filters: Array.isArray(o.filters)
      ? o.filters
          .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
          .map((f) => ({ field: String(f.field ?? ""), value: String(f.value ?? "") }))
          .filter((f) => f.field)
      : undefined,
  };
}

function parsePublish(
  args: unknown,
  ws: CrmWorkspace,
): { html: string; fields: WidgetAgentField[]; query: WidgetAgentQuery | null; name?: string } | null {
  if (!args || typeof args !== "object") return null;
  const o = args as Record<string, unknown>;
  const html = typeof o.html === "string" ? extractWidgetBody(o.html) : "";
  if (!html) return null;
  return {
    html,
    fields: parseFields(o.fields),
    query: parseQuery(o.query, ws),
    name: typeof o.name === "string" ? o.name : undefined,
  };
}

export async function runWidgetAgent(req: WidgetAgentRequest, client: OpenAI, model: string): Promise<WidgetAgentResult> {
  const traces: AgentTraceStep[] = [newTrace("Widget request received"), newTrace("Widget agent")];
  const registry = createRegistry();
  const openaiTools = registry.toOpenAITools();

  const openaiMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM },
    {
      role: "system",
      content: `Current widget draft: ${JSON.stringify({
        name: req.name,
        description: req.description ?? "",
        uiBrief: req.uiBrief,
        fields: req.fields,
      })}`,
    },
    {
      role: "system",
      content: `Workspace snapshot (call tools for live records and listings; do not invent beyond this):\n${JSON.stringify(compactWorkspace(req.workspace))}`,
    },
  ];

  if (req.currentHtml?.trim()) {
    openaiMessages.push({
      role: "system",
      content: `Current widget HTML the user is iterating on:\n${req.currentHtml.slice(0, 8000)}`,
    });
  }

  for (const m of req.messages) {
    if (m.role === "user" || m.role === "assistant") {
      openaiMessages.push({ role: m.role, content: m.content });
    }
  }

  let assistantMessage = "";
  let published: ReturnType<typeof parsePublish> = null;

  for (let round = 0; round < 8; round++) {
    const params: ChatCompletionCreateParamsNonStreaming = {
      model,
      temperature: 0.3,
      messages: openaiMessages,
      tools: openaiTools,
      tool_choice: round === 0 ? "required" : "auto",
    };

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
      if (!published && msg.content) {
        try {
          const parsed = JSON.parse(msg.content) as { html?: string; message?: string; fields?: unknown; query?: unknown; name?: string };
          if (typeof parsed.html === "string") {
            published = parsePublish(parsed, req.workspace);
            if (typeof parsed.message === "string") assistantMessage = parsed.message;
          }
        } catch {
          /* not JSON */
        }
      }
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

      if (toolName === "publish_widget") {
        published = parsePublish(parsedArgs, req.workspace) ?? published;
      }

      const result = await registry.execute(toolName, parsedArgs, { workspace: req.workspace });
      const rec = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
      const success = rec.success === true;
      const summary = typeof rec.summary === "string" ? rec.summary : undefined;
      traces.push(newTrace(success ? "Tool result ready" : "Tool failed", success ? "ok" : "error", summary));

      openaiMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify({ ...rec, workspace: undefined }),
      });
    }
  }

  return {
    assistantMessage: assistantMessage || (published ? "Published the widget from live workspace data." : "I could not finish that widget from the current workspace."),
    html: published?.html ?? null,
    fields: published?.fields,
    query: published?.query ?? null,
    name: published?.name,
    traces,
  };
}
