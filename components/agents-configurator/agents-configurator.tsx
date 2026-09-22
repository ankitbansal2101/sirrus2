"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CrmAgentPanel } from "@/components/crm/crm-agent-panel";
import { WorkflowBuilder, createBlankAutomation } from "@/components/agents-configurator/workflow-builder";
import { useCrm } from "@/components/crm/crm-provider";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { IconArrowUpRight, IconPlus, IconSparkle, IconTrash } from "@/components/icons";
import { IconWorkflow } from "@/components/settings-card-icons";
import { findInhouseAgent, fullToolRegistry, INHOUSE_AGENTS } from "@/lib/agent/catalog";
import { CUSTOM_AGENT_MODELS } from "@/lib/crm/custom-agent";
import { agentToolCatalog } from "@/lib/crm/agent/tools";
import {
  addAgent,
  agentsOf,
  blankWorkspace,
  findAgent,
  findWorkflow,
  removeAgent,
  updateAgent,
} from "@/lib/crm/ops";
import {
  allSlotDefs,
  getSlotAssignment,
  resolveSlotAgent,
  setSlotAssignment,
  slotsUsingAgent,
} from "@/lib/crm/agent-slots";
import { workflowsOf, triggerMeta } from "@/lib/crm/workflows";
import {
  CRM_AGENT_TOOL_CHOICES,
  CRM_AGENT_TOOL_USE_BEHAVIORS,
  type CrmAgentKind,
  type CrmAgentToolChoice,
  type CrmAgentToolUseBehavior,
  type CrmCustomAgent,
  type CrmWorkspace,
} from "@/lib/crm/types";

