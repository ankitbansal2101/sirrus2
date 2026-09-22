"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FieldsConfigurator } from "@/components/fields-configurator/fields-configurator";
import { CustomiseLeadFormClient } from "@/components/lead-form-customiser/customise-lead-form-client";
import { BlueprintConfiguratorShell } from "@/components/blueprint-configurator/blueprint-configurator-shell";
import { BlueprintSaveToolbar } from "@/components/blueprint-configurator/blueprint-save-toolbar";
import { BlueprintWorkspaceProvider } from "@/components/blueprint-configurator/blueprint-workspace-context";
import { OverviewCanvasConfigurator } from "@/components/overview-canvas/overview-canvas-configurator";
import { useCrm } from "@/components/crm/crm-provider";
import { PageAgentBar } from "@/components/crm/page-agent-bar";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { moduleSlot, type ModuleStudioSurface } from "@/lib/crm/agent-slots";
import {
  IconArrowUpRight,
  IconChart,
  IconHandshake,
  IconMegaphone,
  IconOrg,
  IconPlus,
  IconSparkle,
  IconTable,
  IconTrash,
  IconUsers,
} from "@/components/icons";
import {
  IconBlueprint,
  IconFieldsConfigurator,
  IconLeadForm,
  IconOverviewLayout,
} from "@/components/settings-card-icons";
import { BlueprintFieldsProvider } from "@/components/blueprint-configurator/blueprint-fields-context";
import { crmBlueprintFromDocument } from "@/lib/crm/blueprint-bridge";
import { ensureModuleBlueprint, moduleBlueprintId } from "@/lib/crm/module-blueprint";
import {
  addModule,
  blankWorkspace,
  findModule,
  removeModule,
  setFormLayout,
  setModuleFields,
  updateModuleMeta,
} from "@/lib/crm/ops";
import { CRM_MODULE_ICONS, type CrmModule, type CrmModuleIcon } from "@/lib/crm/types";
import { BLUEPRINT_CHANGED_EVENT, loadBlueprintById } from "@/lib/blueprint/storage";

const PANES = [
  { id: "fields", label: "Fields configurator" },
  { id: "form", label: "Form layout" },
  { id: "blueprint", label: "Blueprint" },
  { id: "overview", label: "Overview layout" },
] as const;

type PaneId = (typeof PANES)[number]["id"];

const MODULE_ICONS: Record<CrmModuleIcon, typeof IconTable> = {
  leads: IconUsers,
  deals: IconChart,
  contacts: IconHandshake,
  visits: IconOrg,
  bookings: IconMegaphone,
  tickets: IconSparkle,
  custom: IconTable,
};

const OPTION_CARDS: {
  pane: PaneId;
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    pane: "fields",
    title: "Fields configurator",
    description: "Define the columns, types, and properties for records in this module.",
    Icon: IconFieldsConfigurator,
  },
  {
    pane: "form",
    title: "Form layout",
    description: "Arrange how users create and edit records for this module.",
    Icon: IconLeadForm,
  },
  {
    pane: "blueprint",
    title: "Blueprint",
    description: "Design stages and transitions that drive this module’s pipeline.",
    Icon: IconBlueprint,
  },
  {
    pane: "overview",
    title: "Overview layout",
    description: "Optional extra widgets on the record page. Every record already has a default overview.",
    Icon: IconOverviewLayout,
  },
];

function isPane(x: string | null): x is PaneId {
  return PANES.some((p) => p.id === x);
}

