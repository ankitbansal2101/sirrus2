import type { BlueprintBuilderInput } from "@/lib/blueprint/builder/build-blueprint";
import type { SirrusMetadata } from "@/lib/blueprint/metadata/sirrus-metadata";
import type { BlueprintDocument } from "@/lib/blueprint/types";
import type { FieldDefinition } from "@/lib/fields-config/types";

export type ToolExecuteContext = {
  metadata: SirrusMetadata;
  currentBlueprint: BlueprintDocument | null;
  fieldDefinitions?: FieldDefinition[];
};

export type OpenAIToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type RegisteredTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown, ctx: ToolExecuteContext) => unknown | Promise<unknown>;
};

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  register(tool: RegisteredTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  list(): RegisteredTool[] {
    return [...this.tools.values()];
  }

  toOpenAITools(): OpenAIToolDefinition[] {
    return this.list().map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }

  async execute(name: string, input: unknown, ctx: ToolExecuteContext): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Unknown tool "${name}".` };
    }
    return tool.execute(input, ctx);
  }
}

export const BLUEPRINT_BUILDER_INPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    operation: {
      type: "string",
      enum: ["create", "modify", "explain"],
      description: "create a new Blueprint, modify the current one, or explain why a path/rule exists.",
    },
    intent: {
      type: "string",
      description: "The user's business-process request in their own words.",
    },
    moduleId: {
      type: "string",
      description: "Target module id or label from metadata (e.g. lead, enquiry, application).",
    },
    name: { type: "string", description: "Optional Blueprint name." },
    lifecycleField: {
      type: "string",
      description: "Lifecycle/status picklist apiKey or label from metadata.",
    },
    stages: {
      type: "array",
      items: { type: "string" },
      description: "Ordered happy-path stage labels as the user described them.",
    },
    lostStage: {
      type: "string",
      description: "Optional terminal lost/dropped stage label.",
    },
    rules: {
      type: "array",
      description: "Structured configuration rules extracted from the request.",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          type: {
            type: "string",
            enum: [
              "required_field",
              "auto_task",
              "create_record",
              "field_update",
              "add_stage",
              "remove_stage",
              "add_transition",
              "remove_transition",
              "add_approval",
            ],
          },
          fromStage: { type: "string" },
          toStage: { type: "string" },
          stage: { type: "string" },
          beforeStage: { type: "string" },
          afterStage: { type: "string" },
          field: { type: "string" },
          taskType: { type: "string" },
          offsetDays: { type: "number" },
          targetModule: { type: "string" },
          mapping: {
            type: "array",
            items: {
              type: "object",
              properties: {
                targetField: { type: "string" },
                sourceField: { type: "string" },
                literalValue: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
  required: ["operation", "intent"],
};

export type { BlueprintBuilderInput };