export function AgentsConfigurator() {
  const { workspace, save } = useCrm();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const agents = workspace ? agentsOf(workspace) : [];
  const selectedId = params.get("agent");
  const inhouseId = params.get("inhouse");
  const workflowId = params.get("workflow");
  const tab = params.get("tab") === "automations" || params.get("tab") === "library" ? params.get("tab") : "agents";
  const selected = workspace && selectedId ? findAgent(workspace, selectedId) : undefined;
  const inhouse = inhouseId ? findInhouseAgent(inhouseId) : undefined;
  const [createOpen, setCreateOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);

  const setQuery = (next: { agent?: string | null; inhouse?: string | null; workflow?: string | null; tab?: string | null }) => {
    const q = new URLSearchParams();
    const tabNext = next.tab === undefined ? tab : next.tab;
    if (tabNext && tabNext !== "agents") q.set("tab", tabNext);
    if (next.agent) q.set("agent", next.agent);
    if (next.inhouse) q.set("inhouse", next.inhouse);
    if (next.workflow) q.set("workflow", next.workflow);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const create = (name: string, instructions: string, kind: CrmAgentKind, extras?: { moduleId?: string; makeWorkflow?: boolean }) => {
    const base = workspace ?? blankWorkspace();
    const { workspace: withAgent, agent } = addAgent(base, name, instructions, kind);
    let next = withAgent;
    if (kind === "automation" && extras?.makeWorkflow && extras.moduleId) {
      next = createBlankAutomation(next, extras.moduleId, agent.id);
      const wf = workflowsOf(next).at(-1);
      save(next);
      setCreateOpen(false);
      setQuery({ tab: "automations", workflow: wf?.id ?? null });
      return;
    }
    save(next);
    setCreateOpen(false);
    setQuery({ agent: agent.id, tab: kind === "automation" ? "automations" : "agents" });
  };

  if (workspace && workflowId && findWorkflow(workspace, workflowId)) {
    return (
      <WorkflowBuilder
        workflowId={workflowId}
        backHref={`${pathname}?tab=automations`}
      />
    );
  }

  if (selected && workspace) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DeveloperPageHeader
          backHref={pathname}
          title={selected.name}
          description={selected.handoffDescription || "OpenAI Agent-style config: instructions, tools, and model settings."}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {publishNotice ? (
                <span className="max-w-[14rem] truncate text-[11px] font-medium text-accent sm:max-w-none">{publishNotice}</span>
              ) : null}
              <button
                type="button"
                onClick={() => setTestOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-white px-3.5 py-1.5 text-xs font-semibold text-ink"
              >
                Try in sandbox
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!workspace || !selected) return;
                  const screens = slotsUsingAgent(workspace, selected.id);
                  setPublishNotice(
                    screens.length
                      ? `Published on ${screens.length} screen${screens.length === 1 ? "" : "s"}. Open those pages and click Ask.`
                      : "Published. Assign screens below (or use each page’s Agent dropdown), then click Ask there.",
                  );
                  window.setTimeout(() => setPublishNotice(null), 8000);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                <IconSparkle className="size-3.5" />
                Publish agent
              </button>
            </div>
          }
        />
        <AgentEditor
          agent={selected}
          onSave={(patch) => save(updateAgent(workspace, selected.id, patch))}
          onDelete={() => {
            if (!confirm(`Delete ${selected.name}?`)) return;
            save(removeAgent(workspace, selected.id));
            setQuery({});
          }}
        />
        <CrmAgentPanel open={testOpen} onClose={() => setTestOpen(false)} mode="custom" customAgentId={selected.id} />
      </div>
    );
  }

  if (inhouse) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DeveloperPageHeader
          backHref={pathname}
          title={inhouse.name}
          description="Built-in agent. Tools and routing are fixed; attach a custom agent to replace it on listings or the rail."
        />
        <InhouseDetail agent={inhouse} workspace={workspace} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DeveloperPageHeader
        backHref="/"
        title="Agents"
        description="On-call chat agents, plus automations that run an agent when a record is created, a stage changes, or a call/chat is simulated."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-110"
          >
            <IconPlus className="size-3.5" />
            Add agent
          </button>
        }
      />
      <AgentsHome
        customAgents={agents}
        workspace={workspace}
        tab={tab === "automations" || tab === "library" ? tab : "agents"}
        onTab={(next) => setQuery({ tab: next, agent: null, inhouse: null, workflow: null })}
        onOpenCustom={(id) => setQuery({ agent: id })}
        onOpenInhouse={(id) => setQuery({ inhouse: id, tab: "library" })}
        onOpenWorkflow={(id) => setQuery({ tab: "automations", workflow: id })}
        onAdd={() => setCreateOpen(true)}
        onAddWorkflow={() => {
          const base = workspace ?? blankWorkspace();
          const first = base.modules[0];
          if (!first) return;
          const next = createBlankAutomation(base, first.id);
          const wf = workflowsOf(next).at(-1);
          save(next);
          if (wf) setQuery({ tab: "automations", workflow: wf.id });
        }}
      />
      {createOpen ? (
        <CreateAgentDialog
          modules={workspace?.modules ?? []}
          onClose={() => setCreateOpen(false)}
          onCreate={create}
        />
      ) : null}
    </div>
  );
}

