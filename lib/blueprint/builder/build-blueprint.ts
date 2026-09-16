import { shapeTransitionFormFieldStorage } from "@/lib/blueprint/transition-form-shape";
import {
  createDefaultTransition,
  newEntityId,
  type AfterCreateRecordTargetModule,
  type BlueprintDocument,
  type BlueprintState,
  type BlueprintTransition,
} from "@/lib/blueprint/types";
import { createDefaultLeadFields, type FieldDefinition } from "@/lib/fields-config/types";
import {
  findField,
  findLifecycleField,
  findModule,
  findTaskType,
  type SirrusMetadata,
  type SirrusMetadataField,
} from "@/lib/blueprint/metadata/sirrus-metadata";
import { validateBlueprint, type BlueprintValidationResult } from "@/lib/blueprint/validator/validate-blueprint";

export type BlueprintBuilderOperation = "create" | "modify" | "explain";

export type BlueprintBuilderRuleType =
  | "required_field"
  | "auto_task"
  | "create_record"
  | "field_update"
  | "add_stage"
  | "remove_stage"
  | "add_transition"
  | "remove_transition"
  | "add_approval";

export type BlueprintBuilderRule = {
  type: BlueprintBuilderRuleType;
  fromStage?: string;
  toStage?: string;
  stage?: string;
  beforeStage?: string;
  afterStage?: string;
  field?: string;
  taskType?: string;
  offsetDays?: number;
  targetModule?: string;
  mapping?: Array<{ targetField: string; sourceField?: string; literalValue?: string }>;
};

export type BlueprintBuilderInput = {
  operation: BlueprintBuilderOperation;
  intent: string;
  moduleId?: string;
  name?: string;
  lifecycleField?: string;
  stages?: string[];
  lostStage?: string;
  rules?: BlueprintBuilderRule[];
};

export type BlueprintBuilderContext = {
  metadata: SirrusMetadata;
  currentBlueprint: BlueprintDocument | null;
  fieldDefinitions?: FieldDefinition[];
};

export type BlueprintResponse = {
  success: boolean;
  operation: BlueprintBuilderOperation;
  blueprint: BlueprintDocument | null;
  explanation?: string;
  summary?: string;
  validation: BlueprintValidationResult;
  changed: boolean;
};

const LOST_RE = /^(lost|dropped|closed lost|closed-lost)$/i;
const WON_RE = /won|booked|hired|admission|policy issued|closed won/i;

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugStage(label: string): string {
  const s = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 28);
  return s || "stage";
}

function parseStagesFromIntent(intent: string): string[] {
  const arrow = intent.split(/\s*(?:→|->|=>|➡|➜)\s*/).map((p) => p.trim());
  if (arrow.length >= 2) {
    return arrow
      .map((part) => {
        const cut = part.split(/[.!?\n]/)[0] ?? part;
        return cut
          .replace(/^(when|if|and|then|from)\s+/i, "")
          .replace(/\s+(should|must|will|is)\b[\s\S]*$/i, "")
          .trim();
      })
      .filter((p) => p.length > 1 && p.length < 40);
  }
  return [];
}

function findState(states: BlueprintState[], hint?: string): BlueprintState | undefined {
  if (!hint?.trim()) return undefined;
  const h = norm(hint);
  return (
    states.find((s) => norm(s.label) === h || s.id === hint) ??
    states.find((s) => norm(s.label).includes(h) || h.includes(norm(s.label)))
  );
}

function layoutStates(states: BlueprintState[]): BlueprintState[] {
  const lost = states.filter((s) => LOST_RE.test(s.label));
  const happy = states.filter((s) => !LOST_RE.test(s.label));
  return [
    ...happy.map((s, i) => ({ ...s, position: { x: 48 + i * 168, y: 64 } })),
    ...lost.map((s, i) => ({
      ...s,
      position: { x: 48 + Math.max(0, happy.length - 2 + i) * 168, y: 240 },
    })),
  ];
}

