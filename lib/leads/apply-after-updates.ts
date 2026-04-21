import type { AfterFieldUpdate } from "@/lib/blueprint/types";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Apply configured “after transition” field updates onto lead values (apiKey keys). */
export function applyAfterFieldUpdates(
  values: Record<string, string>,
  updates: AfterFieldUpdate[],
  now: Date = new Date(),
): Record<string, string> {
  const next = { ...values };
  for (const u of updates) {
    switch (u.valueKind) {
      case "clear":
        next[u.fieldId] = "";
        break;
      case "literal":
        next[u.fieldId] = u.literalValue;
        break;
      case "execution_date":
        next[u.fieldId] = formatYmd(now);
        break;
      case "execution_date_time":
        next[u.fieldId] = now.toISOString();
        break;
      default:
        break;
    }
  }
  return next;
}
