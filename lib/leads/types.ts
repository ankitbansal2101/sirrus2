/** One lead row persisted for the Manage leads demo. */
export type LeadRecord = {
  id: string;
  /** Human-facing ref (e.g. L0426002674). */
  displayId: string;
  /** Values keyed by field `apiKey` (picklists store option id). */
  values: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};
