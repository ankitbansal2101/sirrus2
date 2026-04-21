import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { PrototypeStateFile } from "@/lib/prototype-persist/types";

export const runtime = "nodejs";

const FILE = join(process.cwd(), "data", "prototype-state.json");

/** Writable repo `data/` is not available on Vercel serverless; disk sync is dev-only. */
function diskEnabled() {
  const v = process.env.VERCEL;
  return v !== "1" && v !== "true";
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function validateBody(body: unknown): PrototypeStateFile | null {
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

export async function GET() {
  if (!diskEnabled()) {
    return Response.json({ snapshot: null as PrototypeStateFile | null, disk: false });
  }
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const v = validateBody(parsed);
    if (!v) return Response.json({ error: "Invalid snapshot file on disk." }, { status: 500 });
    return Response.json({ snapshot: v, disk: true });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return Response.json({ snapshot: null as PrototypeStateFile | null, disk: true });
    return Response.json({ error: "Could not read prototype snapshot." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!diskEnabled()) {
    return Response.json(
      { error: "Saving to disk is only supported in local dev (not on Vercel serverless)." },
      { status: 501 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const v = validateBody(body);
  if (!v) return Response.json({ error: "Expected { version: 1, savedAt?, fieldsSchema?, blueprint?, leads? }." }, { status: 400 });

  try {
    await mkdir(join(process.cwd(), "data"), { recursive: true });
    await writeFile(FILE, `${JSON.stringify(v, null, 2)}\n`, "utf8");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not write prototype snapshot." }, { status: 500 });
  }
}
