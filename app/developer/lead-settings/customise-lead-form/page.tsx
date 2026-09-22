import { redirect } from "next/navigation";

export default async function CustomiseLeadFormPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const { module } = await searchParams;
  const q = new URLSearchParams({ pane: "form" });
  if (module) q.set("module", module);
  redirect(`/developer/lead-settings/modules-configurator?${q.toString()}`);
}