function sequentialTransitions(states: BlueprintState[], keep: BlueprintTransition[]): BlueprintTransition[] {
  const happy = states.filter((s) => !LOST_RE.test(s.label));
  const next = [...keep];
  const has = (from: string, to: string) => next.some((t) => t.sourceStateId === from && t.targetStateId === to);
  for (let i = 0; i < happy.length - 1; i++) {
    const a = happy[i]!;
    const b = happy[i + 1]!;
    if (!has(a.id, b.id)) next.push(createDefaultTransition(a.id, b.id, a.label, b.label));
  }
  const lost = states.filter((s) => LOST_RE.test(s.label));
  for (const L of lost) {
    for (const s of happy) {
      if (WON_RE.test(s.label)) continue;
      if (!has(s.id, L.id)) next.push(createDefaultTransition(s.id, L.id, s.label, L.label));
    }
  }
  return next;
}

function leadFields(ctx: BlueprintBuilderContext): FieldDefinition[] {
  return ctx.fieldDefinitions?.length ? ctx.fieldDefinitions : createDefaultLeadFields();
}

function toLeadField(meta: SirrusMetadataField, defs: FieldDefinition[]): FieldDefinition | undefined {
  return defs.find((f) => f.apiKey === meta.apiKey) ?? defs.find((f) => f.label.toLowerCase() === meta.label.toLowerCase());
}

function applyRequiredField(
  transitions: BlueprintTransition[],
  target: BlueprintState,
  field: SirrusMetadataField,
  defs: FieldDefinition[],
): BlueprintTransition[] {
  const defn = toLeadField(field, defs);
  const shaped = shapeTransitionFormFieldStorage(defn);
  return transitions.map((t) => {
    if (t.targetStateId !== target.id) return t;
    const existing = t.form.fields.find((f) => f.fieldId === field.apiKey);
    if (existing) {
      return {
        ...t,
        form: {
          ...t.form,
          fields: t.form.fields.map((f) => (f.fieldId === field.apiKey ? { ...f, mandatory: true, label: field.label } : f)),
        },
      };
    }
    return {
      ...t,
      form: {
        ...t.form,
        fields: [
          ...t.form.fields,
          {
            id: newEntityId("df"),
            fieldId: field.apiKey,
            label: field.label,
            kind: shaped.kind,
            mandatory: true,
            picklistOptions: shaped.picklistOptions,
          },
        ],
      },
    };
  });
}

function applyAutoTask(
  transitions: BlueprintTransition[],
  target: BlueprintState,
  taskTypeId: string,
  offsetDays: number,
): BlueprintTransition[] {
  return transitions.map((t) => {
    if (t.targetStateId !== target.id) return t;
    if (t.after.autoTasks.some((a) => a.taskTypeOptionId === taskTypeId && a.offsetDays === offsetDays)) return t;
    return {
      ...t,
      after: {
        ...t.after,
        autoTasks: [
          ...t.after.autoTasks,
          {
            id: newEntityId("at"),
            taskTypeOptionId: taskTypeId,
            dueKind: "execution_plus_days",
            dueAnchor: "execution" as const,
            offsetDays,
            dueTimeHm: "",
            customDueDatetime: "",
          },
        ],
      },
    };
  });
}

function resolveCreateTarget(moduleHint: string | undefined, meta: SirrusMetadata): AfterCreateRecordTargetModule {
  const m = findModule(meta, moduleHint);
  if (m?.id === "booking" || /book/i.test(moduleHint ?? "")) return "booking";
  if (m?.id === "lead" || /lead/i.test(moduleHint ?? "")) return "leads";
  if (/partner|channel/i.test(moduleHint ?? "") || m?.id === "channel_partner") return "channel_partner";
  return "booking";
}

