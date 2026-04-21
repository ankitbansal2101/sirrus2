export type PrototypeStateFile = {
  version: 1;
  savedAt: string;
  fieldsSchema: unknown;
  /** @deprecated Prefer blueprintLibrary — kept for older disk snapshots. */
  blueprint: unknown;
  /** Multiple blueprints + active id (`sirrus2_blueprint_library_v2`). */
  blueprintLibrary?: unknown;
  leads: unknown;
  /** Create-lead section layout (`sirrus2_lead_form_layout_v1`). */
  leadFormLayout?: unknown;
};
