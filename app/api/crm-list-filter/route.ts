import OpenAI from "openai";
import { defaultOperatorForKind, filterFieldKind, operatorsForKind } from "@/lib/leads/lead-filter-operators";
import { isLeadFilterConditionReady } from "@/lib/leads/evaluate-lead-filters";
import { newEmptyCondition, type LeadFilterCondition, type LeadFilterConfig } from "@/lib/leads/lead-filter-types";
import type { FieldDefinition } from "@/lib/fields-config/types";

export const runtime = "nodejs";
export const maxDuration = 30;

type FieldBrief = {
  apiKey: string;
  label: string;
  dataType: string;
  options?: { id: string; label: string }[];
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function parseFields(raw: unknown): FieldDefinition[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f): f is FieldDefinition => isRecord(f) && typeof f.apiKey === "string" && typeof f.label === "string");
}

function sanitizeConditions(raw: unknown, fields: FieldDefinition[]): LeadFilterCondition[] {
  if (!Array.isArray(raw)) return [];
  const out: LeadFilterCondition[] = [];
  for (const item of raw) {
    if (!isRecord(item) || typeof item.fieldApiKey !== "string") continue;
    const field = fields.find((f) => f.apiKey === item.fieldApiKey);
    if (!field) continue;
    const kind = filterFieldKind(field);
    const op = typeof item.operator === "string" ? item.operator : defaultOperatorForKind(kind);
    const allowed = operatorsForKind(kind).some((o) => o.id === op);
    const cond: LeadFilterCondition = {
      ...newEmptyCondition(),
      fieldApiKey: field.apiKey,
      operator: allowed ? op : defaultOperatorForKind(kind),
      value: typeof item.value === "string" ? item.value : "",
      value2: typeof item.value2 === "string" ? item.value2 : "",
    };
    if (isLeadFilterConditionReady(cond, fields)) out.push(cond);
  }
  return out;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.prompt !== "string" || !body.prompt.trim()) {
    return Response.json({ error: "Send a prompt string." }, { status: 400 });
  }

  const fields = parseFields(body.fields);
  if (!fields.length) {
    return Response.json({ error: "No fields available to filter." }, { status: 400 });
  }

  const brief: FieldBrief[] = fields.map((f) => ({
    apiKey: f.apiKey,
    label: f.label,
    dataType: f.dataType,
    options: f.options?.slice(0, 40).map((o) => ({ id: o.id, label: o.label })),
  }));

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const heuristic = heuristicFilter(body.prompt.trim(), fields);
    return Response.json({
      config: heuristic.config,
      explanation: heuristic.explanation,
      source: "heuristic",
    });
  }

  try {
    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o";
    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Convert a CRM list request into structured filters.
Return JSON: { "explanation": string, "conditions": [{ "fieldApiKey": string, "operator": string, "value": string, "value2": string }] }
Use only these fields: ${JSON.stringify(brief)}
Operators by type:
- text/email/phone/url: eq, neq, contains, not_contains, starts_with, ends_with, empty, not_empty
- picklist/radio: eq, neq, empty, not_empty. value = comma-separated option ids
- multi_select: contains_any, contains_all, not_contains, empty, not_empty. value = option ids
- number/decimal: num_eq, num_neq, gt, gte, lt, lte, between, empty, not_empty
- date/date_time: on, before, after, on_or_before, on_or_after, between, today, yesterday, last_7_days, last_30_days, this_month, empty, not_empty
If the request cannot map to fields, return empty conditions and explain.`,
        },
        { role: "user", content: body.prompt.trim() },
      ],
    });
    const text = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text) as { explanation?: string; conditions?: unknown };
    const conditions = sanitizeConditions(parsed.conditions, fields);
    const config: LeadFilterConfig = { logic: "AND", conditions };
    return Response.json({
      config,
      explanation: typeof parsed.explanation === "string" ? parsed.explanation : "Applied AI filters.",
      source: "ai",
    });
  } catch (err) {
    const heuristic = heuristicFilter(body.prompt.trim(), fields);
    return Response.json({
      config: heuristic.config,
      explanation: heuristic.explanation,
      source: "heuristic",
      warning: err instanceof Error ? err.message : "AI filter unavailable.",
    });
  }
}

function heuristicFilter(prompt: string, fields: FieldDefinition[]): { config: LeadFilterConfig; explanation: string } {
  const q = prompt.toLowerCase();
  const conditions: LeadFilterCondition[] = [];
  for (const f of fields) {
    const kind = filterFieldKind(f);
    if (kind === "picklist" || kind === "multi_select") {
      const hit = f.options.find((o) => o.label && q.includes(o.label.toLowerCase()));
      if (hit) {
        conditions.push({
          ...newEmptyCondition(),
          fieldApiKey: f.apiKey,
          operator: kind === "multi_select" ? "contains_any" : "eq",
          value: hit.id,
          value2: "",
        });
      }
    }
  }
  const textField = fields.find((f) => ["text", "email", "phone", "paragraph"].includes(f.dataType));
  if (!conditions.length && textField) {
    const quoted = prompt.match(/"([^"]+)"/)?.[1] ?? prompt.replace(/^(show|find|filter|list)\s+/i, "").trim();
    if (quoted.length >= 2) {
      conditions.push({
        ...newEmptyCondition(),
        fieldApiKey: textField.apiKey,
        operator: "contains",
        value: quoted.slice(0, 80),
        value2: "",
      });
    }
  }
  return {
    config: { logic: "AND", conditions: conditions.filter((c) => isLeadFilterConditionReady(c, fields)) },
    explanation: conditions.length ? `Matched “${prompt}” to ${conditions.length} condition(s).` : `Could not map “${prompt}” to fields.`,
  };
}