function applyCreateRecord(
  transitions: BlueprintTransition[],
  target: BlueprintState,
  targetModule: AfterCreateRecordTargetModule,
  mapping: BlueprintBuilderRule["mapping"],
  meta: SirrusMetadata,
  moduleId: string,
): BlueprintTransition[] {
  const bindings =
    mapping && mapping.length
      ? mapping.map((row) => ({
          id: newEntityId("fb"),
          targetFieldApiKey: findField(meta, row.targetField, targetModule === "booking" ? "booking" : undefined)?.apiKey ?? row.targetField,
          valueMode: (row.sourceField ? "map" : "literal") as "map" | "literal",
          literalValue: row.literalValue ?? "",
          sourceModule: "leads" as const,
          sourceFieldApiKey: row.sourceField
            ? (findField(meta, row.sourceField, moduleId)?.apiKey ?? row.sourceField)
            : "",
        }))
      : [
          {
            id: newEntityId("fb"),
            targetFieldApiKey: targetModule === "booking" ? "booking_name" : "lead_name",
            valueMode: "map" as const,
            literalValue: "",
            sourceModule: "leads" as const,
            sourceFieldApiKey: "lead_name",
          },
        ];

  return transitions.map((t) => {
    if (t.targetStateId !== target.id) return t;
    if (t.after.createRecords.some((c) => c.targetModule === targetModule)) return t;
    return {
      ...t,
      after: {
        ...t.after,
        createRecords: [
          ...t.after.createRecords,
          { id: newEntityId("cr"), targetModule, fieldBindings: bindings },
        ],
      },
    };
  });
}

function inferRules(intent: string, stages: string[], meta: SirrusMetadata, moduleId: string): BlueprintBuilderRule[] {
  const rules: BlueprintBuilderRule[] = [];
  const text = intent;

  for (const field of meta.fields.filter((f) => f.moduleId === moduleId || f.moduleId === "lead")) {
    const names = [field.label, field.apiKey, ...field.aliases];
    const mentioned = names.some((n) => n && text.toLowerCase().includes(n.toLowerCase()));
    if (!mentioned || !/\b(mandatory|required|must|requirement)\b/i.test(text)) continue;
    let toStage: string | undefined;
    if (/lost|dropped/i.test(field.label) || /lost|dropped/i.test(field.apiKey) || field.aliases.some((a) => /lost/i.test(a))) {
      toStage = stages.find((s) => LOST_RE.test(s)) ?? "Lost";
    } else if (/site visit/i.test(field.label) || /site_visit/i.test(field.apiKey)) {
      toStage = stages.find((s) => /site visit/i.test(s));
    } else {
      toStage = stages.find((s) => text.toLowerCase().includes(s.toLowerCase()));
    }
    if (toStage) rules.push({ type: "required_field", toStage, field: field.apiKey });
  }

  const createMatch = text.match(/create (?:a |an )?([A-Za-z ]{2,40}?) record/i);
  if (createMatch) {
    const won = stages.find((s) => WON_RE.test(s)) ?? stages[stages.length - 1];
    if (won) rules.push({ type: "create_record", toStage: won, targetModule: createMatch[1]!.trim() });
  }

  const daysMatch = text.match(/(\d+)\s+days?\s+after\s+([A-Za-z ]{2,40}?)(?:[.!]|$)/i);
  if (daysMatch) {
    const stage = daysMatch[2]!.trim();
    const taskHint = /site visit/i.test(text) ? "Site visit" : /proposal/i.test(text) ? "Proposal Follow Up" : "Follow-up";
    rules.push({ type: "auto_task", toStage: stage, taskType: taskHint, offsetDays: Number(daysMatch[1]) });
  } else if (/follow-?up task/i.test(text) || /creates? (?:a )?site visit task/i.test(text)) {
    const toStage = stages.find((s) => /site visit/i.test(s)) ?? stages.find((s) => /proposal/i.test(s));
    if (toStage) {
      rules.push({
        type: "auto_task",
        toStage,
        taskType: /site visit/i.test(text) ? "Site visit" : "Follow-up",
        offsetDays: 0,
      });
    }
  }

  const approval = text.match(/approval before\s+([A-Za-z ]{2,40}?)(?:[.!]|$)/i);
  if (approval) rules.push({ type: "add_approval", beforeStage: approval[1]!.trim() });

  const remove = text.match(/remove(?: the)?\s+([A-Za-z ]{2,40}?)\s+stage/i);
  if (remove) rules.push({ type: "remove_stage", stage: remove[1]!.trim() });

  return rules;
}

function ensureStage(states: BlueprintState[], label: string): { states: BlueprintState[]; state: BlueprintState } {
  const existing = findState(states, label);
  if (existing) return { states, state: existing };
  const state: BlueprintState = {
    id: `st_${slugStage(label)}_${newEntityId("n").slice(-4)}`,
    label: label.trim(),
    position: { x: 48, y: 64 },
  };
  return { states: [...states, state], state };
}

