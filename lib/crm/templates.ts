import { createOption } from "@/lib/fields-config/types";
import { buildModule, crmField, picklist, record } from "@/lib/crm/module-factory";
import type { CrmModule, IndustryTemplate } from "@/lib/crm/types";

function optionId(fieldApi: ReturnType<typeof picklist>, label: string): string {
  return fieldApi.options.find((o) => o.label === label)?.id ?? fieldApi.options[0]?.id ?? "";
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
}

function realEstate(): CrmModule[] {
  const leadStage = picklist("Stage", "stage", ["New", "Contacted", "Site visit", "Negotiation", "Booked", "Lost"], true);
  const leadSource = picklist("Source", "source", ["Website", "Walk-in", "Channel partner", "Ads"]);
  const leadName = crmField("text", "Full name", "name", { required: true, isSystem: true, locked: true });
  const project = picklist("Project", "project", ["Tower A", "Tower B", "Villa Park"]);
  const leads = buildModule({
    label: "Lead",
    pluralLabel: "Leads",
    description: "Capture and qualify demand across projects",
    icon: "leads",
    fields: [
      leadName,
      leadStage,
      leadSource,
      project,
      crmField("email", "Email", "email"),
      crmField("phone", "Phone", "phone"),
      crmField("text", "Owner", "owner"),
      crmField("number", "Budget", "budget"),
      crmField("text", "Preferred location", "preferred_location"),
    ],
    stageLabels: ["New", "Contacted", "Site visit", "Negotiation", "Booked", "Lost"],
    records: [
      record("L0001", {
        name: "Aarav Mehta",
        stage: optionId(leadStage, "Site visit"),
        source: optionId(leadSource, "Website"),
        project: project.options[0]?.id ?? "",
        email: "aarav@example.com",
        phone: "9000000001",
        owner: "Ankit",
        budget: "8500000",
        preferred_location: "Andheri",
      }, monthsAgo(2)),
      record("L0002", {
        name: "Sara Khan",
        stage: optionId(leadStage, "New"),
        source: optionId(leadSource, "Ads"),
        project: project.options[1]?.id ?? "",
        email: "sara@example.com",
        phone: "9000000002",
        owner: "Priya",
        budget: "12000000",
        preferred_location: "Bandra",
      }, monthsAgo(1)),
      record("L0003", {
        name: "Rohit Iyer",
        stage: optionId(leadStage, "Negotiation"),
        source: optionId(leadSource, "Channel partner"),
        project: project.options[0]?.id ?? "",
        email: "rohit@example.com",
        phone: "9000000003",
        owner: "Ankit",
        budget: "6400000",
        preferred_location: "Powai",
      }, monthsAgo(0)),
    ],
  });

  const visitStage = picklist("Stage", "stage", ["Scheduled", "Completed", "No-show", "Follow-up"], true);
  const visits = buildModule({
    label: "Site visit",
    pluralLabel: "Site visits",
    description: "Schedule and close project walkthroughs",
    icon: "visits",
    fields: [
      crmField("text", "Visit title", "name", { required: true, isSystem: true, locked: true }),
      visitStage,
      crmField("text", "Lead name", "lead_name"),
      crmField("date", "Visit date", "visit_date"),
      crmField("text", "Executive", "owner"),
      picklist("Project", "project", ["Tower A", "Tower B", "Villa Park"]),
    ],
    stageLabels: ["Scheduled", "Completed", "No-show", "Follow-up"],
    records: [
      record("V0001", {
        name: "Aarav — Tower A",
        stage: optionId(visitStage, "Scheduled"),
        lead_name: "Aarav Mehta",
        visit_date: "2026-09-22",
        owner: "Ankit",
      }),
    ],
  });

  const bookStage = picklist("Stage", "stage", ["Token", "Agreement", "Registered"], true);
  const bookings = buildModule({
    label: "Booking",
    pluralLabel: "Bookings",
    description: "Convert qualified demand into inventory bookings",
    icon: "bookings",
    fields: [
      crmField("text", "Booking name", "name", { required: true, isSystem: true, locked: true }),
      bookStage,
      crmField("text", "Buyer", "buyer"),
      crmField("text", "Unit", "unit"),
      crmField("date", "Booking date", "booking_date"),
      crmField("number", "Consideration", "amount"),
    ],
    stageLabels: ["Token", "Agreement", "Registered"],
    records: [
      record("B0001", {
        name: "Unit A-1204",
        stage: optionId(bookStage, "Token"),
        buyer: "Rohit Iyer",
        unit: "A-1204",
        booking_date: "2026-09-18",
        amount: "6400000",
      }),
    ],
  });

  return [leads, visits, bookings];
}

