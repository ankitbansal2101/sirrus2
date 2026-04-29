export const CONNECTED_MODULE_IDS = ["calls", "tasks", "channel_partner"] as const;
export type ConnectedModuleId = (typeof CONNECTED_MODULE_IDS)[number];

/** One row in the filter builder (values are strings; numbers/dates serialized). */
export type LeadFilterCondition = {
  id: string;
  /** Field `apiKey` — matches `LeadRecord.values` for lead conditions, or module field keys when used under `connected`. */
  fieldApiKey: string;
  operator: string;
  value: string;
  /** Second bound for between / not between (numbers + dates). */
  value2: string;
};

/** Filter segment on a module linked to the lead (Calls, Tasks, Channel Partner). */
export type ConnectedModuleFilterBlock = {
  moduleId: ConnectedModuleId;
  /**
   * `with` = at least one related row exists (optionally matching `conditions`).
   * `without` = no related rows for this module.
   */
  presence: "with" | "without";
  /** AND conditions on that module’s fields; ignored when `presence` is `without`. */
  conditions: LeadFilterCondition[];
};

export type LeadFilterConfig = {
  conditions: LeadFilterCondition[];
  /** MVP: only AND across all lead + connected rules. */
  logic: "AND";
  connected?: ConnectedModuleFilterBlock[];
};

export function emptyLeadFilterConfig(): LeadFilterConfig {
  return { conditions: [], logic: "AND" };
}

function newCondId(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c && typeof c.randomUUID === "function") return c.randomUUID();
  return `fc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function newEmptyCondition(): LeadFilterCondition {
  return { id: newCondId(), fieldApiKey: "", operator: "", value: "", value2: "" };
}
