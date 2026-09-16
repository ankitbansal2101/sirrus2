import type { BlueprintDocument, BlueprintTransition } from "@/lib/blueprint/types";
import {
  findField,
  findModule,
  findTaskType,
  type SirrusMetadata,
} from "@/lib/blueprint/metadata/sirrus-metadata";

export type BlueprintIssue = {
  code: string;
  message: string;
  path?: string;
};

export type BlueprintValidationResult = {
  valid: boolean;
  errors: BlueprintIssue[];
  warnings: BlueprintIssue[];
};

function issue(code: string, message: string, path?: string): BlueprintIssue {
  return { code, message, path };
}

function stageIds(doc: BlueprintDocument): Set<string> {
  return new Set(doc.states.map((s) => s.id));
}

function hasCycle(transitions: BlueprintTransition[], ids: Set<string>): boolean {
  const adj = new Map<string, string[]>();
  for (const id of ids) adj.set(id, []);
  for (const t of transitions) {
    if (!ids.has(t.sourceStateId) || !ids.has(t.targetStateId)) continue;
    adj.get(t.sourceStateId)?.push(t.targetStateId);
  }
  const visiting = new Set<string>();
  const seen = new Set<string>();
  const dfs = (n: string): boolean => {
    if (visiting.has(n)) return true;
    if (seen.has(n)) return false;
    visiting.add(n);
    for (const nxt of adj.get(n) ?? []) {
      if (dfs(nxt)) return true;
    }
    visiting.delete(n);
    seen.add(n);
    return false;
  };
  for (const id of ids) {
    if (dfs(id)) return true;
  }
  return false;
}

