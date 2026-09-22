"use client";

import Link from "next/link";
import { useState } from "react";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { IconTrash } from "@/components/icons";
import { useCrm } from "@/components/crm/crm-provider";
import { addOverviewWidget, findModule, setListColumns, setOverviewLayout } from "@/lib/crm/ops";
import type { OverviewWidgetType } from "@/lib/crm/types";

const SETTINGS_LINKS = [
  {
    href: "/developer/lead-settings/fields-configurator",
    title: "Fields configurator",
    description: "Drag field types onto the canvas, edit properties, and save the schema. Same screen as Settings.",
  },
  {
    href: "/developer/lead-settings/customise-lead-form",
    title: "Customise create form",
    description: "Drag fields into sections and preview the record-creation form. Same screen as Settings.",
  },
  {
    href: "/developer/lead-settings/blueprint-configurator",
    title: "Blueprint configurator",
    description: "Stages, transitions, substages, transition forms, and after-move automation. Same canvas as Settings.",
  },
] as const;

export function ModuleSettingsClient({ moduleId }: { moduleId: string }) {
  const { workspace } = useCrm();
  const mod = workspace ? findModule(workspace, moduleId) : undefined;

  if (!workspace || !mod) {
    return (
      <div className="flex flex-1 items-center justify-center bg-canvas text-sm text-muted">
        Module not found.{" "}
        <Link href="/crm/studio" className="ml-1 text-accent">
          Back to studio
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <DeveloperPageHeader
        backHref={`/crm/modules/${mod.id}`}
        title={`${mod.pluralLabel} settings`}
        description="Fields, create-form layout, and blueprints stay in Settings. Overview widgets below are extra for this list."
      />
      <div className="mx-auto w-full max-w-[1100px] flex-1 space-y-8 px-4 py-5">
        <section>
          <h2 className="text-sm font-semibold text-ink">Configure in Settings</h2>
          <p className="mt-1 text-sm text-muted">
            These are the existing tools — not a simplified copy. Changes apply from the same Settings cards on the home screen.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {SETTINGS_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block h-full rounded-2xl border border-border-soft bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{item.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <OverviewTab moduleId={mod.id} />
      </div>
    </div>
  );
}

function OverviewTab({ moduleId }: { moduleId: string }) {
  const { workspace, save } = useCrm();
  const mod = workspace ? findModule(workspace, moduleId) : undefined;
  const [title, setTitle] = useState("Details");
  const [type, setType] = useState<OverviewWidgetType>("details");
  if (!workspace || !mod) return null;

  const toggleField = (widgetId: string, fieldId: string) => {
    const widgets = mod.overviewLayout.widgets.map((w) => {
      if (w.id !== widgetId) return w;
      const has = w.fieldIds.includes(fieldId);
      return { ...w, fieldIds: has ? w.fieldIds.filter((id) => id !== fieldId) : [...w.fieldIds, fieldId] };
    });
    save(setOverviewLayout(workspace, mod.id, { widgets }));
  };

  return (
    <section>
      <h2 className="text-sm font-semibold text-ink">Record overview widgets</h2>
      <p className="mt-1 text-sm text-muted">Optional layout for this module’s record page. Schema and pipeline still live in Settings.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as OverviewWidgetType)} className="rounded-xl border border-border-soft bg-white px-3 py-2 text-sm">
          <option value="header">Header</option>
          <option value="status">Pipeline status</option>
          <option value="details">Details</option>
          <option value="highlights">Highlights</option>
          <option value="activity">Activity</option>
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl border border-border-soft bg-white px-3 py-2 text-sm" />
        <button
          type="button"
          onClick={() => save(addOverviewWidget(workspace, mod.id, { type, title }))}
          className="rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white"
        >
          Add widget
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {mod.overviewLayout.widgets.map((w) => (
          <div key={w.id} className="rounded-2xl border border-border-soft bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                {w.title} <span className="font-normal text-muted">({w.type})</span>
              </p>
              <button
                type="button"
                className="text-muted hover:text-red-600"
                onClick={() =>
                  save(setOverviewLayout(workspace, mod.id, { widgets: mod.overviewLayout.widgets.filter((x) => x.id !== w.id) }))
                }
              >
                <IconTrash className="size-4" />
              </button>
            </div>
            {w.type !== "activity" ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {mod.fields.map((f) => {
                  const on = w.fieldIds.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleField(w.id, f.id)}
                      className={`rounded-full px-2 py-0.5 text-[11px] ${on ? "bg-accent text-white" : "bg-rail-inactive text-accent"}`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted">Activity is a placeholder widget for the management demo.</p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-border-soft bg-surface p-4">
        <p className="text-xs font-medium text-muted">List columns</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {mod.fields.map((f) => {
            const on = mod.listColumnFieldIds.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  const next = on ? mod.listColumnFieldIds.filter((id) => id !== f.id) : [...mod.listColumnFieldIds, f.id];
                  save(setListColumns(workspace, mod.id, next));
                }}
                className={`rounded-full px-2 py-0.5 text-[11px] ${on ? "bg-accent text-white" : "bg-white text-accent"}`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