function applyRules(
  states: BlueprintState[],
  transitions: BlueprintTransition[],
  rules: BlueprintBuilderRule[],
  ctx: BlueprintBuilderContext,
  moduleId: string,
): { states: BlueprintState[]; transitions: BlueprintTransition[] } {
  let nextStates = [...states];
  let nextTr = [...transitions];
  const defs = leadFields(ctx);

  for (const rule of rules) {
    if (rule.type === "add_stage" && rule.stage) {
      const r = ensureStage(nextStates, rule.stage);
      nextStates = r.states;
      if (rule.beforeStage) {
        const before = findState(nextStates, rule.beforeStage);
        if (before) {
          const idx = nextStates.findIndex((s) => s.id === before.id);
          const added = nextStates.find((s) => s.id === r.state.id)!;
          nextStates = nextStates.filter((s) => s.id !== added.id);
          nextStates.splice(Math.max(0, idx), 0, added);
        }
      }
    }

    if (rule.type === "add_approval") {
      const before = findState(nextStates, rule.beforeStage ?? rule.stage) ?? findState(nextStates, "Negotiation");
      if (before) {
        const r = ensureStage(nextStates, rule.stage?.trim() || "Approval");
        nextStates = r.states.filter((s) => s.id !== r.state.id);
        const idx = nextStates.findIndex((s) => s.id === before.id);
        nextStates.splice(Math.max(0, idx), 0, r.state);
        const added = r.state;
        const incoming = nextTr.filter((t) => t.targetStateId === before.id && t.sourceStateId !== added.id);
        const incomingIds = new Set(incoming.map((t) => t.id));
        nextTr = nextTr.filter((t) => !incomingIds.has(t.id));
        for (const t of incoming) {
          const srcLabel = findState(nextStates, t.sourceStateId)?.label ?? "";
          nextTr.push(createDefaultTransition(t.sourceStateId, added.id, srcLabel, added.label));
        }
        if (!nextTr.some((t) => t.sourceStateId === added.id && t.targetStateId === before.id)) {
          nextTr.push(createDefaultTransition(added.id, before.id, added.label, before.label));
        }
      }
    }

    if (rule.type === "remove_stage" && (rule.stage || rule.toStage)) {
      const victim = findState(nextStates, rule.stage ?? rule.toStage);
      if (victim) {
        const incoming = nextTr.filter((t) => t.targetStateId === victim.id).map((t) => t.sourceStateId);
        const outgoing = nextTr.filter((t) => t.sourceStateId === victim.id).map((t) => t.targetStateId);
        nextTr = nextTr.filter((t) => t.sourceStateId !== victim.id && t.targetStateId !== victim.id);
        for (const from of incoming) {
          for (const to of outgoing) {
            if (from === to) continue;
            const a = nextStates.find((s) => s.id === from);
            const b = nextStates.find((s) => s.id === to);
            if (a && b && !nextTr.some((t) => t.sourceStateId === from && t.targetStateId === to)) {
              nextTr.push(createDefaultTransition(from, to, a.label, b.label));
            }
          }
        }
        nextStates = nextStates.filter((s) => s.id !== victim.id);
      }
    }

    if (rule.type === "add_transition" && rule.fromStage && rule.toStage) {
      const a = findState(nextStates, rule.fromStage);
      const b = findState(nextStates, rule.toStage);
      if (a && b && !nextTr.some((t) => t.sourceStateId === a.id && t.targetStateId === b.id)) {
        nextTr.push(createDefaultTransition(a.id, b.id, a.label, b.label));
      }
    }

    if (rule.type === "remove_transition" && rule.fromStage && rule.toStage) {
      const a = findState(nextStates, rule.fromStage);
      const b = findState(nextStates, rule.toStage);
      if (a && b) nextTr = nextTr.filter((t) => !(t.sourceStateId === a.id && t.targetStateId === b.id));
    }

    if (rule.type === "required_field" && rule.field) {
      let target = findState(nextStates, rule.toStage ?? rule.stage);
      const field = findField(ctx.metadata, rule.field, moduleId);
      if (!target && field && (/lost/i.test(field.label) || field.aliases.some((a) => /lost/i.test(a)))) {
        const ensured = ensureStage(nextStates, rule.toStage || "Lost");
        nextStates = ensured.states;
        target = ensured.state;
      }
      if (target && field) nextTr = applyRequiredField(nextTr, target, field, defs);
    }

    if (rule.type === "auto_task") {
      const target = findState(nextStates, rule.toStage ?? rule.stage);
      const tt = findTaskType(ctx.metadata, rule.taskType);
      if (target && tt) nextTr = applyAutoTask(nextTr, target, tt.id, rule.offsetDays ?? 0);
    }

    if (rule.type === "create_record") {
      const target =
        findState(nextStates, rule.toStage ?? rule.stage) ?? nextStates.find((s) => WON_RE.test(s.label));
      if (target) {
        const tm = resolveCreateTarget(rule.targetModule, ctx.metadata);
        nextTr = applyCreateRecord(nextTr, target, tm, rule.mapping, ctx.metadata, moduleId);
      }
    }

    if (rule.type === "field_update" && rule.field) {
      const target = findState(nextStates, rule.toStage ?? rule.stage);
      const field = findField(ctx.metadata, rule.field, moduleId);
      if (target && field) {
        nextTr = nextTr.map((t) => {
          if (t.targetStateId !== target.id) return t;
          if (t.after.fieldUpdates.some((u) => u.fieldId === field.apiKey)) return t;
          const defn = toLeadField(field, defs);
          const valueKind =
            defn?.dataType === "date_time" ? "execution_date_time" : defn?.dataType === "date" ? "execution_date" : "literal";
          return {
            ...t,
            after: {
              ...t.after,
              fieldUpdates: [
                ...t.after.fieldUpdates,
                {
                  id: newEntityId("fu"),
                  fieldId: field.apiKey,
                  fieldLabel: field.label,
                  valueKind,
                  literalValue: "",
                },
              ],
            },
          };
        });
      }
    }
  }

  return { states: nextStates, transitions: nextTr };
}

