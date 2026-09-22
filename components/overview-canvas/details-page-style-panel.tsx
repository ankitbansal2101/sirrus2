"use client";

import type { ReactNode } from "react";
import type { OverviewCanvasNode } from "@/lib/crm/overview-canvas";

type Props = {
  node: OverviewCanvasNode | null;
  onPatch: (patch: Partial<OverviewCanvasNode>) => void;
  extra?: ReactNode;
};

function labelInput(id: string, label: string, value: string, onChange: (v: string) => void) {
  return (
    <label className="flex flex-col gap-0.5" htmlFor={id}>
      <span className="text-[9px] font-semibold text-[#6b6578]">{label}</span>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-200/90 bg-white px-1.5 py-1 text-[11px] text-[#1F1750]"
      />
    </label>
  );
}

function numInput(id: string, label: string, value: number | undefined, onChange: (v: number | undefined) => void) {
  return (
    <label className="flex flex-col gap-0.5" htmlFor={id}>
      <span className="text-[9px] font-semibold text-[#6b6578]">{label}</span>
      <input
        id={id}
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const t = e.target.value;
          onChange(t === "" ? undefined : Number(t));
        }}
        className="rounded-md border border-slate-200/90 bg-white px-1.5 py-1 text-[11px] text-[#1F1750]"
      />
    </label>
  );
}

function colorInput(id: string, label: string, value: string | undefined, onChange: (v: string) => void) {
  return (
    <label className="flex flex-col gap-0.5" htmlFor={id}>
      <span className="text-[9px] font-semibold text-[#6b6578]">{label}</span>
      <input
        id={id}
        type="color"
        value={value?.startsWith("#") && value.length === 7 ? value : "#f4f5ff"}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full cursor-pointer rounded-md border border-slate-200/90 bg-white"
      />
    </label>
  );
}

