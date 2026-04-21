import type { FieldDefinition } from "@/lib/fields-config/types";
import { usesOptions } from "@/lib/fields-config/types";

function optionLabel(field: FieldDefinition, optionId: string): string {
  const o = field.options.find((x) => x.id === optionId);
  return o?.label ?? optionId;
}

/** Turn stored `values[apiKey]` into a short display string for grids. */
export function formatLeadFieldValue(field: FieldDefinition, raw: string | undefined): string {
  const v = raw ?? "";
  if (!v) return "—";
  if (field.dataType === "multi_select") {
    const ids = v.split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return "—";
    return ids.map((id) => optionLabel(field, id)).join(", ");
  }
  if (usesOptions(field.dataType)) return optionLabel(field, v);
  if (field.dataType === "date_time" && v.includes("T")) {
    try {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch {
      /* fall through */
    }
  }
  if (field.dataType === "phone" && v.length > 8) {
    return `${v.slice(0, 4)}…${v.slice(-4)}`;
  }
  if (field.dataType === "email" && v.includes("@")) {
    const [a, b] = v.split("@");
    if (a.length <= 2) return v;
    return `${a[0]}***${a.slice(-1)}@${b}`;
  }
  return v;
}

/** Swatch index for stage / status chips (deterministic). */
export function chipPaletteIndex(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i += 1) h = (h + label.charCodeAt(i) * (i + 3)) % 997;
  return h % 7;
}

export const CHIP_DOT_CLASS = [
  "bg-amber-300",
  "bg-indigo-200",
  "bg-yellow-200",
  "bg-purple-200",
  "bg-emerald-300",
  "bg-orange-300",
  "bg-pink-300",
] as const;