function explainBlueprint(doc: BlueprintDocument, intent: string): string {
  const byId = new Map(doc.states.map((s) => [s.id, s.label]));
  const hops = doc.transitions.map((t) => `${byId.get(t.sourceStateId) ?? t.sourceStateId} → ${byId.get(t.targetStateId) ?? t.targetStateId}`);
  const skip = intent.match(/why\s+(.+?)\s+cannot move directly to\s+(.+?)(?:[.?!]|$)/i);
  if (skip) {
    const from = findState(doc.states, skip[1]);
    const to = findState(doc.states, skip[2]);
    if (from && to) {
      const direct = doc.transitions.some((t) => t.sourceStateId === from.id && t.targetStateId === to.id);
      if (direct) {
        return `${from.label} can already move directly to ${to.label}.`;
      }
      const happy = doc.states.filter((s) => !LOST_RE.test(s.label));
      const fi = happy.findIndex((s) => s.id === from.id);
      const ti = happy.findIndex((s) => s.id === to.id);
      const between = fi >= 0 && ti > fi ? happy.slice(fi + 1, ti).map((s) => s.label) : [];
      if (between.length) {
        return `${from.label} cannot move directly to ${to.label} because this Blueprint is sequential. The configured path is ${from.label} → ${between.join(" → ")} → ${to.label}. There is no skip transition.`;
      }
      return `${from.label} cannot move directly to ${to.label} because no transition is configured between those stages. Configured moves: ${hops.join("; ") || "none"}.`;
    }
  }
  return `Configured transitions: ${hops.join("; ") || "none"}. Stages: ${doc.states.map((s) => s.label).join(" → ")}.`;
}

