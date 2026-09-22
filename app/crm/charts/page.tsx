import { Suspense } from "react";
import { ChartStudio } from "@/components/charts/chart-studio";

export const metadata = {
  title: "Charts — sirus.ai",
  description: "Ask an agent to build charts from any module, field, dimension, and measure.",
};

export default function ChartsPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center text-xs text-muted">Loading charts…</div>}>
      <ChartStudio />
    </Suspense>
  );
}