export function ModulesConfigurator() {
  const { workspace, save } = useCrm();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const modules = workspace?.modules ?? [];
  const moduleFromUrl = params.get("module");
  const selectedId = moduleFromUrl && modules.some((m) => m.id === moduleFromUrl) ? moduleFromUrl : null;
  const paneParam = params.get("pane");
  const pane: PaneId | null = isPane(paneParam) ? paneParam : null;
  const [createOpen, setCreateOpen] = useState(false);

  const selected = useMemo(
    () => (workspace && selectedId ? findModule(workspace, selectedId) : undefined),
    [workspace, selectedId],
  );

  const setQuery = (next: { module?: string | null; pane?: PaneId | null }) => {
    const q = new URLSearchParams();
    const mod = next.module === undefined ? selectedId : next.module;
    const pn = next.pane === undefined ? pane : next.pane;
    if (mod) q.set("module", mod);
    if (pn) q.set("pane", pn);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const create = (label: string, description: string) => {
    const name = label.trim();
    if (!name) return;
    const base = workspace ?? blankWorkspace();
    const { workspace: next, module } = addModule(base, name, description);
    save(next);
    setCreateOpen(false);
    setQuery({ module: module.id, pane: null });
  };

  if (selected && pane) {
    const paneMeta = PANES.find((p) => p.id === pane)!;
    if (pane === "overview") {
      return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas">
          <OverviewCanvasConfigurator key={`${selected.id}-ov`} moduleId={selected.id} />
        </div>
      );
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DeveloperPageHeader
          backHref={`${pathname}?module=${selected.id}`}
          title={`${selected.pluralLabel} · ${paneMeta.label}`}
          description="Changes apply only to this module. Records stay on the left rail."
          actions={
            <PageAgentBar
              slotKey={moduleSlot(selected.id, pane as ModuleStudioSurface)}
              moduleLabel={selected.pluralLabel}
              compact
            />
          }
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas">
          {pane === "fields" ? (
            <FieldsConfigurator
              key={`${selected.id}-fields`}
              initialFields={selected.fields}
              canvasTitle={`${selected.pluralLabel} fields`}
              allowResetDefaults={false}
              onSaveFields={(fields) => {
                if (!workspace) return false;
                save(setModuleFields(workspace, selected.id, fields));
                return true;
              }}
            />
          ) : null}
          {pane === "form" ? (
            <CustomiseLeadFormClient
              key={`${selected.id}-form`}
              fields={selected.fields}
              layout={selected.formLayout}
              onSaveLayout={(layout) => {
                if (!workspace) return false;
                save(setFormLayout(workspace, selected.id, layout));
                return true;
              }}
            />
          ) : null}
          {pane === "blueprint" ? <EmbeddedBlueprint key={`${selected.id}-bp`} module={selected} /> : null}
        </div>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DeveloperPageHeader
          backHref={pathname}
          title={selected.pluralLabel}
          description={selected.description || `Configure fields, form layout, blueprint, and overview for ${selected.pluralLabel}.`}
        />
        <ModuleHub
          module={selected}
          onOpen={(nextPane) => setQuery({ pane: nextPane })}
          onDeleted={() => setQuery({ module: null, pane: null })}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DeveloperPageHeader
        backHref="/"
        title="Modules"
        description="Objects in this org. Open a module to configure its fields, form, blueprint, or overview layout."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn-primary text-xs"
          >
            <IconPlus className="size-3.5" />
            Add module
          </button>
        }
      />
      <ModuleGallery
        modules={modules}
        onOpen={(id) => setQuery({ module: id, pane: null })}
        onOpenPane={(id, nextPane) => setQuery({ module: id, pane: nextPane })}
        onAdd={() => setCreateOpen(true)}
      />
      {createOpen ? (
        <CreateModuleDialog
          onClose={() => setCreateOpen(false)}
          onCreate={create}
        />
      ) : null}
    </div>
  );
}

