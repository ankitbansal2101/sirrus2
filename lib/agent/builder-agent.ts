import { BUILDER_AGENT_SYSTEM_PROMPT } from "@/lib/agent/system-prompt";
import { ToolRegistry } from "@/lib/agent/tool-registry";
import type { AgentTraceStep, BuilderAgentRequest, BuilderAgentResult } from "@/lib/agent/types";
import { compactMetadataForAgent } from "@/lib/blueprint/metadata/sirrus-metadata";
import type { BlueprintDocument } from "@/lib/blueprint/types";
import { blueprintBuilderTool } from "@/lib/tools/blueprint-builder-tool";
import type { BlueprintResponse } from "@/lib/blueprint/builder/build-blueprint";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

function createPrototypeToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(blueprintBuilderTool);
  return registry;
}

function compactBlueprint(doc: BlueprintDocument) {
  return {
    id: doc.id,
    name: doc.name,
    module: doc.module,
    stageField: doc.stageField,
    status: doc.status ?? "draft",
    stages: doc.states.map((s) => ({ id: s.id, label: s.label })),
    transitions: doc.transitions.map((t) => ({
      id: t.id,
      name: t.name,
      from: t.sourceStateId,
      to: t.targetStateId,
      requiredFields: t.form.fields.filter((f) => f.mandatory).map((f) => ({ fieldId: f.fieldId, label: f.label })),
      autoTasks: t.after.autoTasks.map((a) => ({ taskTypeOptionId: a.taskTypeOptionId, offsetDays: a.offsetDays })),
      createRecords: t.after.createRecords.map((c) => ({ targetModule: c.targetModule })),
    })),
  };
}

function newTrace(label: string, status: AgentTraceStep["status"] = "ok", detail?: string): AgentTraceStep {
  return { id: `tr_${Math.random().toString(36).slice(2, 10)}`, label, detail, status };
}

function isBlueprintResponse(x: unknown): x is BlueprintResponse {
  return !!x && typeof x === "object" && "validation" in x && "operation" in x;
}

export function createBuilderAgentClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

/**
 * Runs one Builder Agent turn with OpenAI tool calling.
 * Tool execution stays in-process (prototype). Swap this later for a Sirrus backend without changing the tool contract.
 */
export async function runBuilderAgent(req: BuilderAgentRequest, client: OpenAI, model: string): Promise<BuilderAgentResult> {
  const registry = createPrototypeToolRegistry();
  const traces: AgentTraceStep[] = [newTrace("User request received"), newTrace("Builder Agent")];

  const openaiMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: BUILDER_AGENT_SYSTEM_PROMPT },
    {
      role: "system",
      content: `Available Sirrus metadata (do not invent ids/labels that are not listed):\n${JSON.stringify(compactMetadataForAgent(req.metadata))}`,
    },
  ];

  if (req.currentBlueprint) {
    openaiMessages.push({
      role: "system",
      content: `Current canonical BlueprintConfig (visual builder and agent share this object):\n${JSON.stringify(compactBlueprint(req.currentBlueprint))}`,
    });
  }

  for (const m of req.messages) {
    if (m.role === "user" || m.role === "assistant") {
      openaiMessages.push({ role: m.role, content: m.content });
    }
  }

  let blueprint: BlueprintDocument | null = null;
  let validation: BuilderAgentResult["validation"] = null;
  let changed = false;
  let summary: string | undefined;
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

      if (toolName === "blueprint_builder") {
        traces.push(newTrace("Calling: buildBlueprint()"));
      } else {
        traces.push(newTrace(`Calling: ${toolName}()`));
      }

      const result = await registry.execute(toolName, parsedArgs, {
        metadata: req.metadata,
        currentBlueprint: blueprint ?? req.currentBlueprint,
        fieldDefinitions: req.fieldDefinitions,
      });

      if (isBlueprintResponse(result)) {
        if (result.blueprint && result.changed) {
          blueprint = result.blueprint;
          changed = true;
          traces.push(newTrace("Blueprint generated"));
        }
        validation = result.validation;
        summary = result.summary ?? summary;
        if (result.validation.valid) {
          traces.push(newTrace("Validation passed"));
        } else {
          traces.push(
            newTrace("Validation failed", "error", result.validation.errors.map((e) => e.message).join("; ")),
          );
        }
      }

      openaiMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  if (!assistantMessage) {
    assistantMessage = changed
      ? "Proposed Blueprint configuration is ready for review. It has not been activated."
      : "I could not complete that configuration request.";
  }

  return {
    assistantMessage,
    traces,
    blueprint,
    validation,
    changed,
    summary,
  };
}