export function summarizeBlueprint(doc: BlueprintDocument): string {
  const happy = doc.states.filter((s) => !LOST_RE.test(s.label)).map((s) => s.label);
  const lost = doc.states.filter((s) => LOST_RE.test(s.label)).map((s) => s.label);
  const rules: string[] = [];
  for (const t of doc.transitions) {
    const target = doc.states.find((s) => s.id === t.targetStateId)?.label ?? "";
    for (const f of t.form.fields.filter((x) => x.mandatory)) {
      const line = `${f.label} is mandatory when moving to ${target}`;
      if (!rules.includes(line)) rules.push(line);
    }
    for (const task of t.after.autoTasks) {
      const line = `Auto-task (${task.taskTypeOptionId}) ${task.offsetDays ? `+${task.offsetDays}d ` : ""}on ${target}`;
      if (!rules.includes(line)) rules.push(line);
    }
    for (const rec of t.after.createRecords) {
      const line = `Creates a ${rec.targetModule} record on ${target}`;
      if (!rules.includes(line)) rules.push(line);
    }
  }
  const flow = happy.join(" → ");
  const lostBit = lost.length ? ` Lost path: ${lost.join(", ")}.` : "";
  const ruleBit = rules.length ? ` Rules: ${rules.join("; ")}.` : "";
  return `${flow}.${lostBit}${ruleBit}`.trim();
}

/**
 * Deterministic configuration engine.
 * Converts structured Builder Agent tool input into canonical Blueprint JSON.
 */
export function buildBlueprint(input: BlueprintBuilderInput, ctx: BlueprintBuilderContext): BlueprintResponse {
  const operation = input.operation === "modify" || input.operation === "explain" ? input.operation : "create";
  const current = ctx.currentBlueprint;

  if (operation === "explain") {
    if (!current) {
      return {
        success: false,
        operation,
        blueprint: null,
        changed: false,
        explanation: "There is no Blueprint open to explain. Create or open one first.",
        validation: {
          valid: false,
          errors: [{ code: "no_blueprint", message: "No current Blueprint to explain." }],
          warnings: [],
        },
      };
    }
    const validation = validateBlueprint(current, ctx.metadata);
    return {
      success: true,
      operation,
      blueprint: current,
      changed: false,
      explanation: explainBlueprint(current, input.intent),
      summary: summarizeBlueprint(current),
      validation,
    };
  }

  const moduleMeta = findModule(ctx.metadata, input.moduleId ?? current?.module ?? "lead") ?? findModule(ctx.metadata, "lead")!;
  const lifecycle = findLifecycleField(ctx.metadata, moduleMeta, input.lifecycleField ?? current?.stageField);

  let stageLabels =
    (input.stages ?? []).map((s) => s.trim()).filter(Boolean) ?? [];
  if (operation === "create" && stageLabels.length < 2) {
    const parsed = parseStagesFromIntent(input.intent);
    if (parsed.length >= 2) stageLabels = parsed;
  }

  let states: BlueprintState[] = [];
  let transitions: BlueprintTransition[] = [];
  let id = current?.id ?? newEntityId("bp");
  let name = input.name?.trim() || current?.name || `${moduleMeta.label} process`;

  if (operation === "modify" && current) {
    states = current.states.map((s) => ({ ...s }));
    transitions = current.transitions.map((t) => ({
      ...t,
      form: { ...t.form, fields: [...t.form.fields], tools: [...t.form.tools] },
      after: {
        fieldUpdates: [...t.after.fieldUpdates],
        autoTasks: [...t.after.autoTasks],
        createRecords: t.after.createRecords.map((c) => ({ ...c, fieldBindings: [...c.fieldBindings] })),
      },
    }));
    id = current.id;
    if (!input.name?.trim()) name = current.name;
    if (stageLabels.length >= 2) {
      const rebuilt: BlueprintState[] = [];
      for (const label of stageLabels) {
        const existing = findState(states, label);
        rebuilt.push(existing ? { ...existing, label: existing.label } : { id: `st_${slugStage(label)}_${newEntityId("n").slice(-4)}`, label, position: { x: 0, y: 0 } });
      }
      for (const s of states) {
        if (LOST_RE.test(s.label) && !rebuilt.some((x) => x.id === s.id)) rebuilt.push(s);
      }
      const keepIds = new Set(rebuilt.map((s) => s.id));
      states = rebuilt;
      transitions = transitions.filter((t) => keepIds.has(t.sourceStateId) && keepIds.has(t.targetStateId));
    }
  } else {
    if (stageLabels.length < 2) {
      return {
        success: false,
        operation,
        blueprint: current,
        changed: false,
        explanation: "I need an ordered list of stages (for example New → Contacted → Qualified).",
        validation: {
          valid: false,
          errors: [{ code: "stages_required", message: "Could not identify an ordered stage list from the request." }],
          warnings: [],
        },
      };
    }
    states = stageLabels.map((label) => ({
      id: `st_${slugStage(label)}`,
      label,
      position: { x: 0, y: 0 },
    }));
    const ids = new Map<string, number>();
    states = states.map((s) => {
      const n = (ids.get(s.id) ?? 0) + 1;
      ids.set(s.id, n);
      return n === 1 ? s : { ...s, id: `${s.id}_${n}` };
    });
  }

  if (input.lostStage) {
    const r = ensureStage(states, input.lostStage);
    states = r.states;
  }

  const inferred = inferRules(input.intent, states.map((s) => s.label), ctx.metadata, moduleMeta.id);
  const rules = [...(input.rules ?? []), ...inferred];
  if (rules.some((r) => r.type === "required_field" && r.field && /lost|dropped/i.test(r.field + (r.toStage ?? "")))) {
    if (!states.some((s) => LOST_RE.test(s.label))) {
      const r = ensureStage(states, input.lostStage || "Lost");
      states = r.states;
    }
  }

  states = layoutStates(states);
  transitions = sequentialTransitions(states, transitions);
  const applied = applyRules(states, transitions, rules, ctx, moduleMeta.id);
  states = layoutStates(applied.states);
  transitions = sequentialTransitions(applied.states, applied.transitions);

  const blueprint: BlueprintDocument = {
    id,
    name,
    module: moduleMeta.id === "lead" ? "Leads" : moduleMeta.label,
    stageField: lifecycle?.apiKey ?? current?.stageField ?? "stage",
    substageField: current?.substageField ?? "substage",
    states,
    transitions,
    status: "draft",
  };

  const validation = validateBlueprint(blueprint, ctx.metadata);
  return {
    success: validation.valid,
    operation,
    blueprint,
    changed: true,
    summary: summarizeBlueprint(blueprint),
    explanation: validation.valid
      ? `Proposed ${moduleMeta.label} Blueprint generated as draft. Review it on the canvas before activation.`
      : "Blueprint generated with validation issues. Review errors before approval.",
    validation,
  };
}

