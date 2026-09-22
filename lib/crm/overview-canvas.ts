import { newCrmId } from "@/lib/crm/ids";

export const OVERVIEW_WIDGET_PALETTE = [
  { id: "pair", title: "PAIR Score", defaultW: 0.42, defaultH: 0.14 },
  { id: "ai-summary", title: "AI Summary", defaultW: 0.55, defaultH: 0.18 },
  { id: "open-tasks", title: "All Tasks", defaultW: 0.38, defaultH: 0.22 },
  { id: "calls", title: "Calls", defaultW: 0.42, defaultH: 0.24 },
  { id: "timeline", title: "Timeline", defaultW: 0.4, defaultH: 0.28 },
  { id: "notes", title: "Remarks", defaultW: 0.32, defaultH: 0.24 },
  { id: "change-stage", title: "Change Stage", defaultW: 0.52, defaultH: 0.22 },
  { id: "lead-details", title: "Lead Details", defaultW: 0.28, defaultH: 0.92 },
  { id: "lead-status-history", title: "Status History", defaultW: 0.35, defaultH: 0.28 },
] as const;

export type OverviewWidgetKind = (typeof OVERVIEW_WIDGET_PALETTE)[number]["id"];

/** Default detail tabs — same labels as widgets-config-v2. */
export const DEFAULT_OVERVIEW_TAB_LABELS = [
  "Overview",
  "AI Insights",
  "Lead Journey",
  "Lead Overview",
  "Change Stage",
  "Quotations",
] as const;

export const CUSTOM_WIDGET_DISPLAYS = ["fields", "timeline", "table", "list"] as const;
export type CustomWidgetDisplay = (typeof CUSTOM_WIDGET_DISPLAYS)[number];

export type CanvasTextStyle = {
  content?: string;
  fontSizePx?: number;
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
};

export type CanvasLineStyle = {
  orientation?: "horizontal" | "vertical";
  thicknessPx?: number;
  color?: string;
};

export type CanvasIconStyle = {
  glyph?: "star" | "phone" | "calendar" | "user";
  iconColor?: string;
  backgroundColor?: string;
};

export type CanvasBoxStyle = {
  backgroundColor?: string;
  borderColor?: string;
  borderWidthPx?: number;
  paddingPx?: number;
  borderRadiusPx?: number;
};

export type CanvasTypeStyle = {
  fontSizePx?: number;
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  textTransform?: "none" | "uppercase" | "lowercase";
  align?: "start" | "center" | "end";
};

export type CanvasHeaderStyle = {
  backgroundColor?: string;
  color?: string;
};

/** User-built widget: pick fields (this record or another module) and a layout. */
export type CustomWidgetSpec = {
  display: CustomWidgetDisplay;
  fieldIds: string[];
  dateFieldId?: string;
  titleFieldId?: string;
  bodyFieldId?: string;
  /** Related list: rows come from another module’s records. */
  sourceModuleId?: string | null;
  /** On the source module, field that matches this record’s id / display id. */
  linkFieldId?: string | null;
};

export type OverviewCustomWidgetDef = {
  id: string;
  title: string;
  spec: CustomWidgetSpec;
};

export type OverviewCanvasNode = {
  id: string;
  type: "widget" | "field" | "section" | "text" | "custom" | "line" | "icon";
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  kind?: string;
  title?: string;
  fieldId?: string;
  /** Nested fields inside a section, or columns on a built-in details widget. */
  fieldIds?: string[];
  label?: string;
  content?: string;
  spec?: CustomWidgetSpec;
  widgetDefId?: string;
  headerStyle?: CanvasHeaderStyle;
  bodyBackgroundColor?: string;
  rowGapPx?: number;
  style?: CanvasBoxStyle;
  textStyle?: CanvasTextStyle;
  lineStyle?: CanvasLineStyle;
  iconStyle?: CanvasIconStyle;
  labelStyle?: CanvasTypeStyle;
  valueStyle?: CanvasTypeStyle;
};

export type OverviewCanvasTab = {
  id: string;
  label: string;
  nodes: OverviewCanvasNode[];
};

export type OverviewCanvasDocument = {
  schema: 1;
  activeTabId: string;
  tabs: OverviewCanvasTab[];
};

function presetTabId(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return index === 0 ? "overview" : `preset-${slug || `tab-${index}`}`;
}

export function emptyOverviewCanvas(): OverviewCanvasDocument {
  const tabs: OverviewCanvasTab[] = DEFAULT_OVERVIEW_TAB_LABELS.map((label, i) => ({
    id: presetTabId(label, i),
    label,
    nodes: [],
  }));
  return { schema: 1, activeTabId: tabs[0]!.id, tabs };
}

