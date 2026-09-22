import { embedSnippet } from "@/lib/widgets/compile";
import { loadPublishedWidget } from "@/lib/widgets/load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const widget = await loadPublishedWidget(id);
  if (!widget) {
    return Response.json({ error: "Widget not found or not published." }, { status: 404, headers: CORS });
  }
  const origin = new URL(req.url).origin;
  return Response.json(
    {
      id: widget.id,
      name: widget.name,
      description: widget.description,
      fields: widget.fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: Boolean(f.required),
        options: f.options ?? [],
      })),
      version: widget.version,
      embedUrl: `${origin}/embed/w/${encodeURIComponent(widget.id)}`,
      embedHeight: widget.embedHeight || 420,
      snippet: embedSnippet(origin, widget),
      postMessage: {
        setData: "sirrus:set-data",
        ready: "sirrus:ready",
        ping: "sirrus:ping",
        pong: "sirrus:pong",
      },
    },
    { headers: CORS },
  );
}
