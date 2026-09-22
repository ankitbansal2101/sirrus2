import { displayFieldValue, fieldByApi, recordStageLabel, recordTitle } from "@/lib/crm/display";
import type { CrmModule, CrmRecord } from "@/lib/crm/types";

export type LeadAiSummaryStripInsight = {
  summaryBody: string;
  nextSteps: string;
  lastUpdatedLabel: string;
};

/** Sample copy from widgets-config-v2 (Kawal / Cirrus Eco Habitat). Used in the builder preview. */
export const DEMO_AI_SUMMARY_INSIGHT: LeadAiSummaryStripInsight = {
  summaryBody:
    "This is a new lead who expressed interest in Cirrus Eco Habitat's luxury project in the Banat area by filling out a form. This is the first interaction between the agent and the lead. The lead's response to the initial contact was unclear, with the lead asking for a moment to respond. Further information is needed to understand the lead's interest and requirements. The agent has placed a call to the lead for follow-up. The lead is still at the 'Contacted' stage. The latest call resulted in voicemail, indicating the lead was unavailable. No conversation data is available to provide further insights into the lead's current needs or sentiment. No changes in budget, urgency, or property requirements can be determined at this stage due to the lack of conversation data.",
  nextSteps:
    "Attempt to contact the lead again. If unsuccessful, try a different communication method (email, SMS).",
  lastUpdatedLabel: "15 Apr 2026, 06:27 PM",
};

function formatLastUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .replace(",", "");
}

export function insightForRecord(mod: CrmModule, rec: CrmRecord | null): LeadAiSummaryStripInsight | null {
  if (!rec) return null;
  const title = recordTitle(mod, rec);
  const stage = recordStageLabel(mod, rec);
  const highlights = mod.fields
    .slice(0, 8)
    .map((f) => {
      const v = displayFieldValue(f, rec.values[f.apiKey]);
      if (!v || v === "—") return null;
      return `${f.label} is ${v}`;
    })
    .filter((x): x is string => !!x)
    .slice(0, 4);
  const stageField = mod.stageFieldApiKey ? fieldByApi(mod, mod.stageFieldApiKey) : undefined;
  const stageBit = stage
    ? ` The ${mod.label.toLowerCase()} is still at the '${stage}' stage.`
    : stageField
      ? ` No stage is set yet.`
      : "";
  const extra = highlights.length ? ` ${highlights.join(". ")}.` : "";
  return {
    summaryBody: `This is a ${mod.label.toLowerCase()} named ${title}.${stageBit}${extra} Further information is needed to determine current needs or next actions.`,
    nextSteps: "Attempt to contact again. If unsuccessful, try a different communication method (email, SMS).",
    lastUpdatedLabel: formatLastUpdated(rec.updatedAt),
  };
}
