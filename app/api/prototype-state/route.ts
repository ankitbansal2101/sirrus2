import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  blobStoreStatus,
  loadLivePrototypeState,
  parsePrototypeState,
  saveLivePrototypeState,
} from "@/lib/prototype-persist/live-store";
import type { PrototypeStateFile } from "@/lib/prototype-persist/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = join(process.cwd(), "data", "prototype-state.json");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function diskEnabled() {
  const v = process.env.VERCEL;
  return v !== "1" && v !== "true";
}

async function readDisk(): Promise<PrototypeStateFile | null> {
  if (!diskEnabled()) return null;
  try {
    const raw = await readFile(FILE, "utf8");
    return parsePrototypeState(JSON.parse(raw) as unknown);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return null;
    throw e;
  }
}

async function writeDisk(v: PrototypeStateFile): Promise<boolean> {
  if (!diskEnabled()) return false;
  try {
    await mkdir(join(process.cwd(), "data"), { recursive: true });
    await writeFile(FILE, `${JSON.stringify(v, null, 2)}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const live = await loadLivePrototypeState();
    const blob = blobStoreStatus();
    if (live) return json({ snapshot: live, live: true, disk: diskEnabled(), blob });
    const disk = await readDisk();
    return json({ snapshot: disk, live: false, disk: diskEnabled(), blob });
  } catch {
    return json({ error: "Could not read prototype snapshot." }, 500);
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const v = parsePrototypeState(body);
  if (!v) {
    return json({ error: "Expected { version: 1, savedAt?, fieldsSchema?, blueprint?, leads? }." }, 400);
  }

  const live = await saveLivePrototypeState(v);
  const disk = await writeDisk(v);
  if (!live.ok && !disk) {
    return json(
      {
        error:
          live.error ||
          "Live snapshot store is not configured. In Vercel → Storage, connect the Blob store to this project, then Redeploy.",
        blob: blobStoreStatus(),
      },
      501,
    );
  }
  return json({ ok: true, live: live.ok, disk, blob: blobStoreStatus() });
}
