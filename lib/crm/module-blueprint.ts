import { documentFromModule } from "@/lib/crm/blueprint-bridge";
import { blueprintIdForModule } from "@/lib/crm/ops";
import type { CrmModule } from "@/lib/crm/types";
import { migrateBlueprintDocument } from "@/lib/blueprint/migrate";
import { loadBlueprintById, loadBlueprintLibraryStored, saveBlueprint } from "@/lib/blueprint/storage";
import type { BlueprintDocument } from "@/lib/blueprint/types";

export function moduleBlueprintId(mod: CrmModule): string {
  return blueprintIdForModule(mod.id);
}

/** Load the module pipeline with transition forms migrated against this module's fields. */
export function loadModuleBlueprint(mod: CrmModule): BlueprintDocument | null {
  return loadBlueprintById(moduleBlueprintId(mod), mod.fields);
}

/** Ensure the blueprint library has a document for this module; re-migrate when fields change. */
export function ensureModuleBlueprint(mod: CrmModule): BlueprintDocument {
  const id = moduleBlueprintId(mod);
  const stored = loadBlueprintLibraryStored().blueprints.find((b) => b.id === id);
  if (!stored) {
    const seeded = documentFromModule(mod);
    saveBlueprint(seeded);
    return migrateBlueprintDocument(seeded, mod.fields);
  }
  const migrated = migrateBlueprintDocument(stored, mod.fields);
  if (JSON.stringify(migrated) !== JSON.stringify(stored)) {
    saveBlueprint(migrated);
  }
  return migrated;
}