function ModuleGallery({
  modules,
  onOpen,
  onOpenPane,
  onAdd,
}: {
  modules: CrmModule[];
  onOpen: (id: string) => void;
  onOpenPane: (id: string, pane: PaneId) => void;
  onAdd: () => void;
}) {
  return (
    <main className="page-canvas min-h-0 flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-[1200px]">
        {modules.length === 0 ? (
          <div className="card px-8 py-16 text-center">
            <p className="display text-3xl text-ink">No modules yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Add an object such as Leads or Deals, then configure its fields, create-form, blueprint, and overview. Or start from an industry template.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onAdd}
                className="btn-primary"
              >
                <IconPlus className="size-4" />
                Add module
              </button>
              <Link
                href="/onboarding"
                className="rounded-full px-4 py-2 text-sm font-medium text-accent ring-1 ring-border-soft hover:bg-white"
              >
                Industry template
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => {
              const Icon = MODULE_ICONS[m.icon] ?? IconTable;
              return (
                <article
                  key={m.id}
                  className="card card-hover flex flex-col p-6"
                >
                  <button type="button" onClick={() => onOpen(m.id)} className="group text-left">
                    <div className="mb-4 flex items-start justify-between">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-[#f4efe6] text-accent">
                        <Icon className="size-5" />
                      </span>
                      <IconArrowUpRight className="size-5 shrink-0 rotate-[20deg] text-accent opacity-80 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                    <h2 className="display text-[26px] leading-tight text-ink">{m.pluralLabel}</h2>
                    <p className="mt-1 font-mono text-[11px] text-muted">{m.apiKey}</p>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
                      {m.description || `${m.fields.length} fields · ${m.records.length} records · ${m.blueprint.stages.length} stages`}
                    </p>
                  </button>
                  <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border-soft pt-4 text-center">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted">Fields</dt>
                      <dd className="text-sm font-semibold text-ink">{m.fields.length}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted">Records</dt>
                      <dd className="text-sm font-semibold text-ink">{m.records.length}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted">Stages</dt>
                      <dd className="text-sm font-semibold text-ink">{m.blueprint.stages.length}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {OPTION_CARDS.map((opt) => (
                      <button
                        key={opt.pane}
                        type="button"
                        onClick={() => onOpenPane(m.id, opt.pane)}
                        className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-ink ring-1 ring-border-soft hover:bg-rail-inactive"
                      >
                        {opt.title.replace(" configurator", "")}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
            <button
              type="button"
              onClick={onAdd}
              className="card flex min-h-[240px] flex-col items-center justify-center border-dashed px-6 py-10 text-center transition hover:border-accent/40"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-rail-inactive text-accent">
                <IconPlus className="size-5" />
              </span>
              <span className="mt-3 text-base font-semibold text-ink">Add module</span>
              <span className="mt-1 max-w-[16rem] text-sm text-muted">Create a new object, then configure its fields, form, blueprint, and overview.</span>
            </button>
          </div>
        )}
        {modules.length > 0 ? (
          <p className="mt-6 text-center text-sm text-muted">
            New org?{" "}
            <Link href="/onboarding" className="font-medium text-accent underline-offset-2 hover:underline">
              Start from an industry template
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}

function ModuleHub({
  module: selected,
  onOpen,
  onDeleted,
}: {
  module: CrmModule;
  onOpen: (pane: PaneId) => void;
  onDeleted: () => void;
}) {
  return (
    <main className="page-canvas min-h-0 flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-[1200px] space-y-8">
        <section>
          <h2 className="kicker">Configure</h2>
          <p className="mb-5 mt-2 text-sm text-muted">Open the same tools used elsewhere in Settings — scoped to this module.</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {OPTION_CARDS.map(({ pane, title, description, Icon }) => (
              <button
                key={pane}
                type="button"
                onClick={() => onOpen(pane)}
                className="card card-hover group relative px-4 py-6 text-left"
              >
                <div className="mb-6 flex items-start justify-between">
                  <Icon className="size-10 text-accent" />
                  <IconArrowUpRight className="size-5 shrink-0 rotate-[20deg] text-accent opacity-90 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <h3 className="display mb-2 text-[26px] leading-tight text-ink">{title}</h3>
                <p className="text-sm leading-relaxed text-muted">{description}</p>
              </button>
            ))}
          </div>
        </section>
        <ModuleDetails module={selected} onDeleted={onDeleted} />
      </div>
    </main>
  );
}

function ModuleDetails({ module: selected, onDeleted }: { module: CrmModule; onDeleted: () => void }) {
  const { workspace, save } = useCrm();
  if (!workspace) return null;

  const patch = (p: Parameters<typeof updateModuleMeta>[2]) => save(updateModuleMeta(workspace, selected.id, p));

  return (
    <section className="card p-6">
      <h2 className="display text-2xl text-ink">Module details</h2>
      <p className="mt-1 text-sm text-muted">Name, rail icon, and listing label. Records of this module open from the left rail.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-medium text-muted">
          Label
          <input
            value={selected.label}
            onChange={(e) => patch({ label: e.target.value })}
            className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="block text-xs font-medium text-muted">
          Plural (rail + listing)
          <input
            value={selected.pluralLabel}
            onChange={(e) => patch({ pluralLabel: e.target.value })}
            className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="block text-xs font-medium text-muted sm:col-span-2">
          Description
          <textarea
            value={selected.description}
            onChange={(e) => patch({ description: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="block text-xs font-medium text-muted">
          Rail icon
          <select
            value={selected.icon}
            onChange={(e) => patch({ icon: e.target.value as CrmModuleIcon })}
            className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink"
          >
            {CRM_MODULE_ICONS.map((icon) => (
              <option key={icon} value={icon}>
                {icon}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              if (!confirm(`Delete ${selected.pluralLabel}? The rail icon and listing will disappear.`)) return;
              save(removeModule(workspace, selected.id));
              onDeleted();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-700"
          >
            <IconTrash className="size-3.5" />
            Delete module
          </button>
        </div>
      </div>
    </section>
  );
}

function CreateModuleDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (label: string, description: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-module-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-[24px] border border-border-soft bg-surface p-6 shadow-lg">
        <h2 id="create-module-title" className="text-lg font-semibold text-ink">
          Add module
        </h2>
        <p className="mt-1 text-sm text-muted">Creates a new object on the left rail. You can configure fields, form, blueprint, and overview next.</p>
        <label className="mt-5 block text-xs font-medium text-muted">
          Name
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreate(label, description);
              if (e.key === "Escape") onClose();
            }}
            placeholder="e.g. Properties"
            className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          Description (optional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What this object is used for"
            className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3.5 py-1.5 text-xs font-medium text-ink ring-1 ring-border-soft"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!label.trim()}
            onClick={() => onCreate(label, description)}
            className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            Create module
          </button>
        </div>
      </div>
    </div>
  );
}

function EmbeddedBlueprint({ module: mod }: { module: CrmModule }) {
  const { workspace, save } = useCrm();
  const [readyId, setReadyId] = useState<string | null>(null);

  useEffect(() => {
    ensureModuleBlueprint(mod);
    setReadyId(moduleBlueprintId(mod));
  }, [mod]);

  useEffect(() => {
    if (!workspace) return;
    const onChange = () => {
      const doc = loadBlueprintById(moduleBlueprintId(mod), mod.fields);
      if (!doc) return;
      const next = structuredClone(workspace);
      const target = findModule(next, mod.id);
      if (!target) return;
      target.blueprint = crmBlueprintFromDocument(doc);
      save(next);
    };
    window.addEventListener(BLUEPRINT_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(BLUEPRINT_CHANGED_EVENT, onChange);
  }, [mod.id, workspace, save]);

  if (!readyId) {
    return <div className="flex flex-1 items-center justify-center text-xs text-muted">Loading blueprint…</div>;
  }

  return (
    <BlueprintFieldsProvider
      fields={mod.fields}
      onPersistFields={(next) => {
        if (!workspace) return false;
        save(setModuleFields(workspace, mod.id, next));
        return true;
      }}
    >
      <BlueprintWorkspaceProvider>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex justify-end border-b border-border-soft bg-surface px-3 py-1.5">
            <BlueprintSaveToolbar />
          </div>
          <BlueprintConfiguratorShell blueprintId={readyId} />
        </div>
      </BlueprintWorkspaceProvider>
    </BlueprintFieldsProvider>
  );
}