export function DetailsPageStylePanel({ node, onPatch, extra }: Props) {
  if (!node) {
    return (
      <p className="px-1 text-[10px] leading-relaxed text-[#8b87a8]">
        Select a canvas item to edit styles. Use the Style tab after selecting an item.
      </p>
    );
  }

  if (node.type === "section") {
    const s = node.style ?? {};
    return (
      <div className="flex flex-col gap-2 px-0.5">
        {labelInput("sec-label", "Section label", node.label ?? "", (v) => onPatch({ label: v || undefined }))}
        {colorInput("sec-bg", "Background", s.backgroundColor, (v) => onPatch({ style: { ...s, backgroundColor: v } }))}
        {colorInput("sec-border", "Border color", s.borderColor, (v) => onPatch({ style: { ...s, borderColor: v } }))}
        {numInput("sec-bw", "Border width (px)", s.borderWidthPx, (v) => onPatch({ style: { ...s, borderWidthPx: v } }))}
        {numInput("sec-pad", "Padding (px)", s.paddingPx, (v) => onPatch({ style: { ...s, paddingPx: v } }))}
        {numInput("sec-rad", "Radius (px)", s.borderRadiusPx, (v) => onPatch({ style: { ...s, borderRadiusPx: v } }))}
        {extra}
      </div>
    );
  }

  if (node.type === "text") {
    const ts = node.textStyle ?? {};
    return (
      <div className="flex flex-col gap-2 px-0.5">
        <label className="flex flex-col gap-0.5" htmlFor="txt-content">
          <span className="text-[9px] font-semibold text-[#6b6578]">Content</span>
          <textarea
            id="txt-content"
            value={ts.content ?? node.content ?? "Text"}
            onChange={(e) => onPatch({ content: e.target.value, textStyle: { ...ts, content: e.target.value } })}
            rows={3}
            className="resize-y rounded-md border border-slate-200/90 bg-white px-1.5 py-1 text-[11px] text-[#1F1750]"
          />
        </label>
        {numInput("txt-fs", "Font size (px)", ts.fontSizePx, (v) => onPatch({ textStyle: { ...ts, fontSizePx: v } }))}
        {colorInput("txt-fg", "Text color", ts.color, (v) => onPatch({ textStyle: { ...ts, color: v } }))}
        {colorInput("txt-bg", "Background", ts.backgroundColor, (v) => onPatch({ textStyle: { ...ts, backgroundColor: v } }))}
        {extra}
      </div>
    );
  }

  if (node.type === "line") {
    const ls = node.lineStyle ?? { orientation: "horizontal" as const };
    return (
      <div className="flex flex-col gap-2 px-0.5">
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold text-[#6b6578]">Orientation</span>
          <select
            value={ls.orientation ?? "horizontal"}
            onChange={(e) => onPatch({ lineStyle: { ...ls, orientation: e.target.value as "horizontal" | "vertical" } })}
            className="rounded-md border border-slate-200/90 bg-white px-1.5 py-1 text-[11px]"
          >
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
          </select>
        </label>
        {numInput("ln-th", "Thickness (px)", ls.thicknessPx, (v) => onPatch({ lineStyle: { ...ls, thicknessPx: v } }))}
        {colorInput("ln-c", "Color", ls.color, (v) => onPatch({ lineStyle: { ...ls, color: v } }))}
        {extra}
      </div>
    );
  }

  if (node.type === "icon") {
    const ic = node.iconStyle ?? {};
    return (
      <div className="flex flex-col gap-2 px-0.5">
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold text-[#6b6578]">Glyph</span>
          <select
            value={ic.glyph ?? "star"}
            onChange={(e) =>
              onPatch({ iconStyle: { ...ic, glyph: e.target.value as NonNullable<typeof ic.glyph> } })
            }
            className="rounded-md border border-slate-200/90 bg-white px-1.5 py-1 text-[11px]"
          >
            <option value="star">Star</option>
            <option value="phone">Phone</option>
            <option value="calendar">Calendar</option>
            <option value="user">User</option>
          </select>
        </label>
        {colorInput("ic-fg", "Icon color", ic.iconColor, (v) => onPatch({ iconStyle: { ...ic, iconColor: v } }))}
        {colorInput("ic-bg", "Background", ic.backgroundColor, (v) => onPatch({ iconStyle: { ...ic, backgroundColor: v } }))}
        {extra}
      </div>
    );
  }

  if (node.type === "field") {
    const ls = node.labelStyle ?? {};
    const vs = node.valueStyle ?? {};
    return (
      <div className="flex flex-col gap-2 px-0.5">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-[#8b87a8]">Label</p>
        {numInput("fl-fs", "Font size (px)", ls.fontSizePx, (v) => onPatch({ labelStyle: { ...ls, fontSizePx: v } }))}
        {colorInput("fl-fg", "Color", ls.color, (v) => onPatch({ labelStyle: { ...ls, color: v } }))}
        <p className="text-[9px] font-semibold uppercase tracking-wide text-[#8b87a8]">Value</p>
        {numInput("fv-fs", "Font size (px)", vs.fontSizePx, (v) => onPatch({ valueStyle: { ...vs, fontSizePx: v } }))}
        {colorInput("fv-fg", "Color", vs.color, (v) => onPatch({ valueStyle: { ...vs, color: v } }))}
        {colorInput("fv-bg", "Background", vs.backgroundColor, (v) => onPatch({ valueStyle: { ...vs, backgroundColor: v } }))}
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold text-[#6b6578]">Align</span>
          <select
            value={vs.align ?? "start"}
            onChange={(e) => onPatch({ valueStyle: { ...vs, align: e.target.value as "start" | "center" | "end" } })}
            className="rounded-md border border-slate-200/90 bg-white px-1.5 py-1 text-[11px]"
          >
            <option value="start">Start</option>
            <option value="center">Center</option>
            <option value="end">End</option>
          </select>
        </label>
        {extra}
      </div>
    );
  }

  if (node.type === "widget" || node.type === "custom") {
    const w = node;
    return (
      <div className="flex max-h-[min(50vh,480px)] flex-col gap-3 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
        <div>
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[#8b87a8]">Widget chrome</p>
          {labelInput("wh-title", "Title", w.title ?? "", (v) => onPatch({ title: v }))}
          {colorInput("wh-hbg", "Header background", w.headerStyle?.backgroundColor, (v) =>
            onPatch({ headerStyle: { ...w.headerStyle, backgroundColor: v } }),
          )}
          {colorInput("wh-ht", "Header text", w.headerStyle?.color, (v) =>
            onPatch({ headerStyle: { ...w.headerStyle, color: v } }),
          )}
          {colorInput("wh-bbg", "Body background", w.bodyBackgroundColor, (v) => onPatch({ bodyBackgroundColor: v }))}
        </div>
        {extra}
      </div>
    );
  }

  return extra ?? null;
}
