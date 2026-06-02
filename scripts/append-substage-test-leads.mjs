/**
 * One-off: append Sub stage test blueprint sample leads to data/prototype-state.json
 * Run: node scripts/append-substage-test-leads.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FILE = join(process.cwd(), "data", "prototype-state.json");
const snap = JSON.parse(readFileSync(FILE, "utf8"));
const lib = snap.blueprintLibrary;
const bp = lib?.blueprints?.find((b) => b.id === lib.activeBlueprintId);
if (!bp) throw new Error("No active blueprint in snapshot");

const stageField = snap.fieldsSchema?.find((f) => f.apiKey === bp.stageField || f.apiKey === "stage");
const substageKey = bp.substageField?.trim() || "substage";

function norm(s) {
  return String(s).trim().toLowerCase();
}

function stageOptionId(stateLabel) {
  const opt = stageField?.options?.find((o) => norm(o.label) === norm(stateLabel));
  return opt?.id ?? "";
}

function substageId(stateLabel, substageLabel) {
  const st = bp.states.find((s) => norm(s.label) === norm(stateLabel));
  if (!st?.substages?.length) return "";
  if (substageLabel) {
    const hit = st.substages.find((ss) => norm(ss.label) === norm(substageLabel));
    return hit?.id ?? st.defaultSubstageId ?? st.substages[0]?.id ?? "";
  }
  return st.defaultSubstageId ?? st.substages[0]?.id ?? "";
}

const specs = [
  { name: "Substage Test — New", stateLabel: "New" },
  { name: "Substage Test — Contacted", stateLabel: "Contacted" },
  { name: "Substage Test — Qualified", stateLabel: "Qualified" },
  { name: "Substage Test — SV Scheduled", stateLabel: "Site Visit", substageLabel: "Scheduled" },
  { name: "Substage Test — SV Done", stateLabel: "Site Visit", substageLabel: "Done" },
  { name: "Substage Test — SV Cancelled", stateLabel: "Site Visit", substageLabel: "Cancelled" },
  { name: "Substage Test — SV No Show", stateLabel: "Site Visit", substageLabel: "No Show" },
  { name: "Substage Test — Opportunity", stateLabel: "Opportunity" },
];

const existing = Array.isArray(snap.leads) ? snap.leads : [];
const prefix = existing.some((l) => l.values?.lead_name?.startsWith("Substage Test —"));
if (prefix) {
  console.log("Test leads already present — skipping.");
  process.exit(0);
}

let seq = 2700;
for (const l of existing) {
  const m = /^L\d{6}(\d{4})$/.exec(l.displayId ?? "");
  if (m) seq = Math.max(seq, Number.parseInt(m[1], 10) + 1);
}

function displayId(n) {
  const d = new Date();
  const y = String(d.getFullYear() % 100).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `L${y}${m}${day}${String(n).padStart(4, "0")}`;
}

function emptyValues() {
  const v = {};
  for (const f of snap.fieldsSchema ?? []) {
    if (f.apiKey === "lead_name") continue;
    v[f.apiKey] = "";
  }
  return v;
}

const added = specs.map((spec, i) => {
  const values = emptyValues();
  values.lead_name = spec.name;
  values.email = `substage.test${i + 1}@example.com`;
  values.whatsapp_number = `91000${String(20000 + i).slice(-4)}`;
  values[stageField?.apiKey ?? "stage"] = stageOptionId(spec.stateLabel);
  values[substageKey] = substageId(spec.stateLabel, spec.substageLabel);
  values.assigned_to = "opt-assigned_0";
  values.source = "opt-source_0";
  const now = new Date(Date.now() - i * 3600000).toISOString();
  return {
    id: crypto.randomUUID(),
    displayId: displayId(seq++),
    values,
    createdAt: now,
    updatedAt: now,
    relatedDemo: { calls: [], tasks: [], channel_partner: [] },
  };
});

snap.leads = [...existing, ...added];
snap.savedAt = new Date().toISOString();
writeFileSync(FILE, `${JSON.stringify(snap, null, 2)}\n`, "utf8");
console.log(`Added ${added.length} test leads to ${FILE}`);
