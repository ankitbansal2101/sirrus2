import { resolveFieldDefinitions } from "@/lib/blueprint/from-fields-schema";
import { getSirrusMetadata, type SirrusMetadata } from "@/lib/blueprint/metadata/sirrus-metadata";
import { loadBlueprintLibrary } from "@/lib/blueprint/storage";

/** Browser-side metadata: live fields + library, same contract as the future Sirrus APIs. */
export function getClientSirrusMetadata(): SirrusMetadata {
  const lib = loadBlueprintLibrary();
  return getSirrusMetadata({
    fields: resolveFieldDefinitions(),
    existingBlueprints: lib.blueprints.map((b) => ({
      id: b.id,
      name: b.name,
      module: b.module,
      stageField: b.stageField,
      stageLabels: b.states.map((s) => s.label),
    })),
  });
}
