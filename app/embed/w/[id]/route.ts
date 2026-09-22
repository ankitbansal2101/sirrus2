import { compileWidgetDocument, sampleData } from "@/lib/widgets/compile";
import { loadPublishedWidgetContext } from "@/lib/widgets/load";
import { runWidgetQuery } from "@/lib/widgets/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FRAME_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": "frame-ancestors *",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=30",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const loaded = await loadPublishedWidgetContext(id);
  if (!loaded) {
    return new Response(
      `<!DOCTYPE html><html><body style="font-family:system-ui;padding:24px;color:#667">Widget not found or not published.</body></html>`,
      { status: 404, headers: FRAME_HEADERS },
    );
  }

  const { workspace, widget } = loaded;
  const live = runWidgetQuery(workspace, widget);
  const url = new URL(req.url);
  const queryData: Record<string, string> = {};
  for (const field of widget.fields) {
    const value = url.searchParams.get(field.key);
    if (value != null) queryData[field.key] = value;
  }
  const data = { ...sampleData(widget.fields), ...live.data, ...queryData };
  return new Response(compileWidgetDocument(widget, { data, rows: live.rows }), { headers: FRAME_HEADERS });
}
