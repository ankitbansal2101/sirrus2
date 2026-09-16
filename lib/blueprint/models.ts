/**
 * Canonical Blueprint configuration.
 * Manual canvas edits and Builder Agent tool output both use `BlueprintDocument`.
 * Do not introduce a second AI-only model.
 */
export type {
  BlueprintConfig,
  BlueprintDocument,
  BlueprintLifecycleStatus,
  BlueprintState,
  BlueprintTransition,
} from "@/lib/blueprint/types";
