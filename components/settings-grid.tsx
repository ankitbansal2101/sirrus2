import Link from "next/link";
import { IconArrowUpRight, IconChevronLeft } from "@/components/icons";
import { ProjectSelector } from "@/components/app-shell";
import {
  IconBlueprint,
  IconConnectors,
  IconFieldsConfigurator,
  IconLeadForm,
  IconManageLeads,
  IconReports,
  IconRules,
  IconWhatsapp,
  IconWorkflow,
} from "@/components/settings-card-icons";

type Card = {
  href: string;
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const cards: Card[] = [
  {
    href: "/developer/manage-leads",
    title: "Manage leads",
    description: "List leads from your field schema; change stage using blueprint transitions and transition forms",
    Icon: IconManageLeads,
  },
  {
    href: "/developer/lead-settings/customise-lead-form",
    title: "Customise Lead Form",
    description: "Tailor the form layout and required inputs for better lead qualification",
    Icon: IconLeadForm,
  },
  {
    href: "/developer/lead-routing-rule",
    title: "Rule Management",
    description: "Create, edit, and manage automation rules to streamline lead and workflow actions",
    Icon: IconRules,
  },
  {
    href: "/developer/reports",
    title: "Reports",
    description: "View and manage system-generated reports for better insights and tracking",
    Icon: IconReports,
  },
  {
    href: "/developer/lead-settings/customise-channel-partner-form",
    title: "Customise Channel Partner Form",
    description: "Tailor the form layout and required inputs for better Channel Partner qualification",
    Icon: IconLeadForm,
  },
  {
    href: "/developer/lead-settings/connectors?tab=ads_platforms",
    title: "Connectors",
    description: "Your bridge to seamless, secure integrations across platforms.",
    Icon: IconConnectors,
  },
  {
    href: "/martech/whatsapp",
    title: "Whatsapp Whitelisting Feature",
    description: "Add a new whitelisted template or view existing templates",
    Icon: IconWhatsapp,
  },
  {
    href: "/developer/lead-settings/blueprint-configurator",
    title: "Blueprint management",
    description: "Map stages and transitions: one form per move, plus automatic field values after",
    Icon: IconBlueprint,
  },
  {
    href: "/developer/lead-settings/workflow-management",
    title: "Workflow Management",
    description: "Configure and monitor lead workflows across your organization",
    Icon: IconWorkflow,
  },
  {
    href: "/developer/lead-settings/fields-configurator",
    title: "Fields Configurator",
    description: "Define field types, labels, and validation shared across lead and partner forms",
    Icon: IconFieldsConfigurator,
  },
];

export function SettingsGrid() {
  return (
    <main className="bg-canvas px-8 py-8">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-full border border-border-soft bg-white text-accent shadow-sm transition hover:shadow-md"
              aria-label="Go back"
            >
              <IconChevronLeft className="size-4" />
            </button>
            <h1 className="text-lg font-medium leading-none text-ink">Settings</h1>
          </div>
          <ProjectSelector />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ href, title, description, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group relative rounded-[24px] border border-border-soft bg-surface px-4 py-6 shadow-md transition hover:shadow-lg"
            >
              <div className="mb-6 flex items-start justify-between">
                <Icon className="size-10 text-accent" />
                <IconArrowUpRight className="size-5 shrink-0 rotate-[20deg] text-accent opacity-90 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <h2 className="mb-2 text-2xl font-semibold leading-tight text-ink">{title}</h2>
              <p className="text-sm leading-relaxed text-muted">{description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