export function emptyCustomWidgetSpec(): CustomWidgetSpec {
  return { display: "fields", fieldIds: [], sourceModuleId: null, linkFieldId: null };
}

function isBareDefaultCanvas(canvas: OverviewCanvasDocument): boolean {
  return canvas.tabs.length === 1 && canvas.tabs[0]!.label === "Overview" && canvas.tabs[0]!.nodes.length === 0;
}

export function canvasFromLegacyOverview(layout: {
  widgets: { id: string; type: string; title: string; fieldIds: string[] }[];
} | undefined): OverviewCanvasDocument {
  const widgets = layout?.widgets ?? [];
  const doc = emptyOverviewCanvas();
  if (!widgets.length) return doc;
  const nodes: OverviewCanvasNode[] = [];
  let y = 0.03;
  let z = 1;
  const detailFields = widgets
    .filter((w) => w.type === "header" || w.type === "details" || w.type === "highlights")
    .flatMap((w) => w.fieldIds);
  const uniqueFields = [...new Set(detailFields)];
  if (uniqueFields.length) {
    nodes.push({
      id: newCrmId("ocn"),
      type: "section",
      label: "Record information",
      fieldIds: uniqueFields,
      x: 0.03,
      y,
      w: 0.94,
      h: Math.min(0.42, 0.12 + uniqueFields.length * 0.04),
      z: z++,
    });
    y += 0.46;
  }
  for (const w of widgets) {
    if (w.type === "status") {
      nodes.push({
        id: w.id,
        type: "widget",
        kind: "change-stage",
        title: w.title || "Change Stage",
        x: 0.03,
        y,
        w: 0.94,
        h: 0.16,
        z: z++,
      });
      y += 0.18;
    } else if (w.type === "activity") {
      nodes.push({
        id: w.id,
        type: "widget",
        kind: "timeline",
        title: w.title || "Timeline",
        x: 0.03,
        y,
        w: 0.94,
        h: 0.2,
        z: z++,
      });
      y += 0.22;
    }
  }
  doc.tabs[0] = { ...doc.tabs[0]!, nodes };
  return doc;
}

export function resolveOverviewCanvas(
  layout: { widgets: { id: string; type: string; title: string; fieldIds: string[] }[] } | undefined,
  canvas?: OverviewCanvasDocument,
): OverviewCanvasDocument {
  if (canvas?.tabs?.length) {
    if (isBareDefaultCanvas(canvas)) return emptyOverviewCanvas();
    return canvas;
  }
  return canvasFromLegacyOverview(layout);
}

export function newOverviewNodeId() {
  return newCrmId("ocn");
}

export function newCustomWidgetDefId() {
  return newCrmId("owd");
}

export function hitTestSection(nodes: OverviewCanvasNode[], px: number, py: number): OverviewCanvasNode | null {
  const hits = nodes
    .filter((n) => n.type === "section" && px >= n.x && px <= n.x + n.w && py >= n.y && py <= n.y + n.h)
    .sort((a, b) => b.z - a.z);
  return hits[0] ?? null;
}

export function canvasNodeChromeTitle(node: OverviewCanvasNode): string {
  switch (node.type) {
    case "widget":
    case "custom":
      return node.title?.trim() || "Widget";
    case "field":
      return node.label?.trim() || "Field";
    case "section":
      return node.label?.trim() ? node.label : "Section";
    case "text":
      return "Text";
    case "line":
      return "Line";
    case "icon":
      return "Icon";
    default:
      return "Item";
  }
}

/** Widgets (catalog + custom) stay as large cards; fields and layout primitives use compact chrome. */
export function canvasNodeIsCompactLayout(node: OverviewCanvasNode): boolean {
  return node.type !== "widget" && node.type !== "custom";
}

export function canvasNodeOmitsChromeHeader(node: OverviewCanvasNode): boolean {
  return node.type === "field";
}

export function canvasNodeMinBounds(node: OverviewCanvasNode): { minW: number; minH: number } {
  switch (node.type) {
    case "field":
      return { minW: 0.14, minH: 0.04 };
    case "line":
      return { minW: 0.05, minH: 0.015 };
    case "icon":
      return { minW: 0.04, minH: 0.045 };
    case "text":
      return { minW: 0.12, minH: 0.04 };
    case "section":
      return { minW: 0.2, minH: 0.07 };
    default:
      return { minW: 0.12, minH: 0.1 };
  }
}

export function normalizeWidgetKind(kind: string | undefined): string {
  if (kind === "record-details") return "lead-details";
  if (kind === "status-history") return "lead-status-history";
  return kind ?? "lead-details";
}
