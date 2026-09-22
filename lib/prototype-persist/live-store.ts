import { BlobAccessError, BlobNotFoundError, get, put } from "@vercel/blob";
import type { PrototypeStateFile } from "@/lib/prototype-persist/types";

export const LIVE_SNAPSHOT_PATH = "sirrus/prototype-state.json";

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

export function parsePrototypeState(body: unknown): PrototypeStateFile | null {
  if (!isRecord(body) || body.version !== 1) return null;
  return {
    version: 1,
    savedAt: typeof body.savedAt === "string" ? body.savedAt : new Date().toISOString(),
    fieldsSchema: body.fieldsSchema ?? null,
    blueprint: body.blueprint ?? null,
    blueprintLibrary: body.blueprintLibrary ?? undefined,
    leads: body.leads ?? null,
    leadFormLayout: body.leadFormLayout ?? undefined,
    crmWorkspace: body.crmWorkspace ?? undefined,
  };
}

function blobAccess(): "private" | "public" {
  return process.env.SIRRUS_BLOB_ACCESS?.trim() === "public" ? "public" : "private";
}

function findEnv(suffix: string, valueTest?: (v: string) => boolean): string | undefined {
  const exact = process.env[`BLOB_${suffix}`]?.trim();
  if (exact && (!valueTest || valueTest(exact))) return exact;
  for (const [key, raw] of Object.entries(process.env)) {
    if (!key.endsWith(suffix)) continue;
    const value = raw?.trim();
    if (!value) continue;
    if (valueTest && !valueTest(value)) continue;
    return value;
  }
  return undefined;
}

function blobAuth() {
  return {
    token: findEnv("READ_WRITE_TOKEN"),
    storeId: findEnv("STORE_ID", (v) => v.startsWith("store_")),
  };
}

export function blobStoreStatus() {
  const auth = blobAuth();
  return {
    hasToken: Boolean(auth.token),
    hasStoreId: Boolean(auth.storeId),
    hasOidc: Boolean(process.env.VERCEL_OIDC_TOKEN),
  };
}

function authOptions() {
  const { token, storeId } = blobAuth();
  return {
    ...(token ? { token } : {}),
    ...(storeId ? { storeId } : {}),
  };
}

function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return "Unknown Blob error.";
}

async function readWithAccess(access: "private" | "public"): Promise<PrototypeStateFile | null> {
  const result = await get(LIVE_SNAPSHOT_PATH, { access, useCache: false, ...authOptions() });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const text = await new Response(result.stream).text();
  return parsePrototypeState(JSON.parse(text) as unknown);
}

/** Latest prototype snapshot from Vercel Blob (shared by the UI and Claude MCP). */
export async function loadLivePrototypeState(): Promise<PrototypeStateFile | null> {
  const access = blobAccess();
  const other = access === "private" ? "public" : "private";
  try {
    return await readWithAccess(access);
  } catch (e) {
    if (e instanceof BlobNotFoundError) return null;
    try {
      return await readWithAccess(other);
    } catch {
      return null;
    }
  }
}

export async function saveLivePrototypeState(
  state: PrototypeStateFile,
): Promise<{ ok: boolean; error?: string }> {
  const body = JSON.stringify(state);
  const base = {
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json" as const,
    cacheControlMaxAge: 60,
    ...authOptions(),
  };
  const access = blobAccess();
  const order = [access, access === "private" ? "public" : "private"] as const;
  let lastError = "";
  for (const nextAccess of order) {
    try {
      await put(LIVE_SNAPSHOT_PATH, body, { ...base, access: nextAccess });
      return { ok: true };
    } catch (e) {
      lastError = errorMessage(e);
      if (e instanceof BlobAccessError) continue;
    }
  }
  return { ok: false, error: lastError || "Blob put failed." };
}
