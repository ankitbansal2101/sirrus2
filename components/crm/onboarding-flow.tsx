"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SirrusMark } from "@/components/brand/sirrus-mark";
import { IconArrowUpRight, IconCheckCircle, IconSparkle } from "@/components/icons";
import { useCrm } from "@/components/crm/crm-provider";
import { createWorkspace } from "@/lib/crm/ops";
import { saveCrmWorkspace } from "@/lib/crm/storage";
import { INDUSTRY_TEMPLATES } from "@/lib/crm/templates";

export function OnboardingFlow() {
  const router = useRouter();
  const { workspace: existing } = useCrm();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [orgName, setOrgName] = useState("");
  const [industryId, setIndustryId] = useState("real_estate");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const industry = INDUSTRY_TEMPLATES.find((t) => t.id === industryId)!;
  const previewModules = useMemo(() => {
    try {
      return industry.build();
    } catch {
      return [];
    }
  }, [industry]);

  const toggleKey = (apiKey: string) => {
    setSelectedKeys((prev) => (prev.includes(apiKey) ? prev.filter((k) => k !== apiKey) : [...prev, apiKey]));
  };

  const goPreview = () => {
    const name = orgName.trim();
    if (!name) {
      setError("Give the workspace an organization name.");
      return;
    }
    setError(null);
    const built = industry.build();
    setSelectedKeys(built.map((m) => m.apiKey));
    setStep(3);
  };

  const finish = () => {
    try {
      const ws = createWorkspace({
        orgName: orgName.trim(),
        industryId,
        includeModuleApiKeys: industry.id === "blank" ? undefined : selectedKeys,
      });
      saveCrmWorkspace(ws);
      router.replace("/developer/lead-settings/modules-configurator");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create workspace.");
    }
  };

  return (
    <div className="page-canvas min-h-svh">
      <div className="mx-auto grid min-h-svh max-w-6xl lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="relative hidden overflow-hidden bg-rail px-10 py-12 text-rail-ink lg:flex lg:flex-col">
          <div className="absolute -right-16 top-16 size-72 rounded-full bg-gold/20 blur-3xl" />
          <div className="absolute -bottom-20 left-8 size-80 rounded-full bg-accent/25 blur-3xl" />
          <div className="relative flex items-center gap-2.5">
            <SirrusMark className="size-9" />
            <span className="font-display text-2xl tracking-tight">
              sirrus<span className="text-gold">.ai</span>
            </span>
          </div>
          <div className="relative mt-auto max-w-md pb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Industry-agnostic CRM</p>
            <h2 className="display mt-4 text-5xl leading-[1.05]">
              A workspace that already feels like the product.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-[#c9c0b0]">
              Name the org. Pick a starting industry. Ship modules, pipelines, and agents without waiting on a design file.
            </p>
          </div>
        </aside>

        <main className="flex flex-col px-6 py-10 sm:px-10">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <SirrusMark className="size-8" />
            <span className="font-display text-xl">sirrus.ai</span>
          </div>
          {existing ? (
            <p className="card mb-6 px-4 py-3 text-sm text-ink">
              A workspace already exists.{" "}
              <Link href="/developer/lead-settings/modules-configurator" className="font-semibold text-accent underline-offset-2 hover:underline">
                Continue to {existing.orgName}
              </Link>
            </p>
          ) : null}
          <p className="kicker">Workspace setup</p>
          <h1 className="display mt-2 text-4xl text-ink sm:text-5xl">Open a CRM for any industry</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
            Start from a template so you skip building objects one by one. Fields, forms, and blueprints stay in Settings.
          </p>

          <ol className="mt-8 flex flex-wrap gap-2">
            {[
              [1, "Organization"],
              [2, "Industry"],
              [3, "Modules"],
            ].map(([n, label]) => (
              <li
                key={String(n)}
                className={`chip ${step === n ? "bg-ink text-white" : "bg-white text-muted ring-1 ring-border-soft"}`}
              >
                {n as number}. {label as string}
              </li>
            ))}
          </ol>

          {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          {step === 1 ? (
            <section className="card mt-8 p-6 rise">
              <h2 className="display text-2xl text-ink">Organization</h2>
              <p className="mt-1 text-sm text-muted">Shown in the header. There is no tenant auth in this prototype.</p>
              <label className="mt-5 block text-xs font-medium text-muted">Organization name</label>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Horizon Developers"
                className="input mt-1.5"
              />
              <button
                type="button"
                onClick={() => {
                  if (!orgName.trim()) {
                    setError("Give the workspace an organization name.");
                    return;
                  }
                  setError(null);
                  setStep(2);
                }}
                className="btn-primary mt-6"
              >
                Continue
                <IconArrowUpRight className="size-4" />
              </button>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="mt-8 rise">
              <div className="grid gap-4 sm:grid-cols-2">
                {INDUSTRY_TEMPLATES.map((t) => {
                  const active = t.id === industryId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setIndustryId(t.id)}
                      className={`card p-5 text-left transition ${
                        active ? "ring-2 ring-accent/40" : "card-hover"
                      }`}
                    >
                      <p className="kicker">{t.tagline}</p>
                      <h3 className="display mt-2 text-2xl text-ink">{t.label}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{t.description}</p>
                      <ul className="mt-4 flex flex-wrap gap-1.5">
                        {t.moduleSummaries.map((m) => (
                          <li key={m.label} className="chip bg-[#f4efe6] text-accent">
                            {m.label}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex gap-2">
                <button type="button" onClick={() => setStep(1)} className="btn-ghost">
                  Back
                </button>
                <button type="button" onClick={goPreview} className="btn-primary">
                  Review modules
                </button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="card mt-8 p-6 rise">
              <h2 className="display text-2xl text-ink">
                {industry.id === "blank" ? "Start empty" : "Preconfigured modules"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {industry.id === "blank"
                  ? "Create modules next — or ask the configuration agent to scaffold them."
                  : "Uncheck anything you do not want. You can add more later."}
              </p>
              {industry.id !== "blank" ? (
                <ul className="mt-5 space-y-2">
                  {previewModules.map((m) => {
                    const on = selectedKeys.includes(m.apiKey);
                    return (
                      <li key={m.apiKey}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border-soft bg-white px-4 py-3">
                          <input type="checkbox" checked={on} onChange={() => toggleKey(m.apiKey)} className="mt-1 accent-[#0f6b5c]" />
                          <span>
                            <span className="block text-sm font-semibold text-ink">{m.pluralLabel}</span>
                            <span className="block text-xs text-muted">{m.description}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 flex items-center gap-2 rounded-2xl bg-[#f4efe6] px-4 py-3 text-sm text-accent">
                  <IconSparkle className="size-4" />
                  Blank workspace — create modules from the studio or the agent.
                </p>
              )}
              <div className="mt-6 flex gap-2">
                <button type="button" onClick={() => setStep(2)} className="btn-ghost">
                  Back
                </button>
                <button type="button" onClick={finish} className="btn-primary">
                  <IconCheckCircle className="size-4" />
                  Open workspace
                </button>
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
