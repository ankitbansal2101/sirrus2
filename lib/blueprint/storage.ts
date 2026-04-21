import { migrateBlueprintDocument } from "@/lib/blueprint/migrate";
import { createStandardBlueprintDocument, defaultBlueprintDocument } from "@/lib/blueprint/standard-blueprint";
import type { BlueprintDocument } from "@/lib/blueprint/types";
import { newEntityId } from "@/lib/blueprint/types";
import { loadFieldsSchema } from "@/lib/fields-config/schema-storage";
import { createDefaultLeadFields } from "@/lib/fields-config/types";
import { schedulePrototypeDiskPush } from "@/lib/prototype-persist/push";

/** Legacy single-document key — migrated into `BLUEPRINT_LIBRARY_KEY` on first read. */
export const BLUEPRINT_STORAGE_KEY = "sirrus2_blueprint_v1";

/** v2: avoids stale libraries where “New blueprint” kept a pre–multi-hop transition set. */
export const BLUEPRINT_LIBRARY_KEY = "sirrus2_blueprint_library_v2";

export const LEGACY_BLUEPRINT_LIBRARY_KEY = "sirrus2_blueprint_library_v1";

/** Fired after blueprint library / active blueprint changes. */
export const BLUEPRINT_CHANGED_EVENT = "sirrus2-blueprint-changed";

export type BlueprintLibraryV1 = {
  version: 1;
  activeBlueprintId: string;
  blueprints: BlueprintDocument[];
};

function fieldRows() {
  return loadFieldsSchema() ?? createDefaultLeadFields();
}

function migrateDoc(doc: BlueprintDocument): BlueprintDocument {
  return migrateBlueprintDocument(doc, fieldRows());
}

function isBlueprintDoc(x: unknown): x is BlueprintDocument {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.module === "string" &&
    typeof o.stageField === "string" &&
    Array.isArray(o.states) &&
    Array.isArray(o.transitions)
  );
}

function parseBlueprintFromUnknown(raw: unknown): BlueprintDocument | null {
  if (!isBlueprintDoc(raw)) return null;
  return raw;
}

function isLibrary(x: unknown): x is BlueprintLibraryV1 {
  if (!x || typeof x !== "object" || (x as BlueprintLibraryV1).version !== 1) return false;
  const o = x as BlueprintLibraryV1;
  return typeof o.activeBlueprintId === "string" && Array.isArray(o.blueprints) && o.blueprints.every(isBlueprintDoc);
}

function defaultLibrary(): BlueprintLibraryV1 {
  const def = createStandardBlueprintDocument();
  return { version: 1, activeBlueprintId: def.id, blueprints: [def] };
}

/** Raw library from localStorage (not field-migrated). */
function readLibraryStored(): BlueprintLibraryV1 {
  if (typeof window === "undefined") return defaultLibrary();
  try {
    const rawLib = localStorage.getItem(BLUEPRINT_LIBRARY_KEY);
    if (rawLib) {
      const parsed = JSON.parse(rawLib) as unknown;
      if (isLibrary(parsed) && parsed.blueprints.length > 0) return parsed;
    }
    const legacy = localStorage.getItem(BLUEPRINT_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as unknown;
      const doc = parseBlueprintFromUnknown(parsed);
      if (doc) {
        const lib: BlueprintLibraryV1 = {
          version: 1,
          activeBlueprintId: doc.id,
          blueprints: [doc],
        };
        persistLibrary(lib);
        return lib;
      }
    }
  } catch {
    /* fall through */
  }
  const lib = defaultLibrary();
  persistLibrary(lib);
  return lib;
}

function persistLibrary(lib: BlueprintLibraryV1): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BLUEPRINT_LIBRARY_KEY, JSON.stringify(lib));
}

function emitBlueprintChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BLUEPRINT_CHANGED_EVENT));
  schedulePrototypeDiskPush();
}

/** All blueprints + active id (documents are not field-migrated). */
export function loadBlueprintLibraryStored(): BlueprintLibraryV1 {
  return readLibraryStored();
}

