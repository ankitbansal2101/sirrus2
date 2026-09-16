import type { PrototypeStateFile } from "@/lib/prototype-persist/types";

/** Duplicated on purpose — must not import schema/blueprint/leads modules here (import cycles). */
const K_FIELDS = "sirrus2_fields_schema_v2";
const K_BLUEPRINT = "sirrus2_blueprint_v1";
const K_BLUEPRINT_LIBRARY = "sirrus2_blueprint_library_v2";
const K_LEADS = "sirrus2_leads_v1";
const K_LEAD_FORM_LAYOUT = "sirrus2_lead_form_layout_v1";

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function readLs(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function hasBlueprintShape(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return Array.isArray(o.states) && Array.isArray(o.transitions);
}

function isLibraryShape(x: unknown): boolean {
  if (!x || typeof x !== "object" || (x as { version?: unknown }).version !== 1) return false;
  const o = x as { activeBlueprintId?: unknown; blueprints?: unknown };
  return typeof o.activeBlueprintId === "string" && Array.isArray(o.blueprints) && o.blueprints.length > 0;
}

async function pushNow(): Promise<void> {
  if (typeof window === "undefined") return;

  const fieldsSchema = parseJson(readLs(K_FIELDS));
  const blueprintLibrary = parseJson(readLs(K_BLUEPRINT_LIBRARY));
  const blueprint = parseJson(readLs(K_BLUEPRINT));
  const leads = parseJson(readLs(K_LEADS));
  const leadFormLayout = parseJson(readLs(K_LEAD_FORM_LAYOUT));

  const hasFields = Array.isArray(fieldsSchema) && fieldsSchema.length > 0;
  const hasBp = isLibraryShape(blueprintLibrary) || hasBlueprintShape(blueprint);
  const hasLeads = Array.isArray(leads) && leads.length > 0;
  const hasLeadForm =
    leadFormLayout &&
    typeof leadFormLayout === "object" &&
    (leadFormLayout as { version?: unknown }).version === 1;
  if (!hasFields && !hasBp && !hasLeads && !hasLeadForm) return;

  const body: PrototypeStateFile = {
    version: 1,
    savedAt: new Date().toISOString(),
    fieldsSchema,
    blueprint,
    blueprintLibrary: isLibraryShape(blueprintLibrary) ? blueprintLibrary : undefined,
    leads,
    leadFormLayout: hasLeadForm ? leadFormLayout : undefined,
  };

  const payload = JSON.stringify(body);
  const urls = new Set<string>(["/api/prototype-state"]);
  const syncOrigin = (process.env.NEXT_PUBLIC_MCP_SYNC_ORIGIN || "https://sirrus3.vercel.app").replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.origin !== syncOrigin) {
    urls.add(`${syncOrigin}/api/prototype-state`);
  }

  await Promise.all(
    [...urls].map(async (url) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });
        if (!res.ok) {
          console.warn("[prototype-persist] POST failed", url, res.status);
          return;
        }
        try {
          window.localStorage.setItem("sirrus2_live_saved_at", body.savedAt);
        } catch {
          /* ignore */
        }
      } catch (e) {
        console.warn("[prototype-persist] POST error", url, e);
      }
    }),
  );
}

/** Debounced write of current localStorage snapshot to the live store (and local disk in dev). */
export function schedulePrototypeDiskPush(): void {
  if (typeof window === "undefined") return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void pushNow();
  }, 400);
}
