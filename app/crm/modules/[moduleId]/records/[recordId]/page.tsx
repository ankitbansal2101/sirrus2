"use client";

import { useParams } from "next/navigation";
import { RecordOverview } from "@/components/crm/record-overview";

export default function RecordPage() {
  const params = useParams<{ moduleId: string; recordId: string }>();
  return <RecordOverview moduleId={String(params.moduleId ?? "")} recordId={String(params.recordId ?? "")} />;
}
