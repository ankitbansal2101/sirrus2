import { buildModule, crmField, picklist, record } from "@/lib/crm/module-factory";
import { emptyCustomAgent } from "@/lib/crm/custom-agent";
import type { CrmModule, CrmWorkspace } from "@/lib/crm/types";

const people = [
  ["Priya Sharma", "priya.sharma@example.com", "Whitefield", "2 BHK", "Site visit", "Website", "Arjun", "9200000", "High"],
  ["Rahul Mehta", "rahul.mehta@example.com", "Sarjapur Road", "3 BHK", "Negotiation", "Referral", "Neha", "14500000", "High"],
  ["Ananya Rao", "ananya.rao@example.com", "HSR Layout", "2 BHK", "Qualified", "Property portal", "Arjun", "9800000", "Medium"],
  ["Karan Iyer", "karan.iyer@example.com", "Devanahalli", "Villa", "New", "Website", "Neha", "22000000", "Medium"],
  ["Meera Nair", "meera.nair@example.com", "Hebbal", "3 BHK", "Follow-up", "Walk-in", "Rohit", "16500000", "Medium"],
  ["Vikram Joshi", "vikram.joshi@example.com", "Electronic City", "2 BHK", "Contacted", "Campaign", "Arjun", "7800000", "Low"],
  ["Sana Kapoor", "sana.kapoor@example.com", "Whitefield", "3 BHK", "Site visit", "Referral", "Rohit", "13200000", "High"],
  ["Aditya Menon", "aditya.menon@example.com", "Indiranagar", "2 BHK", "Qualified", "Property portal", "Neha", "11800000", "Medium"],
  ["Ishita Das", "ishita.das@example.com", "Sarjapur Road", "2 BHK", "New", "Website", "Rohit", "9000000", "Low"],
  ["Dev Malhotra", "dev.malhotra@example.com", "Hebbal", "Penthouse", "Negotiation", "Referral", "Arjun", "28500000", "High"],
  ["Nisha Reddy", "nisha.reddy@example.com", "Whitefield", "2 BHK", "Contacted", "Campaign", "Neha", "8800000", "Medium"],
  ["Kabir Bhatia", "kabir.bhatia@example.com", "Yelahanka", "Villa", "Qualified", "Walk-in", "Rohit", "19800000", "Medium"],
  ["Aisha Thomas", "aisha.thomas@example.com", "HSR Layout", "3 BHK", "Site visit", "Property portal", "Arjun", "15200000", "High"],
  ["Rohan Kulkarni", "rohan.k@example.com", "Electronic City", "2 BHK", "New", "Website", "Neha", "7600000", "Low"],
  ["Tara Sethi", "tara.sethi@example.com", "Indiranagar", "3 BHK", "Follow-up", "Referral", "Rohit", "17500000", "Medium"],
  ["Arjun Pillai", "arjun.pillai@example.com", "Devanahalli", "Villa", "Negotiation", "Walk-in", "Arjun", "24000000", "High"],
  ["Zoya Khan", "zoya.khan@example.com", "Whitefield", "1 BHK", "Contacted", "Campaign", "Neha", "6400000", "Medium"],
  ["Neil Fernandes", "neil.f@example.com", "Hebbal", "2 BHK", "Qualified", "Website", "Rohit", "10400000", "Medium"],
  ["Rhea Banerjee", "rhea.b@example.com", "Sarjapur Road", "3 BHK", "New", "Property portal", "Arjun", "14900000", "Low"],
  ["Sameer Chawla", "sameer.c@example.com", "HSR Layout", "2 BHK", "Site visit", "Referral", "Neha", "9600000", "High"],
  ["Diya Krishnan", "diya.k@example.com", "Yelahanka", "2 BHK", "Contacted", "Website", "Rohit", "8100000", "Medium"],
  ["Manav Suri", "manav.suri@example.com", "Indiranagar", "Penthouse", "Qualified", "Walk-in", "Arjun", "31000000", "High"],
  ["Pooja Shetty", "pooja.s@example.com", "Electronic City", "2 BHK", "Follow-up", "Property portal", "Neha", "7300000", "Medium"],
  ["Aarav Khanna", "aarav.k@example.com", "Whitefield", "3 BHK", "New", "Campaign", "Rohit", "12800000", "Low"],
  ["Simran Gill", "simran.g@example.com", "Hebbal", "2 BHK", "Negotiation", "Referral", "Arjun", "11200000", "High"],
  ["Veer Shah", "veer.shah@example.com", "Sarjapur Road", "Villa", "Site visit", "Website", "Neha", "20500000", "High"],
  ["Lavanya Rao", "lavanya.rao@example.com", "HSR Layout", "2 BHK", "Qualified", "Walk-in", "Rohit", "9900000", "Medium"],
  ["Omkar Patil", "omkar.p@example.com", "Devanahalli", "Villa", "Contacted", "Property portal", "Arjun", "21800000", "Medium"],
  ["Mira George", "mira.george@example.com", "Indiranagar", "3 BHK", "New", "Campaign", "Neha", "16800000", "Low"],
  ["Yash Agarwal", "yash.a@example.com", "Whitefield", "2 BHK", "Follow-up", "Referral", "Rohit", "9300000", "Medium"],
];

