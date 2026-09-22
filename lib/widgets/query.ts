import { queryModuleRecords } from "@/lib/crm/agent/query-records";
import { resolveModule } from "@/lib/crm/agent/tools";
import type { CrmWorkspace, MarketplaceWidget, MarketplaceWidgetField } from "@/lib/crm/types";
import { sampleData } from "@/lib/widgets/compile";

export type WidgetRuntimePayload = {
  data: Record<string, string>;
  rows: Array<Record<string, string>>;
};

function asRow(values: Record<string, unknown>): Record<string, string> {
  const row: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v == null) continue;
    row[k] = String(v);
  }
  return row;
}

export function runWidgetQuery(ws: CrmWorkspace, widget: MarketplaceWidget): WidgetRuntimePayload {
  const fallback = { data: sampleData(widget.fields), rows: [] as Array<Record<string, string>> };
  const q = widget.query;
  if (!q?.moduleId) return fallback;
  const mod = resolveModule(ws, q.moduleId);
  if (!mod) return fallback;

  const result = queryModuleRecords(mod, {
    operation: q.operation,
    contains: q.contains,
    filters: q.filters,
    groupBy: q.groupBy,
    limit: q.limit ?? 50,
  });

  if (result.operation === "aggregate" && "groups" in result && result.groups) {
    const groupKey = q.groupBy?.trim() || "group";
    const rows = result.groups.map((g) =>
      asRow({
        group: g.value,
        count: g.count,
        [groupKey]: g.value,
      }),
    );
    return {
      data: {
        ...fallback.data,
        module: mod.pluralLabel,
        total: String(result.matched),
        groupBy: result.groupBy ?? groupKey,
      },
      rows,
    };
  }

  if (result.operation === "count") {
    return {
      data: { ...fallback.data, module: mod.pluralLabel, total: String(result.matched) },
      rows: [],
    };
  }

  const records = "records" in result && result.records ? result.records : [];
  const keys = q.listFieldKeys?.length ? q.listFieldKeys : undefined;
  const rows = records.map((r) => {
    const src: Record<string, string> = { name: r.name, displayId: r.displayId, ...r.values };
    if (!keys) return asRow(src);
    const slim: Record<string, string> = { name: r.name, displayId: r.displayId };
    for (const k of keys) {
      const value = src[k];
      if (value != null) slim[k] = String(value);
    }
    return slim;
  });

  return {
    data: {
      ...fallback.data,
      module: mod.pluralLabel,
      total: String(result.matched),
    },
    rows,
  };
}

export function fieldsFromKeys(
  keys: Array<{ key: string; label: string; type?: MarketplaceWidgetField["type"] }>,
): MarketplaceWidgetField[] {
  return keys.map((k, i) => ({
    id: `wf_${k.key}_${i}`,
    key: k.key,
    label: k.label,
    type: k.type ?? "text",
  }));
}
