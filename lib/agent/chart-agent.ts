import type { AgentTraceStep, ChartAgentChart, ChartAgentRequest, ChartAgentResult } from "@/lib/agent/types";
import { inferChartFromPrompt, resolveInferredChart } from "@/lib/crm/chart-infer";
import { compactModulesForAgent } from "@/lib/crm/chart-query";
import type { CrmWorkspace } from "@/lib/crm/types";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const SYSTEM = `You design analytics charts for a Sirrus CRM workspace.

The user describes what they want. You return a JSON object:
{
  "message": "short confirmation",
  "chart": {
    "name": "Leads created by month",
    "description": "",
    "moduleId": "leads",
    "chartType": "bar" | "line" | "area" | "pie" | "donut" | "table",
    "dimensions": [{ "field": "__created_at", "timeGrain": "month" }],
    "measures": [{ "fn": "count", "label": "Count" }],
    "filters": []
  }
}

Rules:
- Use only modules and field apiKeys from the provided schema. Never invent keys.
- "__created_at" and "__updated_at" are valid date dimensions on every module.
- timeGrain is required for date dimensions: day | week | month | quarter | year.
- "leads created every month" → module leads, bar, dimension __created_at + month, measure count.
- "leads by source" → pie or bar, dimension source, measure count.
- "sum of budget by owner" → bar, dimension owner, measure sum of budget.
- Prefer count when the user does not name a numeric field.
- One dimension is usual. A second dimension splits series (e.g. month × source).
- If refining an existing chart, keep unchanged fields unless the user asks to change them.`;

function newTrace(label: string, status: AgentTraceStep["status"] = "ok", detail?: string): AgentTraceStep {
  return { id: `tr_${Math.random().toString(36).slice(2, 10)}`, label, detail, status };
}

export function createChartAgentClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

function asChart(raw: unknown): ChartAgentChart | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.moduleId !== "string" || typeof o.chartType !== "string") return null;
  const dimensions = Array.isArray(o.dimensions)
    ? o.dimensions
        .filter((d): d is Record<string, unknown> => !!d && typeof d === "object" && typeof (d as { field?: unknown }).field === "string")
        .map((d) => ({
          field: String(d.field),
          timeGrain: typeof d.timeGrain === "string" ? d.timeGrain : undefined,
        }))
    : [];
  const measures = Array.isArray(o.measures)
    ? o.measures
        .filter((m): m is Record<string, unknown> => !!m && typeof m === "object" && typeof (m as { fn?: unknown }).fn === "string")
        .map((m) => ({
          fn: String(m.fn),
          field: typeof m.field === "string" ? m.field : undefined,
          label: typeof m.label === "string" ? m.label : undefined,
        }))
    : [];
  return {
    name: typeof o.name === "string" ? o.name : "Chart",
    description: typeof o.description === "string" ? o.description : "",
    moduleId: o.moduleId,
    chartType: o.chartType,
    dimensions,
    measures,
    filters: Array.isArray(o.filters)
      ? o.filters
          .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
          .map((f) => ({ field: String(f.field ?? ""), value: String(f.value ?? "") }))
          .filter((f) => f.field)
      : [],
  };
}

export function chartFromPromptFallback(prompt: string, ws: CrmWorkspace): ChartAgentResult {
  const inferred = inferChartFromPrompt(prompt, ws);
  const resolved = resolveInferredChart(ws, inferred);
  return {
    assistantMessage: `Built “${resolved.name}” from your prompt.`,
    chart: resolved,
    traces: [newTrace("Local chart builder"), newTrace("Spec inferred from prompt")],
  };
}

export async function runChartAgent(
  req: ChartAgentRequest,
  ws: CrmWorkspace,
  client: OpenAI,
  model: string,
): Promise<ChartAgentResult> {
  const traces: AgentTraceStep[] = [newTrace("Chart request received"), newTrace("Chart agent")];
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM },
    {
      role: "system",
      content: `Workspace modules (authoritative):\n${JSON.stringify(compactModulesForAgent(ws))}`,
    },
  ];
  if (req.current) {
    messages.push({ role: "system", content: `Current chart the user is editing:\n${JSON.stringify(req.current)}` });
  }
  for (const m of req.messages) {
    if (m.role === "user" || m.role === "assistant") messages.push({ role: m.role, content: m.content });
  }

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages,
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  let parsed: { message?: string; chart?: unknown } = {};
  try {
    parsed = JSON.parse(raw) as { message?: string; chart?: unknown };
  } catch {
    traces.push(newTrace("Model JSON", "warn", "Fell back to local inference."));
    return chartFromPromptFallback(lastUser, ws);
  }

  const chart = asChart(parsed.chart);
  if (!chart) {
    traces.push(newTrace("Chart spec", "warn", "Model omitted a spec; used local inference."));
    return chartFromPromptFallback(lastUser, ws);
  }

  const resolved = resolveInferredChart(ws, {
    ...chart,
    chartType: chart.chartType as never,
    dimensions: chart.dimensions.map((d) => ({ field: d.field, timeGrain: d.timeGrain as never })),
    measures: chart.measures.map((m) => ({ id: "", fn: m.fn as never, field: m.field, label: m.label })),
    prompt: lastUser,
  });

  traces.push(newTrace("Chart spec resolved", "ok", resolved.name));
  return {
    assistantMessage: typeof parsed.message === "string" && parsed.message.trim() ? parsed.message.trim() : `Built “${resolved.name}”.`,
    chart: resolved,
    traces,
  };
}
