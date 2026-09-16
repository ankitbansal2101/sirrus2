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
  };
}

function blobAccess(): "private" | "public" {
  return process.env.SIRRUS_BLOB_ACCESS?.trim() === "public" ? "public" : "private";
}

async function readWithAccess(access: "private" | "public"): Promise<PrototypeStateFile | null> {
  const result = await get(LIVE_SNAPSHOT_PATH, { access, useCache: false });
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

export async function saveLivePrototypeState(state: PrototypeStateFile): Promise<boolean> {
  const body = JSON.stringify(state);
  const base = {
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json" as const,
    cacheControlMaxAge: 60,
  };
  const access = blobAccess();
  try {
    await put(LIVE_SNAPSHOT_PATH, body, { ...base, access });
    return true;
  } catch (e) {
    if (!(e instanceof BlobAccessError)) return false;
    try {
      await put(LIVE_SNAPSHOT_PATH, body, { ...base, access: access === "private" ? "public" : "private" });
      return true;
    } catch {
      return false;
    }
  }
}