/** Deterministic Blueprint validator — used by the tool and by the Validate button. */
export function validateBlueprint(doc: BlueprintDocument, metadata: SirrusMetadata): BlueprintValidationResult {
  const errors: BlueprintIssue[] = [];
  const warnings: BlueprintIssue[] = [];

  if (!doc.name?.trim()) {
    errors.push(issue("name_required", "Blueprint name is required.", "name"));
  }

  const moduleMeta = findModule(metadata, doc.module);
  if (!moduleMeta) {
    errors.push(issue("module_missing", `Module "${doc.module}" is not in Sirrus metadata.`, "module"));
  }

  const lifecycle = doc.stageField?.trim();
  if (!lifecycle) {
    errors.push(issue("lifecycle_field_required", "Lifecycle / stage field is required.", "stageField"));
  } else {
    const field = findField(metadata, lifecycle, moduleMeta?.id);
    if (!field) {
      errors.push(
        issue("lifecycle_field_missing", `Lifecycle field "${lifecycle}" was not found in metadata.`, "stageField"),
      );
    }
  }

  if (!doc.states.length) {
    errors.push(issue("stages_required", "A Blueprint needs at least one stage.", "states"));
  }

  const ids = stageIds(doc);
  if (ids.size !== doc.states.length) {
    errors.push(issue("duplicate_stage_ids", "Stage IDs must be unique.", "states"));
  }

  const labels = new Map<string, number>();
  for (const s of doc.states) {
    if (!s.label?.trim()) {
      errors.push(issue("stage_label_required", "Every stage needs a label.", `states.${s.id}`));
    }
    const key = s.label.trim().toLowerCase();
    labels.set(key, (labels.get(key) ?? 0) + 1);
    if (!Number.isFinite(s.position?.x) || !Number.isFinite(s.position?.y)) {
      warnings.push(issue("stage_position", `Stage "${s.label}" is missing a canvas position.`, `states.${s.id}`));
    }
  }
  for (const [label, count] of labels) {
    if (count > 1) {
      warnings.push(issue("duplicate_stage_label", `Duplicate stage label "${label}".`, "states"));
    }
  }

  const pairSeen = new Set<string>();
  for (const t of doc.transitions) {
    if (!ids.has(t.sourceStateId)) {
      errors.push(issue("transition_source", `Transition "${t.name}" references an unknown source stage.`, `transitions.${t.id}`));
    }
    if (!ids.has(t.targetStateId)) {
      errors.push(issue("transition_target", `Transition "${t.name}" references an unknown target stage.`, `transitions.${t.id}`));
    }
    if (t.sourceStateId === t.targetStateId) {
      errors.push(issue("self_loop", `Transition "${t.name}" loops onto the same stage.`, `transitions.${t.id}`));
    }
    const pair = `${t.sourceStateId}→${t.targetStateId}`;
    if (pairSeen.has(pair)) {
      warnings.push(issue("duplicate_transition", `Duplicate transition ${pair}.`, `transitions.${t.id}`));
    }
    pairSeen.add(pair);

    for (const f of t.form.fields) {
      if (!f.fieldId) {
        errors.push(issue("required_field_empty", `Transition "${t.name}" has a form field without a field id.`, `transitions.${t.id}`));
        continue;
      }
      const metaField = findField(metadata, f.fieldId, moduleMeta?.id);
      if (!metaField) {
        errors.push(
          issue(
            "required_field_missing",
            `Transition "${t.name}" requires unknown field "${f.label || f.fieldId}".`,
            `transitions.${t.id}`,
          ),
        );
      }
    }

    for (const task of t.after.autoTasks) {
      const tt = metadata.taskTypes.find((x) => x.id === task.taskTypeOptionId) ?? findTaskType(metadata, task.taskTypeOptionId);
      if (!tt) {
        errors.push(
          issue("task_type_missing", `Transition "${t.name}" uses unknown task type "${task.taskTypeOptionId}".`, `transitions.${t.id}`),
        );
      }
    }

    for (const rec of t.after.createRecords) {
      const target =
        rec.targetModule === "booking"
          ? findModule(metadata, "booking")
          : rec.targetModule === "leads"
            ? findModule(metadata, "lead")
            : findModule(metadata, "channel_partner") ?? findModule(metadata, rec.targetModule);
      if (!target) {
        errors.push(
          issue("target_module_missing", `Transition "${t.name}" creates a record on unknown module "${rec.targetModule}".`, `transitions.${t.id}`),
        );
      }
      for (const b of rec.fieldBindings) {
        if (!b.targetFieldApiKey) {
          errors.push(issue("mapping_target", `Create-record mapping on "${t.name}" is missing a target field.`, `transitions.${t.id}`));
        } else if (target) {
          const tf = findField(metadata, b.targetFieldApiKey, target.id);
          if (!tf) {
            errors.push(
              issue(
                "mapping_target_missing",
                `Create-record mapping on "${t.name}" targets unknown field "${b.targetFieldApiKey}".`,
                `transitions.${t.id}`,
              ),
            );
          }
        }
        if (b.valueMode === "map" && b.sourceFieldApiKey) {
          const sf = findField(metadata, b.sourceFieldApiKey, moduleMeta?.id);
          if (!sf) {
            errors.push(
              issue(
                "mapping_source_missing",
                `Create-record mapping on "${t.name}" maps from unknown field "${b.sourceFieldApiKey}".`,
                `transitions.${t.id}`,
              ),
            );
          }
        }
      }
    }

    if (t.targetSubstageId) {
      const parent = doc.states.find((s) => s.id === t.targetStateId);
      const ok = parent?.substages?.some((ss) => ss.id === t.targetSubstageId);
      if (!ok) {
        errors.push(
          issue("substage_missing", `Transition "${t.name}" targets an unknown sub-stage.`, `transitions.${t.id}`),
        );
      }
    }
  }

  if (doc.states.length > 1 && doc.transitions.length === 0) {
    warnings.push(issue("no_transitions", "Multiple stages exist but no transitions are configured.", "transitions"));
  }

  if (hasCycle(doc.transitions, ids)) {
    warnings.push(
      issue("circular_transitions", "The stage graph contains a cycle. Confirm that looping back is intentional.", "transitions"),
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