function saas(): CrmModule[] {
  const leadStage = picklist("Stage", "stage", ["New", "MQL", "SQL", "Disqualified"], true);
  const leads = buildModule({
    label: "Lead",
    pluralLabel: "Leads",
    description: "Inbound and outbound product interest",
    icon: "leads",
    fields: [
      crmField("text", "Full name", "name", { required: true, isSystem: true, locked: true }),
      leadStage,
      picklist("Source", "source", ["Website", "Outbound", "Partner", "Event"]),
      crmField("email", "Work email", "email"),
      crmField("text", "Company", "company"),
      crmField("text", "Owner", "owner"),
    ],
    stageLabels: ["New", "MQL", "SQL", "Disqualified"],
    records: [
      record("L0001", {
        name: "Maya Chen",
        stage: optionId(leadStage, "SQL"),
        source: createOption("Website").id,
        email: "maya@northwind.io",
        company: "Northwind",
        owner: "Alex",
      }),
    ],
  });
  // Fix source option - picklist creates its own options. Find Website from fields.
  const sourceField = leads.fields.find((f) => f.apiKey === "source");
  if (sourceField && leads.records[0]) {
    leads.records[0].values.source = sourceField.options.find((o) => o.label === "Website")?.id ?? "";
  }

  const accountStage = picklist("Stage", "stage", ["Prospect", "Customer", "Churn risk"], true);
  const accounts = buildModule({
    label: "Account",
    pluralLabel: "Accounts",
    description: "Companies you sell to",
    icon: "contacts",
    fields: [
      crmField("text", "Account name", "name", { required: true, isSystem: true, locked: true }),
      accountStage,
      crmField("url", "Website", "website"),
      crmField("text", "Industry", "segment"),
      crmField("text", "Owner", "owner"),
    ],
    stageLabels: ["Prospect", "Customer", "Churn risk"],
    records: [
      record("A0001", {
        name: "Northwind",
        stage: optionId(accountStage, "Prospect"),
        website: "https://northwind.example",
        segment: "B2B SaaS",
        owner: "Alex",
      }),
    ],
  });

  const dealStage = picklist("Stage", "stage", ["Discovery", "Proposal", "Negotiation", "Won", "Lost"], true);
  const deals = buildModule({
    label: "Deal",
    pluralLabel: "Deals",
    description: "Revenue pipeline",
    icon: "deals",
    fields: [
      crmField("text", "Deal name", "name", { required: true, isSystem: true, locked: true }),
      dealStage,
      crmField("number", "Amount", "amount"),
      crmField("text", "Account", "account"),
      crmField("date", "Close date", "close_date"),
      crmField("text", "Owner", "owner"),
    ],
    stageLabels: ["Discovery", "Proposal", "Negotiation", "Won", "Lost"],
    records: [
      record("D0001", {
        name: "Northwind — Growth",
        stage: optionId(dealStage, "Proposal"),
        amount: "48000",
        account: "Northwind",
        close_date: "2026-10-15",
        owner: "Alex",
      }),
    ],
  });

  return [leads, accounts, deals];
}

