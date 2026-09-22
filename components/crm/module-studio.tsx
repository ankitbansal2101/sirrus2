"use client";

import Link from "next/link";
import { useState } from "react";
import { DeveloperPageHeader } from "@/components/developer/developer-page-header";
import { IconPlus, IconSparkle } from "@/components/icons";
import { CrmAgentPanel } from "@/components/crm/crm-agent-panel";
import { useCrm } from "@/components/crm/crm-provider";
import { addModule } from "@/lib/crm/ops";

export function ModuleStudio() {
  const { workspace, save } = useCrm();
  const [name, setName] = useState("");
  const [agentOpen, setAgentOpen] = useState(false);
  if (!workspace) return null;

  const create = () => {
    const label = name.trim();
    if (!label) return;
    const { workspace: next } = addModule(workspace, label);
    save(next);
    setName("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <DeveloperPageHeader
        backHref="/crm"
        title="Module studio"
        description="Create extra objects for the industry demo. Fields, create forms, and blueprints stay in Settings."
        actions={
          <button
            type="button"
            onClick={() => setAgentOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border-soft bg-white px-3 py-1.5 text-xs font-medium text-accent"
          >
            <IconSparkle className="size-3.5" />
            Agent
          </button>
        }
      />
      <div className="mx-auto w-full max-w-[1100px] px-4 py-6">
        <div className="rounded-[24px] border border-border-soft bg-surface p-4 shadow-sm">
          <p className="text-xs font-medium text-muted">Create a module</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
              }}
              placeholder="e.g. Partner, Ticket, Listing"
              className="min-w-[16rem] flex-1 rounded-xl border border-border-soft bg-white px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button type="button" onClick={create} className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white">
              <IconPlus className="size-4" />
              Create
            </button>
          </div>
        </div>

        <ul className="mt-5 space-y-3">
          {workspace.modules.map((m) => (
            <li key={m.id} className="rounded-[20px] border border-border-soft bg-surface px-5 py-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink">{m.pluralLabel}</h2>
                  <p className="text-sm text-muted">{m.description}</p>
                </div>
                <Link href={`/crm/modules/${m.id}`} className="rounded-xl bg-rail-inactive px-3 py-1.5 text-xs font-medium text-accent">
                  Open list
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Link href="/developer/lead-settings/fields-configurator" className="rounded-full border border-border-soft bg-white px-2.5 py-1 text-ink">
                  Fields
                </Link>
                <Link href="/developer/lead-settings/customise-lead-form" className="rounded-full border border-border-soft bg-white px-2.5 py-1 text-ink">
                  Create form
                </Link>
                <Link href="/developer/lead-settings/blueprint-configurator" className="rounded-full border border-border-soft bg-white px-2.5 py-1 text-ink">
                  Blueprint
                </Link>
                <Link href="/" className="rounded-full border border-border-soft bg-white px-2.5 py-1 text-ink">
                  All settings
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <CrmAgentPanel open={agentOpen} onClose={() => setAgentOpen(false)} />
    </div>
  );
}
