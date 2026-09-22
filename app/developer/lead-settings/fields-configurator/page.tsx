import { redirect } from "next/navigation";

export default async function FieldsConfiguratorPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const { module } = await searchParams;
  const q = new URLSearchParams({ pane: "fields" });
  if (module) q.set("module", module);
  redirect(`/developer/lead-settings/modules-configurator?${q.toString()}`);
}
