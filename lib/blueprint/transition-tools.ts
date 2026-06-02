/** Configurable tools reps can run during a transition (During form). */
export const TRANSITION_TOOL_PRESETS = [
  { id: "sv_otp_flow", label: "SV OTP flow" },
  { id: "sv_recorder", label: "SV Recorder" },
] as const;

export type TransitionToolPresetId = (typeof TRANSITION_TOOL_PRESETS)[number]["id"];

export function labelForTransitionToolId(toolId: string): string {
  return TRANSITION_TOOL_PRESETS.find((t) => t.id === toolId)?.label ?? toolId;
}

export function transitionToolDraftKey(transitionId: string, toolRowId: string): string {
  return `${transitionId}:__tool__${toolRowId}`;
}
