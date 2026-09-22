"use client";

import { useParams } from "next/navigation";
import { RecordList } from "@/components/crm/record-list";

export default function ModuleListPage() {
  const params = useParams<{ moduleId: string }>();
  return <RecordList moduleId={String(params.moduleId ?? "")} />;
}