/** Library with each blueprint migrated against the current fields schema. */
export function loadBlueprintLibrary(): BlueprintLibraryV1 {
  const lib = readLibraryStored();
  return {
    ...lib,
    blueprints: lib.blueprints.map((b) => migrateDoc(b)),
  };
}

/** Active blueprint for Manage leads / seeding (migrated). */
export function loadBlueprint(): BlueprintDocument | null {
  const lib = readLibraryStored();
  const doc = lib.blueprints.find((b) => b.id === lib.activeBlueprintId) ?? lib.blueprints[0];
  if (!doc) return null;
  return migrateDoc(doc);
}

export function loadBlueprintOrDefault(): BlueprintDocument {
  return loadBlueprint() ?? migrateDoc(defaultBlueprintDocument());
}

/** One blueprint for the canvas editor (migrated). */
export function loadBlueprintById(id: string): BlueprintDocument | null {
  const lib = readLibraryStored();
  const doc = lib.blueprints.find((b) => b.id === id);
  if (!doc) return null;
  return migrateDoc(doc);
}

/** Upsert document in the library (by `doc.id`). */
export function saveBlueprint(doc: BlueprintDocument): boolean {
  if (typeof window === "undefined") return false;
  try {
    const lib = readLibraryStored();
    const i = lib.blueprints.findIndex((b) => b.id === doc.id);
    const nextBlueprints =
      i === -1 ? [...lib.blueprints, doc] : lib.blueprints.map((b, idx) => (idx === i ? doc : b));
    const nextLib: BlueprintLibraryV1 = {
      ...lib,
      blueprints: nextBlueprints,
      activeBlueprintId: lib.activeBlueprintId || doc.id,
    };
    persistLibrary(nextLib);
    emitBlueprintChanged();
    return true;
  } catch {
    return false;
  }
}

export function setActiveBlueprint(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const lib = readLibraryStored();
    if (!lib.blueprints.some((b) => b.id === id)) return false;
    persistLibrary({ ...lib, activeBlueprintId: id });
    emitBlueprintChanged();
    return true;
  } catch {
    return false;
  }
}

export function getActiveBlueprintId(): string {
  return readLibraryStored().activeBlueprintId;
}

export function blueprintDocumentExists(id: string): boolean {
  return readLibraryStored().blueprints.some((b) => b.id === id);
}

export function addBlueprint(copyFrom?: BlueprintDocument): BlueprintDocument {
  const lib = readLibraryStored();
  const doc: BlueprintDocument = copyFrom
    ? {
        ...(JSON.parse(JSON.stringify(copyFrom)) as BlueprintDocument),
        id: newEntityId("bp"),
        name: `${copyFrom.name} (copy)`,
      }
    : (() => {
        const fresh = JSON.parse(JSON.stringify(createStandardBlueprintDocument())) as BlueprintDocument;
        fresh.id = newEntityId("bp");
        fresh.name = "New blueprint";
        return fresh;
      })();
  persistLibrary({
    ...lib,
    blueprints: [...lib.blueprints, doc],
  });
  emitBlueprintChanged();
  return migrateDoc(doc);
}

export function deleteBlueprint(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const lib = readLibraryStored();
    if (lib.blueprints.length <= 1) return false;
    const next = lib.blueprints.filter((b) => b.id !== id);
    if (next.length === lib.blueprints.length) return false;
    let activeBlueprintId = lib.activeBlueprintId;
    if (activeBlueprintId === id) {
      activeBlueprintId = next[0]?.id ?? "";
    }
    persistLibrary({ version: 1, activeBlueprintId, blueprints: next });
    emitBlueprintChanged();
    return true;
  } catch {
    return false;
  }
}

export function duplicateBlueprint(id: string): BlueprintDocument | null {
  const lib = readLibraryStored();
  const src = lib.blueprints.find((b) => b.id === id);
  if (!src) return null;
  const copy: BlueprintDocument = {
    ...JSON.parse(JSON.stringify(src)) as BlueprintDocument,
    id: newEntityId("bp"),
    name: `${src.name} (copy)`,
  };
  persistLibrary({
    ...lib,
    blueprints: [...lib.blueprints, copy],
  });
  emitBlueprintChanged();
  return migrateDoc(copy);
}
