import { redirect } from "next/navigation";

export default async function BlueprintConfiguratorPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const { module } = await searchParams;
  const q = new URLSearchParams({ pane: "blueprint" });
  if (module) q.set("module", module);
  redirect(`/developer/lead-settings/modules-configurator?${q.toString()}`);
}
