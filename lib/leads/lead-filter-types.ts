/** One row in the filter builder (values are strings; numbers/dates serialized). */
export type LeadFilterCondition = {
  id: string;
  /** Field `apiKey` — matches `LeadRecord.values`. */
  fieldApiKey: string;
  operator: string;
  value: string;
  /** Second bound for between / not between (numbers + dates). */
  value2: string;
};

export type LeadFilterConfig = {
  conditions: LeadFilterCondition[];
};

export function emptyLeadFilterConfig(): LeadFilterConfig {
  return { conditions: [] };
}

function newCondId(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c && typeof c.randomUUID === "function") return c.randomUUID();
  return `fc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function newEmptyCondition(): LeadFilterCondition {
  return { id: newCondId(), fieldApiKey: "", operator: "", value: "", value2: "" };
}
