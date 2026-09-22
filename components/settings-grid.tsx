"use client";

import Link from "next/link";
import { IconArrowUpRight } from "@/components/icons";
import { ProjectSelector } from "@/components/app-shell";
import { IconAgents, IconFieldsConfigurator, IconMarketplaceWidget, IconReports } from "@/components/settings-card-icons";
import { useCrm } from "@/components/crm/crm-provider";

const cards = [
  {
    href: "/developer/lead-settings/modules-configurator",
    title: "Modules",
    kicker: "Objects",
    description: "Define every object in this org — fields, forms, pipelines, and the record overview.",
    Icon: IconFieldsConfigurator,
  },
  {
    href: "/developer/lead-settings/agents",
    title: "Agents",
    kicker: "Intelligence",
    description: "On-call assistants and automations that fire when records are created or stages move.",
    Icon: IconAgents,
  },
  {
    href: "/crm/widgets",
    title: "Widgets",
    kicker: "Marketplace",
    description: "Design iframe widgets from live module data and host them anywhere.",
    Icon: IconMarketplaceWidget,
  },
  {
    href: "/crm/charts",
    title: "Charts",
    kicker: "Insight",
    description: "Ask for a bar, line, or pie from any module — dimensions, measures, time grains.",
    Icon: IconReports,
  },
] as const;

export function SettingsGrid() {
  const { workspace } = useCrm();
  const modules = workspace?.modules.length ?? 0;
  const records = workspace?.modules.reduce((n, m) => n + m.records.length, 0) ?? 0;
  const agents = workspace?.agents?.length ?? 0;

  return (
    <main className="page-canvas min-h-0 flex-1 overflow-y-auto px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4 rise">
          <div>
            <p className="kicker">Workspace</p>
            <h1 className="display mt-2 text-4xl text-ink sm:text-5xl">Settings</h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
              This is the metadata hub. Configure how the CRM captures work — then operate from the rail.
            </p>
          </div>
          <ProjectSelector />
        </div>
        <div className="grid grid-cols-3 gap-3 rise-2">
          {[
            [modules, "Modules"],
            [records, "Records"],
            [agents, "Agents"],
          ].map(([n, label]) => (
            <div key={String(label)} className="card px-5 py-4">
              <p className="display text-3xl text-ink">{n}</p>
              <p className="mt-1 text-[12px] text-muted">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 rise-3">
          {cards.map(({ href, title, kicker, description, Icon }) => (
            <Link key={href} href={href} className="card card-hover group p-6">
              <div className="mb-8 flex items-start justify-between">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-[#f4efe6] text-accent">
                  <Icon className="size-8" />
                </span>
                <span className="chip bg-[#f4efe6] text-muted">
                  {kicker}
                  <IconArrowUpRight className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </div>
              <h2 className="display text-[28px] text-ink">{title}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
