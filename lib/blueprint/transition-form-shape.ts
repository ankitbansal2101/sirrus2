import type { TransitionFormField } from "@/lib/blueprint/types";
import type { FieldDefinition } from "@/lib/fields-config/types";
import { optionsSorted } from "@/lib/fields-config/types";

/** Align stored transition row `kind` / `picklistOptions` with the Fields configurator (apiKey = `fieldId`). */
export function shapeTransitionFormFieldStorage(
  defn: FieldDefinition | undefined,
): Pick<TransitionFormField, "kind" | "picklistOptions"> {
  if (!defn) return { kind: "text", picklistOptions: [] };
  if (defn.dataType === "url") return { kind: "text", picklistOptions: [] };
  if (defn.dataType === "paragraph") return { kind: "textarea", picklistOptions: [] };
  if (defn.dataType === "picklist" || defn.dataType === "radio") {
    return {
      kind: "picklist",
      picklistOptions: optionsSorted(defn).map((o) => o.label),
    };
  }
  if (defn.dataType === "multi_select") return { kind: "multi_select", picklistOptions: [] };
  return { kind: "text", picklistOptions: [] };
}
