import { Suspense } from "react";
import { WidgetStudio } from "@/components/widget-studio/widget-studio";

export const metadata = {
  title: "Widgets — sirrus.ai",
  description: "Design iframe widgets with an AI agent and host them on other marketplaces.",
};

export default function CrmWidgetsPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center text-xs text-muted">Loading widgets…</div>}>
      <WidgetStudio />
    </Suspense>
  );
}
