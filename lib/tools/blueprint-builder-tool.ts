import {
  buildBlueprint,
  parseBlueprintBuilderInput,
} from "@/lib/blueprint/builder/build-blueprint";
import { BLUEPRINT_BUILDER_INPUT_SCHEMA, type RegisteredTool, type ToolExecuteContext } from "@/lib/agent/tool-registry";

export const BLUEPRINT_BUILDER_TOOL_NAME = "blueprint_builder";

export const blueprintBuilderTool: RegisteredTool = {
  name: BLUEPRINT_BUILDER_TOOL_NAME,
  description:
    "Create or modify a Sirrus Blueprint from a business process description. Returns canonical Blueprint JSON plus validation. Use for stage workflows, required fields on transitions, auto-tasks, create-record actions, approvals, and explaining why a skip path is not allowed. Do not use this tool for unrelated chat.",
  inputSchema: BLUEPRINT_BUILDER_INPUT_SCHEMA,
  execute: (input: unknown, ctx: ToolExecuteContext) => {
    const parsed = parseBlueprintBuilderInput(input);
    if (!ctx.metadata) {
      return {
        success: false,
        operation: "create",
        blueprint: null,
        changed: false,
        validation: { valid: false, errors: [{ code: "no_metadata", message: "Metadata is required." }], warnings: [] },
      };
    }
    return buildBlueprint(parsed, {
      metadata: ctx.metadata,
      currentBlueprint: ctx.currentBlueprint ?? null,
      fieldDefinitions: ctx.fieldDefinitions,
    });
  },
};
