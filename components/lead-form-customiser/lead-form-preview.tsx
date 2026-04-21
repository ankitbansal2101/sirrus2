"use client";

import type { FieldDefinition } from "@/lib/fields-config/types";
import { usesOptions } from "@/lib/fields-config/types";
import type { LeadFormLayoutV1 } from "@/lib/lead-form-layout/types";

const ink = "#1f1750";
const muted = "#7e7a95";
const fieldBg = "#efeff1";
const cardBorder = "#d4d3df";
const placeholder = "#b7b6ca";

function FieldChrome({ children, colSpan2 }: { children: React.ReactNode; colSpan2?: boolean }) {
  return <div className={colSpan2 ? "col-span-2" : ""}>{children}</div>;
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex items-start gap-1 pb-2 pl-5">
      <span className="text-sm" style={{ color: muted }}>
        {children}
      </span>
      {required ? (
        <span className="text-sm" style={{ color: "#ff6678" }}>
          *
        </span>
      ) : null}
    </div>
  );
}

function FakeInput({ multiline }: { multiline?: boolean }) {
  const common =
    "w-full rounded-2xl pl-5 py-3 text-sm outline-none pointer-events-none border border-transparent";
  const style = { backgroundColor: fieldBg, color: ink };
  if (multiline) {
    return (
      <textarea readOnly className={common} placeholder="Enter here" rows={4} style={{ ...style, height: 130 }} />
    );
  }
  return <input readOnly className={common} placeholder="Enter here" maxLength={25} value="" style={style} />;
}

function FakeSelect() {
  return (
    <button
      type="button"
      className="flex w-full flex-row items-center justify-between rounded-2xl px-5 py-3 text-sm pointer-events-none border-[1.5px] border-transparent"
      style={{ backgroundColor: fieldBg, color: placeholder }}
    >
      <span>Select here</span>
      <span className="text-[#4f4c5e]" aria-hidden>
        ▾
      </span>
    </button>
  );
}

function FakeDate() {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-full px-5 py-2.5 text-base font-semibold pointer-events-none"
      style={{ backgroundColor: fieldBg, color: ink }}
    >
      <span style={{ color: placeholder }}>Select here</span>
      <span className="text-lg" aria-hidden>
        📅
      </span>
    </button>
  );
}

function PreviewField({ def }: { def: FieldDefinition }) {
  const pickish = usesOptions(def.dataType);
  const multiline = def.dataType === "paragraph";
  const isDate = def.dataType === "date" || def.dataType === "date_time";

  return (
    <FieldChrome colSpan2={multiline}>
      <Label required={def.required}>{def.label}</Label>
      {pickish ? (
        <FakeSelect />
      ) : isDate ? (
        <FakeDate />
      ) : (
        <FakeInput multiline={multiline} />
      )}
    </FieldChrome>
  );
}

type Props = {
  fieldsById: Map<string, FieldDefinition>;
  layout: LeadFormLayoutV1;
};

export function LeadFormPreview({ fieldsById, layout }: Props) {
  return (
    <div
      className="h-full w-full min-w-0 rounded-[2rem] px-4 py-5 sm:px-6 sm:py-6 xl:px-8"
      style={{ backgroundColor: "#fafafa" }}
    >
      <div className="flex flex-row items-center justify-between gap-1">
        <span className="text-lg font-semibold leading-8 sm:text-[20px] sm:leading-9" style={{ color: ink }}>
          Form Preview
        </span>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        {layout.sections.map((sec) => (
          <div key={sec.id} className="rounded-2xl px-3 py-4 sm:px-5 sm:py-5" style={{ border: `1px solid ${cardBorder}` }}>
            <div className="flex flex-row items-center justify-between gap-2">
              <span className="text-base font-semibold sm:text-lg" style={{ color: ink }}>
                {sec.title}
              </span>
            </div>
            <div className="mt-4 px-2 sm:mt-6 sm:px-4">
              <div className="mb-4 grid grid-cols-1 gap-4 sm:mb-6 sm:grid-cols-2 sm:gap-5 md:gap-6 xl:grid-cols-2 xl:gap-x-8">
                {sec.fieldIds.map((fid) => {
                  const def = fieldsById.get(fid);
                  if (!def) return null;
                  return <PreviewField key={fid} def={def} />;
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