function education(): CrmModule[] {
  const enqStage = picklist("Stage", "stage", ["New", "Counselled", "Applied", "Dropped"], true);
  const enquiries = buildModule({
    label: "Enquiry",
    pluralLabel: "Enquiries",
    description: "Program interest from students and parents",
    icon: "leads",
    fields: [
      crmField("text", "Student name", "name", { required: true, isSystem: true, locked: true }),
      enqStage,
      picklist("Program", "program", ["MBA", "B.Tech", "Design"]),
      crmField("email", "Email", "email"),
      crmField("phone", "Phone", "phone"),
      crmField("text", "Counsellor", "owner"),
    ],
    stageLabels: ["New", "Counselled", "Applied", "Dropped"],
    records: [
      record("E0001", {
        name: "Ishaan Patel",
        stage: optionId(enqStage, "Counselled"),
        email: "ishaan@example.com",
        phone: "9811100110",
        owner: "Nisha",
      }),
      record("E0002", {
        name: "Meera Shah",
        stage: optionId(enqStage, "New"),
        email: "meera@example.com",
        phone: "9811100111",
        owner: "Amit",
      }),
      record("E0003", {
        name: "Kabir Rao",
        stage: optionId(enqStage, "Applied"),
        email: "kabir@example.com",
        phone: "9811100112",
        owner: "Nisha",
      }),
      record("E0004", {
        name: "Ananya Gill",
        stage: optionId(enqStage, "Counselled"),
        email: "ananya@example.com",
        phone: "9811100113",
        owner: "Priya",
      }),
    ],
  });
  const program = enquiries.fields.find((f) => f.apiKey === "program");
  if (program && enquiries.records[0]) {
    enquiries.records[0].values.program = program.options.find((o) => o.label === "MBA")?.id ?? "";
  }

  const appStage = picklist("Stage", "stage", ["Submitted", "Review", "Offer", "Enrolled"], true);
  const applications = buildModule({
    label: "Application",
    pluralLabel: "Applications",
    description: "Admissions file for each program",
    icon: "tickets",
    fields: [
      crmField("text", "Application", "name", { required: true, isSystem: true, locked: true }),
      appStage,
      crmField("text", "Student", "student"),
      crmField("date", "Submitted on", "submitted_on"),
      crmField("text", "Owner", "owner"),
    ],
    stageLabels: ["Submitted", "Review", "Offer", "Enrolled"],
    records: [
      record("AP0001", {
        name: "Ishaan — MBA",
        stage: optionId(appStage, "Review"),
        student: "Ishaan Patel",
        submitted_on: "2026-09-10",
        owner: "Nisha",
      }),
    ],
  });

  return [enquiries, applications];
}

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    id: "real_estate",
    label: "Real estate",
    tagline: "Projects, visits, bookings",
    description: "Pre-sales CRM for developers and brokers — leads through site visit to booking.",
    moduleSummaries: [
      { label: "Leads", description: "Demand capture", icon: "leads" },
      { label: "Site visits", description: "Walkthroughs", icon: "visits" },
      { label: "Bookings", description: "Inventory close", icon: "bookings" },
    ],
    build: realEstate,
  },
  {
    id: "saas",
    label: "B2B SaaS",
    tagline: "Leads, accounts, deals",
    description: "Classic software pipeline from inbound lead to closed-won revenue.",
    moduleSummaries: [
      { label: "Leads", description: "Inbound interest", icon: "leads" },
      { label: "Accounts", description: "Companies", icon: "contacts" },
      { label: "Deals", description: "Pipeline", icon: "deals" },
    ],
    build: saas,
  },
  {
    id: "education",
    label: "Education",
    tagline: "Enquiries to enrolment",
    description: "Admissions workspace for institutes — counselling through application.",
    moduleSummaries: [
      { label: "Enquiries", description: "Program interest", icon: "leads" },
      { label: "Applications", description: "Admissions files", icon: "tickets" },
    ],
    build: education,
  },
  {
    id: "blank",
    label: "Start blank",
    tagline: "Your own modules",
    description: "No prebuilt objects. Create industry-agnostic modules, fields, forms, and pipelines from scratch — or ask the agent.",
    moduleSummaries: [{ label: "Custom", description: "Build anything", icon: "custom" }],
    build: () => [],
  },
];

export function industryById(id: string): IndustryTemplate | undefined {
  return INDUSTRY_TEMPLATES.find((t) => t.id === id);
}
