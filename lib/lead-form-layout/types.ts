export type LeadFormSection = {
  id: string;
  title: string;
  /** `FieldDefinition.id` values shown on create lead, in column order (then grid wraps). */
  fieldIds: string[];
};

export type LeadFormLayoutV1 = {
  version: 1;
  sections: LeadFormSection[];
};