function AgentsHome({
  customAgents,
  workspace,
  tab,
  onTab,
  onOpenCustom,
  onOpenInhouse,
  onOpenWorkflow,
  onAdd,
  onAddWorkflow,
}: {
  customAgents: CrmCustomAgent[];
  workspace: CrmWorkspace | null;
  tab: string;
  onTab: (tab: string) => void;
  onOpenCustom: (id: string) => void;
  onOpenInhouse: (id: string) => void;
  onOpenWorkflow: (id: string) => void;
  onAdd: () => void;
  onAddWorkflow: () => void;
}) {
  const registry = useMemo(() => fullToolRegistry(), []);
  const customById = useMemo(() => new Map(customAgents.map((a) => [a.id, a])), [customAgents]);
  const workspaceOverride = workspace?.workspaceAgentId ? customById.get(workspace.workspaceAgentId) : undefined;
  const onCall = customAgents.filter((a) => (a.kind ?? "on_call") !== "automation");
  const automationAgents = customAgents.filter((a) => a.kind === "automation");
  const workflows = workspace ? workflowsOf(workspace) : [];

  return (
    <main className="page-canvas min-h-0 flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-[1200px] space-y-10">
        <div className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-border-soft w-fit">
          {[
            { id: "agents", label: "On-call" },
            { id: "automations", label: "Automations" },
            { id: "library", label: "Library" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                tab === t.id ? "bg-accent text-white" : "text-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "agents" ? (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">On-call agents</h2>
          <p className="mt-1 mb-5 text-sm text-muted">
            People chat with these. Open an agent and choose which screens it runs on, or pick the agent from any screen’s Agent dropdown.
          </p>
          {onCall.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-border-soft bg-surface px-8 py-10 text-center">
              <p className="text-sm font-medium text-ink">No on-call agents yet</p>
              <button
                type="button"
                onClick={onAdd}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
              >
                <IconPlus className="size-4" />
                Add agent
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {onCall.map((a) => (
                <AgentCard key={a.id} agent={a} onOpen={() => onOpenCustom(a.id)} />
              ))}
              <AddCard onAdd={onAdd} label="Add on-call agent" />
            </div>
          )}
        </section>
        ) : null}

        {tab === "automations" ? (
          <>
            <section>
              <div className="mb-5 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Workflows</h2>
                  <p className="mt-1 text-sm text-muted">
                    When a trigger fires, run an agent, then change stage or update fields. Same idea as HubSpot workflows / Monday automations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onAddWorkflow}
                  disabled={!workspace?.modules.length}
                  className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  <IconPlus className="size-3.5" />
                  New automation
                </button>
              </div>
              {workflows.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-border-soft bg-surface px-8 py-10 text-center">
                  <p className="text-sm font-medium text-ink">No automations yet</p>
                  <p className="mt-1 text-sm text-muted">Example: Lead created → run qualifier agent → change stage.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {workflows.map((wf) => {
                    const mod = workspace?.modules.find((m) => m.id === wf.moduleId);
                    const trig = triggerMeta(wf.triggerType);
                    return (
                      <button
                        key={wf.id}
                        type="button"
                        onClick={() => onOpenWorkflow(wf.id)}
                        className="group flex flex-col card card-hover p-5 text-left"
                      >
                        <div className="mb-4 flex items-start justify-between">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${wf.enabled ? "bg-accent/10 text-accent" : "bg-rail-inactive text-muted"}`}>
                            {wf.enabled ? "On" : "Off"}
                          </span>
                          <IconArrowUpRight className="size-5 shrink-0 rotate-[20deg] text-accent opacity-80" />
                        </div>
                        <h3 className="text-xl font-semibold leading-tight text-ink">{wf.name}</h3>
                        <p className="mt-2 text-sm text-muted">
                          When {trig?.label.toLowerCase()} on {mod?.pluralLabel ?? "module"}
                        </p>
                        <p className="mt-3 text-[11px] text-muted">
                          {wf.steps.length} step{wf.steps.length === 1 ? "" : "s"}
                          {wf.runs[0] ? ` · last run ${new Date(wf.runs[0].at).toLocaleString()}` : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Automation agents</h2>
              <p className="mt-1 mb-5 text-sm text-muted">Background agents wired into workflows. They are not shown as chat panels.</p>
              {automationAgents.length === 0 ? (
                <p className="text-sm text-muted">Create an agent and set its kind to Automation, or add one from Add agent.</p>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {automationAgents.map((a) => (
                    <AgentCard key={a.id} agent={a} onOpen={() => onOpenCustom(a.id)} />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}

        {tab === "library" ? (
        <>
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">In-house agents</h2>
          <p className="mt-1 mb-5 text-sm text-muted">Shipped with the product. Open one to see where it runs and which tools it uses.</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {INHOUSE_AGENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpenInhouse(a.id)}
                className="group flex flex-col card card-hover p-5 text-left"
              >
                <div className="mb-4 flex items-start justify-between">
                  <span className="rounded-full bg-rail-inactive px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    Built-in
                  </span>
                  <IconArrowUpRight className="size-5 shrink-0 rotate-[20deg] text-accent opacity-80 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <h3 className="text-xl font-semibold leading-tight text-ink">{a.name}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{a.description}</p>
                <p className="mt-4 text-[11px] text-muted">
                  {a.tools.length} tool{a.tools.length === 1 ? "" : "s"}
                  {a.id === "workspace" && workspaceOverride ? ` · overridden by ${workspaceOverride.name}` : ""}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Tools registry</h2>
          <p className="mt-1 mb-5 text-sm text-muted">Every function tool registered for in-house agents, custom agents, and MCP.</p>
          <div className="space-y-4">
            {registry.map((group) => (
              <div key={group.group} className="overflow-hidden rounded-[24px] border border-border-soft bg-surface shadow-md">
                <div className="border-b border-border-soft px-5 py-3">
                  <h3 className="text-sm font-semibold text-ink">{group.group}</h3>
                  <p className="text-[11px] text-muted">{group.tools.length} tool{group.tools.length === 1 ? "" : "s"}</p>
                </div>
                <ul className="divide-y divide-border-soft">
                  {group.tools.map((t) => (
                    <li key={`${group.group}-${t.name}`} className="px-5 py-3">
                      <p className="font-mono text-[13px] font-semibold text-ink">{t.name}</p>
                      <p className="mt-1 text-[13px] leading-snug text-muted">{t.description}</p>
                      <p className="mt-2 text-[11px] text-muted">
                        {t.sources.join(" · ")}
                        {t.usedBy.length ? ` · used by ${t.usedBy.join(", ")}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        </>
        ) : null}
      </div>
    </main>
  );
}

function AgentCard({ agent, onOpen }: { agent: CrmCustomAgent; onOpen: () => void }) {
  const { workspace } = useCrm();
  const kind = agent.kind ?? "on_call";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col card card-hover p-5 text-left"
    >
      <div className="mb-4 flex items-start justify-between">
        <span className="flex size-10 items-center justify-center rounded-xl bg-rail-inactive text-accent">
          {kind === "automation" ? <IconWorkflow className="size-5" /> : <IconSparkle className="size-5" />}
        </span>
        <IconArrowUpRight className="size-5 shrink-0 rotate-[20deg] text-accent opacity-80 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        {kind === "automation" ? "Automation" : "On-call"}
      </p>
      <h3 className="mt-1 text-xl font-semibold leading-tight text-ink">{agent.name}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
        {agent.handoffDescription || agent.instructions || "No instructions yet"}
      </p>
      <p className="mt-4 text-[11px] text-muted">
        {agent.tools.length} tool{agent.tools.length === 1 ? "" : "s"}
        {agent.model ? ` · ${agent.model}` : " · default model"}
        {workspace && (agent.kind ?? "on_call") === "on_call"
          ? ` · ${slotsUsingAgent(workspace, agent.id).length} screen${slotsUsingAgent(workspace, agent.id).length === 1 ? "" : "s"}`
          : ""}
      </p>
    </button>
  );
}

function AddCard({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border-soft bg-surface/70 px-6 py-10 text-center transition hover:border-accent/40 hover:bg-surface"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-rail-inactive text-accent">
        <IconPlus className="size-5" />
      </span>
      <span className="mt-3 text-base font-semibold text-ink">{label}</span>
    </button>
  );
}

function InhouseDetail({
  agent,
  workspace,
}: {
  agent: (typeof INHOUSE_AGENTS)[number];
  workspace: CrmWorkspace | null;
}) {
  const customName = (id: string | null | undefined) =>
    id && workspace ? agentsOf(workspace).find((a) => a.id === id)?.name : undefined;
  const listingOverrides =
    agent.id === "module-records" && workspace
      ? workspace.modules.filter((m) => m.listingAgentId).map((m) => `${m.pluralLabel} → ${customName(m.listingAgentId)}`)
      : [];
  const workspaceOverride = agent.id === "workspace" ? customName(workspace?.workspaceAgentId) : undefined;

  return (
    <main className="page-canvas min-h-0 flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-[800px] space-y-6">
        <section className="rounded-[24px] border border-border-soft bg-surface p-6 shadow-md">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">Built-in</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">{agent.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{agent.description}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-xs font-medium text-muted">Where it runs</dt>
              <dd className="text-ink">{agent.usedAt}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">API</dt>
              <dd className="font-mono text-[13px] text-ink">{agent.api}</dd>
            </div>
          </dl>
          {workspaceOverride ? (
            <p className="mt-4 rounded-xl bg-rail-inactive px-3 py-2 text-sm text-ink">
              Currently replaced on the rail by <span className="font-semibold">{workspaceOverride}</span>.
            </p>
          ) : null}
          {listingOverrides.length > 0 ? (
            <p className="mt-4 rounded-xl bg-rail-inactive px-3 py-2 text-sm text-ink">
              Replaced on: {listingOverrides.join("; ")}.
            </p>
          ) : null}
        </section>
        <section className="rounded-[24px] border border-border-soft bg-surface p-6 shadow-md">
          <h2 className="text-base font-semibold text-ink">Tools</h2>
          <p className="mt-1 text-sm text-muted">This agent may call these registered functions. They cannot be edited here.</p>
          <ul className="mt-4 space-y-2">
            {agent.tools.map((name) => (
              <li key={name} className="rounded-xl border border-border-soft bg-white px-3 py-2 font-mono text-[13px] text-ink">
                {name}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

const PLACEMENT_GROUPS = ["Workspace", "Module operations", "Module studio", "Studios"] as const;

function AgentScreenPlacements({
  workspace,
  agentId,
  save,
}: {
  workspace: CrmWorkspace;
  agentId: string;
  save: (next: CrmWorkspace) => void;
}) {
  const slots = allSlotDefs(workspace);
  return (
    <div className="mt-6 space-y-5">
      <p className="text-sm text-muted">
        Choose where this agent is live after you click <strong className="font-semibold text-ink">Publish agent</strong> above. You can
        also switch agents from the Agent dropdown on each page.
      </p>
      {PLACEMENT_GROUPS.map((group) => {
        const inGroup = slots.filter((s) => s.group === group);
        if (!inGroup.length) return null;
        return (
          <div key={group}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{group}</p>
            <ul className="mt-2 max-h-52 space-y-1.5 overflow-y-auto pr-1">
              {inGroup.map((slot) => {
                const assigned = getSlotAssignment(workspace, slot.key);
                const checked = assigned === agentId;
                const { defaultInhouseName } = resolveSlotAgent(workspace, slot.key);
                return (
                  <li key={slot.key}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-soft bg-white px-3 py-2.5 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) save(setSlotAssignment(workspace, slot.key, agentId));
                          else if (assigned === agentId) save(setSlotAssignment(workspace, slot.key, null));
                        }}
                      />
                      <span className="min-w-0">
                        <span className="font-medium text-ink">{slot.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                          {slot.hint} · Default: {defaultInhouseName}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function AgentEditor({
  agent,
  onSave,
  onDelete,
}: {
  agent: CrmCustomAgent;
  onSave: (patch: Partial<CrmCustomAgent>) => void;
  onDelete: () => void;
}) {
  const { workspace, save } = useCrm();
  const catalog = useMemo(() => agentToolCatalog(), []);
  if (!workspace) return null;
  const otherAgents = agentsOf(workspace).filter((a) => a.id !== agent.id);

  return (
    <main className="page-canvas min-h-0 flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-[800px] space-y-6">
        <section className="rounded-[24px] border border-border-soft bg-surface p-6 shadow-md">
          <h2 className="text-base font-semibold text-ink">Agent</h2>
          <p className="mt-1 text-sm text-muted">Maps to <code className="text-[12px]">new Agent({"{ name, instructions }"})</code> in the OpenAI Agents SDK.</p>
          <label className="mt-5 block text-xs font-medium text-muted">
            name
            <input
              value={agent.name}
              onChange={(e) => onSave({ name: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-muted">
            instructions
            <textarea
              value={agent.instructions}
              onChange={(e) => onSave({ instructions: e.target.value })}
              rows={8}
              placeholder="System prompt: who this agent is and how it should respond."
              className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-muted">
            handoffDescription
            <input
              value={agent.handoffDescription}
              onChange={(e) => onSave({ handoffDescription: e.target.value })}
              placeholder="Short description used when this agent is a handoff target"
              className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink"
            />
          </label>
        </section>

        <section className="rounded-[24px] border border-border-soft bg-surface p-6 shadow-md">
          <h2 className="text-base font-semibold text-ink">model</h2>
          <p className="mt-1 text-sm text-muted">Leave default to use the server OPENAI_MODEL.</p>
          <select
            value={agent.model}
            onChange={(e) => onSave({ model: e.target.value })}
            className="mt-4 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink"
          >
            {CUSTOM_AGENT_MODELS.map((m) => (
              <option key={m.id || "default"} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </section>

        <section className="rounded-[24px] border border-border-soft bg-surface p-6 shadow-md">
          <h2 className="text-base font-semibold text-ink">tools</h2>
          <p className="mt-1 text-sm text-muted">Function tools this agent may call. Uncheck all for a chat-only agent.</p>
          <div className="mt-4 space-y-5">
            {catalog.map((group) => (
              <div key={group.id}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{group.label}</p>
                <ul className="space-y-2">
                  {group.tools.map((t) => {
                    const on = agent.tools.includes(t.name);
                    return (
                      <li key={t.name}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-soft bg-white px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => {
                              const next = on ? agent.tools.filter((n) => n !== t.name) : [...agent.tools, t.name];
                              onSave({ tools: next });
                            }}
                            className="mt-1"
                          />
                          <span>
                            <span className="block font-mono text-[13px] font-semibold text-ink">{t.name}</span>
                            <span className="block text-[12px] leading-snug text-muted">{t.description}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-border-soft bg-surface p-6 shadow-md">
          <h2 className="text-base font-semibold text-ink">modelSettings</h2>
          <p className="mt-1 text-sm text-muted">temperature, top_p, max tokens, and toolChoice. Empty means the model default.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <NumField
              label="temperature"
              value={agent.modelSettings.temperature}
              onChange={(temperature) => onSave({ modelSettings: { ...agent.modelSettings, temperature } })}
              min={0}
              max={2}
              step={0.1}
            />
            <NumField
              label="topP"
              value={agent.modelSettings.topP}
              onChange={(topP) => onSave({ modelSettings: { ...agent.modelSettings, topP } })}
              min={0}
              max={1}
              step={0.05}
            />
            <NumField
              label="maxTokens"
              value={agent.modelSettings.maxTokens}
              onChange={(maxTokens) => onSave({ modelSettings: { ...agent.modelSettings, maxTokens } })}
              min={16}
              max={8192}
              step={16}
              integer
            />
            <label className="block text-xs font-medium text-muted">
              toolChoice
              <select
                value={agent.modelSettings.toolChoice}
                onChange={(e) =>
                  onSave({ modelSettings: { ...agent.modelSettings, toolChoice: e.target.value as CrmAgentToolChoice } })
                }
                className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink"
              >
                {CRM_AGENT_TOOL_CHOICES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={agent.resetToolChoice}
              onChange={(e) => onSave({ resetToolChoice: e.target.checked })}
            />
            resetToolChoice (back to auto after the first tool call)
          </label>
          <label className="mt-3 block text-xs font-medium text-muted">
            toolUseBehavior
            <select
              value={agent.toolUseBehavior}
              onChange={(e) => onSave({ toolUseBehavior: e.target.value as CrmAgentToolUseBehavior })}
              className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink"
            >
              {CRM_AGENT_TOOL_USE_BEHAVIORS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        </section>

        {otherAgents.length > 0 ? (
          <section className="rounded-[24px] border border-border-soft bg-surface p-6 shadow-md">
            <h2 className="text-base font-semibold text-ink">handoffs</h2>
            <p className="mt-1 text-sm text-muted">Other agents this one may name as specialists. Stored on the agent; runtime still uses this agent’s instructions and tools.</p>
            <ul className="mt-4 space-y-2">
              {otherAgents.map((a) => {
                const on = agent.handoffAgentIds.includes(a.id);
                return (
                  <li key={a.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border-soft bg-white px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => {
                          const next = on ? agent.handoffAgentIds.filter((id) => id !== a.id) : [...agent.handoffAgentIds, a.id];
                          onSave({ handoffAgentIds: next });
                        }}
                      />
                      <span className="font-medium text-ink">{a.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="rounded-[24px] border border-border-soft bg-surface p-6 shadow-md">
          <h2 className="text-base font-semibold text-ink">Agent type</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(
              [
                ["on_call", "On-call (chat)", "People talk to it on CRM screens."],
                ["automation", "Automation", "Runs from workflows — not a chat panel."],
              ] as const
            ).map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                onClick={() => onSave({ kind: id })}
                className={`rounded-2xl border px-3 py-3 text-left ${
                  (agent.kind ?? "on_call") === id ? "border-accent bg-accent/5" : "border-border-soft bg-white"
                }`}
              >
                <p className="text-sm font-semibold text-ink">{label}</p>
                <p className="mt-1 text-[12px] text-muted">{hint}</p>
              </button>
            ))}
          </div>
          {(agent.kind ?? "on_call") === "on_call" ? (
            <AgentScreenPlacements workspace={workspace} agentId={agent.id} save={save} />
          ) : (
            <p className="mt-4 text-sm text-muted">
              Open the Automations tab and add a “Run agent” step that points at this agent. Example: When lead created → run this agent → change stage.
            </p>
          )}
        </section>

        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-700"
        >
          <IconTrash className="size-3.5" />
          Delete agent
        </button>
      </div>
    </main>
  );
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  integer,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  min: number;
  max: number;
  step: number;
  integer?: boolean;
}) {
  return (
    <label className="block text-xs font-medium text-muted">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        placeholder="default"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          const n = integer ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
          onChange(Number.isFinite(n) ? n : null);
        }}
        className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink"
      />
    </label>
  );
}

function CreateAgentDialog({
  modules,
  onClose,
  onCreate,
}: {
  modules: { id: string; pluralLabel: string }[];
  onClose: () => void;
  onCreate: (name: string, instructions: string, kind: CrmAgentKind, extras?: { moduleId?: string; makeWorkflow?: boolean }) => void;
}) {
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [kind, setKind] = useState<CrmAgentKind>("on_call");
  const [makeWorkflow, setMakeWorkflow] = useState(true);
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-agent-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[24px] border border-border-soft bg-surface p-6 shadow-lg">
        <h2 id="create-agent-title" className="text-lg font-semibold text-ink">
          Add agent
        </h2>
        <p className="mt-1 text-sm text-muted">Name and instructions first. Then choose whether people chat with it, or a workflow runs it.</p>
        <label className="mt-5 block text-xs font-medium text-muted">
          name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
            placeholder="e.g. Lead qualifier"
            className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-muted">
          instructions
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={5}
            placeholder="You qualify inbound records. Query the record, then update stage if it looks ready."
            className="mt-1 w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
        <p className="mt-4 text-xs font-medium text-muted">Where should this agent live?</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setKind("on_call")}
            className={`rounded-2xl border px-3 py-3 text-left ${kind === "on_call" ? "border-accent bg-accent/5" : "border-border-soft bg-white"}`}
          >
            <p className="text-sm font-semibold text-ink">On-call</p>
            <p className="mt-1 text-[12px] text-muted">Chat on listings, record pages, or the workspace rail.</p>
          </button>
          <button
            type="button"
            onClick={() => setKind("automation")}
            className={`rounded-2xl border px-3 py-3 text-left ${kind === "automation" ? "border-accent bg-accent/5" : "border-border-soft bg-white"}`}
          >
            <p className="text-sm font-semibold text-ink">Automation</p>
            <p className="mt-1 text-[12px] text-muted">Runs when a record is created, stage changes, or a call is simulated.</p>
          </button>
        </div>
        {kind === "automation" && modules.length > 0 ? (
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={makeWorkflow} onChange={(e) => setMakeWorkflow(e.target.checked)} />
              Also create a workflow (record created → run this agent)
            </label>
            {makeWorkflow ? (
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                className="w-full rounded-xl border border-border-soft bg-white px-3 py-2 text-sm"
              >
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.pluralLabel}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-3.5 py-1.5 text-xs font-medium text-ink ring-1 ring-border-soft">
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim() || !instructions.trim()}
            onClick={() => onCreate(name, instructions, kind, { moduleId, makeWorkflow: kind === "automation" && makeWorkflow })}
            className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            Create agent
          </button>
        </div>
      </div>
    </div>
  );
}
