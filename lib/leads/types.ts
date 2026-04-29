/** One related row for prototype connected-module filters (Calls / Tasks / Channel Partner). */
export type LeadRelatedDemoRow = Record<string, string>;

/** One lead row persisted for the Manage leads demo. */
export type LeadRecord = {
  id: string;
  /** Human-facing ref (e.g. L0426002674). */
  displayId: string;
  /** Values keyed by field `apiKey` (picklists store option id). */
  values: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  /**
   * Prototype-only: sample related records so “Connected modules” filters can run locally.
   * Omitted on older stored rows — `loadLeads` backfills.
   */
  relatedDemo?: {
    calls?: LeadRelatedDemoRow[];
    tasks?: LeadRelatedDemoRow[];
    channel_partner?: LeadRelatedDemoRow[];
  };
};
