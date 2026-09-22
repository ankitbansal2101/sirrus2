"use client";

import Link from "next/link";
import { useState } from "react";
import { IconArrowUpRight, IconPlus, IconSparkle, IconTable } from "@/components/icons";
import { CrmAgentPanel } from "@/components/crm/crm-agent-panel";
import { useCrm } from "@/components/crm/crm-provider";
import { clearCrmWorkspace } from "@/lib/crm/storage";

export function WorkspaceHome() {
  const { workspace } = useCrm();
  const [agentOpen, setAgentOpen] = useState(false);
  if (!workspace) return null;

  return (
    <main className="page-canvas relative min-h-0 flex-1 overflow-y-auto px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 rise">
          <div>
            <p className="kicker">Workspace</p>
            <h1 className="display mt-2 text-5xl text-ink">{workspace.orgName}</h1>
            <p className="mt-2 text-[15px] text-muted">
              {workspace.industryLabel} · {workspace.modules.length} module{workspace.modules.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setAgentOpen(true)} className="btn-ghost">
              <IconSparkle className="size-4" />
              Ask agent
            </button>
            <Link href="/crm/studio" className="btn-primary">
              <IconPlus className="size-4" />
              Configure modules
            </Link>
          </div>
        </div>

        {workspace.modules.length === 0 ? (
          <div className="card px-6 py-16 text-center">
            <IconTable className="mx-auto size-10 text-accent" />
            <h2 className="display mt-3 text-3xl text-ink">No modules yet</h2>
            <p className="mt-2 text-sm text-muted">Create a module in the studio, or ask the agent to scaffold the first objects.</p>
            <Link href="/crm/studio" className="btn-primary mt-5">
              Open module studio
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 rise-2">
            {workspace.modules.map((m) => (
              <Link key={m.id} href={`/crm/modules/${m.id}`} className="card card-hover group p-6">
                <div className="mb-6 flex items-start justify-between">
                  <span className="chip bg-[#f4efe6] text-accent">{m.apiKey}</span>
                  <IconArrowUpRight className="size-4 text-accent transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
                <h2 className="display text-[28px] text-ink">{m.pluralLabel}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{m.description}</p>
                <p className="mt-5 text-xs text-muted">
                  {m.records.length} records · {m.fields.length} fields · {m.blueprint.stages.length} stages
                </p>
              </Link>
            ))}
          </div>
        )}

        <p className="mt-12 text-center text-xs text-muted">
          Fields, create form, and blueprints stay in{" "}
          <Link href="/" className="text-accent underline-offset-2 hover:underline">
            Settings
          </Link>
          .{" "}
          <button
            type="button"
            className="text-accent underline-offset-2 hover:underline"
            onClick={() => {
              if (confirm("Reset this CRM workspace and return to onboarding?")) {
                clearCrmWorkspace();
                window.location.href = "/onboarding";
              }
            }}
          >
            Reset onboarding
          </button>
        </p>
      </div>
      <CrmAgentPanel open={agentOpen} onClose={() => setAgentOpen(false)} />
    </main>
  );
}
