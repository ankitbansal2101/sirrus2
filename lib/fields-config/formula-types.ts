/** Structured “calculated field” definition (serialized separately for the engine). */
export type FormulaPlan =
  | {
      kind: "date_offset";
      sourceFieldId: string;
      daysDelta: number;
    }
  | {
      kind: "days_between";
      startFieldId: string;
      endFieldId: string;
    }
  | {
      kind: "number_binary";
      leftFieldId: string;
      op: "+" | "-" | "*" | "/";
      rightMode: "field" | "constant";
      rightFieldId: string;
      rightConstant: number;
    }
  | { kind: "custom"; expression: string };

export function defaultFormulaPlan(): FormulaPlan {
  return { kind: "date_offset", sourceFieldId: "", daysDelta: -2 };
}