function makeLeadModule(): CrmModule {
  const stage = picklist("Stage", "stage", ["New", "Contacted", "Qualified", "Site visit", "Negotiation", "Follow-up", "Booked", "Lost"], true);
  const source = picklist("Lead source", "source", ["Website", "Property portal", "Referral", "Walk-in", "Campaign"]);
  const intent = picklist("Buying intent", "intent", ["High", "Medium", "Low"]);
  const channel = picklist("Preferred channel", "preferred_channel", ["Call", "WhatsApp", "Email"]);
  const visit = picklist("Visit outcome", "visit_outcome", ["Interested", "Needs family discussion", "Price concern", "No show", "Not visited"]);
  const budgetBand = picklist("Budget range", "budget_range", ["Under ₹80L", "₹80L–₹1.2Cr", "₹1.2Cr–₹2Cr", "Above ₹2Cr"]);
  const fields = [
    crmField("text", "Full name", "name", { required: true, isSystem: true, locked: true }), stage, source,
    crmField("email", "Email", "email", { required: true }), crmField("phone", "Phone", "phone"),
    crmField("text", "Assigned owner", "owner"), crmField("text", "Preferred location", "preferred_location"),
    picklist("Unit type", "unit_type", ["1 BHK", "2 BHK", "3 BHK", "Villa", "Penthouse"]),
    crmField("number", "Budget (₹)", "budget"), budgetBand, intent, channel, visit,
    picklist("Financing", "financing", ["Pre-approved", "Loan needed", "Self-funded", "Undecided"]),
    crmField("date_time", "Last contacted", "last_contacted"), crmField("date_time", "Next follow-up", "next_follow_up"),
    crmField("paragraph", "Latest interaction", "interaction_summary"),
    crmField("number", "Call attempts", "call_attempts"),
    picklist("Last call outcome", "last_call_outcome", ["Connected", "No answer", "Callback requested", "Site visit discussed", "Not called"]),
    crmField("paragraph", "Recent call notes", "call_history"),
    crmField("number", "WhatsApp messages", "whatsapp_message_count"),
    picklist("WhatsApp response", "whatsapp_response", ["Replied positively", "Asked a question", "Seen, no reply", "Not seen", "No WhatsApp sent"]),
    crmField("paragraph", "Recent WhatsApp conversation", "whatsapp_history"),
    picklist("Email engagement", "email_engagement", ["Opened and clicked", "Opened", "No open", "Not sent"]),
    picklist("Buying blocker", "buying_blocker", ["Price", "Location", "Family decision", "Financing", "Timing", "No blocker shared"]),
    crmField("paragraph", "Customer preferences", "preferences"),
    crmField("paragraph", "AI/evidence notes", "evidence_notes"),
  ];
  const option = (field: typeof stage, label: string) => field.options.find((o) => o.label === label)?.id ?? "";
  const stageByName = new Map(stage.options.map((o) => [o.label, o.id]));
  const created = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();
  const leads = people.map((p, i) => {
    const [name, email, area, unit, status, origin, owner, budget, interest] = p;
    const age = (i * 3) % 18;
    const followup = i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2;
    const outcome = status === "Site visit" ? (i % 2 ? "Interested" : "Needs family discussion") : "Not visited";
    const channelLabel = i % 3 === 0 ? "Call" : i % 3 === 1 ? "WhatsApp" : "Email";
    const budgetNum = Number(budget);
    const budgetRange = budgetNum < 8000000 ? "Under ₹80L" : budgetNum < 12000000 ? "₹80L–₹1.2Cr" : budgetNum < 20000000 ? "₹1.2Cr–₹2Cr" : "Above ₹2Cr";
    const lastLine = status === "Site visit" ? `Visited ${area} project; ${outcome.toLowerCase()}.` : status === "Negotiation" ? "Asked for best price and availability; comparing final options." : status === "New" ? "New enquiry; contact attempt not yet recorded." : `Discussed ${unit} options in ${area}; follow-up requested.`;
    const callOutcome = status === "New" ? "Not called" : ["Connected", "No answer", "Callback requested", "Site visit discussed"][i % 4]!;
    const waResponse = status === "New" ? "No WhatsApp sent" : ["Replied positively", "Asked a question", "Seen, no reply", "Not seen"][i % 4]!;
    const blockers = ["Price", "Location", "Family decision", "Financing", "Timing", "No blocker shared"];
    return record(`L${String(1001 + i).padStart(4, "0")}`, {
      name, stage: stageByName.get(status) ?? option(stage, "New"), source: option(source, origin),
      email, phone: `+91 98${String(10000000 + i * 13791).slice(0, 8)}`, owner, preferred_location: area,
      unit_type: option(fields.find((f) => f.apiKey === "unit_type")!, unit), budget, budget_range: option(budgetBand, budgetRange),
      intent: option(intent, interest), preferred_channel: option(channel, channelLabel), visit_outcome: option(visit, outcome),
      financing: option(fields.find((f) => f.apiKey === "financing")!, ["Pre-approved", "Loan needed", "Self-funded"][i % 3]!),
      last_contacted: created(age), next_follow_up: created(-followup),
      interaction_summary: lastLine,
      call_attempts: String(status === "New" ? 0 : 1 + (i % 4)),
      last_call_outcome: option(fields.find((f) => f.apiKey === "last_call_outcome")!, callOutcome),
      call_history: status === "New" ? "No calls logged yet." : `${i % 2 ? "Yesterday" : "2 days ago"}: ${callOutcome.toLowerCase()}. ${i % 3 === 0 ? "Asked for a callback after work." : `Discussed ${unit} availability and requested a ${i % 2 ? "price sheet" : "floor plan"}.`}`,
      whatsapp_message_count: String(status === "New" ? 0 : 2 + (i % 6)),
      whatsapp_response: option(fields.find((f) => f.apiKey === "whatsapp_response")!, waResponse),
      whatsapp_history: status === "New" ? "No WhatsApp conversation yet." : `Recent WhatsApp: ${waResponse.toLowerCase()}. ${i % 2 ? `Asked whether ${area} has a quieter-facing ${unit}.` : "Requested the brochure and total cost including registration."} ${i % 5 === 0 ? "Agent replied with a brochure; buyer asked to reconnect this week." : "Last agent reply included available visit slots."}`,
      email_engagement: option(fields.find((f) => f.apiKey === "email_engagement")!, status === "New" ? "Not sent" : ["Opened and clicked", "Opened", "No open"][i % 3]!),
      buying_blocker: option(fields.find((f) => f.apiKey === "buying_blocker")!, blockers[i % blockers.length]!),
      preferences: `${unit} in ${area}; ${budgetRange} budget; ${i % 2 ? "east-facing, near transit" : "balcony, covered parking"}.`,
      evidence_notes: `${interest} intent; ${status === "Negotiation" ? "pricing discussion active" : status === "Site visit" ? "site visit completed" : status === "New" ? "fresh inbound enquiry" : "responsive to recent follow-up"}.`,
    }, created(age));
  });
  return buildModule({
    label: "Lead", pluralLabel: "Leads", apiKey: "leads", description: "Real-estate prospects, preferences, intent signals, and follow-up activity", icon: "leads",
    nameFieldApiKey: "name", stageFieldApiKey: "stage", fields,
    stageLabels: ["New", "Contacted", "Qualified", "Site visit", "Negotiation", "Follow-up", "Booked", "Lost"], records: leads,
  });
}

