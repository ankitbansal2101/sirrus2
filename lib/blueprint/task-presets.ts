/** Task labels shown on transitions (admin preset + rep-facing picker). */
export const TASK_TYPE_PRESETS = ["Follow up", "Site visit"] as const;

export type TaskTypePreset = (typeof TASK_TYPE_PRESETS)[number];

export function coerceTaskPresetType(t: string): TaskTypePreset {
  return t.trim() === "Site visit" ? "Site visit" : "Follow up";
}
