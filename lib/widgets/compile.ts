import type { MarketplaceWidget, MarketplaceWidgetField, MarketplaceWidgetQuery } from "@/lib/crm/types";

export const WIDGET_MESSAGE = {
  setData: "sirrus:set-data",
  ready: "sirrus:ready",
  ping: "sirrus:ping",
  pong: "sirrus:pong",
} as const;

export function fieldKey(label: string, fallback = "field"): string {
  const s = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return s || fallback;
}

export function sampleValue(field: MarketplaceWidgetField): string {
  switch (field.type) {
    case "number":
      return "42";
    case "date":
      return new Date().toISOString().slice(0, 10);
    case "select":
      return field.options?.[0]?.trim() || "Option A";
    case "boolean":
      return "Yes";
    case "currency":
      return "₹ 12,50,000";
    case "image_url":
      return "data:image/svg+xml;utf8," + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect fill="#eef0f6" width="100%" height="100%"/><text x="50%" y="50%" fill="#667085" font-family="system-ui" font-size="18" text-anchor="middle" dy=".3em">${escapeHtml(field.label)}</text></svg>`,
      );
    default:
      return `Sample ${field.label}`;
  }
}

export function sampleData(fields: MarketplaceWidgetField[]): Record<string, string> {
  const data: Record<string, string> = {};
  for (const field of fields) data[field.key] = sampleValue(field);
  return data;
}

export function defaultWidgetBody(widget: Pick<MarketplaceWidget, "name" | "fields">): string {
  const rows = widget.fields
    .map(
      (f) =>
        `<div class="sw-row"><span class="sw-k">${escapeHtml(f.label)}</span><span class="sw-v" data-field="${escapeAttr(f.key)}">—</span></div>`,
    )
    .join("");
  return `<style>
.sw{padding:18px 18px 16px;font-family:ui-sans-serif,system-ui,sans-serif}
.sw-title{margin:0 0 14px;font-size:16px;font-weight:650;letter-spacing:-.02em}
.sw-grid{display:grid;gap:0}
.sw-row{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid #eceef3;font-size:13px}
.sw-row:last-child{border-bottom:0}
.sw-k{color:#667085}
.sw-v{font-weight:600;color:#111827;text-align:right}
</style>
<section class="sw">
  <h1 class="sw-title">${escapeHtml(widget.name)}</h1>
  <div class="sw-grid">${rows || `<p style="margin:0;color:#667085;font-size:13px">Declare fields, then generate a layout.</p>`}</div>
</section>`;
}

export function defaultQueryWidgetBody(
  widget: Pick<MarketplaceWidget, "name">,
  query: MarketplaceWidgetQuery,
  columns: Array<{ key: string; label: string }>,
): string {
  const css = `<style>
.sw{padding:18px 16px 14px;font-family:ui-sans-serif,system-ui,sans-serif}
.sw-title{margin:0;font-size:15px;font-weight:650;letter-spacing:-.02em}
.sw-meta{margin:4px 0 12px;font-size:11px;color:#667085}
.sw-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #eceef3;font-size:13px}
.sw-row:last-child{border-bottom:0}
.sw-k{color:#667085}
.sw-v{font-weight:600;color:#111827;text-align:right}
.sw-table{width:100%;border-collapse:collapse;font-size:12px}
.sw-table th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#667085;padding:0 8px 8px 0}
.sw-table td{padding:7px 8px 7px 0;border-top:1px solid #eceef3;color:#111827}
</style>`;
  if (query.operation === "count") {
    return `${css}<section class="sw"><h1 class="sw-title">${escapeHtml(widget.name)}</h1><p class="sw-meta" data-field="module">Module</p><p class="sw-v" style="font-size:28px" data-field="total">0</p></section>`;
  }
  if (query.operation === "aggregate") {
    return `${css}<section class="sw">
  <h1 class="sw-title">${escapeHtml(widget.name)}</h1>
  <p class="sw-meta"><span data-field="module"></span> · <span data-field="total"></span> records · by <span data-field="groupBy"></span></p>
  <div data-rows>
    <div class="sw-row" data-row-template hidden>
      <span class="sw-k" data-col="group">—</span>
      <span class="sw-v" data-col="count">0</span>
    </div>
  </div>
</section>`;
  }
  const cols = columns.length ? columns : [{ key: "name", label: "Name" }];
  const th = cols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const td = cols.map((c) => `<td data-col="${escapeAttr(c.key)}">—</td>`).join("");
  return `${css}<section class="sw">
  <h1 class="sw-title">${escapeHtml(widget.name)}</h1>
  <p class="sw-meta"><span data-field="module"></span> · <span data-field="total"></span> records</p>
  <table class="sw-table">
    <thead><tr>${th}</tr></thead>
    <tbody data-rows>
      <tr data-row-template hidden>${td}</tr>
    </tbody>
  </table>
</section>`;
}

export function extractWidgetBody(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const fence = trimmed.match(/```(?:html|HTML)?\s*([\s\S]*?)```/);
  const source = fence ? fence[1].trim() : trimmed;
  const body = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (body) return stripHostile(body[1].trim());
  return stripHostile(source);
}

function stripHostile(html: string): string {
  return html
    .replace(/<script\b[^>]*\bsrc=[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object\b[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/javascript:/gi, "");
}

export function compileWidgetDocument(
  widget: MarketplaceWidget,
  opts?: { data?: Record<string, string>; rows?: Array<Record<string, string>> },
): string {
  const body = extractWidgetBody(widget.html) || defaultWidgetBody(widget);
  const fields = widget.fields.map((f) => ({ key: f.key, type: f.type }));
  const initial = opts?.data ?? sampleData(widget.fields);
  const rows = opts?.rows ?? [];
  const fieldJson = JSON.stringify(fields);
  const dataJson = JSON.stringify(initial);
  const rowsJson = JSON.stringify(rows);
  const idJson = JSON.stringify(widget.id);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(widget.name)}</title>
<style>
  html,body{margin:0;padding:0;background:transparent;color:#111827;font-family:ui-sans-serif,system-ui,sans-serif}
  img{max-width:100%;height:auto;display:block}
</style>
</head>
<body>
<div id="sirrus-root">${body}</div>
<script>
(function(){
  var FIELDS = ${fieldJson};
  var WIDGET_ID = ${idJson};
  window.SIRRUS_DATA = ${dataJson};
  window.SIRRUS_ROWS = ${rowsJson};
  function applyRows(rows){
    if (!Array.isArray(rows)) return;
    window.SIRRUS_ROWS = rows;
    var host = document.querySelector("[data-rows]");
    if (!host) return;
    var tpl = host.querySelector("[data-row-template]");
    if (!tpl) return;
    var kids = host.querySelectorAll(":scope > *");
    for (var i = 0; i < kids.length; i++) {
      if (kids[i] !== tpl) host.removeChild(kids[i]);
    }
    tpl.setAttribute("hidden", "hidden");
    for (var r = 0; r < rows.length; r++) {
      var clone = tpl.cloneNode(true);
      clone.removeAttribute("data-row-template");
      clone.removeAttribute("hidden");
      var cols = clone.querySelectorAll("[data-col]");
      for (var c = 0; c < cols.length; c++) {
        var key = cols[c].getAttribute("data-col");
        if (!key || rows[r][key] == null) continue;
        cols[c].textContent = String(rows[r][key]);
      }
      host.appendChild(clone);
    }
  }
  function apply(data, rows){
    if (data && typeof data === "object") {
      window.SIRRUS_DATA = Object.assign({}, window.SIRRUS_DATA || {}, data);
    }
    var nodes = document.querySelectorAll("[data-field]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute("data-field");
      if (!key || window.SIRRUS_DATA[key] == null) continue;
      var val = String(window.SIRRUS_DATA[key]);
      if (el.tagName === "IMG") el.setAttribute("src", val);
      else if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") el.value = val;
      else el.textContent = val;
    }
    if (rows) applyRows(rows);
    else applyRows(window.SIRRUS_ROWS || []);
    if (typeof window.renderWidget === "function") {
      try { window.renderWidget(window.SIRRUS_DATA, FIELDS, window.SIRRUS_ROWS); } catch (e) {}
    }
    notify();
  }
  function notify(){
    var height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 1);
    try {
      window.parent.postMessage({ type: "sirrus:ready", widgetId: WIDGET_ID, height: height, data: window.SIRRUS_DATA }, "*");
    } catch (e) {}
  }
  function fromQuery(){
    var q = new URLSearchParams(location.search);
    var data = {};
    for (var i = 0; i < FIELDS.length; i++) {
      var key = FIELDS[i].key;
      if (q.has(key)) data[key] = q.get(key);
    }
    return data;
  }
  window.addEventListener("message", function(ev){
    var msg = ev.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "sirrus:set-data") apply(msg.data, msg.rows);
    if (msg.type === "sirrus:ping") {
      try { ev.source && ev.source.postMessage({ type: "sirrus:pong", widgetId: WIDGET_ID }, "*"); } catch (e) {}
    }
  });
  apply(fromQuery());
})();
</script>
</body>
</html>`;
}

export function embedSnippet(origin: string, widget: MarketplaceWidget): string {
  const height = widget.embedHeight || 420;
  const src = `${origin.replace(/\/$/, "")}/embed/w/${encodeURIComponent(widget.id)}`;
  return `<iframe
  src="${src}"
  title="${escapeAttr(widget.name)}"
  width="100%"
  height="${height}"
  style="border:0;width:100%;max-width:100%;height:${height}px;background:transparent"
  sandbox="allow-scripts"
  loading="lazy"
></iframe>`;
}

export function embedScript(origin: string, widget: MarketplaceWidget): string {
  const src = `${origin.replace(/\/$/, "")}/embed/w/${encodeURIComponent(widget.id)}`;
  return `<script>
(function () {
  var frame = document.currentScript.previousElementSibling;
  if (!frame || frame.tagName !== "IFRAME") return;
  window.addEventListener("message", function (ev) {
    if (!ev.data || ev.data.type !== "sirrus:ready") return;
    if (ev.data.widgetId !== ${JSON.stringify(widget.id)}) return;
    if (typeof ev.data.height === "number") frame.style.height = ev.data.height + "px";
  });
  frame.contentWindow && frame.contentWindow.postMessage({
    type: "sirrus:set-data",
    data: { /* pass marketplace record fields here */ }
  }, "*");
})();
</script>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