export function addDemoLeads(workspace: CrmWorkspace): { workspace: CrmWorkspace; module: CrmModule; added: number } {
  const next = structuredClone(workspace);
  const existing = next.modules.find((m) => m.apiKey === "leads" || m.pluralLabel.toLowerCase() === "leads");
  const sample = makeLeadModule();
  if (!existing) {
    next.modules.unshift(sample);
    if (next.industryId === "real_estate" && !next.agents?.some((agent) => /next\s*best|\bnba\b/i.test(agent.name))) {
      next.agents = [...(next.agents ?? []), emptyCustomAgent("Next Best Action Agent", "Rank real-estate lead follow-ups using intent, stage, follow-up timing, call outcomes, WhatsApp responses, email engagement, and stated buying blockers. Prefer a useful next step that respects the buyer’s last response and avoids repetitive outreach. Cite only supplied evidence, never invent facts, and prepare a concise low-pressure draft. Do not send messages or claim they were sent.")];
    }
    return { workspace: next, module: sample, added: sample.records.length };
  }

  if (next.industryId === "real_estate" && !next.agents?.some((agent) => /next\s*best|\bnba\b/i.test(agent.name))) {
    next.agents = [...(next.agents ?? []), emptyCustomAgent("Next Best Action Agent", "Rank real-estate lead follow-ups using intent, stage, follow-up timing, call outcomes, WhatsApp responses, email engagement, and stated buying blockers. Prefer a useful next step that respects the buyer’s last response and avoids repetitive outreach. Cite only supplied evidence, never invent facts, and prepare a concise low-pressure draft. Do not send messages or claim they were sent.")];
  }
  for (const sourceField of sample.fields) {
    let targetField = existing.fields.find((field) => field.apiKey === sourceField.apiKey);
    if (!targetField) {
      targetField = structuredClone(sourceField);
      existing.fields.push(targetField);
      existing.formLayout.sections[0]?.fieldIds.push(targetField.id);
    } else {
      for (const sourceOption of sourceField.options) {
        if (!targetField.options.some((option) => option.label === sourceOption.label)) {
          targetField.options.push(structuredClone(sourceOption));
        }
      }
    }
  }

  const usedDisplays = new Set(existing.records.map((item) => item.displayId));
  const sourceByDisplayId = new Map(sample.records.map((row) => [row.displayId, row]));
  // Backfill newly introduced activity fields into existing demo rows, using synthetic
  // activity from the matching sample lead and never overwriting user-edited values.
  existing.records.forEach((current, index) => {
    const normalizedId = current.displayId.replace(/^DEMO-/, "");
    const sourceRecord = sourceByDisplayId.get(normalizedId) ?? sample.records[index % sample.records.length];
    for (const sourceField of sample.fields) {
      const targetField = existing.fields.find((field) => field.apiKey === sourceField.apiKey);
      if (!targetField || current.values[targetField.apiKey]) continue;
      const raw = sourceRecord.values[sourceField.apiKey] ?? "";
      const sourceOption = sourceField.options.find((option) => option.id === raw);
      current.values[targetField.apiKey] = sourceOption
        ? targetField.options.find((option) => option.label === sourceOption.label)?.id ?? raw
        : raw;
    }
  });
  const pending = sample.records.filter((item) => !existing.records.some((current) => current.displayId === item.displayId || current.displayId === `DEMO-${item.displayId}`));
  for (const sourceRecord of (existing.records.length >= sample.records.length ? [] : pending)) {
    const sourceDisplay = sourceRecord.displayId;
    let displayId = sourceDisplay;
    if (usedDisplays.has(displayId)) displayId = `DEMO-${sourceDisplay}`;
    let suffix = 2;
    while (usedDisplays.has(displayId)) displayId = `DEMO-${sourceDisplay}-${suffix++}`;
    usedDisplays.add(displayId);
    const values: Record<string, string> = {};
    for (const sourceField of sample.fields) {
      const targetField = existing.fields.find((field) => field.apiKey === sourceField.apiKey);
      if (!targetField) continue;
      const raw = sourceRecord.values[sourceField.apiKey] ?? "";
      const sourceOption = sourceField.options.find((option) => option.id === raw);
      values[targetField.apiKey] = sourceOption
        ? targetField.options.find((option) => option.label === sourceOption.label)?.id ?? raw
        : raw;
    }
    existing.records.push({ ...sourceRecord, displayId, values });
  }
  return { workspace: next, module: existing, added: existing.records.length - workspace.modules.find((m) => m.id === existing.id)!.records.length };
}