export function parseBlueprintBuilderInput(raw: unknown): BlueprintBuilderInput {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const op = o.operation === "modify" || o.operation === "explain" ? o.operation : "create";
  const rulesRaw = Array.isArray(o.rules) ? o.rules : [];
  const stages = Array.isArray(o.stages) ? o.stages.filter((s): s is string => typeof s === "string") : undefined;
  return {
    operation: op,
    intent: typeof o.intent === "string" ? o.intent : "",
    moduleId: typeof o.moduleId === "string" ? o.moduleId : undefined,
    name: typeof o.name === "string" ? o.name : undefined,
    lifecycleField: typeof o.lifecycleField === "string" ? o.lifecycleField : undefined,
    stages,
    lostStage: typeof o.lostStage === "string" ? o.lostStage : undefined,
    rules: rulesRaw
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r) => ({
        type: (typeof r.type === "string" ? r.type : "required_field") as BlueprintBuilderRuleType,
        fromStage: typeof r.fromStage === "string" ? r.fromStage : undefined,
        toStage: typeof r.toStage === "string" ? r.toStage : undefined,
        stage: typeof r.stage === "string" ? r.stage : undefined,
        beforeStage: typeof r.beforeStage === "string" ? r.beforeStage : undefined,
        afterStage: typeof r.afterStage === "string" ? r.afterStage : undefined,
        field: typeof r.field === "string" ? r.field : undefined,
        taskType: typeof r.taskType === "string" ? r.taskType : undefined,
        offsetDays: typeof r.offsetDays === "number" ? r.offsetDays : undefined,
        targetModule: typeof r.targetModule === "string" ? r.targetModule : undefined,
        mapping: Array.isArray(r.mapping)
          ? r.mapping
              .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
              .map((row) => ({
                targetField: typeof row.targetField === "string" ? row.targetField : "",
                sourceField: typeof row.sourceField === "string" ? row.sourceField : undefined,
                literalValue: typeof row.literalValue === "string" ? row.literalValue : undefined,
              }))
              .filter((row) => row.targetField)
          : undefined,
      })),
  };
}
