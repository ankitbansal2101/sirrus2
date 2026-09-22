import { displayFieldValue, fieldById, recordTitle } from "@/lib/crm/display";
import type { CustomWidgetSpec } from "@/lib/crm/overview-canvas";
import type { CrmModule, CrmRecord, CrmWorkspace } from "@/lib/crm/types";

export type CustomWidgetRow = {
  id: string;
  values: Record<string, string>;
  createdAt: string;
};

export function rowsForCustomWidget(
  workspace: CrmWorkspace | null | undefined,
  currentModule: CrmModule,
  record: CrmRecord | null,
  spec: CustomWidgetSpec | undefined,
): CustomWidgetRow[] {
  if (!spec) return [];
  const sourceId = spec.sourceModuleId?.trim();
  if (sourceId && workspace) {
    const src = workspace.modules.find((m) => m.id === sourceId);
    if (!src) return [];
    const link = spec.linkFieldId ? src.fields.find((f) => f.id === spec.linkFieldId) : undefined;
    const keys = record ? [record.id, record.displayId, recordTitle(currentModule, record)] : [];
    const rows = src.records.filter((r) => {
      if (!link) return true;
      const v = (r.values[link.apiKey] ?? "").trim();
      return keys.some((k) => k && v === k);
    });
    return rows.map((r) => ({ id: r.id, values: r.values, createdAt: r.createdAt }));
  }
  if (!record) return [];
  return [{ id: record.id, values: record.values, createdAt: record.createdAt }];
}

export function fieldCells(mod: CrmModule, values: Record<string, string>, fieldIds: string[]) {
  return fieldIds
    .map((id) => fieldById(mod, id))
    .filter((f): f is NonNullable<typeof f> => !!f)
    .map((f) => ({
      id: f.id,
      label: f.label,
      value: displayFieldValue(f, values[f.apiKey]),
      raw: values[f.apiKey] ?? "",
    }));
}
