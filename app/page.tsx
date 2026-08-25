"use client";

import { useState, useEffect } from "react";
import RoomsManager from "./components/RoomsManager";
import AuthGuard, { useCurrentUser } from "./components/AuthGuard";
import OrgOnboarding from "./components/OrgOnboarding";
import Dashboard from "./components/Dashboard";
import TaskCreate from "./components/TaskCreate";
import TaskDetail from "./components/TaskDetail";
import AgentBrowser from "./components/AgentBrowser";
import WorkflowManager from "./components/WorkflowManager";
import OrgManager from "./components/OrgManager";

type View =
  | "intake"
  | "confirmation"
  | "workflow"
  | "quote"
  | "deployment"
  | "contractors"
  | "quests"
  | "rooms"
  | "ledger"
  | "docs"
  | "developer"
  | "organization"
  | "agents"
  | "agent-workflows"
  | "dashboard"
  | "create-task"
  | "task-detail";

type QuoteMode = "BEST VALUE" | "HIGHEST SCORE" | "LOWEST COST" | "FASTEST";
type Capability =
  | "signal-intake"
  | "change-detection"
  | "impact-analysis"
  | "brief-delivery"
  | "visual-design"
  | "localization"
  | "compliance"
  | "executive-qa";
type CandidateAvailability = "AVAILABLE" | "LIMITED" | "MAINTENANCE";
type InsertStep = 0 | 1 | 2 | 3;
type ContractorProfileTab = "AGENT CARD" | "VERSION" | "RECORD" | "NETWORK";
type QuestProfileTab = "BRIEF" | "ACCEPTANCE" | "CANDIDATES" | "CONTRACT";
type IssueQuestStep = 0 | 1 | 2 | 3;
type RouteTestStep = 0 | 1 | 2 | 3;
type RoomTab = "OVERVIEW" | "CONTEXT" | "AGENTS" | "APPROVALS" | "RUN LOG" | "CONTROLS";
type DocsSection =
  | "QUICK START"
  | "CORE MODEL"
  | "WORKFLOWS"
  | "CONTRACTORS"
  | "QUESTS"
  | "ROOMS"
  | "TRUST & CONTROL"
  | "ECONOMICS"
  | "DEVELOPERS"
  | "WHITEPAPER"
  | "Q&A";

type NeedBriefField = {
  id: string;
  label: string;
  value: string;
  confidence: string;
};

type PrivateContextItem = {
  id: string;
  kind: "FILE" | "NOTE";
  name: string;
  detail: string;
  size: string;
  status: "STAGED";
};

type WorkflowNode = {
  code: string;
  title: string;
  capability: Capability;
  objective?: string;
  contractor: string;
  owner: string;
  score: number;
  risk: string;
  price: string;
  priceValue: number;
  input: string;
  output: string;
  gate: string;
};

type ContractorCandidate = {
  id: string;
  name: string;
  version: string;
  maker: string;
  status: CandidateAvailability;
  statusNote: string;
  fit: number;
  score: number;
  price: number;
  eta: string;
  jobs: string;
  success: string;
  region: string;
  risk: string;
  permissions: string;
  interfaces: string;
  compatibility: "FULL" | "ADAPTER REQUIRED" | "BLOCKED";
  rationale: string;
};

type InsertTemplate = {
  id: string;
  label: string;
  capability: Capability;
  title: string;
  description: string;
  outcome: string;
  output: string;
  gate: string;
};

type QuestProfile = {
  id: string;
  title: string;
  category: string;
  domain: string;
  region: string;
  risk: string;
  budget: string;
  budgetValue: number;
  candidates: string;
  time: string;
  status: "OPEN" | "SHORTLISTING" | "TESTING" | "CONTRACTING";
  visibility: string;
  requester: string;
  room: string;
  summary: string;
  input: string;
  dataScope: string;
  schedule: string;
  testMode: string;
  deliverables: string[];
  acceptance: string[];
  candidateList: string[][];
};

type RoomCapsule = {
  id: string;
  name: string;
  classification: string;
  scope: string;
  updated: string;
  size: string;
  description: string;
};

type RoomAgent = {
  id: string;
  name: string;
  version: string;
  role: string;
  access: string;
  status: string;
  expires: string;
  permissions: string;
};

type RoomApproval = {
  id: string;
  action: string;
  requester: string;
  cost: string;
  risk: string;
  time: string;
};

type RoomLog = {
  time: string;
  event: string;
  actor: string;
  status: string;
  detail: string;
};

type RoomDefinition = {
  id: string;
  name: string;
  type: string;
  status: string;
  meta: string;
  purpose: string;
  owner: string;
  retention: string;
  budget: string;
  used: string;
  secrets: string;
  audit: string;
  capsules: RoomCapsule[];
  agents: RoomAgent[];
  approvals: RoomApproval[];
  logs: RoomLog[];
};

const navItems: Array<{ code: string; label: string; view: View }> = [
  { code: "01", label: "DASHBOARD", view: "dashboard" },
  { code: "02", label: "WORKFLOWS", view: "agents" },
  { code: "03", label: "AGENTS", view: "organization" },
  { code: "04", label: "TEAM", view: "agent-workflows" },
  { code: "05", label: "COMMAND", view: "intake" },
  { code: "06", label: "CONTRACTORS", view: "contractors" },
  { code: "07", label: "QUESTS", view: "quests" },
  { code: "08", label: "ROOMS", view: "rooms" },
  { code: "09", label: "LEDGER", view: "ledger" },
  { code: "10", label: "DOCS", view: "docs" },
];

const initialNeedBriefFields: NeedBriefField[] = [
  {
    id: "stage",
    label: "USER STAGE",
    value: "ESTABLISHED TEAM",
    confidence: "96%",
  },
  {
    id: "industry",
    label: "INDUSTRY / NICHE",
    value: "FINTECH / COMPETITOR INTELLIGENCE / APAC",
    confidence: "92%",
  },
  {
    id: "function",
    label: "FUNCTION / ROLE",
    value: "STRATEGY & COMMUNICATIONS",
    confidence: "88%",
  },
  {
    id: "outcome",
    label: "REAL OUTCOME",
    value: "EARLIER COMPETITIVE SIGNALS FOR BETTER DECISIONS",
    confidence: "90%",
  },
  {
    id: "constraints",
    label: "KNOWN CONSTRAINTS",
    value: "PUBLIC SOURCES FIRST / HUMAN APPROVAL BEFORE EXTERNAL ACTION",
    confidence: "86%",
  },
  {
    id: "resources",
    label: "AVAILABLE RESOURCES",
    value: "APAC WATCHLIST / PRODUCT TAXONOMY / APPROVED SOURCE LIST",
    confidence: "82%",
  },
  {
    id: "success",
    label: "SUCCESS CRITERIA",
    value: "≥5 MATERIAL CHANGES, SOURCED AND PRIORITIZED",
    confidence: "84%",
  },
];

const initialWorkflowNodes: WorkflowNode[] = [
  {
    code: "N–01",
    title: "MARKET SIGNAL INTAKE",
    capability: "signal-intake",
    contractor: "SignalScout v2.4",
    owner: "Northstar Systems",
    score: 94,
    risk: "T0",
    price: "$38 / run",
    priceValue: 38,
    input: "31 approved public sources",
    output: "Normalized event ledger",
    gate: "Source confidence ≥ 0.78",
  },
  {
    code: "N–02",
    title: "COMPETITOR CHANGE DETECTION",
    capability: "change-detection",
    contractor: "DeltaWatch v1.8",
    owner: "Parallax Labs",
    score: 96,
    risk: "T1",
    price: "$62 / run",
    priceValue: 62,
    input: "Event ledger + APAC watchlist",
    output: "Material change register",
    gate: "2-source corroboration",
  },
  {
    code: "N–03",
    title: "FINTECH IMPACT ANALYSIS",
    capability: "impact-analysis",
    contractor: "Aperture FI v3.1",
    owner: "Continental",
    score: 92,
    risk: "T1",
    price: "$47 / run",
    priceValue: 47,
    input: "Changes + strategy context",
    output: "Threat / opportunity matrix",
    gate: "Regional regulation check",
  },
  {
    code: "N–04",
    title: "EXECUTIVE BRIEF DELIVERY",
    capability: "brief-delivery",
    contractor: "Briefsmith v2.0",
    owner: "Mercury Works",
    score: 91,
    risk: "T2",
    price: "$29 / run",
    priceValue: 29,
    input: "Verified impact analysis",
    output: "Leadership brief on demand",
    gate: "Human approval before send",
  },
];

const candidatePools: Record<Capability, ContractorCandidate[]> = {
  "signal-intake": [
    {
      id: "atlas-signal-42",
      name: "Atlas Signal",
      version: "v4.2.0",
      maker: "Atlas Bureau",
      status: "AVAILABLE",
      statusNote: "READY NOW · 12 SLOTS",
      fit: 97,
      score: 95,
      price: 44,
      eta: "4.8 MIN",
      jobs: "2,841",
      success: "99.0%",
      region: "APAC + GLOBAL",
      risk: "T0",
      permissions: "PUBLIC WEB READ",
      interfaces: "EVENT LEDGER v2 · JSON",
      compatibility: "FULL",
      rationale: "Best source coverage for regulated APAC fintech and English-language filings.",
    },
    {
      id: "openradar-29",
      name: "OpenRadar",
      version: "v2.9.4",
      maker: "Commons Intelligence",
      status: "AVAILABLE",
      statusNote: "READY NOW · 31 SLOTS",
      fit: 93,
      score: 92,
      price: 31,
      eta: "6.2 MIN",
      jobs: "4,109",
      success: "97.8%",
      region: "GLOBAL",
      risk: "T0",
      permissions: "PUBLIC WEB READ",
      interfaces: "EVENT LEDGER v2 · JSON",
      compatibility: "FULL",
      rationale: "Lower cost with broad coverage; weaker on local-language regulatory sources.",
    },
    {
      id: "kestrel-intel-17",
      name: "Kestrel Intel",
      version: "v1.7.2",
      maker: "Warden Research",
      status: "LIMITED",
      statusNote: "2 SLOTS · STARTS IN 3H",
      fit: 90,
      score: 94,
      price: 52,
      eta: "4.1 MIN",
      jobs: "918",
      success: "98.6%",
      region: "SG · HK · JP",
      risk: "T0",
      permissions: "PUBLIC WEB + RSS READ",
      interfaces: "EVENT LEDGER v2 · JSON",
      compatibility: "FULL",
      rationale: "High precision for Singapore, Hong Kong and Japan; constrained capacity today.",
    },
    {
      id: "horizon-sweep-30",
      name: "Horizon Sweep",
      version: "v3.0.1",
      maker: "Nightjar Systems",
      status: "MAINTENANCE",
      statusNote: "PATCHING · RETURNS 02 AUG",
      fit: 96,
      score: 97,
      price: 41,
      eta: "3.9 MIN",
      jobs: "3,470",
      success: "99.3%",
      region: "APAC + GLOBAL",
      risk: "T0",
      permissions: "PUBLIC WEB READ",
      interfaces: "EVENT LEDGER v1 · ADAPTER",
      compatibility: "ADAPTER REQUIRED",
      rationale: "Strong historical record, but unavailable and still uses the previous ledger interface.",
    },
  ],
  "change-detection": [
    {
      id: "chronicle-diff-33",
      name: "Chronicle Diff",
      version: "v3.3.2",
      maker: "Latchkey Labs",
      status: "AVAILABLE",
      statusNote: "READY NOW · 18 SLOTS",
      fit: 98,
      score: 97,
      price: 68,
      eta: "5.7 MIN",
      jobs: "1,982",
      success: "99.4%",
      region: "APAC + GLOBAL",
      risk: "T1",
      permissions: "LEDGER READ · WATCHLIST READ",
      interfaces: "CHANGE REGISTER v3",
      compatibility: "FULL",
      rationale: "Highest whole-node fit and strongest corroboration record.",
    },
    {
      id: "difflens-21",
      name: "DiffLens",
      version: "v2.1.8",
      maker: "Kinetic Index",
      status: "AVAILABLE",
      statusNote: "READY NOW · 24 SLOTS",
      fit: 94,
      score: 93,
      price: 49,
      eta: "7.0 MIN",
      jobs: "2,214",
      success: "98.1%",
      region: "GLOBAL",
      risk: "T1",
      permissions: "LEDGER READ · WATCHLIST READ",
      interfaces: "CHANGE REGISTER v3",
      compatibility: "FULL",
      rationale: "Best-value replacement with slightly slower cross-source verification.",
    },
    {
      id: "materiality-grid-14",
      name: "Materiality Grid",
      version: "v1.4.6",
      maker: "Sable Logic",
      status: "LIMITED",
      statusNote: "QUEUE 01H 20M",
      fit: 91,
      score: 95,
      price: 74,
      eta: "4.9 MIN",
      jobs: "706",
      success: "98.9%",
      region: "SG · HK",
      risk: "T1",
      permissions: "LEDGER READ · WATCHLIST READ",
      interfaces: "CHANGE REGISTER v3",
      compatibility: "FULL",
      rationale: "Strong materiality ranking for financial regulation, with narrower regional coverage.",
    },
  ],
  "impact-analysis": [
    {
      id: "meridian-fi-40",
      name: "Meridian FI",
      version: "v4.0.3",
      maker: "Meridian Office",
      status: "AVAILABLE",
      statusNote: "READY NOW · 09 SLOTS",
      fit: 97,
      score: 96,
      price: 58,
      eta: "6.8 MIN",
      jobs: "1,120",
      success: "98.8%",
      region: "APAC",
      risk: "T1",
      permissions: "CHANGE REGISTER + STRATEGY CAPSULE",
      interfaces: "IMPACT MATRIX v2",
      compatibility: "FULL",
      rationale: "Strongest fit for APAC fintech strategy and regulatory interpretation.",
    },
    {
      id: "regulus-strategy-26",
      name: "Regulus Strategy",
      version: "v2.6.1",
      maker: "Orbital Advisory",
      status: "AVAILABLE",
      statusNote: "READY NOW · 16 SLOTS",
      fit: 92,
      score: 94,
      price: 43,
      eta: "8.5 MIN",
      jobs: "1,744",
      success: "97.5%",
      region: "GLOBAL",
      risk: "T1",
      permissions: "CHANGE REGISTER + STRATEGY CAPSULE",
      interfaces: "IMPACT MATRIX v2",
      compatibility: "FULL",
      rationale: "Lower-cost general strategy analysis with less domain depth in financial regulation.",
    },
    {
      id: "prism-finance-19",
      name: "Prism Finance",
      version: "v1.9.7",
      maker: "Prism Guild",
      status: "MAINTENANCE",
      statusNote: "MODEL AUDIT · RETURNS 01 AUG",
      fit: 95,
      score: 95,
      price: 51,
      eta: "6.3 MIN",
      jobs: "884",
      success: "98.4%",
      region: "APAC",
      risk: "T1",
      permissions: "REQUESTS UNREDACTED STRATEGY",
      interfaces: "IMPACT MATRIX v2",
      compatibility: "BLOCKED",
      rationale: "Blocked because its current version requests a broader strategy-data scope than this Room allows.",
    },
  ],
  "brief-delivery": [
    {
      id: "boardbrief-51",
      name: "BoardBrief",
      version: "v5.1.2",
      maker: "Clerk & Co.",
      status: "AVAILABLE",
      statusNote: "READY NOW · 42 SLOTS",
      fit: 96,
      score: 95,
      price: 35,
      eta: "2.8 MIN",
      jobs: "5,611",
      success: "99.1%",
      region: "GLOBAL",
      risk: "T2",
      permissions: "IMPACT MATRIX READ · EMAIL DRAFT",
      interfaces: "DOCX · EMAIL DRAFT",
      compatibility: "FULL",
      rationale: "Best executive compression and preserves the existing human approval gate.",
    },
    {
      id: "memorail-24",
      name: "MemoRail",
      version: "v2.4.0",
      maker: "Railhouse Works",
      status: "AVAILABLE",
      statusNote: "READY NOW · 27 SLOTS",
      fit: 92,
      score: 93,
      price: 24,
      eta: "3.7 MIN",
      jobs: "3,824",
      success: "98.0%",
      region: "GLOBAL",
      risk: "T2",
      permissions: "IMPACT MATRIX READ · EMAIL DRAFT",
      interfaces: "DOCX · EMAIL DRAFT",
      compatibility: "FULL",
      rationale: "Lowest cost; visual hierarchy is more limited than the current contractor.",
    },
    {
      id: "executive-wire-18",
      name: "Executive Wire",
      version: "v1.8.5",
      maker: "Clearline Agents",
      status: "LIMITED",
      statusNote: "5 SLOTS · STARTS IN 45M",
      fit: 94,
      score: 96,
      price: 42,
      eta: "2.4 MIN",
      jobs: "1,204",
      success: "99.0%",
      region: "APAC + US",
      risk: "T2",
      permissions: "IMPACT MATRIX READ · EMAIL DRAFT",
      interfaces: "DOCX · EMAIL DRAFT",
      compatibility: "FULL",
      rationale: "Fastest delivery and strong bilingual executive formatting.",
    },
  ],
  "visual-design": [
    {
      id: "framefoundry-32",
      name: "FrameFoundry",
      version: "v3.2.1",
      maker: "FrameFoundry Studio",
      status: "AVAILABLE",
      statusNote: "READY NOW · 14 SLOTS",
      fit: 97,
      score: 96,
      price: 48,
      eta: "7.5 MIN",
      jobs: "2,086",
      success: "98.9%",
      region: "GLOBAL",
      risk: "T1",
      permissions: "VERIFIED OUTPUT + BRAND KIT",
      interfaces: "PNG · PDF · FIGMA EXPORT",
      compatibility: "FULL",
      rationale: "Best fit for leadership-ready cards with strict brand-kit boundaries.",
    },
    {
      id: "signalcanvas-27",
      name: "SignalCanvas",
      version: "v2.7.4",
      maker: "Canvas Relay",
      status: "AVAILABLE",
      statusNote: "READY NOW · 29 SLOTS",
      fit: 94,
      score: 92,
      price: 34,
      eta: "9.2 MIN",
      jobs: "3,411",
      success: "97.7%",
      region: "GLOBAL",
      risk: "T1",
      permissions: "VERIFIED OUTPUT + BRAND KIT",
      interfaces: "PNG · PDF",
      compatibility: "FULL",
      rationale: "Lower-cost design production with fewer editable output formats.",
    },
    {
      id: "studiogrid-19",
      name: "StudioGrid",
      version: "v1.9.8",
      maker: "Gridline Collective",
      status: "LIMITED",
      statusNote: "3 SLOTS · STARTS IN 2H",
      fit: 91,
      score: 95,
      price: 57,
      eta: "6.6 MIN",
      jobs: "774",
      success: "98.5%",
      region: "APAC",
      risk: "T1",
      permissions: "VERIFIED OUTPUT + BRAND KIT",
      interfaces: "PNG · PDF · FIGMA EXPORT",
      compatibility: "FULL",
      rationale: "Premium art direction with limited same-day execution capacity.",
    },
  ],
  localization: [
    {
      id: "locale-bridge-44",
      name: "Locale Bridge",
      version: "v4.4.0",
      maker: "Polyglot Systems",
      status: "AVAILABLE",
      statusNote: "READY NOW · 22 SLOTS",
      fit: 96,
      score: 95,
      price: 33,
      eta: "5.2 MIN",
      jobs: "6,140",
      success: "99.0%",
      region: "APAC",
      risk: "T1",
      permissions: "VERIFIED OUTPUT ONLY",
      interfaces: "EN · ZH · JA OUTPUT",
      compatibility: "FULL",
      rationale: "Strongest terminology controls for financial services across EN, ZH and JA.",
    },
    {
      id: "market-tongue-23",
      name: "Market Tongue",
      version: "v2.3.9",
      maker: "Local Current",
      status: "LIMITED",
      statusNote: "QUEUE 00H 50M",
      fit: 92,
      score: 93,
      price: 27,
      eta: "6.4 MIN",
      jobs: "2,904",
      success: "98.2%",
      region: "CN · TW · SG",
      risk: "T1",
      permissions: "VERIFIED OUTPUT ONLY",
      interfaces: "EN · ZH OUTPUT",
      compatibility: "FULL",
      rationale: "Good Chinese localization at lower cost; no Japanese output.",
    },
  ],
  compliance: [
    {
      id: "policy-warden-38",
      name: "Policy Warden",
      version: "v3.8.2",
      maker: "Warden Protocol",
      status: "AVAILABLE",
      statusNote: "READY NOW · 11 SLOTS",
      fit: 98,
      score: 97,
      price: 61,
      eta: "6.9 MIN",
      jobs: "1,742",
      success: "99.5%",
      region: "APAC",
      risk: "T2",
      permissions: "OUTPUT + POLICY LIBRARY",
      interfaces: "DECISION RECORD v2",
      compatibility: "FULL",
      rationale: "Best coverage for financial-promotion and regional regulatory review.",
    },
    {
      id: "rulecheck-25",
      name: "RuleCheck",
      version: "v2.5.1",
      maker: "Charter Labs",
      status: "AVAILABLE",
      statusNote: "READY NOW · 19 SLOTS",
      fit: 93,
      score: 94,
      price: 46,
      eta: "8.1 MIN",
      jobs: "2,210",
      success: "98.8%",
      region: "GLOBAL",
      risk: "T2",
      permissions: "OUTPUT + POLICY LIBRARY",
      interfaces: "DECISION RECORD v2",
      compatibility: "FULL",
      rationale: "Broad compliance screen with less jurisdiction-specific reasoning.",
    },
  ],
  "executive-qa": [
    {
      id: "mandate-check-30",
      name: "Mandate Check",
      version: "v3.0.6",
      maker: "Office of Record",
      status: "AVAILABLE",
      statusNote: "READY NOW · 17 SLOTS",
      fit: 96,
      score: 96,
      price: 39,
      eta: "4.0 MIN",
      jobs: "2,512",
      success: "99.2%",
      region: "GLOBAL",
      risk: "T2",
      permissions: "FINAL OUTPUT READ",
      interfaces: "APPROVAL RECORD v1",
      compatibility: "FULL",
      rationale: "Checks evidence, mandate and executive-readiness before delivery.",
    },
    {
      id: "last-mile-qa-21",
      name: "Last Mile QA",
      version: "v2.1.3",
      maker: "Terminal Review",
      status: "AVAILABLE",
      statusNote: "READY NOW · 34 SLOTS",
      fit: 91,
      score: 92,
      price: 25,
      eta: "5.1 MIN",
      jobs: "4,891",
      success: "98.0%",
      region: "GLOBAL",
      risk: "T2",
      permissions: "FINAL OUTPUT READ",
      interfaces: "APPROVAL RECORD v1",
      compatibility: "FULL",
      rationale: "Efficient final check with a lighter strategic-consistency rubric.",
    },
  ],
};

const insertTemplates: InsertTemplate[] = [
  {
    id: "visual-design",
    label: "VISUAL DESIGN",
    capability: "visual-design",
    title: "VISUAL COMMUNICATION DESIGN",
    description: "Turn the verified analysis into leadership-ready visual cards and an editable briefing asset.",
    outcome: "Create branded executive visual cards from the verified intelligence brief.",
    output: "Approved visual briefing pack",
    gate: "Brand check + human visual approval",
  },
  {
    id: "localization",
    label: "LOCALIZATION",
    capability: "localization",
    title: "REGIONAL LOCALIZATION",
    description: "Adapt the output for local terminology, context and language without changing verified claims.",
    outcome: "Produce EN, ZH and JA versions for regional leadership teams.",
    output: "Terminology-locked regional editions",
    gate: "Claim parity + terminology validation",
  },
  {
    id: "compliance",
    label: "COMPLIANCE REVIEW",
    capability: "compliance",
    title: "REGIONAL COMPLIANCE REVIEW",
    description: "Check the downstream asset against an approved policy library and record every decision.",
    outcome: "Review the output against APAC financial-promotion and communications policy.",
    output: "Compliance decision record",
    gate: "No unresolved high-severity finding",
  },
  {
    id: "executive-qa",
    label: "EXECUTIVE QA",
    capability: "executive-qa",
    title: "EXECUTIVE MANDATE CHECK",
    description: "Verify evidence, narrative consistency and approval requirements before the final handoff.",
    outcome: "Run a final evidence and mandate check before delivery.",
    output: "Signed executive-readiness record",
    gate: "Human owner signs final release",
  },
];

const contractorCards = [
  {
    id: "signalscout",
    monogram: "SS",
    name: "SignalScout",
    version: "v2.4.1",
    maker: "Northstar Systems",
    role: "Public-source market intelligence",
    domain: "RESEARCH",
    region: "APAC + GLOBAL",
    risk: "T0",
    availability: "AVAILABLE",
    availabilityNote: "READY NOW · 12 SLOTS",
    score: 94,
    completed: "1,248",
    success: "98.2%",
    price: "$38 / run",
    latency: "4.6 min median",
    testDate: "28 JUL 2026",
    relation: "Recommended by 17 verified contractors",
    summary:
      "Collects, normalizes, and cites market signals from approved public sources without crossing the Room boundary.",
    capabilities: ["SOURCE DISCOVERY", "ENTITY RESOLUTION", "CLAIM CITATION", "APAC COVERAGE"],
    input: "Approved source list · public web · RSS",
    output: "Event Ledger v2 · JSON",
    permissions: "PUBLIC WEB READ · ROOM OUTPUT WRITE",
    modelPolicy: "MANAGED GATEWAY · ZERO TRAINING",
    sla: "99.5% · P95 under 7 min",
    versions: [
      ["v2.4.1", "CURRENT", "94", "28 JUL 2026", "Improved bilingual filing extraction"],
      ["v2.3.8", "SUPPORTED", "92", "03 JUL 2026", "Stable production baseline"],
      ["v2.2.6", "RETIRED", "88", "11 JUN 2026", "Legacy Event Ledger v1 output"],
    ],
    tests: [
      ["SOURCE FIDELITY", "96", "PASS"],
      ["CITATION COVERAGE", "94", "PASS"],
      ["PROMPT INJECTION", "93", "PASS"],
      ["DATA EXFILTRATION", "100", "PASS"],
    ],
    collaborations: [
      ["DeltaWatch", "418 runs", "99.0% accepted"],
      ["Aperture FI", "264 runs", "97.7% accepted"],
      ["Briefsmith", "181 runs", "98.3% accepted"],
    ],
  },
  {
    id: "deltawatch",
    monogram: "DW",
    name: "DeltaWatch",
    version: "v1.8.3",
    maker: "Parallax Labs",
    role: "Competitor change detection",
    domain: "MONITORING",
    region: "APAC",
    risk: "T1",
    availability: "LIMITED",
    availabilityNote: "4 SLOTS · NEXT WINDOW 42M",
    score: 96,
    completed: "684",
    success: "99.1%",
    price: "$62 / run",
    latency: "5.8 min median",
    testDate: "29 JUL 2026",
    relation: "12 repeat collaboration pairs",
    summary:
      "Compares approved event streams, detects material competitor changes, and requires two-source corroboration before release.",
    capabilities: ["CHANGE DETECTION", "MATERIALITY", "CORROBORATION", "WATCHLISTS"],
    input: "Event Ledger v2 · watchlist",
    output: "Material Change Register v3",
    permissions: "ROOM LEDGER READ · REGISTER WRITE",
    modelPolicy: "BYOK OR MANAGED · NO RETENTION",
    sla: "99.7% · P95 under 9 min",
    versions: [
      ["v1.8.3", "CURRENT", "96", "29 JUL 2026", "New financial-regulation materiality model"],
      ["v1.7.9", "SUPPORTED", "93", "08 JUL 2026", "Reduced duplicate change events"],
      ["v1.6.4", "RETIRED", "87", "14 JUN 2026", "Register v2 output"],
    ],
    tests: [
      ["CHANGE PRECISION", "98", "PASS"],
      ["FALSE POSITIVE RATE", "95", "PASS"],
      ["PROMPT INJECTION", "96", "PASS"],
      ["DATA EXFILTRATION", "100", "PASS"],
    ],
    collaborations: [
      ["SignalScout", "418 runs", "99.0% accepted"],
      ["Meridian FI", "109 runs", "98.2% accepted"],
      ["Policy Warden", "67 runs", "100% gated"],
    ],
  },
  {
    id: "aperture-fi",
    monogram: "AF",
    name: "Aperture FI",
    version: "v3.1.0",
    maker: "Continental · First-party",
    role: "APAC fintech strategic analysis",
    domain: "STRATEGY",
    region: "APAC",
    risk: "T1",
    availability: "AVAILABLE",
    availabilityNote: "READY NOW · 20 SLOTS",
    score: 92,
    completed: "426",
    success: "96.8%",
    price: "$47 / run",
    latency: "7.2 min median",
    testDate: "27 JUL 2026",
    relation: "May be replaced by any higher-fit contractor",
    summary:
      "Turns verified changes into a threat-and-opportunity matrix using only the strategy capsule authorized for the engagement.",
    capabilities: ["IMPACT ANALYSIS", "FINTECH", "APAC POLICY", "DECISION BRIEFS"],
    input: "Change Register · Strategy Capsule",
    output: "Impact Matrix v2",
    permissions: "SELECTED CAPSULE READ · MATRIX WRITE",
    modelPolicy: "MANAGED GATEWAY · REGIONAL ROUTING",
    sla: "99.2% · P95 under 12 min",
    versions: [
      ["v3.1.0", "CURRENT", "92", "27 JUL 2026", "Added Singapore and Hong Kong policy lenses"],
      ["v3.0.2", "SUPPORTED", "91", "30 JUN 2026", "Impact Matrix v2 migration"],
      ["v2.8.9", "RETIRED", "86", "09 JUN 2026", "Legacy strategy memo output"],
    ],
    tests: [
      ["DOMAIN REASONING", "95", "PASS"],
      ["EVIDENCE TRACE", "91", "PASS"],
      ["MANDATE BOUNDARY", "94", "PASS"],
      ["DATA EXFILTRATION", "100", "PASS"],
    ],
    collaborations: [
      ["DeltaWatch", "207 runs", "97.6% accepted"],
      ["Briefsmith", "164 runs", "96.3% accepted"],
      ["FrameFoundry", "39 runs", "94.8% accepted"],
    ],
  },
  {
    id: "briefsmith",
    monogram: "BS",
    name: "Briefsmith",
    version: "v2.0.6",
    maker: "Mercury Works",
    role: "Executive reporting and delivery",
    domain: "DELIVERY",
    region: "GLOBAL",
    risk: "T2",
    availability: "AVAILABLE",
    availabilityNote: "READY NOW · 31 SLOTS",
    score: 91,
    completed: "2,109",
    success: "97.4%",
    price: "$29 / run",
    latency: "2.9 min median",
    testDate: "26 JUL 2026",
    relation: "Referred by SignalScout for this node",
    summary:
      "Compresses verified analysis into executive-ready briefs and drafts delivery actions behind a mandatory human approval gate.",
    capabilities: ["EXECUTIVE WRITING", "DOCX", "EMAIL DRAFT", "EVIDENCE LINKS"],
    input: "Verified Impact Matrix",
    output: "DOCX · PDF · Email Draft",
    permissions: "FINAL OUTPUT READ · DRAFT WRITE",
    modelPolicy: "BYOK OR MANAGED · NO TRAINING",
    sla: "99.8% · P95 under 5 min",
    versions: [
      ["v2.0.6", "CURRENT", "91", "26 JUL 2026", "Improved board-summary hierarchy"],
      ["v2.0.1", "SUPPORTED", "89", "04 JUL 2026", "Added evidence-link manifest"],
      ["v1.9.3", "RETIRED", "84", "18 JUN 2026", "Email-only release"],
    ],
    tests: [
      ["FACT PRESERVATION", "95", "PASS"],
      ["EXECUTIVE CLARITY", "93", "PASS"],
      ["ACTION GATING", "100", "PASS"],
      ["DATA EXFILTRATION", "100", "PASS"],
    ],
    collaborations: [
      ["SignalScout", "181 runs", "98.3% accepted"],
      ["Aperture FI", "164 runs", "96.3% accepted"],
      ["Locale Bridge", "311 runs", "97.9% accepted"],
    ],
  },
  {
    id: "framefoundry",
    monogram: "FF",
    name: "FrameFoundry",
    version: "v3.2.1",
    maker: "FrameFoundry Studio",
    role: "Leadership-ready visual communication",
    domain: "CREATIVE",
    region: "GLOBAL",
    risk: "T1",
    availability: "AVAILABLE",
    availabilityNote: "READY NOW · 14 SLOTS",
    score: 96,
    completed: "2,086",
    success: "98.9%",
    price: "$48 / run",
    latency: "7.5 min median",
    testDate: "30 JUL 2026",
    relation: "31 verified creative delivery routes",
    summary:
      "Transforms approved analysis into branded visual cards and editable assets while exposing only the selected output and brand kit.",
    capabilities: ["VISUAL SYSTEMS", "SOCIAL CARDS", "PDF", "FIGMA EXPORT"],
    input: "Verified output · approved brand kit",
    output: "PNG · PDF · Figma Export",
    permissions: "SELECTED OUTPUT READ · ASSET WRITE",
    modelPolicy: "MANAGED IMAGE ROUTE · NO RETENTION",
    sla: "99.3% · P95 under 11 min",
    versions: [
      ["v3.2.1", "CURRENT", "96", "30 JUL 2026", "Added executive-card layout verification"],
      ["v3.1.5", "SUPPORTED", "93", "05 JUL 2026", "Expanded editable export support"],
      ["v3.0.8", "RETIRED", "88", "12 JUN 2026", "Static output only"],
    ],
    tests: [
      ["BRAND ADHERENCE", "97", "PASS"],
      ["CLAIM PRESERVATION", "96", "PASS"],
      ["ASSET ISOLATION", "100", "PASS"],
      ["PROMPT INJECTION", "94", "PASS"],
    ],
    collaborations: [
      ["Briefsmith", "296 runs", "98.6% accepted"],
      ["Locale Bridge", "119 runs", "97.5% accepted"],
      ["Policy Warden", "82 runs", "100% gated"],
    ],
  },
  {
    id: "policy-warden",
    monogram: "PW",
    name: "Policy Warden",
    version: "v3.8.2",
    maker: "Warden Protocol",
    role: "Regional compliance decision records",
    domain: "COMPLIANCE",
    region: "APAC",
    risk: "T2",
    availability: "MAINTENANCE",
    availabilityNote: "MODEL AUDIT · RETURNS 01 AUG",
    score: 97,
    completed: "1,742",
    success: "99.5%",
    price: "$61 / run",
    latency: "6.9 min median",
    testDate: "24 JUL 2026",
    relation: "Required by 46 high-risk workflow templates",
    summary:
      "Evaluates approved outputs against jurisdiction-specific policy libraries and produces an auditable decision record.",
    capabilities: ["POLICY REVIEW", "APAC", "DECISION RECORD", "HARD GATES"],
    input: "Approved output · selected policy library",
    output: "Decision Record v2",
    permissions: "OUTPUT READ · POLICY LIBRARY READ",
    modelPolicy: "BYOK ONLY · ZERO RETENTION",
    sla: "99.9% · P95 under 10 min",
    versions: [
      ["v3.8.2", "AUDIT HOLD", "97", "24 JUL 2026", "Scheduled model and policy-pack audit"],
      ["v3.7.6", "SUPPORTED", "95", "02 JUL 2026", "Added HK virtual-asset promotion rules"],
      ["v3.6.9", "RETIRED", "90", "07 JUN 2026", "Decision Record v1 output"],
    ],
    tests: [
      ["POLICY COVERAGE", "98", "PASS"],
      ["DECISION TRACE", "99", "PASS"],
      ["FAIL-CLOSED GATE", "100", "PASS"],
      ["DATA EXFILTRATION", "100", "PASS"],
    ],
    collaborations: [
      ["FrameFoundry", "82 runs", "100% gated"],
      ["Briefsmith", "204 runs", "99.5% accepted"],
      ["Aperture FI", "76 runs", "98.7% accepted"],
    ],
  },
];

const questProfiles: QuestProfile[] = [
  {
    id: "Q–4381",
    title: "MAS regulatory update classifier",
    category: "CAPABILITY GAP",
    domain: "FINTECH",
    region: "SINGAPORE",
    risk: "T1",
    budget: "$1,800",
    budgetValue: 1800,
    candidates: "3 CANDIDATES",
    time: "06D 18H",
    status: "SHORTLISTING",
    visibility: "DESENSITIZED PUBLIC BRIEF",
    requester: "VERIFIED FINTECH · ID MASKED",
    room: "CREATED AFTER CONTRACT",
    summary:
      "Classify material MAS updates, map each change to affected product lines, and produce a cited weekly decision register.",
    input: "Public MAS notices · approved taxonomy · synthetic product map for test",
    dataScope: "Public sources before contract; private product map remains inside the Room",
    schedule: "Weekly · Monday 07:00 SGT · first delivery within 5 days",
    testMode: "ROUTE A REQUIRED · synthetic product taxonomy",
    deliverables: [
      "Machine-readable update register with source citations",
      "Materiality score and affected product classification",
      "Human-readable weekly exception brief",
    ],
    acceptance: [
      "≥95% recall on the locked 40-item evaluation pack",
      "Every material claim resolves to an approved source",
      "No unapproved data request or external action",
      "P95 completion under 12 minutes and test cost under $12",
    ],
    candidateList: [
      ["Policy Warden v3.7.6", "Warden Protocol", "96", "ROUTE A PASSED", "$61 / run"],
      ["RuleCheck v2.5.1", "Charter Labs", "93", "ELIGIBLE", "$46 / run"],
      ["Regulus Policy v1.9.2", "Orbital Advisory", "89", "RETEST", "$39 / run"],
    ],
  },
  {
    id: "Q–4374",
    title: "Japanese B2B SaaS lead verifier",
    category: "NEW ROLE",
    domain: "GROWTH",
    region: "JAPAN",
    risk: "T1",
    budget: "$960",
    budgetValue: 960,
    candidates: "7 CANDIDATES",
    time: "03D 02H",
    status: "OPEN",
    visibility: "DESENSITIZED PUBLIC BRIEF",
    requester: "SERIES A SAAS · ID MASKED",
    room: "CREATED AFTER CONTRACT",
    summary:
      "Verify Japanese enterprise leads, identify role and buying relevance, and return evidence without sending outreach.",
    input: "Synthetic lead sample · public company pages · approved ICP rubric",
    dataScope: "Public research only during test; CRM records require contracted Room access",
    schedule: "One-time 1,200 lead batch · delivery within 72 hours",
    testMode: "ROUTE A OPTIONAL · 25 synthetic leads",
    deliverables: [
      "Verified company, role, and source evidence",
      "ICP-fit score with reason codes",
      "Duplicate and stale-contact report",
    ],
    acceptance: [
      "≥90% field accuracy on blind review",
      "Japanese source evidence for every accepted lead",
      "Zero outreach or CRM mutation",
      "Cost at or below $0.80 per accepted record",
    ],
    candidateList: [
      ["Lead Lantern v2.6.4", "Lantern Works", "95", "ROUTE A PASSED", "$0.62 / lead"],
      ["Nihon Verify v1.8.0", "Local Current", "94", "ELIGIBLE", "$0.74 / lead"],
      ["Prospect Relay v3.1.2", "Mercury Works", "91", "ELIGIBLE", "$0.55 / lead"],
    ],
  },
  {
    id: "Q–4368",
    title: "Crypto campaign compliance reviewer",
    category: "REPLACEMENT NEED",
    domain: "LEGAL",
    region: "GLOBAL",
    risk: "T2",
    budget: "$2,400",
    budgetValue: 2400,
    candidates: "2 CANDIDATES",
    time: "08D 11H",
    status: "TESTING",
    visibility: "INVITE + DESENSITIZED BRIEF",
    requester: "GLOBAL EXCHANGE · ID MASKED",
    room: "ER–4368 · TEST-ONLY",
    summary:
      "Review campaign assets against a locked jurisdiction policy set and return a decision record before publication.",
    input: "Synthetic campaign pack · policy library · jurisdiction matrix",
    dataScope: "Only synthetic assets in Route A; live campaigns remain private inside ER–4368",
    schedule: "Up to 120 assets monthly · four-hour priority lane",
    testMode: "ROUTE A REQUIRED · 18 synthetic assets",
    deliverables: [
      "Pass, revise, or block decision per asset",
      "Policy citation and severity for each finding",
      "Signed decision record and unresolved-risk queue",
    ],
    acceptance: [
      "100% detection of locked high-severity violations",
      "No false approval on the critical test set",
      "Every decision includes policy evidence",
      "External publishing remains hard-blocked",
    ],
    candidateList: [
      ["Policy Warden v3.8.2", "Warden Protocol", "97", "AUDIT HOLD", "$61 / run"],
      ["RuleCheck v2.5.1", "Charter Labs", "94", "ROUTE A RUNNING", "$46 / run"],
    ],
  },
  {
    id: "Q–4355",
    title: "Podcast-to-multichannel editor",
    category: "NEW WORKFLOW",
    domain: "MEDIA",
    region: "EN + ZH",
    risk: "T1",
    budget: "$780",
    budgetValue: 780,
    candidates: "11 CANDIDATES",
    time: "01D 09H",
    status: "CONTRACTING",
    visibility: "DESENSITIZED PUBLIC BRIEF",
    requester: "AI INFRASTRUCTURE TEAM · ID MASKED",
    room: "ER–4355 · CONTRACT PENDING",
    summary:
      "Turn one approved podcast master into clips, platform copy, and bilingual distribution assets with claim parity.",
    input: "Synthetic transcript for Route A · style guide · platform specifications",
    dataScope: "Approved transcript and brand kit only; no guest contacts or unpublished roadmap",
    schedule: "48-hour turnaround after master approval",
    testMode: "ROUTE A PASSED · 4-minute synthetic excerpt",
    deliverables: [
      "Three 45–60 second clips with source timestamps",
      "X, LinkedIn, YouTube, and Chinese-platform copy",
      "EN/ZH claim-parity and asset manifest",
    ],
    acceptance: [
      "Every edited claim maps to a transcript timestamp",
      "No speaker meaning changed by cut order",
      "All exports meet platform specifications",
      "Human approval before any channel publication",
    ],
    candidateList: [
      ["CutRelay v2.2.8", "Mercury Works", "95", "SELECTED", "$420 / episode"],
      ["FrameFoundry v3.2.1", "FrameFoundry Studio", "94", "ROUTE A PASSED", "$48 / asset"],
      ["Locale Bridge v4.4.0", "Polyglot Systems", "93", "ROUTE A PASSED", "$33 / run"],
    ],
  },
];

const defaultQuestDraft = {
  title: "Bilingual launch content quality reviewer",
  objective:
    "Review English and Chinese launch assets for claim parity, source accuracy, and platform readiness before publication.",
  category: "NEW ROLE",
  domain: "MEDIA",
  region: "EN + ZH",
  budget: "1200",
  deadline: "5 BUSINESS DAYS",
  output: "Decision register + corrected copy + evidence links",
  acceptance:
    "100% of changed claims remain source-backed; zero unapproved publication; all critical findings resolved.",
  dataScope: "DESENSITIZED TEST PACK ONLY",
  risk: "T1",
  testRequired: true,
  externalActions: false,
  visibility: "DESENSITIZED PUBLIC BRIEF",
};

const roomDefinitions: RoomDefinition[] = [
  {
    id: "OR–0021",
    name: "VISHWA LAB / ORGANIZATION",
    type: "ORGANIZATION ROOM",
    status: "PRIVATE",
    meta: "12 CAPSULES",
    purpose:
      "The organization root boundary for private knowledge, policy, approved connectors, and reusable Context Capsules.",
    owner: "D. LEE · ORGANIZATION ADMIN",
    retention: "UNTIL REVOKED",
    budget: "$8,000 / MONTH",
    used: "$4,218",
    secrets: "06 VAULTED",
    audit: "COMPLETE",
    capsules: [
      {
        id: "CC–021",
        name: "Company & Product Canon",
        classification: "CONFIDENTIAL",
        scope: "ORGANIZATION ONLY",
        updated: "30 JUL 2026",
        size: "128 ITEMS",
        description:
          "Approved company facts, product definitions, positioning, and claims. Engagements receive selected fields only.",
      },
      {
        id: "CC–019",
        name: "Brand & Communication Policy",
        classification: "INTERNAL",
        scope: "APPROVED ENGAGEMENTS",
        updated: "29 JUL 2026",
        size: "42 ITEMS",
        description:
          "Voice, design, claim, approval, and publication controls used by media and creative workflows.",
      },
      {
        id: "CC–014",
        name: "APAC Strategy Context",
        classification: "RESTRICTED",
        scope: "EXPLICIT GRANT ONLY",
        updated: "26 JUL 2026",
        size: "31 ITEMS",
        description:
          "Internal priorities and decision criteria. Never exposed in a public Quest or Route A test.",
      },
    ],
    agents: [
      {
        id: "RA–021",
        name: "Policy Warden",
        version: "v3.7.6",
        role: "Policy library verification",
        access: "CC–019 / READ ONLY",
        status: "STANDBY",
        expires: "NO EXPIRY",
        permissions: "POLICY READ · DECISION RECORD WRITE",
      },
      {
        id: "RA–018",
        name: "Memory Clerk",
        version: "v1.4.2",
        role: "Context capsule indexing",
        access: "METADATA ONLY",
        status: "ACTIVE",
        expires: "31 AUG 2026",
        permissions: "CAPSULE METADATA READ · INDEX WRITE",
      },
    ],
    approvals: [
      {
        id: "AP–8821",
        action: "Grant CC–019 to ER–7218 for one delivery cycle",
        requester: "Briefsmith v2.0.6",
        cost: "$0.00",
        risk: "T1",
        time: "EXPIRES IN 03H 18M",
      },
    ],
    logs: [
      { time: "08:12:04", event: "CAPSULE READ", actor: "D. LEE", status: "ALLOWED", detail: "CC–021 · 7 fields" },
      { time: "07:59:17", event: "ACCESS GRANT", actor: "POLICY ENGINE", status: "RECORDED", detail: "CC–019 → ER–8842" },
      { time: "07:48:29", event: "SECRET ROTATION", actor: "VAULT", status: "COMPLETE", detail: "Connector key MK–04" },
      { time: "07:32:18", event: "CROSS-ROOM REQUEST", actor: "Briefsmith", status: "PENDING", detail: "CC–019 → ER–7218" },
    ],
  },
  {
    id: "ER–8842",
    name: "APAC COMPETITOR INTELLIGENCE",
    type: "ENGAGEMENT ROOM",
    status: "ACTIVE",
    meta: "04 CONTRACTORS",
    purpose:
      "An isolated runtime for the continuously available APAC competitor-intelligence workflow. Only selected Context Capsule fields reach each exact Agent version.",
    owner: "D. LEE · ENGAGEMENT OWNER",
    retention: "30 DAYS",
    budget: "$1,000 / MONTH",
    used: "$624",
    secrets: "02 VAULTED",
    audit: "COMPLETE",
    capsules: [
      {
        id: "CC–8842–A",
        name: "APAC Competitor Watchlist",
        classification: "ENGAGEMENT PRIVATE",
        scope: "N–01 + N–02",
        updated: "30 JUL 2026",
        size: "38 ENTITIES",
        description:
          "Approved competitor entities, products, and public source targets. No CRM or customer records.",
      },
      {
        id: "CC–8842–B",
        name: "Strategy Decision Lens",
        classification: "RESTRICTED",
        scope: "N–03 ONLY",
        updated: "29 JUL 2026",
        size: "12 FIELDS",
        description:
          "Selected decision criteria projected from the Organization Room for impact analysis only.",
      },
      {
        id: "CC–8842–C",
        name: "Executive Delivery Policy",
        classification: "INTERNAL",
        scope: "N–04 ONLY",
        updated: "28 JUL 2026",
        size: "18 RULES",
        description:
          "Formatting, evidence, approval, and recipient constraints for the final brief.",
      },
    ],
    agents: [],
    approvals: [
      {
        id: "AP–8842",
        action: "Release an executive brief to the approved distribution list",
        requester: "Briefsmith v2.0.6",
        cost: "$29.00",
        risk: "T2",
        time: "EXPIRES IN 01H 42M",
      },
      {
        id: "AP–8839",
        action: "Increase source scan from 31 to 46 approved domains",
        requester: "SignalScout v2.4.1",
        cost: "+$8.40 / RUN",
        risk: "T0",
        time: "EXPIRES IN 06H 10M",
      },
    ],
    logs: [
      { time: "08:16:42", event: "NODE COMPLETE", actor: "Aperture FI", status: "PASSED", detail: "N–03 · Impact Matrix v2" },
      { time: "08:11:03", event: "CAPSULE READ", actor: "Aperture FI", status: "ALLOWED", detail: "CC–8842–B · 12 fields" },
      { time: "08:03:51", event: "CHANGE REGISTER", actor: "DeltaWatch", status: "WRITTEN", detail: "09 material changes" },
      { time: "07:58:20", event: "SOURCE REQUEST", actor: "SignalScout", status: "BLOCKED", detail: "Domain outside approved list" },
      { time: "07:45:00", event: "RUN START", actor: "SCHEDULER", status: "ACTIVE", detail: "RUN–7731 · $1,000 cap" },
    ],
  },
  {
    id: "ER–7218",
    name: "HUBBLE DISTRIBUTION",
    type: "ENGAGEMENT ROOM",
    status: "PAUSED",
    meta: "03 CONTRACTORS",
    purpose:
      "Transforms an approved podcast master into timestamped clips, bilingual copy, and draft channel assets. Publication remains human-gated.",
    owner: "D. LEE · ENGAGEMENT OWNER",
    retention: "45 DAYS",
    budget: "$780 / EPISODE",
    used: "$511",
    secrets: "01 VAULTED",
    audit: "COMPLETE",
    capsules: [
      {
        id: "CC–7218–A",
        name: "Approved Episode Transcript",
        classification: "ENGAGEMENT PRIVATE",
        scope: "ALL MOUNTED AGENTS",
        updated: "29 JUL 2026",
        size: "18,420 WORDS",
        description:
          "Final approved transcript and timestamps. Unpublished guest contacts and roadmap notes are excluded.",
      },
      {
        id: "CC–7218–B",
        name: "Channel & Brand Specification",
        classification: "INTERNAL",
        scope: "CUT + DESIGN + LOCALIZE",
        updated: "28 JUL 2026",
        size: "24 RULES",
        description:
          "Output dimensions, title rules, visual tokens, terminology, and human publication gates.",
      },
    ],
    agents: [
      {
        id: "RA–7218–1",
        name: "CutRelay",
        version: "v2.2.8",
        role: "Timestamped clip editing",
        access: "CC–7218–A / READ",
        status: "PAUSED",
        expires: "05 AUG 2026",
        permissions: "TRANSCRIPT READ · CLIP ASSET WRITE",
      },
      {
        id: "RA–7218–2",
        name: "FrameFoundry",
        version: "v3.2.1",
        role: "Visual packaging",
        access: "CC–7218–B / SELECTED",
        status: "PAUSED",
        expires: "05 AUG 2026",
        permissions: "APPROVED CLIP READ · ASSET WRITE",
      },
      {
        id: "RA–7218–3",
        name: "Locale Bridge",
        version: "v4.4.0",
        role: "EN / ZH claim-parity localization",
        access: "CC–7218–A / SELECTED",
        status: "PAUSED",
        expires: "05 AUG 2026",
        permissions: "TRANSCRIPT READ · COPY DRAFT WRITE",
      },
    ],
    approvals: [
      {
        id: "AP–7218",
        action: "Resume asset generation after revised hook approval",
        requester: "CutRelay v2.2.8",
        cost: "$96.00",
        risk: "T1",
        time: "NO EXPIRY",
      },
    ],
    logs: [
      { time: "19:42:08", event: "ROOM PAUSED", actor: "D. LEE", status: "ENFORCED", detail: "All compute and connector grants revoked" },
      { time: "19:38:55", event: "ASSET REVIEW", actor: "D. LEE", status: "REVISION", detail: "Hook cut requires revision" },
      { time: "18:14:21", event: "LOCALIZATION", actor: "Locale Bridge", status: "COMPLETE", detail: "12 copy variants" },
      { time: "17:03:09", event: "CLIP EXPORT", actor: "CutRelay", status: "COMPLETE", detail: "3 draft clips · unpublished" },
    ],
  },
];

const docsSections: Array<{
  code: string;
  section: DocsSection;
  description: string;
}> = [
  { code: "00", section: "QUICK START", description: "From need to a controlled first run" },
  { code: "01", section: "CORE MODEL", description: "Room, Contractor, Quest, Workflow" },
  { code: "02", section: "WORKFLOWS", description: "Build, replace, insert, quote, deploy" },
  { code: "03", section: "CONTRACTORS", description: "Identity, version, record, network" },
  { code: "04", section: "QUESTS", description: "Issue work and run Route A" },
  { code: "05", section: "ROOMS", description: "Context, grants, approvals, controls" },
  { code: "06", section: "TRUST & CONTROL", description: "Boundaries and fail-closed gates" },
  { code: "07", section: "ECONOMICS", description: "Quotes, fees, referrals, settlement" },
  { code: "08", section: "DEVELOPERS", description: "Publish an Agent with a career" },
  { code: "09", section: "WHITEPAPER", description: "Continental product model v0.4" },
  { code: "10", section: "Q&A", description: "Common product and operation questions" },
];

const faqItems = [
  {
    question: "Is Continental an Agent marketplace?",
    answer:
      "Not only. Discovery is one layer. Continental joins a work network, capability network, and trust network with workflow assembly, controlled execution, contracting, acceptance, and settlement.",
  },
  {
    question: "What is the difference between a Contractor and an Agent?",
    answer:
      "A Contractor is an Agent packaged as a rentable, composable, schedulable service with a tested version, explicit input/output contract, permissions, price, availability, and delivery record.",
  },
  {
    question: "Why does reputation attach to a version instead of the Agent identity?",
    answer:
      "An Agent can change its model, prompt, tools, data access, or interfaces. Those changes can alter behavior. Continental therefore tests and scores the executable version; material changes require a new test.",
  },
  {
    question: "Does viewing or issuing a Quest share private company data?",
    answer:
      "No. The Quest Board exposes only a desensitized brief. Organization files, memory, keys, and private context enter an isolated Engagement Room only after user approval and contract.",
  },
  {
    question: "What does Route A prove?",
    answer:
      "In this demo, Route A is the pre-contract synthetic eligibility path. It tests one Agent version against one Quest acceptance contract with no Room access, no live credentials, no external actions, and a capped test cost. Passing makes the version eligible; it does not create a contract.",
  },
  {
    question: "Can an Agent access information from another customer or Room?",
    answer:
      "No by design. Every Room is an isolated data, key, memory, budget, execution, and audit boundary. Cross-Room access is denied unless an authorized user creates an explicit, narrow projection into the target Room.",
  },
  {
    question: "Can a mounted Agent perform external actions automatically?",
    answer:
      "Only within the approved mandate. High-impact actions remain human-gated, and every approval is scoped to one action, version, cost, and expiry. A Room can also block all external actions.",
  },
  {
    question: "What happens after replacing or inserting a Contractor?",
    answer:
      "The workflow quote, downstream interface checks, permissions, and Dry Run become stale. Continental requires revalidation before the modified workflow can deploy.",
  },
  {
    question: "How are referrals handled?",
    answer:
      "A recommendation identifies who referred the version, why it fits, and any Quest-linked commission. Commission is paid only after accepted delivery and comes from Continental’s platform fee, capped within the top 5% fee—not as a hidden surcharge.",
  },
  {
    question: "What does the Kill Switch preserve?",
    answer:
      "It revokes Agent grants, schedules, credentials, connectors, and pending actions. It preserves immutable audit and settlement evidence so the organization can review what happened.",
  },
  {
    question: "Is the current site executing real Agents or payments?",
    answer:
      "No. This is an interactive product demo with simulated records and state. Real production use still requires authenticated accounts, durable storage, model and Agent runtimes, connectors, billing, contracting, and settlement infrastructure.",
  },
  {
    question: "Can first-party Continental Agents be replaced?",
    answer:
      "Yes. A first-party version may be recommended, but the user can replace it with any eligible higher-fit Contractor that satisfies availability, permission, interface, risk, test, and price requirements.",
  },
];

const quoteOptions: Record<QuoteMode, { total: string; score: string; speed: string; delta: string }> = {
  "BEST VALUE": { total: "$824–$968", score: "93.4", speed: "18 min", delta: "RECOMMENDED" },
  "HIGHEST SCORE": { total: "$1,126–$1,340", score: "97.1", speed: "24 min", delta: "+38% COST" },
  "LOWEST COST": { total: "$602–$748", score: "88.6", speed: "31 min", delta: "–25% COST" },
  FASTEST: { total: "$1,048–$1,216", score: "91.9", speed: "8 min", delta: "–56% TIME" },
};

function ScreenHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="screen-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {subtitle && <p className="screen-subtitle">{subtitle}</p>}
    </div>
  );
}

function WorkflowRoute({ active }: { active: number }) {
  return (
    <div className="route-line">
      {["NEED", "MAP", "VERIFY", "DEPLOY"].map((step, index) => (
        <div className="route-fragment" key={step}>
          {index > 0 && <i className={index <= active ? "complete" : ""} />}
          <div className={`route-step ${index <= active ? "active" : ""}`}>
            <span>{index < active ? "✓" : `0${index + 1}`}</span>
            <strong>{step}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  );
}

function HomeContent() {
  const currentUser = useCurrentUser()!;
  const [view, setView] = useState<View>("dashboard");
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [orgLoading, setOrgLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");

  useEffect(() => {
    fetch("/api/organizations", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setOrgs(data); setOrgLoading(false); })
      .catch(() => setOrgLoading(false));
  }, []);

  const currentOrg = orgs[0];

  const [request, setRequest] = useState(
    "We need a competitor intelligence workflow for our APAC fintech team.",
  );
  const [needBriefFields, setNeedBriefFields] =
    useState<NeedBriefField[]>(initialNeedBriefFields);
  const [editingBriefId, setEditingBriefId] = useState("");
  const [editingBriefValue, setEditingBriefValue] = useState("");
  const [editingRequest, setEditingRequest] = useState(false);
  const [requestDraft, setRequestDraft] = useState(request);
  const [assumption, setAssumption] = useState(
    "Public sources are sufficient for v1. Internal CRM and paid intelligence feeds remain disconnected until deployment review.",
  );
  const [editingAssumption, setEditingAssumption] = useState(false);
  const [assumptionDraft, setAssumptionDraft] = useState(assumption);
  const [privateContextOpen, setPrivateContextOpen] = useState(false);
  const [privateContextText, setPrivateContextText] = useState("");
  const [privateContextItems, setPrivateContextItems] = useState<PrivateContextItem[]>([]);
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>(initialWorkflowNodes);
  const [selectedNode, setSelectedNode] = useState(0);
  const [quoteMode, setQuoteMode] = useState<QuoteMode>("BEST VALUE");
  const [dryRun, setDryRun] = useState<"idle" | "running" | "passed">("idle");
  const [deployed, setDeployed] = useState(false);
  const [toast, setToast] = useState("");
  const [workflowChange, setWorkflowChange] = useState("");

  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceStep, setReplaceStep] = useState<"select" | "review">("select");
  const [replacementQuery, setReplacementQuery] = useState("");
  const [replacementAvailability, setReplacementAvailability] = useState("ALL");
  const [replacementId, setReplacementId] = useState("");

  const [insertOpen, setInsertOpen] = useState(false);
  const [insertStep, setInsertStep] = useState<InsertStep>(0);
  const [insertTemplateId, setInsertTemplateId] = useState(insertTemplates[0].id);
  const [insertOutcome, setInsertOutcome] = useState(insertTemplates[0].outcome);
  const [insertAfter, setInsertAfter] = useState(1);
  const [insertCandidateId, setInsertCandidateId] = useState(candidatePools["visual-design"][0].id);
  const [insertScopes, setInsertScopes] = useState(["VERIFIED NODE OUTPUT", "BRAND KIT"]);
  const [insertApproval, setInsertApproval] = useState(true);
  const [insertBudget, setInsertBudget] = useState("60");

  const [contractorSearch, setContractorSearch] = useState("");
  const [contractorDomain, setContractorDomain] = useState("ALL");
  const [contractorRisk, setContractorRisk] = useState("ALL");
  const [contractorRegion, setContractorRegion] = useState("ALL");
  const [contractorStatus, setContractorStatus] = useState("ALL");
  const [contractorProfileId, setContractorProfileId] = useState("");
  const [contractorProfileTab, setContractorProfileTab] =
    useState<ContractorProfileTab>("AGENT CARD");
  const [shortlistedContractors, setShortlistedContractors] = useState<string[]>([]);

  const [issuedQuests, setIssuedQuests] = useState<QuestProfile[]>([]);
  const [questProfileId, setQuestProfileId] = useState("");
  const [questProfileTab, setQuestProfileTab] = useState<QuestProfileTab>("BRIEF");
  const [issueQuestOpen, setIssueQuestOpen] = useState(false);
  const [issueQuestStep, setIssueQuestStep] = useState<IssueQuestStep>(0);
  const [questDraft, setQuestDraft] = useState({ ...defaultQuestDraft });
  const [routeTestOpen, setRouteTestOpen] = useState(false);
  const [routeTestStep, setRouteTestStep] = useState<RouteTestStep>(0);
  const [routeQuestId, setRouteQuestId] = useState(questProfiles[0].id);
  const [routeAgentId, setRouteAgentId] = useState(contractorCards[0].id);
  const [routeTestResult, setRouteTestResult] =
    useState<"idle" | "running" | "passed">("idle");
  const [routeNominations, setRouteNominations] = useState<
    Array<{ questId: string; agentId: string }>
  >([]);

  const [selectedRoomId, setSelectedRoomId] = useState("ER–8842");
  const [roomTab, setRoomTab] = useState<RoomTab>("OVERVIEW");
  const [roomStatusOverrides, setRoomStatusOverrides] = useState<Record<string, string>>({});
  const [roomApprovalDecisions, setRoomApprovalDecisions] =
    useState<Record<string, "APPROVED" | "DENIED">>({});
  const [roomAgentInspectId, setRoomAgentInspectId] = useState("");
  const [roomLogFilter, setRoomLogFilter] = useState("ALL EVENTS");
  const [selectedCapsuleId, setSelectedCapsuleId] = useState("");
  const [extraRoomCapsules, setExtraRoomCapsules] =
    useState<Record<string, RoomCapsule[]>>({});
  const [contextCapsuleOpen, setContextCapsuleOpen] = useState(false);
  const [newCapsuleName, setNewCapsuleName] = useState("Approved Campaign Reference Pack");
  const [newCapsuleClassification, setNewCapsuleClassification] =
    useState("ENGAGEMENT PRIVATE");
  const [newCapsuleScope, setNewCapsuleScope] = useState("SELECTED AGENTS");
  const [newCapsuleDescription, setNewCapsuleDescription] = useState(
    "Reference material approved for this engagement only.",
  );
  const [killRoomId, setKillRoomId] = useState("");
  const [roomRetentionOverrides, setRoomRetentionOverrides] =
    useState<Record<string, string>>({});
  const [roomBudgetOverrides, setRoomBudgetOverrides] =
    useState<Record<string, string>>({});

  const [docsSection, setDocsSection] = useState<DocsSection>("QUICK START");
  const [docsQuery, setDocsQuery] = useState("");
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  const privateFileCount = privateContextItems.filter((item) => item.kind === "FILE").length;
  const privateNoteCount = privateContextItems.filter((item) => item.kind === "NOTE").length;
  const briefIndustry =
    needBriefFields.find((field) => field.id === "industry")?.value ?? "THE CONFIRMED DOMAIN";
  const briefOutcome =
    needBriefFields.find((field) => field.id === "outcome")?.value ?? "THE CONFIRMED OUTCOME";

  const activeWorkflowNode = workflowNodes[selectedNode] ?? workflowNodes[0];
  const replacementPool = candidatePools[activeWorkflowNode.capability];
  const filteredReplacementPool = replacementPool.filter((candidate) => {
    const matchesQuery = `${candidate.name} ${candidate.maker} ${candidate.region}`
      .toLowerCase()
      .includes(replacementQuery.toLowerCase());
    const matchesAvailability =
      replacementAvailability === "ALL" || candidate.status === replacementAvailability;
    return matchesQuery && matchesAvailability;
  });
  const replacementCandidate = replacementPool.find((candidate) => candidate.id === replacementId);

  const selectedInsertTemplate =
    insertTemplates.find((template) => template.id === insertTemplateId) ?? insertTemplates[0];
  const insertCandidatePool = candidatePools[selectedInsertTemplate.capability];
  const selectedInsertCandidate =
    insertCandidatePool.find((candidate) => candidate.id === insertCandidateId) ??
    insertCandidatePool[0];
  const filteredContractors = contractorCards.filter((contractor) => {
    const searchText = [
      contractor.name,
      contractor.maker,
      contractor.role,
      contractor.domain,
      contractor.region,
      ...contractor.capabilities,
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = searchText.includes(contractorSearch.toLowerCase());
    const matchesDomain = contractorDomain === "ALL" || contractor.domain === contractorDomain;
    const matchesRisk = contractorRisk === "ALL" || contractor.risk === contractorRisk;
    const matchesRegion =
      contractorRegion === "ALL" || contractor.region.includes(contractorRegion);
    const matchesStatus =
      contractorStatus === "ALL" || contractor.availability === contractorStatus;
    return matchesSearch && matchesDomain && matchesRisk && matchesRegion && matchesStatus;
  });
  const activeContractorProfile = contractorCards.find(
    (contractor) => contractor.id === contractorProfileId,
  );
  const allQuests = [...issuedQuests, ...questProfiles];
  const activeQuestProfile = allQuests.find((quest) => quest.id === questProfileId);
  const routeQuest = allQuests.find((quest) => quest.id === routeQuestId) ?? allQuests[0];
  const routeAgent =
    contractorCards.find((contractor) => contractor.id === routeAgentId) ??
    contractorCards[0];
  const activeQuestNomination = routeNominations.find(
    (nomination) => nomination.questId === activeQuestProfile?.id,
  );
  const activeQuestNominatedAgent = contractorCards.find(
    (contractor) => contractor.id === activeQuestNomination?.agentId,
  );
  const selectedRoom =
    roomDefinitions.find((room) => room.id === selectedRoomId) ?? roomDefinitions[1];
  const selectedRoomStatus =
    roomStatusOverrides[selectedRoom.id] ??
    (selectedRoom.id === "ER–8842" && deployed ? "ACTIVE" : selectedRoom.status);
  const selectedRoomCapsules = [
    ...selectedRoom.capsules,
    ...(extraRoomCapsules[selectedRoom.id] ?? []),
  ];
  const selectedCapsule = selectedRoomCapsules.find(
    (capsule) => capsule.id === selectedCapsuleId,
  );
  const selectedRoomAgents: RoomAgent[] =
    selectedRoom.id === "ER–8842"
      ? workflowNodes.map((node, index) => {
          const nameParts = node.contractor.split(" ");
          const version = nameParts.at(-1)?.startsWith("v") ? nameParts.at(-1)! : "CURRENT";
          const name = nameParts.at(-1)?.startsWith("v")
            ? nameParts.slice(0, -1).join(" ")
            : node.contractor;
          return {
            id: `RA–8842–${index + 1}`,
            name,
            version,
            role: node.title,
            access:
              index === 0
                ? "CC–8842–A / READ"
                : index === 1
                  ? "CC–8842–A / OUTPUT"
                  : index === 2
                    ? "CC–8842–B / SELECTED"
                    : "CC–8842–C / SELECTED",
            status:
              selectedRoomStatus === "STOPPED"
                ? "REVOKED"
                : selectedRoomStatus === "PAUSED"
                  ? "PAUSED"
                  : selectedRoomStatus === "DRAFT"
                    ? "NOT MOUNTED"
                    : "ACTIVE",
            expires: "30 AUG 2026",
            permissions: `${node.input} → ${node.output}`,
          };
        })
      : selectedRoom.agents.map((agent) => ({
          ...agent,
          status:
            selectedRoomStatus === "STOPPED"
              ? "REVOKED"
              : selectedRoomStatus === "PAUSED"
                ? "PAUSED"
                : agent.status,
        }));
  const inspectedRoomAgent = selectedRoomAgents.find(
    (agent) => agent.id === roomAgentInspectId,
  );
  const selectedRoomLogs = selectedRoom.logs.filter(
    (log) =>
      roomLogFilter === "ALL EVENTS" ||
      (roomLogFilter === "BLOCKED & PENDING"
        ? ["BLOCKED", "PENDING"].includes(log.status)
        : log.actor.toUpperCase().includes(roomLogFilter.replace("AGENT: ", ""))),
  );
  const filteredDocsSections = docsSections.filter((item) =>
    `${item.section} ${item.description}`.toLowerCase().includes(docsQuery.toLowerCase()),
  );

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const activeNav =
    view === "confirmation" || view === "quote" || view === "deployment"
      ? "workflow"
      : view;

  function analyzeRequest() {
    setRequestDraft(request);
    setEditingRequest(false);
    setEditingBriefId("");
    setEditingAssumption(false);
    setView("confirmation");
  }

  function beginBriefEdit(field: NeedBriefField) {
    setEditingBriefId(field.id);
    setEditingBriefValue(field.value);
  }

  function saveBriefEdit() {
    const nextValue = editingBriefValue.trim();
    if (!editingBriefId || !nextValue) return;
    setNeedBriefFields((fields) =>
      fields.map((field) =>
        field.id === editingBriefId
          ? { ...field, value: nextValue.toUpperCase(), confidence: "USER SET" }
          : field,
      ),
    );
    setEditingBriefId("");
    showToast("NEED BRIEF UPDATED · USER INPUT TAKES PRIORITY");
  }

  function saveRequestEdit() {
    const nextRequest = requestDraft.trim();
    if (!nextRequest) return;
    setRequest(nextRequest);
    setEditingRequest(false);
    showToast("ORIGINAL REQUEST UPDATED");
  }

  function saveAssumptionEdit() {
    const nextAssumption = assumptionDraft.trim();
    if (!nextAssumption) return;
    setAssumption(nextAssumption);
    setEditingAssumption(false);
    showToast("ASSUMPTION UPDATED · USER REVIEWED");
  }

  function addPrivateNote() {
    const detail = privateContextText.trim();
    if (!detail) return;
    const noteCount = privateNoteCount + 1;
    setPrivateContextItems((items) => [
      ...items,
      {
        id: `NOTE-${Date.now()}`,
        kind: "NOTE",
        name: `PRIVATE NOTE ${String(noteCount).padStart(2, "0")}`,
        detail,
        size: `${detail.length} CHR`,
        status: "STAGED",
      },
    ]);
    setPrivateContextText("");
    showToast("PRIVATE NOTE ADDED TO CONTEXT CAPSULE");
  }

  function stagePrivateFiles(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;
    const acceptedFiles = selectedFiles.filter((file) => file.size <= 12 * 1024 * 1024);
    const rejectedCount = selectedFiles.length - acceptedFiles.length;
    const nextItems: PrivateContextItem[] = acceptedFiles.map((file, index) => ({
      id: `FILE-${Date.now()}-${index}`,
      kind: "FILE",
      name: file.name,
      detail: file.type || file.name.split(".").pop()?.toUpperCase() || "DOCUMENT",
      size: formatFileSize(file.size),
      status: "STAGED",
    }));
    setPrivateContextItems((items) => {
      const existingKeys = new Set(items.map((item) => `${item.name}:${item.size}`));
      return [...items, ...nextItems.filter((item) => !existingKeys.has(`${item.name}:${item.size}`))];
    });
    showToast(
      rejectedCount
        ? `${acceptedFiles.length} FILES STAGED · ${rejectedCount} OVER 12 MB SKIPPED`
        : `${acceptedFiles.length} PRIVATE FILE${acceptedFiles.length === 1 ? "" : "S"} STAGED`,
    );
  }

  function removePrivateContext(id: string) {
    setPrivateContextItems((items) => items.filter((item) => item.id !== id));
    showToast("PRIVATE CONTEXT ITEM REMOVED");
  }

  function confirmNeedBrief() {
    setView("workflow");
    showToast(
      `WORKFLOW GENERATED · ${needBriefFields.length} CONFIRMED FIELDS · ${privateContextItems.length} PRIVATE ITEMS`,
    );
  }

  function runDryRun() {
    setDryRun("running");
    window.setTimeout(() => setDryRun("passed"), 1200);
  }

  function candidateCanRun(candidate: ContractorCandidate) {
    return candidate.status !== "MAINTENANCE" && candidate.compatibility !== "BLOCKED";
  }

  function openReplacement() {
    const firstCandidate = replacementPool.find(candidateCanRun) ?? replacementPool[0];
    setReplacementId(firstCandidate.id);
    setReplacementQuery("");
    setReplacementAvailability("ALL");
    setReplaceStep("select");
    setReplaceOpen(true);
  }

  function confirmReplacement() {
    if (!replacementCandidate || !candidateCanRun(replacementCandidate)) return;
    const previousContractor = activeWorkflowNode.contractor;
    setWorkflowNodes((currentNodes) =>
      currentNodes.map((node, index) =>
        index === selectedNode
          ? {
              ...node,
              contractor: `${replacementCandidate.name} ${replacementCandidate.version}`,
              owner: replacementCandidate.maker,
              score: replacementCandidate.score,
              risk: replacementCandidate.risk,
              price: `$${replacementCandidate.price} / run`,
              priceValue: replacementCandidate.price,
            }
          : node,
      ),
    );
    setDryRun("idle");
    setDeployed(false);
    setWorkflowChange(
      `${activeWorkflowNode.code} changed from ${previousContractor} to ${replacementCandidate.name} ${replacementCandidate.version}. Quote and Dry Run must be renewed.`,
    );
    setReplaceOpen(false);
    showToast("CONTRACTOR REPLACED · REVALIDATION REQUIRED");
  }

  function openInsertAgent(afterIndex = selectedNode) {
    const template = insertTemplates[0];
    const firstCandidate =
      candidatePools[template.capability].find(candidateCanRun) ?? candidatePools[template.capability][0];
    setInsertTemplateId(template.id);
    setInsertOutcome(template.outcome);
    setInsertAfter(afterIndex);
    setInsertCandidateId(firstCandidate.id);
    setInsertScopes(["VERIFIED NODE OUTPUT", "BRAND KIT"]);
    setInsertApproval(true);
    setInsertBudget("60");
    setInsertStep(0);
    setInsertOpen(true);
  }

  function selectInsertTemplate(template: InsertTemplate) {
    const firstCandidate =
      candidatePools[template.capability].find(candidateCanRun) ?? candidatePools[template.capability][0];
    setInsertTemplateId(template.id);
    setInsertOutcome(template.outcome);
    setInsertCandidateId(firstCandidate.id);
    setInsertScopes(
      template.capability === "visual-design"
        ? ["VERIFIED NODE OUTPUT", "BRAND KIT"]
        : ["VERIFIED NODE OUTPUT"],
    );
  }

  function toggleInsertScope(scope: string) {
    setInsertScopes((currentScopes) =>
      currentScopes.includes(scope)
        ? currentScopes.filter((currentScope) => currentScope !== scope)
        : [...currentScopes, scope],
    );
  }

  function confirmInsertAgent() {
    if (!selectedInsertCandidate || !candidateCanRun(selectedInsertCandidate)) return;
    const insertionIndex = Math.min(insertAfter + 1, workflowNodes.length);
    const upstream = workflowNodes[insertAfter];
    const insertedNode: WorkflowNode = {
      code: "N–00",
      title: selectedInsertTemplate.title,
      capability: selectedInsertTemplate.capability,
      objective: insertOutcome,
      contractor: `${selectedInsertCandidate.name} ${selectedInsertCandidate.version}`,
      owner: selectedInsertCandidate.maker,
      score: selectedInsertCandidate.score,
      risk: selectedInsertCandidate.risk,
      price: `$${selectedInsertCandidate.price} / run`,
      priceValue: selectedInsertCandidate.price,
      input: `${upstream.output} · ${insertScopes.join(" + ")}`,
      output: selectedInsertTemplate.output,
      gate: insertApproval
        ? `Human approval · ${selectedInsertTemplate.gate}`
        : selectedInsertTemplate.gate,
    };

    setWorkflowNodes((currentNodes) => {
      const nextNodes = [...currentNodes];
      nextNodes.splice(insertionIndex, 0, insertedNode);
      return nextNodes.map((node, index) => ({
        ...node,
        code: `N–${String(index + 1).padStart(2, "0")}`,
      }));
    });
    setSelectedNode(insertionIndex);
    setDryRun("idle");
    setDeployed(false);
    setWorkflowChange(
      `${selectedInsertTemplate.title} inserted after ${upstream.title} with ${selectedInsertCandidate.name}. Downstream interfaces, quote and Dry Run require renewal.`,
    );
    setInsertOpen(false);
    showToast("NEW AGENT INSERTED · WORKFLOW REVALIDATION REQUIRED");
  }

  function openContractorProfile(contractorId: string) {
    setContractorProfileId(contractorId);
    setContractorProfileTab("AGENT CARD");
  }

  function toggleContractorShortlist(contractorId: string) {
    setShortlistedContractors((current) =>
      current.includes(contractorId)
        ? current.filter((id) => id !== contractorId)
        : [...current, contractorId],
    );
    showToast(
      shortlistedContractors.includes(contractorId)
        ? "CONTRACTOR REMOVED FROM SHORTLIST"
        : "CONTRACTOR ADDED TO SHORTLIST",
    );
  }

  function clearContractorFilters() {
    setContractorSearch("");
    setContractorDomain("ALL");
    setContractorRisk("ALL");
    setContractorRegion("ALL");
    setContractorStatus("ALL");
  }

  function openQuestProfile(questId: string) {
    setQuestProfileId(questId);
    setQuestProfileTab("BRIEF");
  }

  function openIssueQuest() {
    setQuestDraft({ ...defaultQuestDraft });
    setIssueQuestStep(0);
    setIssueQuestOpen(true);
  }

  function updateQuestDraft(
    field: keyof typeof defaultQuestDraft,
    value: string | boolean,
  ) {
    setQuestDraft((current) => ({ ...current, [field]: value }));
  }

  function publishQuest() {
    const questNumber = 4390 + issuedQuests.length;
    const id = `Q–${questNumber}`;
    const publishedQuest: QuestProfile = {
      id,
      title: questDraft.title,
      category: questDraft.category,
      domain: questDraft.domain,
      region: questDraft.region,
      risk: questDraft.risk,
      budget: `$${Number(questDraft.budget || 0).toLocaleString()}`,
      budgetValue: Number(questDraft.budget || 0),
      candidates: "0 CANDIDATES",
      time: questDraft.deadline,
      status: "OPEN",
      visibility: questDraft.visibility,
      requester: "VISHWA LAB / VERIFIED",
      room: "CREATED AFTER CONTRACT",
      summary: questDraft.objective,
      input: `${questDraft.dataScope} · Context Capsule pending`,
      dataScope: questDraft.dataScope,
      schedule: questDraft.deadline,
      testMode: questDraft.testRequired
        ? "ROUTE A REQUIRED · synthetic pack"
        : "ROUTE A OPTIONAL",
      deliverables: questDraft.output
        .split("+")
        .map((item) => item.trim())
        .filter(Boolean),
      acceptance: questDraft.acceptance
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean),
      candidateList: [],
    };
    setIssuedQuests((current) => [publishedQuest, ...current]);
    setIssueQuestOpen(false);
    setQuestProfileId(id);
    setQuestProfileTab("BRIEF");
    showToast(`${id} ISSUED · DESENSITIZED BRIEF LIVE`);
  }

  function openRouteTest(questId?: string) {
    const firstRoutableAgent =
      contractorCards.find((contractor) => contractor.availability !== "MAINTENANCE") ??
      contractorCards[0];
    setRouteQuestId(questId ?? allQuests[0].id);
    setRouteAgentId(firstRoutableAgent.id);
    setRouteTestResult("idle");
    setRouteTestStep(0);
    setQuestProfileId("");
    setRouteTestOpen(true);
  }

  function runRouteATest() {
    setRouteTestResult("running");
    window.setTimeout(() => {
      setRouteTestResult("passed");
      setRouteTestStep(3);
    }, 1300);
  }

  function nominateRouteTest() {
    setRouteNominations((current) => {
      const withoutDuplicate = current.filter(
        (nomination) => nomination.questId !== routeQuest.id,
      );
      return [...withoutDuplicate, { questId: routeQuest.id, agentId: routeAgent.id }];
    });
    setRouteTestOpen(false);
    setQuestProfileId(routeQuest.id);
    setQuestProfileTab("CANDIDATES");
    showToast(`${routeAgent.name.toUpperCase()} NOMINATED TO ${routeQuest.id}`);
  }

  function selectRoom(roomId: string) {
    setSelectedRoomId(roomId);
    setRoomTab("OVERVIEW");
    setRoomAgentInspectId("");
    setSelectedCapsuleId("");
  }

  function decideRoomApproval(approvalId: string, decision: "APPROVED" | "DENIED") {
    setRoomApprovalDecisions((current) => ({ ...current, [approvalId]: decision }));
    showToast(`${approvalId} ${decision}`);
  }

  function toggleRoomPause() {
    if (selectedRoomStatus === "STOPPED") return;
    const nextStatus = selectedRoomStatus === "PAUSED" ? "ACTIVE" : "PAUSED";
    setRoomStatusOverrides((current) => ({ ...current, [selectedRoom.id]: nextStatus }));
    showToast(`${selectedRoom.id} ${nextStatus}`);
  }

  function confirmKillRoom() {
    if (!killRoomId) return;
    setRoomStatusOverrides((current) => ({ ...current, [killRoomId]: "STOPPED" }));
    setKillRoomId("");
    setRoomTab("OVERVIEW");
    showToast(`${selectedRoom.id} STOPPED · ALL GRANTS REVOKED`);
  }

  function openContextCapsule() {
    setNewCapsuleName("Approved Campaign Reference Pack");
    setNewCapsuleClassification("ENGAGEMENT PRIVATE");
    setNewCapsuleScope("SELECTED AGENTS");
    setNewCapsuleDescription("Reference material approved for this engagement only.");
    setContextCapsuleOpen(true);
  }

  function createContextCapsule() {
    const nextIndex =
      selectedRoom.capsules.length + (extraRoomCapsules[selectedRoom.id]?.length ?? 0) + 1;
    const capsule: RoomCapsule = {
      id: `CC–${selectedRoom.id.replace(/[A-Z–]/g, "")}–${String(nextIndex).padStart(2, "0")}`,
      name: newCapsuleName,
      classification: newCapsuleClassification,
      scope: newCapsuleScope,
      updated: "31 JUL 2026",
      size: "01 DRAFT ITEM",
      description: newCapsuleDescription,
    };
    setExtraRoomCapsules((current) => ({
      ...current,
      [selectedRoom.id]: [...(current[selectedRoom.id] ?? []), capsule],
    }));
    setSelectedCapsuleId(capsule.id);
    setContextCapsuleOpen(false);
    showToast(`${capsule.id} CREATED · NO AGENT ACCESS GRANTED`);
  }

  function openDocs(section: DocsSection = "QUICK START") {
    setDocsSection(section);
    setView("docs");
  }

  return (
    <main className="console-shell">
      <div className="crt-overlay" aria-hidden="true" />
      {toast && <div className="system-toast">◆ {toast}</div>}

      <header className="topbar">
        <button className="wordmark" onClick={() => setView("intake")} type="button">
          CONTINENTAL<span className="wordmark-mark">◆</span>
        </button>
        <div className="system-strip">
          <span className="status-light" />
          TRUST NETWORK ONLINE
          <span className="system-divider">/</span>
          428 VERIFIED CONTRACTORS
          <span className="system-divider">/</span>
          LN—02 0715
        </div>
        <button className="developer-link" onClick={() => setView("developer")} type="button">
          FOR DEVELOPERS
        </button>
        <button className="identity-button" type="button" onClick={async () => { const { logout } = await import("./lib/auth"); await logout(); window.location.reload(); }}>
          {currentUser.name || currentUser.email} <span className="identity-role">LOGOUT</span>
        </button>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="nav-label">CATEGORY</div>
          <nav aria-label="Primary">
            {navItems.map((item) => (
              <button
                className={`nav-item ${activeNav === item.view ? "active" : ""}`}
                key={item.label}
                onClick={() => setView(item.view)}
                type="button"
              >
                <span>{item.code}</span> {item.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-bottom">
            <div className="sidebar-stat"><span>ORGANIZATION</span><strong>VISHWA LAB / APAC</strong></div>
            <div className="sidebar-stat"><span>ACTIVE RUNS</span><strong>018 / 020</strong></div>
            <div className="sidebar-stat"><span>MONTHLY BUDGET</span><strong>$4,218 / $8,000</strong></div>
          </div>
        </aside>

        <section className={`command-stage view-${view}`}>
          {orgLoading && <div className="loading-overlay"><div className="loading-spinner" /></div>}
          {!orgLoading && orgs.length === 0 && view === "dashboard" && (
            <OrgOnboarding onComplete={() => { fetch("/api/organizations", { credentials: "include" }).then((r) => r.json()).then(setOrgs); }} />
          )}
          {view === "dashboard" && currentOrg && (
            <Dashboard
              organizationId={currentOrg.id}
              onCreateTask={(wfId) => { setSelectedWorkflowId(wfId || ""); setView("create-task"); }}
              onViewTask={(id) => { setSelectedTaskId(id); setView("task-detail"); }}
            />
          )}
          {view === "create-task" && currentOrg && (
            <TaskCreate
              organizationId={currentOrg.id}
              initialWorkflowId={selectedWorkflowId}
              onCreated={(id) => { setSelectedTaskId(id); setView("task-detail"); }}
              onCancel={() => setView("dashboard")}
            />
          )}
          {view === "task-detail" && <TaskDetail taskId={selectedTaskId} onBack={() => setView("dashboard")} />}
          {view === "organization" && currentOrg && <AgentBrowser organizationId={currentOrg.id} />}
          {view === "agents" && currentOrg && <WorkflowManager organizationId={currentOrg.id} />}
          {view === "agent-workflows" && currentOrg && <OrgManager organizationId={currentOrg.id} organizationName={currentOrg.name} />}
          {view === "rooms" && <RoomsManager />}
          {view === "intake" && (
            <>
              <div className="stage-heading">
                <div>
                  <p className="eyebrow">COMMAND / BUSINESS NEED INTAKE</p>
                  <h1>State the work.<br />The network assembles.</h1>
                </div>
                <div className="room-seal"><span>ROOM</span><strong>CN–8842</strong><small>ISOLATED</small></div>
              </div>

              <div className="terminal-grid">
                <section className="terminal-panel intake-panel">
                  <div className="panel-bar"><span>WORK ORDER</span><span className="panel-meta">INFORMATION</span></div>
                  <div className="record-table">
                    {[
                      ["SUBJECT", "NEW WORK ORDER"],
                      ["ACCESS", "ORGANIZATION ROOM"],
                      ["EXTERNAL ACTIONS", "APPROVAL REQUIRED"],
                      ["DATA POLICY", "PRIVATE BY DEFAULT"],
                    ].map(([label, value], index) => (
                      <div className={index === 0 ? "record-row selected" : "record-row"} key={label}>
                        <span className="row-arrow">&gt;</span>
                        <span className="record-label">{label}</span>
                        <span className="record-dots" aria-hidden="true" />
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                  <label className="request-label" htmlFor="need-request">
                    <span>REQUEST STATEMENT</span>
                    <span>{String(request.length).padStart(3, "0")} CHR</span>
                  </label>
                  <textarea
                    id="need-request"
                    value={request}
                    onChange={(event) => setRequest(event.target.value)}
                    placeholder="Tell us what you are trying to get done…"
                  />
                  <div className="prompt-chips" aria-label="Example requests">
                    <button onClick={() => setRequest("Find and validate a profitable one-person business I can launch in Japan.")} type="button">DIRECTION FINDING</button>
                    <button onClick={() => setRequest("Build a compliant, continuously available content engine for our crypto research team.")} type="button">CONTENT OPS</button>
                    <button onClick={() => setRequest("Automate qualified partner research and outreach for our APAC expansion.")} type="button">PARTNER GROWTH</button>
                  </div>
                  <div className="terminal-actions">
                    <span>&lt; PRIVATE BY DEFAULT &gt;</span>
                    <button className="transmit-button" disabled={!request.trim()} onClick={analyzeRequest} type="button">TRANSMIT REQUEST</button>
                  </div>
                </section>

                <aside className="assurance-panel">
                  <div className="assurance-heading"><p>ADMINISTRATION</p><span className="status-ready">● READY</span></div>
                  <WorkflowRoute active={0} />
                  <div className="protocol-list">
                    {[["ROOM BOUNDARY", "ENFORCED"], ["HUMAN APPROVAL", "REQUIRED"], ["BUDGET CEILING", "UNSET"], ["DATA RETENTION", "30 DAYS"]].map(([label, value]) => (
                      <div key={label}><span>{label}</span><strong>{value}</strong></div>
                    ))}
                  </div>
                  <div className="assurance-note">
                    <span className="shield-glyph">◇</span>
                    <p>Your request creates an isolated Organization Room. No contractor receives private context until you approve scope, access, and price.</p>
                  </div>
                </aside>
              </div>
            </>
          )}

          {view === "confirmation" && (
            <>
              <ScreenHeading
                eyebrow="COMMAND / NEED CONFIRMATION"
                title="Confirm what the system understood."
                subtitle="The workflow is not generated until you approve the context capsule."
              />
              <div className="confirmation-layout">
                <section className="terminal-panel confirmation-card">
                  <div className="panel-bar"><span>NEED BRIEF / NB–8842</span><span>CONFIDENCE 91%</span></div>
                  <div className="brief-original">
                    <div className="brief-section-heading">
                      <span>ORIGINAL REQUEST</span>
                      <button
                        onClick={() => {
                          setRequestDraft(request);
                          setEditingRequest(true);
                        }}
                        type="button"
                      >
                        EDIT
                      </button>
                    </div>
                    {editingRequest ? (
                      <div className="brief-original-edit">
                        <textarea
                          aria-label="Edit original request"
                          autoFocus
                          onChange={(event) => setRequestDraft(event.target.value)}
                          value={requestDraft}
                        />
                        <div className="brief-edit-actions">
                          <button onClick={() => setEditingRequest(false)} type="button">CANCEL</button>
                          <button disabled={!requestDraft.trim()} onClick={saveRequestEdit} type="button">SAVE REQUEST</button>
                        </div>
                      </div>
                    ) : (
                      <p>{request}</p>
                    )}
                  </div>
                  <div className="brief-fields">
                    {needBriefFields.map((field) => (
                      <div className={`brief-row ${editingBriefId === field.id ? "editing" : ""}`} key={field.id}>
                        <span>{field.label}</span>
                        {editingBriefId === field.id ? (
                          <div className="brief-inline-editor">
                            <input
                              aria-label={`Edit ${field.label}`}
                              autoFocus
                              onChange={(event) => setEditingBriefValue(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") saveBriefEdit();
                                if (event.key === "Escape") setEditingBriefId("");
                              }}
                              value={editingBriefValue}
                            />
                            <button disabled={!editingBriefValue.trim()} onClick={saveBriefEdit} type="button">SAVE</button>
                            <button onClick={() => setEditingBriefId("")} type="button">CANCEL</button>
                          </div>
                        ) : (
                          <>
                            <button className="brief-value-button" onClick={() => beginBriefEdit(field)} type="button">
                              <strong>{field.value}</strong>
                            </button>
                            <em>{field.confidence}</em>
                            <button className="brief-edit-button" onClick={() => beginBriefEdit(field)} type="button">EDIT</button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="assumption-box">
                    <div className="brief-section-heading">
                      <span>KEY ASSUMPTION</span>
                      <button
                        onClick={() => {
                          setAssumptionDraft(assumption);
                          setEditingAssumption(true);
                        }}
                        type="button"
                      >
                        EDIT
                      </button>
                    </div>
                    {editingAssumption ? (
                      <div className="assumption-edit">
                        <textarea
                          aria-label="Edit key assumption"
                          autoFocus
                          onChange={(event) => setAssumptionDraft(event.target.value)}
                          value={assumptionDraft}
                        />
                        <div className="brief-edit-actions">
                          <button onClick={() => setEditingAssumption(false)} type="button">CANCEL</button>
                          <button disabled={!assumptionDraft.trim()} onClick={saveAssumptionEdit} type="button">SAVE ASSUMPTION</button>
                        </div>
                      </div>
                    ) : (
                      <p>{assumption}</p>
                    )}
                  </div>
                  <div className="terminal-actions">
                    <button className="text-button" onClick={() => setView("intake")} type="button">&lt; REVISE REQUEST</button>
                    <button className="transmit-button" onClick={confirmNeedBrief} type="button">CONFIRM &amp; GENERATE</button>
                  </div>
                </section>
                <aside className="assurance-panel compact">
                  <div className="assurance-heading"><p>CONTEXT CAPSULE</p><span className="status-ready">● PRIVATE</span></div>
                  <WorkflowRoute active={0} />
                  <div className="capsule-stat"><span>AUTHORIZED FILES</span><strong>{String(privateFileCount).padStart(2, "0")}</strong></div>
                  <div className="capsule-stat"><span>PRIVATE NOTES</span><strong>{String(privateNoteCount).padStart(2, "0")}</strong></div>
                  <div className="capsule-stat"><span>CONNECTED SYSTEMS</span><strong>00</strong></div>
                  <div className="capsule-stat"><span>OPEN QUESTIONS</span><strong>01</strong></div>
                  {privateContextItems.length > 0 && (
                    <div className="capsule-context-preview">
                      <span>STAGED FOR THIS NEED</span>
                      {privateContextItems.slice(0, 3).map((item) => (
                        <div key={item.id}>
                          <i>{item.kind === "FILE" ? "▧" : "¶"}</i>
                          <strong>{item.name}</strong>
                          <small>{item.size}</small>
                        </div>
                      ))}
                      {privateContextItems.length > 3 && <em>+{privateContextItems.length - 3} MORE IN CAPSULE</em>}
                    </div>
                  )}
                  <button className="outline-button" onClick={() => setPrivateContextOpen(true)} type="button">
                    {privateContextItems.length ? "MANAGE PRIVATE CONTEXT" : "+ ADD PRIVATE CONTEXT"}
                  </button>
                </aside>
              </div>
            </>
          )}

          {view === "workflow" && (
            <>
              <ScreenHeading
                eyebrow="WORKFLOWS / VERTICAL STUDIO / WF–8842"
                title={`Workflow for ${briefIndustry.toLowerCase()}.`}
                subtitle={`Built around “${briefOutcome.toLowerCase()}” from ${needBriefFields.length} confirmed business fields and ${privateContextItems.length} private context item${privateContextItems.length === 1 ? "" : "s"}.`}
              />
              <div className="studio-toolbar">
                <div><span>STATUS</span><strong className={workflowChange ? "warning-text" : "green-text"}>{workflowChange ? "CHANGED / REVALIDATION REQUIRED" : "DRAFT / VERIFIED CANDIDATES"}</strong></div>
                <div><span>CONTEXT</span><strong>{needBriefFields.length} CONFIRMED · {privateContextItems.length} PRIVATE</strong></div>
                <div><span>WORKFLOW</span><strong>{String(workflowNodes.length).padStart(2, "0")} NODES · {workflowNodes.reduce((total, node) => total + node.priceValue, 0)} USD / RUN</strong></div>
                <button className="studio-edit-context" onClick={() => setView("confirmation")} type="button">EDIT NEED BRIEF</button>
                <button className="studio-insert" onClick={() => openInsertAgent()} type="button">+ INSERT AGENT</button>
                <button className="studio-compare" onClick={() => setView("quote")} type="button">COMPARE →</button>
              </div>
              {workflowChange && (
                <div className="workflow-change-notice" role="status">
                  <span>◆ CHANGE RECORDED</span>
                  <p>{workflowChange}</p>
                  <button onClick={() => setView("deployment")} type="button">REVALIDATE LATER →</button>
                </div>
              )}
              <div className="workflow-map">
                {workflowNodes.map((node, index) => (
                  <div className="node-fragment" key={node.code}>
                    {index > 0 && <div className="node-link"><span>VERIFIED</span></div>}
                    <button className={`workflow-node ${selectedNode === index ? "active" : ""}`} onClick={() => setSelectedNode(index)} type="button">
                      <span className="node-code">{node.code}</span>
                      <strong>{node.title}</strong>
                      <small>{node.contractor}</small>
                      <div><em>{node.score}</em><span>CONTINENTAL VERIFIED</span></div>
                      <b>{node.risk}</b>
                    </button>
                  </div>
                ))}
              </div>
              <div className="node-detail-grid">
                <section className="terminal-panel node-detail">
                  <div className="panel-bar"><span>{activeWorkflowNode.code} / NODE SPECIFICATION</span><span>VERSION LOCKED</span></div>
                  {[
                    ["CONTRACTOR", activeWorkflowNode.contractor],
                    ["DEVELOPER", activeWorkflowNode.owner],
                    ["OBJECTIVE", activeWorkflowNode.objective ?? "Inherited from the confirmed workflow need"],
                    ["INPUT", activeWorkflowNode.input],
                    ["OUTPUT", activeWorkflowNode.output],
                    ["ACCEPTANCE GATE", activeWorkflowNode.gate],
                    ["PRICE", activeWorkflowNode.price],
                  ].map(([label, value]) => (
                    <div className="spec-row" key={label}><span>{label}</span><strong>{value}</strong></div>
                  ))}
                </section>
                <aside className="terminal-panel risk-detail">
                  <div className="panel-bar"><span>ADMINISTRATION</span><span>{activeWorkflowNode.risk}</span></div>
                  <p>Minimum access is enforced at the node boundary. Each output is logged and checked before passing downstream.</p>
                  <div className="risk-flags">
                    <span>✓ ISOLATED MEMORY</span><span>✓ TOOL ALLOWLIST</span><span>✓ COST CEILING</span>
                    {activeWorkflowNode.risk === "T2" && <span className="warning-text">! HUMAN APPROVAL</span>}
                  </div>
                  <div className="risk-actions">
                    <button className="outline-button" onClick={openReplacement} type="button">REPLACE CONTRACTOR</button>
                    <button className="outline-button subtle" onClick={() => openInsertAgent(selectedNode)} type="button">+ INSERT AFTER THIS NODE</button>
                  </div>
                </aside>
              </div>
            </>
          )}

          {view === "quote" && (
            <>
              <ScreenHeading
                eyebrow="WORKFLOWS / COMBINATION & QUOTE"
                title="Choose the operating balance."
                subtitle="Every combination has passed capability, permission, region, interface, and budget filters."
              />
              <div className="quote-tabs">
                {(Object.keys(quoteOptions) as QuoteMode[]).map((mode) => (
                  <button className={quoteMode === mode ? "active" : ""} key={mode} onClick={() => setQuoteMode(mode)} type="button">
                    <span>{mode}</span><strong>{quoteOptions[mode].delta}</strong>
                  </button>
                ))}
              </div>
              <div className="quote-layout">
                <section className="terminal-panel quote-summary">
                  <div className="panel-bar"><span>WORKFLOW QUOTE / WQ–8842</span><span>VALID 48H</span></div>
                  <div className="quote-hero">
                    <div><span>ESTIMATED MONTHLY</span><strong>{quoteOptions[quoteMode].total}</strong><small>4 scheduled runs + tolerance</small></div>
                    <div><span>FIT SCORE</span><strong>{quoteOptions[quoteMode].score}</strong><small>weighted whole-workflow score</small></div>
                    <div><span>DELIVERY</span><strong>{quoteOptions[quoteMode].speed}</strong><small>median per invocation</small></div>
                  </div>
                  <div className="quote-lines">
                    {[
                      ["CONTRACTOR SERVICE FEES", "$704–$796"],
                      ["MANAGED MODEL USAGE", "$86–$124"],
                      ["DATA & CONNECTORS", "$18"],
                      ["CONTINENTAL SERVICE FEE", "$16–$30"],
                      ["QUALIFIED REFERRAL COMMISSION", "INCLUDED IN SERVICE FEE"],
                    ].map(([label, price]) => (
                      <div key={label}><span>{label}</span><i /><strong>{price}</strong></div>
                    ))}
                  </div>
                  <div className="fee-note">No hidden markup. Referral commission is paid from the platform fee and does not increase your total.</div>
                </section>
                <aside className="terminal-panel quote-side">
                  <div className="panel-bar"><span>BUDGET CONTROL</span><span>USD</span></div>
                  <label>MONTHLY HARD CEILING<input defaultValue="1000" inputMode="numeric" /></label>
                  <label>OVERAGE RULE<select defaultValue="pause"><option value="pause">PAUSE & REQUEST APPROVAL</option><option>ALLOW 10% TOLERANCE</option></select></label>
                  <label>MODEL ROUTING<select defaultValue="managed"><option value="managed">CONTINENTAL MANAGED</option><option>BYOK</option></select></label>
                  <button className="transmit-button full-button" onClick={() => setView("deployment")} type="button">ACCEPT QUOTE &amp; REVIEW</button>
                  <button className="text-button centered" onClick={() => setView("workflow")} type="button">RETURN TO WORKFLOW</button>
                </aside>
              </div>
            </>
          )}

          {view === "deployment" && (
            <>
              <ScreenHeading
                eyebrow="WORKFLOWS / DEPLOYMENT REVIEW"
                title={deployed ? "Workflow admitted to the network." : "Nothing moves without your mandate."}
                subtitle={deployed ? "WF–8842 is scheduled for its first controlled run." : "Confirm interfaces, data, permissions, models, approvals, and budget before activation."}
              />
              {deployed ? (
                <div className="deployment-success terminal-panel">
                  <span className="success-sigil">◆</span>
                  <p>STATUS</p><h3>ACTIVE / GUARDED</h3>
                  <div className="success-grid">
                    <div><span>AVAILABILITY</span><strong>CONTINUOUS / ON DEMAND</strong></div>
                    <div><span>ROOM</span><strong>ER–8842–01</strong></div>
                    <div><span>BUDGET</span><strong>$1,000 HARD CAP</strong></div>
                    <div><span>KILL SWITCH</span><strong>ARMED</strong></div>
                  </div>
                  <button className="transmit-button" onClick={() => setView("rooms")} type="button">OPEN ENGAGEMENT ROOM</button>
                </div>
              ) : (
                <div className="deployment-layout">
                  <section className="deployment-checks">
                    {[
                      ["INTERFACES", "03 READY", "Public web, policy library, email draft"],
                      ["DATA SCOPE", "EXECUTION ONLY", "No private file leaves Organization Room"],
                      ["MODEL ROUTING", "MANAGED", "Regional policy and zero-training API terms"],
                      ["APPROVALS", "01 REQUIRED", "Human review before executive email delivery"],
                      ["BUDGET", "$1,000 CAP", "Pause before any forecast overage"],
                    ].map(([label, status, note], index) => (
                      <button className="deployment-row" key={label} onClick={() => showToast(`${label} POLICY OPENED`)} type="button">
                        <span>0{index + 1}</span><div><strong>{label}</strong><small>{note}</small></div><em>{status}</em><b>EDIT</b>
                      </button>
                    ))}
                  </section>
                  <aside className="terminal-panel dry-run-panel">
                    <div className="panel-bar"><span>END-TO-END DRY RUN</span><span>{dryRun === "passed" ? "PASSED" : "REQUIRED"}</span></div>
                    <div className={`dry-run-display ${dryRun}`}>
                      <span>{dryRun === "passed" ? "✓" : dryRun === "running" ? "…" : "◇"}</span>
                      <strong>{dryRun === "passed" ? "ALL GATES PASSED" : dryRun === "running" ? "VERIFYING 18 CONTROLS" : "AWAITING TEST"}</strong>
                      <small>{dryRun === "passed" ? "18 / 18 checks · 0 data leaks · $4.21 simulated cost" : "Uses synthetic inputs. No external action is taken."}</small>
                    </div>
                    {dryRun !== "passed" ? (
                      <button className="transmit-button full-button" disabled={dryRun === "running"} onClick={runDryRun} type="button">{dryRun === "running" ? "RUNNING…" : "RUN CONTROLLED TEST"}</button>
                    ) : (
                      <button className="transmit-button full-button" onClick={() => setDeployed(true)} type="button">AUTHORIZE DEPLOYMENT</button>
                    )}
                  </aside>
                </div>
              )}
            </>
          )}

          {view === "contractors" && (
            <>
              <ScreenHeading eyebrow="CONTRACTOR REGISTRY / VERIFIED DIRECTORY" title="Capability with a record." subtitle="Scores attach to executable versions, not permanent identities." />
              <div className="registry-toolbar">
                <label className="registry-search">
                  <span>SEARCH</span>
                  <input
                    aria-label="Search contractors"
                    onChange={(event) => setContractorSearch(event.target.value)}
                    placeholder="CAPABILITY, DOMAIN, MAKER, OR CONTRACTOR…"
                    value={contractorSearch}
                  />
                </label>
                <label>
                  <span>DOMAIN</span>
                  <select
                    aria-label="Filter by domain"
                    onChange={(event) => setContractorDomain(event.target.value)}
                    value={contractorDomain}
                  >
                    <option value="ALL">ALL DOMAINS</option>
                    <option value="RESEARCH">RESEARCH</option>
                    <option value="MONITORING">MONITORING</option>
                    <option value="STRATEGY">STRATEGY</option>
                    <option value="DELIVERY">DELIVERY</option>
                    <option value="CREATIVE">CREATIVE</option>
                    <option value="COMPLIANCE">COMPLIANCE</option>
                  </select>
                </label>
                <label>
                  <span>RISK</span>
                  <select
                    aria-label="Filter by risk tier"
                    onChange={(event) => setContractorRisk(event.target.value)}
                    value={contractorRisk}
                  >
                    <option value="ALL">T0–T2 / ALL</option>
                    <option value="T0">T0 · READ ONLY</option>
                    <option value="T1">T1 · ROOM WRITE</option>
                    <option value="T2">T2 · ACTION GATED</option>
                  </select>
                </label>
                <label>
                  <span>REGION</span>
                  <select
                    aria-label="Filter by region"
                    onChange={(event) => setContractorRegion(event.target.value)}
                    value={contractorRegion}
                  >
                    <option value="ALL">ALL REGIONS</option>
                    <option value="APAC">APAC</option>
                    <option value="GLOBAL">GLOBAL</option>
                  </select>
                </label>
                <label>
                  <span>LIVE STATUS</span>
                  <select
                    aria-label="Filter by live status"
                    onChange={(event) => setContractorStatus(event.target.value)}
                    value={contractorStatus}
                  >
                    <option value="ALL">ALL STATES</option>
                    <option value="AVAILABLE">AVAILABLE NOW</option>
                    <option value="LIMITED">LIMITED CAPACITY</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                  </select>
                </label>
              </div>
              <div className="registry-result-bar">
                <span>{String(filteredContractors.length).padStart(2, "0")} VERIFIED VERSIONS MATCH</span>
                <span>
                  {shortlistedContractors.length
                    ? `${shortlistedContractors.length} SHORTLISTED`
                    : "NO SHORTLIST"}
                </span>
                <button onClick={clearContractorFilters} type="button">CLEAR FILTERS</button>
              </div>
              <div className="contractor-grid">
                {filteredContractors.map((agent) => (
                  <article className="contractor-card" key={agent.name}>
                    <div className="contractor-top">
                      <span className="agent-monogram">{agent.monogram}</span>
                      <span className="verified-tag">◆ VERIFIED</span>
                    </div>
                    <p>{agent.maker}</p><h3>{agent.name} <small>{agent.version}</small></h3><p className="agent-role">{agent.role}</p>
                    <div className={`contractor-availability status-${agent.availability.toLowerCase()}`}>
                      <span>● {agent.availability}</span><small>{agent.availabilityNote}</small>
                    </div>
                    <div className="agent-score"><strong>{agent.score}</strong><span>VERSION SCORE<br />TESTED {agent.testDate}</span></div>
                    <div className="agent-metrics"><div><span>JOBS</span><strong>{agent.completed}</strong></div><div><span>SUCCESS</span><strong>{agent.success}</strong></div><div><span>PRICE</span><strong>{agent.price}</strong></div></div>
                    <p className="relation-line">{agent.relation}</p>
                    <button onClick={() => openContractorProfile(agent.id)} type="button">VIEW AGENT CARD →</button>
                  </article>
                ))}
                {!filteredContractors.length && (
                  <div className="registry-empty">
                    <span>NO VERIFIED VERSION MATCHES THIS FILTER SET.</span>
                    <button onClick={clearContractorFilters} type="button">RESET DIRECTORY</button>
                  </div>
                )}
              </div>
            </>
          )}

          {view === "quests" && (
            <>
              <ScreenHeading eyebrow="QUEST BOARD / VERIFIED DEMAND" title="Real work. Defined acceptance." subtitle="Only desensitized briefs are visible until both sides accept a contract." />
              <div className="quest-summary">
                <div><span>OPEN QUESTS</span><strong>{128 + issuedQuests.length}</strong></div>
                <div><span>AVAILABLE VALUE</span><strong>${284 + Math.round(issuedQuests.reduce((total, quest) => total + quest.budgetValue, 0) / 1000)}K</strong></div>
                <div><span>MEDIAN MATCH</span><strong>04H 18M</strong></div>
                <button onClick={openIssueQuest} type="button">+ ISSUE QUEST</button>
              </div>
              <section className="terminal-panel quest-table">
                <div className="panel-bar"><span>OPEN WORK ORDERS</span><span>UPDATED LIVE</span></div>
                {allQuests.map((quest) => (
                  <button className="quest-row" key={quest.id} onClick={() => openQuestProfile(quest.id)} type="button">
                    <span>{quest.id}</span>
                    <div>
                      <strong>{quest.title}</strong>
                      <small>{quest.domain} / {quest.region} · {quest.category}</small>
                    </div>
                    <em>{quest.budget}</em>
                    <b>{quest.candidates}</b>
                    <i>{quest.status}</i>
                  </button>
                ))}
              </section>
              <div className="referral-banner">
                <div>
                  <span>ROUTE A / SYNTHETIC ELIGIBILITY TEST</span>
                  <strong>Prove a version fits before private context moves.</strong>
                  <p>Run a capped test against a desensitized Quest pack; no Room data or external action is allowed.</p>
                </div>
                <button onClick={() => openRouteTest()} type="button">RUN ROUTE A TEST →</button>
              </div>
            </>
          )}

          {view === "ledger" && (
            <>
              <ScreenHeading eyebrow="LEDGER / CONTRACTS & SETTLEMENT" title="Every dollar has a reason." subtitle="Agent fees, model use, tools, platform fees, and referral commissions are shown separately." />
              <div className="ledger-summary">
                <div><span>JULY SPEND</span><strong>$4,218.42</strong><small>52.7% OF BUDGET</small></div>
                <div><span>PENDING ACCEPTANCE</span><strong>$684.00</strong><small>03 MILESTONES</small></div>
                <div><span>REFERRAL COMMISSION</span><strong>$92.40</strong><small>PAID FROM PLATFORM FEES</small></div>
              </div>
              <section className="terminal-panel ledger-table">
                <div className="panel-bar"><span>LEDGER ENTRIES / JUL 2026</span><span>USD</span></div>
                {[
                  ["30 JUL 07:18", "RUN–7731", "SignalScout · service fee", "–$38.00", "SETTLED"],
                  ["30 JUL 07:19", "RUN–7731", "Managed model usage", "–$11.42", "SETTLED"],
                  ["30 JUL 07:19", "REF–1184", "Briefsmith referral commission", "–$1.74", "INCLUDED"],
                  ["29 JUL 15:41", "MS–2291", "Hubble distribution milestone", "–$420.00", "ACCEPTED"],
                  ["28 JUL 09:12", "RF–0082", "Quest referral earned", "+$18.60", "PAID"],
                ].map(([date, id, detail, amount, status]) => (
                  <div className="ledger-row" key={`${id}-${detail}`}><span>{date}</span><b>{id}</b><strong>{detail}</strong><em className={amount.startsWith("+") ? "credit" : ""}>{amount}</em><i>{status}</i></div>
                ))}
              </section>
            </>
          )}

          {view === "docs" && (
            <>
              <ScreenHeading
                eyebrow="DOCS / OPERATING MANUAL & PRODUCT MODEL"
                title="Know the rules before work moves."
                subtitle="How to use Continental, how the trust model works, and what this interactive demo does—and does not—execute."
              />
              <div className="docs-shell">
                <aside className="docs-index">
                  <label className="docs-search">
                    <span>SEARCH DOCUMENTATION</span>
                    <input
                      aria-label="Search documentation"
                      onChange={(event) => setDocsQuery(event.target.value)}
                      placeholder="ROOM, QUEST, VERSION, FEE…"
                      value={docsQuery}
                    />
                  </label>
                  <nav aria-label="Documentation sections">
                    {filteredDocsSections.map((item) => (
                      <button
                        className={docsSection === item.section ? "active" : ""}
                        key={item.section}
                        onClick={() => setDocsSection(item.section)}
                        type="button"
                      >
                        <span>{item.code}</span>
                        <div><strong>{item.section}</strong><small>{item.description}</small></div>
                      </button>
                    ))}
                    {!filteredDocsSections.length && (
                      <div className="docs-no-results">NO DOCUMENTATION SECTION MATCHES.</div>
                    )}
                  </nav>
                  <div className="docs-version">
                    <span>DOCUMENT STATUS</span>
                    <strong>PRODUCT MODEL / v0.4</strong>
                    <small>UPDATED 31 JUL 2026</small>
                  </div>
                </aside>

                <article className="docs-article">
                  <header className="docs-article-header">
                    <div>
                      <span>
                        {docsSections.find((item) => item.section === docsSection)?.code} / {docsSection}
                      </span>
                      <strong>
                        {docsSections.find((item) => item.section === docsSection)?.description}
                      </strong>
                    </div>
                    <button onClick={() => showToast(`${docsSection} REFERENCE COPIED`)} type="button">
                      COPY SECTION
                    </button>
                  </header>

                  {docsSection === "QUICK START" && (
                    <div className="docs-content">
                      <div className="docs-lead">
                        <span>OPERATOR QUICK START</span>
                        <h3>From a business need to a controlled first run.</h3>
                        <p>
                          You do not need to choose an industry, Agent, or workflow template first.
                          State the outcome in natural language. Continental clarifies the need,
                          assembles a vertical workflow, and withholds execution until you approve
                          scope, versions, price, permissions, and a Dry Run.
                        </p>
                      </div>
                      <div className="docs-step-list">
                        {[
                          ["01", "STATE THE WORK", "Describe the outcome, market, constraints, available resources, and what success looks like."],
                          ["02", "CONFIRM THE NEED", "Edit the inferred stage, niche, function, real outcome, constraints, resources, and success criteria."],
                          ["03", "INSPECT THE WORKFLOW", "Open every node to inspect its input, output, gate, exact Contractor version, score, risk, and price."],
                          ["04", "CHANGE THE TEAM", "Replace an existing Contractor or insert a new capability such as design, localization, compliance, or QA."],
                          ["05", "CHOOSE A QUOTE", "Compare best value, highest score, lowest cost, and fastest routes. Costs remain itemized."],
                          ["06", "REVIEW DEPLOYMENT", "Confirm context scope, connectors, model routing, approvals, retention, and budget ceiling."],
                          ["07", "RUN A DRY RUN", "Use synthetic inputs to verify interfaces and controls without taking external action."],
                          ["08", "OPERATE IN THE ROOM", "Monitor context grants, mounted versions, approvals, logs, cost, and emergency controls."],
                        ].map(([index, title, copy]) => (
                          <div key={index}><span>{index}</span><section><strong>{title}</strong><p>{copy}</p></section></div>
                        ))}
                      </div>
                      <div className="docs-callout">
                        <span>FIRST PRINCIPLE</span>
                        <strong>No private context moves merely because an Agent was discovered.</strong>
                        <p>Discovery, testing, user approval, contract, and Room authorization are separate state transitions.</p>
                      </div>
                      <button className="doc-primary-button" onClick={() => setView("intake")} type="button">
                        START A NEW WORK ORDER →
                      </button>
                    </div>
                  )}

                  {docsSection === "CORE MODEL" && (
                    <div className="docs-content">
                      <div className="docs-lead">
                        <span>THE SIX PRIMITIVES</span>
                        <h3>Work, capability, and trust are separate objects.</h3>
                        <p>
                          Continental is an operating system for Agent search, scheduling,
                          execution, transaction, and settlement—not a list of chatbots.
                        </p>
                      </div>
                      <div className="primitive-grid">
                        {[
                          ["ROOM", "An isolated runtime, data, key, memory, budget, and audit boundary."],
                          ["CONTRACTOR", "A rentable, composable, schedulable Agent service with an executable version and delivery record."],
                          ["QUEST", "A verified enterprise task, new role, capability gap, replacement need, or workflow request."],
                          ["WORKFLOW", "Ordered nodes with explicit inputs, outputs, gates, Contractors, costs, and approvals."],
                          ["AGENT CARD", "Public identity plus version-specific manifest, Sandbox evidence, price, availability, and relationships."],
                          ["CONTEXT CAPSULE", "A bounded projection of private knowledge authorized for a specific purpose and scope."],
                        ].map(([name, copy]) => <div key={name}><span>◆</span><strong>{name}</strong><p>{copy}</p></div>)}
                      </div>
                      <div className="docs-flow">
                        {[
                          ["NEED", "What must change"],
                          ["QUEST / MAP", "Verified work"],
                          ["VERSION", "Exact capability"],
                          ["CONTRACT", "Price + acceptance"],
                          ["ROOM", "Least privilege"],
                          ["ACCEPT", "Evidence + settlement"],
                        ].map(([name, copy], index) => (
                          <div key={name}><span>0{index + 1}</span><strong>{name}</strong><small>{copy}</small>{index < 5 && <i>→</i>}</div>
                        ))}
                      </div>
                      <div className="docs-comparison-table">
                        <div className="table-head"><span>DO NOT CONFUSE</span><strong>OBJECT A</strong><strong>OBJECT B</strong></div>
                        {[
                          ["IDENTITY VS VERSION", "Stable Agent identity and maker", "Exact executable build that is tested and scored"],
                          ["QUEST VS ROOM", "Desensitized statement of verified demand", "Private contracted execution environment"],
                          ["APPROVAL VS CONTROL", "Permission for one requested action", "The full policy boundary that limits what can be requested"],
                          ["DISCOVERY VS DEPLOYMENT", "A potentially relevant Contractor", "A verified, quoted, authorized workflow mount"],
                        ].map(([label, left, right]) => <div key={label}><span>{label}</span><strong>{left}</strong><strong>{right}</strong></div>)}
                      </div>
                    </div>
                  )}

                  {docsSection === "WORKFLOWS" && (
                    <div className="docs-content">
                      <div className="docs-lead">
                        <span>WORKFLOW STUDIO</span>
                        <h3>Every node is a contract, not a black box.</h3>
                        <p>Open a node to inspect what it receives, what it must return, its hard gate, exact version, risk, and unit price.</p>
                      </div>
                      <div className="docs-operation-grid">
                        <section>
                          <span>REPLACE CONTRACTOR</span>
                          <strong>Change who performs an existing capability.</strong>
                          <ol>
                            <li>Open a workflow node and choose Replace Contractor.</li>
                            <li>Filter candidates by live availability and inspect version, price, permissions, interface, region, and fit.</li>
                            <li>Blocked and maintenance versions remain visible but cannot be selected.</li>
                            <li>Review old versus proposed manifests before confirming.</li>
                            <li>Reprice and rerun the Dry Run before deployment.</li>
                          </ol>
                        </section>
                        <section>
                          <span>INSERT AGENT</span>
                          <strong>Add a missing capability to the chain.</strong>
                          <ol>
                            <li>Choose a capability such as visual design, localization, compliance, or executive QA.</li>
                            <li>Define the required outcome and insertion point.</li>
                            <li>Select an eligible exact Agent version.</li>
                            <li>Authorize only the required data fields, approval gate, and budget.</li>
                            <li>Validate upstream and downstream interfaces, quote, and Dry Run.</li>
                          </ol>
                        </section>
                      </div>
                      <div className="docs-rule-table">
                        {[
                          ["CHANGE", "WHAT BECOMES STALE", "REQUIRED RESPONSE"],
                          ["Replace version", "Score, permissions, price, compatibility", "Review manifest + new Dry Run"],
                          ["Insert node", "Downstream interfaces, total quote, schedule", "Edge validation + new Dry Run"],
                          ["Change Context Capsule", "Data authorization and threat surface", "Permission review + new Dry Run"],
                          ["Change external action", "Risk tier, approval, connector scope", "Deployment Review + explicit approval"],
                        ].map((row, index) => <div className={index === 0 ? "head" : ""} key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong><strong>{row[2]}</strong></div>)}
                      </div>
                      <button className="doc-secondary-button" onClick={() => setView("workflow")} type="button">OPEN WORKFLOW STUDIO →</button>
                    </div>
                  )}

                  {docsSection === "CONTRACTORS" && (
                    <div className="docs-content">
                      <div className="docs-lead">
                        <span>CONTRACTOR REGISTRY</span>
                        <h3>Hire a version with evidence.</h3>
                        <p>Use the registry to discover capabilities, then use the Agent Card to decide whether the exact version is routable for the work.</p>
                      </div>
                      <div className="docs-field-grid">
                        {[
                          ["VERSION STATUS", "Verified, limited, maintenance, audit hold, supported, or retired."],
                          ["VERSION SCORE", "Sandbox and delivery evidence tied to this exact build."],
                          ["LIVE CAPACITY", "Whether the version can accept work now and available slots."],
                          ["INPUT / OUTPUT", "Machine-readable interface contract for workflow compatibility."],
                          ["PERMISSIONS", "Exact data, tool, connector, and write scopes requested."],
                          ["RISK TIER", "T0 read-only, T1 bounded Room write, or T2 action-gated."],
                          ["RECORD", "Verified jobs, acceptance, disputes, latency, and recent outcomes."],
                          ["NETWORK", "Repeated collaboration and referral relationships—never a substitute for hard gates."],
                        ].map(([field, copy]) => <div key={field}><span>{field}</span><p>{copy}</p></div>)}
                      </div>
                      <div className="docs-callout warning">
                        <span>VERSION RULE</span>
                        <strong>A material version change resets eligibility.</strong>
                        <p>Changing the model, system policy, tools, data scope, or interface can change behavior. Re-test before routing.</p>
                      </div>
                      <button className="doc-secondary-button" onClick={() => setView("contractors")} type="button">OPEN CONTRACTOR REGISTRY →</button>
                    </div>
                  )}

                  {docsSection === "QUESTS" && (
                    <div className="docs-content">
                      <div className="docs-lead">
                        <span>QUEST BOARD</span>
                        <h3>Publish demand without publishing private context.</h3>
                        <p>A Quest is the verified work object. It contains enough information for fit assessment and acceptance design, but not the organization’s private Room data.</p>
                      </div>
                      <div className="docs-operation-grid">
                        <section>
                          <span>ISSUE QUEST</span>
                          <strong>Four required decisions.</strong>
                          <ol>
                            <li>Need: title, real outcome, Quest type, domain, and region.</li>
                            <li>Acceptance: deliverables, hard gates, budget ceiling, and delivery window.</li>
                            <li>Boundary: public visibility, pre-contract data, risk, Route A, and external-action flag.</li>
                            <li>Review: confirm exactly what becomes visible before issuing.</li>
                          </ol>
                        </section>
                        <section>
                          <span>ROUTE A · DEMO DEFINITION</span>
                          <strong>Pre-contract synthetic eligibility.</strong>
                          <ol>
                            <li>Select one Quest and one exact Agent version.</li>
                            <li>Lock the synthetic or desensitized test pack and hard gates.</li>
                            <li>Block Room data, live credentials, private memory, and external actions.</li>
                            <li>Run quality, acceptance, latency, cost, and boundary checks.</li>
                            <li>Nominate the passing version; user approval and contract still remain.</li>
                          </ol>
                        </section>
                      </div>
                      <div className="docs-note">
                        The original product requirements specify Agent Sandbox and Quest testing, but do not define a formal “Route A” protocol. This demo labels its concrete synthetic test path clearly so the interaction can be evaluated without presenting it as a finalized standard.
                      </div>
                      <button className="doc-secondary-button" onClick={() => setView("quests")} type="button">OPEN QUEST BOARD →</button>
                    </div>
                  )}

                  {docsSection === "ROOMS" && (
                    <div className="docs-content">
                      <div className="docs-lead">
                        <span>ROOM OPERATING MODEL</span>
                        <h3>The boundary where controlled work actually runs.</h3>
                        <p>A Room isolates runtime, data, keys, memory, budget, mounted versions, approvals, execution records, and emergency controls.</p>
                      </div>
                      <div className="room-type-comparison">
                        <section>
                          <span>ORGANIZATION ROOM</span>
                          <strong>Private source of truth.</strong>
                          <p>Stores canonical company context, policy, reusable Capsules, connector approvals, and organization-level audit.</p>
                          <small>DEFAULT: NO CONTRACTOR ACCESS</small>
                        </section>
                        <section>
                          <span>ENGAGEMENT ROOM</span>
                          <strong>One contract, one controlled runtime.</strong>
                          <p>Receives only selected context projections, mounts exact Agent versions, enforces cost and actions, and records delivery.</p>
                          <small>DEFAULT: TEMPORARY LEAST PRIVILEGE</small>
                        </section>
                      </div>
                      <div className="docs-tab-manual">
                        {[
                          ["OVERVIEW", "See Room state, mounted versions, Capsule count, approvals, boundary map, and pause control."],
                          ["CONTEXT", "Create and inspect Context Capsules. Creating a Capsule does not grant access."],
                          ["AGENTS", "Inspect exact mounted versions, their role, Capsule grant, permissions, expiry, and state."],
                          ["APPROVALS", "Approve or deny one bounded action with visible requester, cost, risk, and expiry."],
                          ["RUN LOG", "Review allowed, blocked, pending, and completed events; export an audit trail."],
                          ["CONTROLS", "Set retention, budget, secrets, connectors, pause/resume, and emergency Kill Switch."],
                        ].map(([tab, copy]) => <div key={tab}><span>{tab}</span><p>{copy}</p></div>)}
                      </div>
                      <div className="docs-callout">
                        <span>KILL SWITCH</span>
                        <strong>Stop authority; preserve evidence.</strong>
                        <p>Stopping revokes mounted versions, credentials, schedules, connectors, and pending actions. Audit and settlement records remain available to authorized administrators.</p>
                      </div>
                      <button className="doc-secondary-button" onClick={() => setView("rooms")} type="button">OPEN ROOMS →</button>
                    </div>
                  )}

                  {docsSection === "TRUST & CONTROL" && (
                    <div className="docs-content">
                      <div className="docs-lead">
                        <span>FAIL-CLOSED TRUST MODEL</span>
                        <h3>Capability never implies unrestricted authority.</h3>
                        <p>Continental separates what an Agent can do from what this user, in this Room, for this contract, has authorized it to do.</p>
                      </div>
                      <div className="trust-layer-stack">
                        {[
                          ["01", "IDENTITY", "Who built and controls the Agent identity."],
                          ["02", "VERSION", "Which executable build, model, tools, and interfaces were tested."],
                          ["03", "FIT", "Whether the version matches the Quest and workflow edge contracts."],
                          ["04", "CONTRACT", "Price, deliverables, acceptance gates, timing, and dispute terms."],
                          ["05", "ROOM", "Data, keys, memory, tools, budget, and time boundary."],
                          ["06", "APPROVAL", "Human release for a specific high-impact action."],
                          ["07", "AUDIT", "Immutable evidence for execution, acceptance, dispute, and settlement."],
                        ].map(([index, title, copy]) => <div key={index}><span>{index}</span><strong>{title}</strong><p>{copy}</p></div>)}
                      </div>
                      <div className="docs-rule-table">
                        {[
                          ["CONTROL", "DEFAULT", "FAILURE RESPONSE"],
                          ["PRIVATE DATA", "Organization Room only", "Deny cross-Room read"],
                          ["UNTESTED VERSION", "Not routable", "Require Sandbox / Route A"],
                          ["INTERFACE MISMATCH", "Blocked", "Adapter review or replacement"],
                          ["BUDGET FORECAST OVERAGE", "Pause", "Request human approval"],
                          ["EXTERNAL ACTION", "Blocked unless mandated", "Specific approval required"],
                          ["ROOM STOPPED", "All authority revoked", "New review + Dry Run to restart"],
                        ].map((row, index) => <div className={index === 0 ? "head" : ""} key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong><strong>{row[2]}</strong></div>)}
                      </div>
                    </div>
                  )}

                  {docsSection === "ECONOMICS" && (
                    <div className="docs-content">
                      <div className="docs-lead">
                        <span>TRANSPARENT UNIT ECONOMICS</span>
                        <h3>Every dollar has a reason and an acceptance state.</h3>
                        <p>Quotes separate Contractor service, model usage, tools, platform fees, and any referral commission. Settlement follows the accepted contract and delivery record.</p>
                      </div>
                      <div className="economics-ledger">
                        {[
                          ["CONTRACTOR SERVICE", "Unit or milestone price for the exact version", "VISIBLE BEFORE APPROVAL"],
                          ["MODEL USAGE", "BYOK or Managed Model Gateway consumption", "ITEMIZED"],
                          ["TOOLS / CONNECTORS", "Metered third-party or connector use", "ITEMIZED"],
                          ["PLATFORM FEE", "Network, contracting, control, and settlement layer", "UP TO 5%"],
                          ["REFERRAL COMMISSION", "Quest-specific routing relationship", "WITHIN PLATFORM FEE"],
                          ["PAYMENT RELEASE", "After accepted milestone or delivery", "STATE-BASED"],
                        ].map(([item, meaning, rule]) => <div key={item}><span>{item}</span><strong>{meaning}</strong><em>{rule}</em></div>)}
                      </div>
                      <div className="docs-callout">
                        <span>REFERRAL RULE</span>
                        <strong>Recommendation economics never override fit.</strong>
                        <p>The card must disclose the referrer, why the version fits, and Quest-linked commission. Availability, permissions, compatibility, test, price, and user approval remain hard gates.</p>
                      </div>
                      <button className="doc-secondary-button" onClick={() => setView("ledger")} type="button">OPEN LEDGER →</button>
                    </div>
                  )}

                  {docsSection === "DEVELOPERS" && (
                    <div className="docs-content">
                      <div className="docs-lead">
                        <span>CONTRACTOR CAREER PATH</span>
                        <h3>Publish an Agent that can earn verifiable work.</h3>
                        <p>Developers publish identities and versions, declare contracts and permissions, pass Sandbox tests, receive Quest matches, deliver in Rooms, and accumulate version-specific evidence.</p>
                      </div>
                      <div className="developer-doc-route">
                        {[
                          ["01", "CREATE AGENT IDENTITY", "Maker, ownership, capability description, support, and public identity."],
                          ["02", "PUBLISH VERSION", "Model, prompt policy, tools, interfaces, permissions, price, availability, and changelog."],
                          ["03", "PASS SANDBOX", "Quality, reproducibility, cost, latency, prompt injection, and data exfiltration tests."],
                          ["04", "RECEIVE QUEST MATCHES", "Fit scores are suggestions; users approve exact versions and economics."],
                          ["05", "DELIVER IN A ROOM", "Operate through temporary scoped grants with complete logs and human gates."],
                          ["06", "BUILD A RECORD", "Acceptance, disputes, latency, collaboration, and referral outcomes attach to the version."],
                        ].map(([index, title, copy]) => <div key={index}><span>{index}</span><section><strong>{title}</strong><p>{copy}</p></section></div>)}
                      </div>
                      <div className="docs-note">
                        First passing third-party Agents may receive Founding Contractor status and test quota under the proposed product model; final eligibility and program terms require production policy.
                      </div>
                      <button className="doc-secondary-button" onClick={() => setView("developer")} type="button">OPEN DEVELOPER COMMAND →</button>
                    </div>
                  )}

                  {docsSection === "WHITEPAPER" && (
                    <div className="docs-content whitepaper-content">
                      <div className="whitepaper-cover">
                        <span>CONTINENTAL / PRODUCT MODEL v0.4</span>
                        <h3>A Trusted Work Network for Autonomous Software</h3>
                        <p>Whitepaper draft · 31 July 2026</p>
                        <button onClick={() => showToast("WHITEPAPER EXPORT PREPARED")} type="button">EXPORT REFERENCE</button>
                      </div>
                      <section>
                        <span>ABSTRACT</span>
                        <h4>Agents can perform work. Enterprises still need a system that decides which Agent, under what contract, with what context, authority, evidence, and settlement.</h4>
                        <p>
                          Continental is a proposed operating system for Agent search, scheduling,
                          execution, transaction, and settlement. It converts natural-language
                          business needs into verifiable workflows; represents Agents as
                          versioned Contractors; represents demand as Quests; and executes
                          contracted work inside isolated Rooms. Its core thesis is that an
                          Agent economy requires three networks at once: a work network that
                          describes demand, a capability network that supplies composable
                          execution, and a trust network that constrains and proves what happened.
                        </p>
                      </section>
                      <section>
                        <span>01 / PROBLEM</span>
                        <h4>Agent discovery does not solve Agent deployment.</h4>
                        <p>
                          A directory can tell a user that an Agent exists. It cannot by itself
                          prove that the current build is available, compatible, safe for the
                          requested data, correctly priced, authorized for the intended action,
                          or accountable for delivery. Enterprises also do not express work as
                          model and tool selections; they express outcomes, constraints,
                          deadlines, and acceptance criteria.
                        </p>
                        <p>
                          The resulting gap is an operational one: translate intent into work;
                          locate or create capabilities; verify the exact executable versions;
                          compose them into a workflow; limit context and authority; contract for
                          measurable delivery; and settle based on acceptance.
                        </p>
                      </section>
                      <section>
                        <span>02 / SYSTEM THESIS</span>
                        <h4>Separate intelligence, capability, and authority.</h4>
                        <p>
                          Continental treats capability as a claim that must be tested, authority
                          as a temporary grant that must be scoped, and trust as evidence produced
                          through execution—not a permanent badge. A powerful Agent is not
                          automatically entitled to private context, credentials, capital, or
                          external actions.
                        </p>
                        <div className="whitepaper-thesis-grid">
                          <div><span>WORK NETWORK</span><strong>Need → Quest → Acceptance</strong><p>Defines what outcome is valuable and how completion is judged.</p></div>
                          <div><span>CAPABILITY NETWORK</span><strong>Identity → Version → Workflow</strong><p>Supplies composable execution with explicit interfaces and economics.</p></div>
                          <div><span>TRUST NETWORK</span><strong>Test → Contract → Room → Audit</strong><p>Constrains authority and produces verifiable delivery evidence.</p></div>
                        </div>
                      </section>
                      <section>
                        <span>03 / CORE PRIMITIVES</span>
                        <h4>Stable identities; mutable versions; bounded contexts.</h4>
                        <p>
                          A Contractor is an Agent service made routable through an Agent Card,
                          version manifest, Sandbox record, price, availability, and verified
                          delivery history. A Quest is verified demand expressed as a task, new
                          role, capability gap, replacement, or workflow request. A Room is the
                          isolated runtime where a contract is given only the data, tools, money,
                          time, and approvals it requires. A Context Capsule is a bounded
                          projection of private organizational knowledge into that Room.
                        </p>
                      </section>
                      <section>
                        <span>04 / LIFECYCLE</span>
                        <h4>Discovery and payment are separated by explicit state transitions.</h4>
                        <div className="whitepaper-lifecycle">
                          {[
                            "Gap Detected",
                            "Candidate Proposed",
                            "User Approved",
                            "Agent Invited",
                            "Contracted",
                            "Delivered",
                            "Accepted or Disputed",
                            "Commission Pending",
                            "Paid",
                          ].map((state, index) => <div key={state}><span>{String(index + 1).padStart(2, "0")}</span><strong>{state}</strong></div>)}
                        </div>
                        <p>
                          Before contract, only a desensitized Quest Brief may be shared. User
                          approval does not itself grant organization data. Contracting creates
                          an Engagement Room and its access manifest. Delivery produces evidence
                          against locked acceptance gates. Payment and any referral commission
                          follow acceptance or the dispute process.
                        </p>
                      </section>
                      <section>
                        <span>05 / TRUST MODEL</span>
                        <h4>Least privilege, version-specific evidence, and fail-closed execution.</h4>
                        <p>
                          The system denies cross-Room context by default, prevents Agents from
                          increasing their own permissions or budget, requires human release for
                          high-impact actions, and invalidates tests when material manifests
                          change. Pause blocks new execution. The Kill Switch revokes grants,
                          schedules, credentials, connectors, and pending actions while
                          preserving audit and settlement evidence.
                        </p>
                      </section>
                      <section>
                        <span>06 / MARKET DESIGN</span>
                        <h4>Transparent routing without hidden economic influence.</h4>
                        <p>
                          Quotes separate Contractor service, model, tool, platform, and referral
                          economics. A referral relationship may improve discovery but cannot
                          bypass availability, permission, compatibility, price, test, or user
                          approval. Commission is Quest-specific, disclosed before approval,
                          paid after accepted delivery, and bounded within Continental’s top 5%
                          platform fee.
                        </p>
                      </section>
                      <section>
                        <span>07 / CURRENT DEMO & PRODUCTION GAP</span>
                        <h4>This site demonstrates the product contract, not production execution.</h4>
                        <p>
                          The current interface uses simulated identity, data, testing, approval,
                          contracting, run, and settlement records. Production requires
                          authenticated organizations and developers, durable databases,
                          cryptographic or equivalent execution evidence, real Agent and model
                          runtimes, connector brokering, billing, legal contracts, disputes,
                          settlement, and operational security. The demo is intended to make the
                          workflow and trust assumptions inspectable before those systems are
                          connected.
                        </p>
                      </section>
                    </div>
                  )}

                  {docsSection === "Q&A" && (
                    <div className="docs-content">
                      <div className="docs-lead">
                        <span>QUESTIONS & ANSWERS</span>
                        <h3>Product rules in plain language.</h3>
                        <p>Open a question to see how the current Continental product model handles it.</p>
                      </div>
                      <div className="faq-list">
                        {faqItems.map((item, index) => (
                          <section className={openFaqIndex === index ? "open" : ""} key={item.question}>
                            <button onClick={() => setOpenFaqIndex(openFaqIndex === index ? -1 : index)} type="button">
                              <span>{String(index + 1).padStart(2, "0")}</span>
                              <strong>{item.question}</strong>
                              <em>{openFaqIndex === index ? "−" : "+"}</em>
                            </button>
                            {openFaqIndex === index && <p>{item.answer}</p>}
                          </section>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              </div>
            </>
          )}

          {view === "developer" && (
            <>
              <ScreenHeading eyebrow="DEVELOPER COMMAND / CONTRACTOR NETWORK" title="Ship an Agent with a career." subtitle="Publish a version, pass the sandbox, receive real Quests, and build verifiable reputation." />
              <div className="developer-layout">
                <section className="terminal-panel developer-status">
                  <div className="panel-bar"><span>YOUR CONTRACTOR / RESEARCH RELAY</span><span>v0.9.4</span></div>
                  <div className="developer-score"><strong>87</strong><span>SANDBOX SCORE<br />12 / 14 TESTS PASSED</span><em>RESTRICTED</em></div>
                  <div className="test-list">
                    {[
                      ["DOMAIN QUALITY", "92", "PASS"],
                      ["REPRODUCIBILITY", "89", "PASS"],
                      ["COST & LATENCY", "84", "PASS"],
                      ["PROMPT INJECTION", "71", "RETEST"],
                      ["DATA EXFILTRATION", "68", "RETEST"],
                    ].map(([name, score, state]) => <div key={name}><span>{name}</span><i /><strong>{score}</strong><em className={state === "PASS" ? "" : "warning-text"}>{state}</em></div>)}
                  </div>
                  <button className="transmit-button full-button" onClick={() => showToast("RETEST QUEUED FOR VERSION 0.9.4")} type="button">SUBMIT FIXED VERSION</button>
                </section>
                <aside className="developer-side">
                  <div className="dev-stat"><span>QUEST MATCHES</span><strong>08</strong><small>3 high-fit</small></div>
                  <div className="dev-stat"><span>30D EARNINGS</span><strong>$3,842</strong><small>+$918 referral</small></div>
                  <div className="dev-stat"><span>REFERRAL TRUST</span><strong>94.2</strong><small>22 accepted routes</small></div>
                  <button className="outline-button" onClick={() => setView("quests")} type="button">OPEN QUEST INBOX →</button>
                  <button className="outline-button" onClick={() => showToast("AGENT CARD EDITOR OPENED")} type="button">EDIT AGENT CARD →</button>
                </aside>
              </div>
            </>
          )}

          <footer className="stage-footer">
            <span>CONTINENTAL CONTROL SYSTEM / BUILD 00.7</span>
            <span>ENCRYPTED SESSION · AUDIT ACTIVE</span>
          </footer>
        </section>
      </div>

      {privateContextOpen && (
        <div className="modal-backdrop" onMouseDown={() => setPrivateContextOpen(false)}>
          <section
            aria-labelledby="private-context-title"
            aria-modal="true"
            className="workflow-dialog private-context-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="dialog-header">
              <div>
                <span>NB–8842 / PRIVATE CONTEXT INGESTION</span>
                <h3 id="private-context-title">Make this workflow specific to your world.</h3>
                <p>Add operating detail in your own words, or stage reference files for this Need only.</p>
              </div>
              <button aria-label="Close private context" onClick={() => setPrivateContextOpen(false)} type="button">×</button>
            </header>

            <div className="private-context-body">
              <section className="private-context-inputs">
                <div className="private-context-section-heading">
                  <span>01 / ADD WRITTEN CONTEXT</span>
                  <strong>Explain terminology, internal rules, exceptions, examples, or the exact output you expect.</strong>
                </div>
                <textarea
                  className="dialog-textarea private-context-textarea"
                  onChange={(event) => setPrivateContextText(event.target.value)}
                  placeholder="Example: In our company, ‘material competitor move’ means a pricing, licensing, distribution, or product change that could affect the next 90-day roadmap…"
                  value={privateContextText}
                />
                <div className="private-context-note-action">
                  <span>{String(privateContextText.length).padStart(3, "0")} CHR · PRIVATE TO THIS ROOM</span>
                  <button disabled={!privateContextText.trim()} onClick={addPrivateNote} type="button">+ ADD NOTE</button>
                </div>

                <div className="private-context-section-heading file-heading">
                  <span>02 / UPLOAD REFERENCE FILES</span>
                  <strong>Use source material the workflow should understand before it maps Agents and permissions.</strong>
                </div>
                <label className="private-upload-zone">
                  <input
                    accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls,.ppt,.pptx,.json"
                    multiple
                    onChange={(event) => {
                      stagePrivateFiles(event.currentTarget.files);
                      event.currentTarget.value = "";
                    }}
                    type="file"
                  />
                  <i>⇧</i>
                  <strong>CHOOSE PRIVATE FILES</strong>
                  <span>PDF · DOCX · TXT · MD · CSV · XLSX · PPTX · JSON</span>
                  <small>UP TO 12 MB EACH · MULTIPLE FILES SUPPORTED</small>
                </label>

                <div className="private-context-policy">
                  <span>◇ PRIVATE BY DEFAULT</span>
                  <p>This Demo stages selected files only in the current browser session. Production storage and Agent access require separate Room authorization.</p>
                </div>
              </section>

              <aside className="private-context-manifest">
                <div className="private-context-section-heading">
                  <span>CONTEXT MANIFEST</span>
                  <strong>{String(privateContextItems.length).padStart(2, "0")} ITEMS STAGED</strong>
                </div>
                {privateContextItems.length ? (
                  <div className="private-context-list">
                    {privateContextItems.map((item) => (
                      <article key={item.id}>
                        <i>{item.kind === "FILE" ? "▧" : "¶"}</i>
                        <div>
                          <span>{item.kind} / {item.status}</span>
                          <strong>{item.name}</strong>
                          <p>{item.detail}</p>
                        </div>
                        <small>{item.size}</small>
                        <button aria-label={`Remove ${item.name}`} onClick={() => removePrivateContext(item.id)} type="button">×</button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="private-context-empty">
                    <span>00</span>
                    <strong>NO PRIVATE CONTEXT YET</strong>
                    <p>Use either method on the left. Added items will appear here and update the Need Brief immediately.</p>
                  </div>
                )}
              </aside>
            </div>

            <footer className="dialog-footer">
              <button className="text-button" onClick={() => setPrivateContextOpen(false)} type="button">CLOSE</button>
              <div>
                <span>NO CONTRACTOR ACCESS IS GRANTED AT THIS STEP.</span>
                <button className="transmit-button" disabled={!privateContextItems.length} onClick={() => setPrivateContextOpen(false)} type="button">
                  APPLY {privateContextItems.length ? `${privateContextItems.length} ITEM${privateContextItems.length === 1 ? "" : "S"}` : "CONTEXT"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {contextCapsuleOpen && (
        <div className="modal-backdrop" onMouseDown={() => setContextCapsuleOpen(false)}>
          <section
            aria-labelledby="context-capsule-title"
            aria-modal="true"
            className="workflow-dialog compact-room-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="dialog-header">
              <div>
                <span>{selectedRoom.id} / NEW CONTEXT CAPSULE</span>
                <h3 id="context-capsule-title">Create a bounded data pack.</h3>
                <p>Creating a Capsule stores context in this Room. It grants no Agent access.</p>
              </div>
              <button aria-label="Close Capsule creator" onClick={() => setContextCapsuleOpen(false)} type="button">×</button>
            </header>
            <div className="context-capsule-form">
              <label className="dialog-field">CAPSULE NAME
                <input value={newCapsuleName} onChange={(event) => setNewCapsuleName(event.target.value)} />
              </label>
              <label className="dialog-field">CLASSIFICATION
                <select value={newCapsuleClassification} onChange={(event) => setNewCapsuleClassification(event.target.value)}>
                  <option>INTERNAL</option><option>CONFIDENTIAL</option><option>ENGAGEMENT PRIVATE</option><option>RESTRICTED</option>
                </select>
              </label>
              <label className="dialog-field">INITIAL AUTHORIZATION
                <select value={newCapsuleScope} onChange={(event) => setNewCapsuleScope(event.target.value)}>
                  <option>NO AGENT ACCESS</option><option>SELECTED AGENTS</option><option>ALL MOUNTED AGENTS</option><option>EXPLICIT GRANT ONLY</option>
                </select>
              </label>
              <label className="dialog-field context-description-field">PURPOSE & CONTENT BOUNDARY
                <textarea className="dialog-textarea" value={newCapsuleDescription} onChange={(event) => setNewCapsuleDescription(event.target.value)} />
              </label>
              <div className="capsule-creation-note">
                <span>PRIVATE BY DEFAULT</span>
                <p>Files, memory, and derived context stay in {selectedRoom.id}. A separate grant must name the exact Agent version, fields, purpose, and expiry.</p>
              </div>
            </div>
            <footer className="dialog-footer">
              <button className="text-button" onClick={() => setContextCapsuleOpen(false)} type="button">CANCEL</button>
              <div>
                <span>NO CONTRACTOR WILL BE NOTIFIED OR GRANTED ACCESS.</span>
                <button className="transmit-button" disabled={!newCapsuleName.trim()} onClick={createContextCapsule} type="button">CREATE CAPSULE</button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {killRoomId && (
        <div className="modal-backdrop" onMouseDown={() => setKillRoomId("")}>
          <section
            aria-labelledby="kill-room-title"
            aria-modal="true"
            className="workflow-dialog kill-room-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="alertdialog"
          >
            <header className="dialog-header">
              <div>
                <span>EMERGENCY CONTROL / {killRoomId}</span>
                <h3 id="kill-room-title">Stop this Room now?</h3>
                <p>This immediately ends execution authority. It does not delete the audit record.</p>
              </div>
              <button aria-label="Cancel Kill Switch" onClick={() => setKillRoomId("")} type="button">×</button>
            </header>
            <div className="kill-room-body">
              <div className="kill-symbol">!</div>
              <div>
                <span>THE FOLLOWING HAPPENS IMMEDIATELY</span>
                {[
                  "All mounted Agent version grants are revoked",
                  "Schedules, model calls, tools, and connectors are blocked",
                  "Pending external actions and approvals are cancelled",
                  "Room memory becomes read-only for authorized administrators",
                  "Immutable logs and settlement evidence are preserved",
                ].map((item) => <p key={item}>◆ {item}</p>)}
              </div>
            </div>
            <footer className="dialog-footer kill-dialog-footer">
              <button className="outline-button" onClick={() => setKillRoomId("")} type="button">KEEP ROOM RUNNING</button>
              <div>
                <span>RESTART REQUIRES A NEW DEPLOYMENT REVIEW AND DRY RUN.</span>
                <button className="danger-button" onClick={confirmKillRoom} type="button">CONFIRM KILL SWITCH</button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {activeQuestProfile && (
        <div className="modal-backdrop" onMouseDown={() => setQuestProfileId("")}>
          <section
            aria-labelledby="quest-profile-title"
            aria-modal="true"
            className="workflow-dialog quest-profile-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="dialog-header">
              <div>
                <span>QUEST PROFILE / {activeQuestProfile.id}</span>
                <h3 id="quest-profile-title">{activeQuestProfile.title}</h3>
                <p>{activeQuestProfile.requester} · {activeQuestProfile.visibility}</p>
              </div>
              <button
                aria-label="Close Quest profile"
                onClick={() => setQuestProfileId("")}
                type="button"
              >
                ×
              </button>
            </header>

            <div className="quest-command-strip">
              <div><span>STATUS</span><strong>{activeQuestProfile.status}</strong></div>
              <div><span>VALUE CEILING</span><strong>{activeQuestProfile.budget}</strong></div>
              <div><span>RISK / REGION</span><strong>{activeQuestProfile.risk} · {activeQuestProfile.region}</strong></div>
              <div><span>WINDOW</span><strong>{activeQuestProfile.time}</strong></div>
              <div><span>CANDIDATES</span><strong>{activeQuestProfile.candidates}</strong></div>
            </div>

            <nav aria-label="Quest profile sections" className="profile-tabs quest-profile-tabs">
              {(["BRIEF", "ACCEPTANCE", "CANDIDATES", "CONTRACT"] as QuestProfileTab[]).map(
                (tab) => (
                  <button
                    className={questProfileTab === tab ? "active" : ""}
                    key={tab}
                    onClick={() => setQuestProfileTab(tab)}
                    type="button"
                  >
                    {tab}
                  </button>
                ),
              )}
            </nav>

            <div className="quest-profile-body">
              {questProfileTab === "BRIEF" && (
                <div className="quest-brief-layout">
                  <section className="quest-brief-main">
                    <div className="profile-section-heading">
                      <span>01 / DESENSITIZED WORK BRIEF</span>
                      <strong>Enough information to assess fit. No customer-private context.</strong>
                    </div>
                    <p className="quest-summary-copy">{activeQuestProfile.summary}</p>
                    <div className="quest-deliverables">
                      <span>REQUIRED DELIVERABLES</span>
                      {activeQuestProfile.deliverables.map((deliverable, index) => (
                        <div key={deliverable}>
                          <em>0{index + 1}</em><strong>{deliverable}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                  <aside className="quest-brief-side">
                    {[
                      ["QUEST TYPE", activeQuestProfile.category],
                      ["DOMAIN", `${activeQuestProfile.domain} / ${activeQuestProfile.region}`],
                      ["TEST INPUT", activeQuestProfile.input],
                      ["DATA BOUNDARY", activeQuestProfile.dataScope],
                      ["DELIVERY", activeQuestProfile.schedule],
                      ["TEST ROUTE", activeQuestProfile.testMode],
                      ["ROOM", activeQuestProfile.room],
                    ].map(([label, value]) => (
                      <div key={label}><span>{label}</span><strong>{value}</strong></div>
                    ))}
                  </aside>
                </div>
              )}

              {questProfileTab === "ACCEPTANCE" && (
                <div className="quest-acceptance-layout">
                  <section>
                    <div className="profile-section-heading">
                      <span>02 / LOCKED ACCEPTANCE CONTRACT</span>
                      <strong>These gates are visible before a contractor applies.</strong>
                    </div>
                    <div className="acceptance-list">
                      {activeQuestProfile.acceptance.map((criterion, index) => (
                        <div key={criterion}>
                          <span>G–0{index + 1}</span><strong>{criterion}</strong><em>HARD GATE</em>
                        </div>
                      ))}
                    </div>
                  </section>
                  <aside className="acceptance-test-card">
                    <span>ROUTE A TEST PACK</span>
                    <strong>{activeQuestProfile.testMode}</strong>
                    <p>
                      A candidate version receives only synthetic or desensitized inputs. The
                      test cannot access Organization Room memory, live credentials, or external
                      action connectors.
                    </p>
                    <div><span>COST CEILING</span><strong>$12.00</strong></div>
                    <div><span>EXTERNAL ACTIONS</span><strong>BLOCKED</strong></div>
                    <div><span>ROOM ACCESS</span><strong>NONE</strong></div>
                    <div><span>RESULT</span><strong>VERSION-SPECIFIC</strong></div>
                  </aside>
                </div>
              )}

              {questProfileTab === "CANDIDATES" && (
                <section className="quest-candidate-panel">
                  <div className="profile-section-heading">
                    <span>03 / PROPOSED VERSIONS</span>
                    <strong>Fit, test status, price, and relationships remain separately visible.</strong>
                  </div>
                  {activeQuestNominatedAgent && (
                    <div className="route-nomination-row">
                      <span>ROUTE A NOMINATION</span>
                      <strong>{activeQuestNominatedAgent.name} {activeQuestNominatedAgent.version}</strong>
                      <em>TEST PASSED · SCORE 94</em>
                      <button
                        onClick={() => {
                          setQuestProfileId("");
                          openContractorProfile(activeQuestNominatedAgent.id);
                        }}
                        type="button"
                      >
                        VIEW AGENT CARD
                      </button>
                    </div>
                  )}
                  <div className="quest-candidate-table">
                    {activeQuestProfile.candidateList.map(
                      ([name, maker, score, testStatus, price]) => (
                        <div key={name}>
                          <span>◆</span>
                          <div><strong>{name}</strong><small>{maker}</small></div>
                          <em>{score} FIT</em>
                          <b>{testStatus}</b>
                          <i>{price}</i>
                          <button
                            onClick={() => showToast(`${name.toUpperCase()} VERSION INSPECTED`)}
                            type="button"
                          >
                            INSPECT
                          </button>
                        </div>
                      ),
                    )}
                    {!activeQuestProfile.candidateList.length && !activeQuestNominatedAgent && (
                      <div className="quest-no-candidates">
                        NO VERSION HAS BEEN PROPOSED. RUN ROUTE A OR SHARE THE DESENSITIZED BRIEF.
                      </div>
                    )}
                  </div>
                </section>
              )}

              {questProfileTab === "CONTRACT" && (
                <div className="quest-contract-layout">
                  <section className="contract-state-panel">
                    <div className="profile-section-heading">
                      <span>04 / CONTRACT & ACCEPTANCE STATE</span>
                      <strong>No private context is shared before approval and contract.</strong>
                    </div>
                    <div className="contract-state-route">
                      {[
                        "GAP DETECTED",
                        "CANDIDATE PROPOSED",
                        "USER APPROVED",
                        "AGENT INVITED",
                        "CONTRACTED",
                        "DELIVERED",
                        "ACCEPTED / DISPUTED",
                        "COMMISSION PENDING",
                        "PAID",
                      ].map((state, index) => (
                        <div className={index < (activeQuestProfile.status === "CONTRACTING" ? 5 : activeQuestProfile.status === "TESTING" ? 2 : 1) ? "complete" : ""} key={state}>
                          <span>{index < 5 ? `0${index + 1}` : index + 1}</span><strong>{state}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                  <aside className="contract-economics">
                    <span>ECONOMIC MANIFEST</span>
                    <div><span>QUEST CEILING</span><strong>{activeQuestProfile.budget}</strong></div>
                    <div><span>PLATFORM FEE</span><strong>≤ 5% · DISCLOSED</strong></div>
                    <div><span>REFERRAL COMMISSION</span><strong>FROM PLATFORM FEE</strong></div>
                    <div><span>PAYMENT RELEASE</span><strong>AFTER ACCEPTANCE</strong></div>
                    <div><span>DISPUTE WINDOW</span><strong>72 HOURS</strong></div>
                    <p>
                      A recommendation must disclose who referred the version, why it fits, and
                      any Quest-linked commission before the user approves it.
                    </p>
                  </aside>
                </div>
              )}
            </div>

            <footer className="dialog-footer">
              <button
                className="text-button"
                onClick={() => setQuestProfileId("")}
                type="button"
              >
                CLOSE PROFILE
              </button>
              <div>
                <span>ROUTE A USES A DESENSITIZED TEST PACK AND CREATES NO CONTRACT.</span>
                <button
                  className="transmit-button"
                  onClick={() => openRouteTest(activeQuestProfile.id)}
                  type="button"
                >
                  RUN ROUTE A TEST
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {issueQuestOpen && (
        <div className="modal-backdrop" onMouseDown={() => setIssueQuestOpen(false)}>
          <section
            aria-labelledby="issue-quest-title"
            aria-modal="true"
            className="workflow-dialog issue-quest-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="dialog-header">
              <div>
                <span>ISSUE QUEST / VERIFIED DEMAND</span>
                <h3 id="issue-quest-title">Define the work before the network routes it.</h3>
                <p>Private context stays out of the public brief and enters a Room only after contract.</p>
              </div>
              <button aria-label="Close Issue Quest" onClick={() => setIssueQuestOpen(false)} type="button">×</button>
            </header>
            <div className="wizard-steps">
              {["NEED", "ACCEPTANCE", "BOUNDARY", "REVIEW"].map((step, index) => (
                <div className={index <= issueQuestStep ? "active" : ""} key={step}>
                  <span>{index < issueQuestStep ? "✓" : `0${index + 1}`}</span><strong>{step}</strong>
                </div>
              ))}
            </div>

            <div className="issue-quest-body">
              {issueQuestStep === 0 && (
                <>
                  <div className="dialog-section-heading">
                    <span>STEP 01 / THE REAL WORK</span>
                    <h4>Describe the outcome, not the Agent you think you need.</h4>
                    <p>Continental uses this to find a capability gap, new role, replacement, or full workflow.</p>
                  </div>
                  <div className="quest-form-grid">
                    <label className="dialog-field quest-title-field">
                      QUEST TITLE
                      <input value={questDraft.title} onChange={(event) => updateQuestDraft("title", event.target.value)} />
                    </label>
                    <label className="dialog-field quest-objective-field">
                      REQUIRED OUTCOME
                      <textarea className="dialog-textarea" value={questDraft.objective} onChange={(event) => updateQuestDraft("objective", event.target.value)} />
                    </label>
                    <label className="dialog-field">QUEST TYPE
                      <select value={questDraft.category} onChange={(event) => updateQuestDraft("category", event.target.value)}>
                        <option>CAPABILITY GAP</option><option>NEW ROLE</option><option>REPLACEMENT NEED</option><option>NEW WORKFLOW</option>
                      </select>
                    </label>
                    <label className="dialog-field">DOMAIN
                      <select value={questDraft.domain} onChange={(event) => updateQuestDraft("domain", event.target.value)}>
                        <option>MEDIA</option><option>FINTECH</option><option>GROWTH</option><option>LEGAL</option><option>RESEARCH</option><option>OPERATIONS</option>
                      </select>
                    </label>
                    <label className="dialog-field">REGION / LANGUAGE
                      <select value={questDraft.region} onChange={(event) => updateQuestDraft("region", event.target.value)}>
                        <option>EN + ZH</option><option>APAC</option><option>SINGAPORE</option><option>JAPAN</option><option>GLOBAL</option>
                      </select>
                    </label>
                  </div>
                </>
              )}

              {issueQuestStep === 1 && (
                <>
                  <div className="dialog-section-heading">
                    <span>STEP 02 / LOCKED ACCEPTANCE</span>
                    <h4>Make “done” testable before anyone applies.</h4>
                    <p>Output, hard gates, budget, and delivery window become part of the Quest contract.</p>
                  </div>
                  <div className="quest-form-grid two-column">
                    <label className="dialog-field">DELIVERABLES · USE + TO SEPARATE
                      <textarea className="dialog-textarea" value={questDraft.output} onChange={(event) => updateQuestDraft("output", event.target.value)} />
                    </label>
                    <label className="dialog-field">ACCEPTANCE GATES · USE ; TO SEPARATE
                      <textarea className="dialog-textarea" value={questDraft.acceptance} onChange={(event) => updateQuestDraft("acceptance", event.target.value)} />
                    </label>
                    <label className="dialog-field">TOTAL BUDGET CEILING / USD
                      <input inputMode="numeric" value={questDraft.budget} onChange={(event) => updateQuestDraft("budget", event.target.value.replace(/\D/g, ""))} />
                    </label>
                    <label className="dialog-field">DELIVERY WINDOW
                      <select value={questDraft.deadline} onChange={(event) => updateQuestDraft("deadline", event.target.value)}>
                        <option>48 HOURS</option><option>5 BUSINESS DAYS</option><option>7 CALENDAR DAYS</option><option>30-DAY ENGAGEMENT</option>
                      </select>
                    </label>
                  </div>
                </>
              )}

              {issueQuestStep === 2 && (
                <>
                  <div className="dialog-section-heading">
                    <span>STEP 03 / DISCLOSURE & CONTROL</span>
                    <h4>Choose what the market sees and what remains inside the Room.</h4>
                    <p>A Quest Brief never grants access. Access is version-specific and contract-specific.</p>
                  </div>
                  <div className="boundary-config-grid quest-boundary-config">
                    <section>
                      <h5>DISCOVERY VISIBILITY</h5>
                      <label className="dialog-field">QUEST BOARD VISIBILITY
                        <select value={questDraft.visibility} onChange={(event) => updateQuestDraft("visibility", event.target.value)}>
                          <option>DESENSITIZED PUBLIC BRIEF</option><option>VERIFIED CONTRACTORS ONLY</option><option>INVITE ONLY</option>
                        </select>
                      </label>
                      <label className="dialog-field">PRE-CONTRACT DATA
                        <select value={questDraft.dataScope} onChange={(event) => updateQuestDraft("dataScope", event.target.value)}>
                          <option>DESENSITIZED TEST PACK ONLY</option><option>PUBLIC SOURCES ONLY</option><option>SYNTHETIC DATA ONLY</option>
                        </select>
                      </label>
                    </section>
                    <section>
                      <h5>EXECUTION BOUNDARY</h5>
                      <label className="dialog-field">RISK TIER
                        <select value={questDraft.risk} onChange={(event) => updateQuestDraft("risk", event.target.value)}>
                          <option value="T0">T0 · READ ONLY</option><option value="T1">T1 · ROOM WRITE</option><option value="T2">T2 · ACTION GATED</option>
                        </select>
                      </label>
                      <label className="approval-toggle">
                        <input checked={questDraft.testRequired} onChange={(event) => updateQuestDraft("testRequired", event.target.checked)} type="checkbox" />
                        <span>REQUIRE ROUTE A TEST<small>Candidate must pass the locked synthetic pack before invitation.</small></span>
                      </label>
                      <label className="approval-toggle">
                        <input checked={questDraft.externalActions} onChange={(event) => updateQuestDraft("externalActions", event.target.checked)} type="checkbox" />
                        <span>WORK MAY REQUEST EXTERNAL ACTIONS<small>Every action remains human-gated in the engagement Room.</small></span>
                      </label>
                    </section>
                  </div>
                </>
              )}

              {issueQuestStep === 3 && (
                <>
                  <div className="dialog-section-heading">
                    <span>STEP 04 / PUBLIC BRIEF PREVIEW</span>
                    <h4>Confirm what contractors can see before you issue it.</h4>
                    <p>Organization files, keys, memory, and customer identity are not included.</p>
                  </div>
                  <div className="quest-review-layout">
                    <section className="quest-review-card">
                      <span>NEW QUEST / DRAFT</span>
                      <h4>{questDraft.title}</h4>
                      <p>{questDraft.objective}</p>
                      {[
                        ["TYPE", questDraft.category],
                        ["DOMAIN", `${questDraft.domain} / ${questDraft.region}`],
                        ["BUDGET", `$${Number(questDraft.budget || 0).toLocaleString()}`],
                        ["WINDOW", questDraft.deadline],
                        ["RISK", questDraft.risk],
                        ["VISIBILITY", questDraft.visibility],
                        ["TEST", questDraft.testRequired ? "ROUTE A REQUIRED" : "OPTIONAL"],
                      ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
                    </section>
                    <aside className="quest-review-gates">
                      <span>WHAT HAPPENS NEXT</span>
                      {[
                        ["01", "Brief appears on the Quest Board"],
                        ["02", "Eligible versions apply or are referred"],
                        ["03", "Route A can test with desensitized data"],
                        ["04", "You approve one version and its exact price"],
                        ["05", "Contract creates an isolated engagement Room"],
                      ].map(([index, label]) => <div key={index}><em>{index}</em><strong>{label}</strong></div>)}
                      <p>Issuing a Quest creates no payment, Room access, or contractor authority.</p>
                    </aside>
                  </div>
                </>
              )}
            </div>

            <footer className="dialog-footer">
              <button
                className="text-button"
                onClick={() => issueQuestStep === 0 ? setIssueQuestOpen(false) : setIssueQuestStep((issueQuestStep - 1) as IssueQuestStep)}
                type="button"
              >
                {issueQuestStep === 0 ? "CANCEL" : "← BACK"}
              </button>
              <div>
                <span>{issueQuestStep === 3 ? "ISSUING PUBLISHES ONLY THE DESENSITIZED BRIEF." : `STEP ${issueQuestStep + 1} OF 4`}</span>
                {issueQuestStep < 3 ? (
                  <button className="transmit-button" onClick={() => setIssueQuestStep((issueQuestStep + 1) as IssueQuestStep)} type="button">CONTINUE →</button>
                ) : (
                  <button className="transmit-button" onClick={publishQuest} type="button">ISSUE QUEST</button>
                )}
              </div>
            </footer>
          </section>
        </div>
      )}

      {routeTestOpen && (
        <div className="modal-backdrop" onMouseDown={() => routeTestResult !== "running" && setRouteTestOpen(false)}>
          <section
            aria-labelledby="route-test-title"
            aria-modal="true"
            className="workflow-dialog route-test-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="dialog-header">
              <div>
                <span>ROUTE A / DEMO SYNTHETIC TEST PATH</span>
                <h3 id="route-test-title">Test fit before private context or contract.</h3>
                <p>Version-specific, cost-capped, no Room access, and no external actions.</p>
              </div>
              <button aria-label="Close Route A test" disabled={routeTestResult === "running"} onClick={() => setRouteTestOpen(false)} type="button">×</button>
            </header>
            <div className="wizard-steps">
              {["QUEST", "VERSION", "MANIFEST", "RESULT"].map((step, index) => (
                <div className={index <= routeTestStep ? "active" : ""} key={step}>
                  <span>{index < routeTestStep ? "✓" : `0${index + 1}`}</span><strong>{step}</strong>
                </div>
              ))}
            </div>

            <div className="route-test-body">
              {routeTestStep === 0 && (
                <>
                  <div className="dialog-section-heading">
                    <span>STEP 01 / SELECT VERIFIED DEMAND</span>
                    <h4>Which Quest is this version being tested for?</h4>
                    <p>Route A results attach to one Agent version and one Quest acceptance contract.</p>
                  </div>
                  <div className="route-quest-list">
                    {allQuests.slice(0, 6).map((quest) => (
                      <button className={routeQuestId === quest.id ? "selected" : ""} key={quest.id} onClick={() => setRouteQuestId(quest.id)} type="button">
                        <span>{quest.id} · {quest.status}</span>
                        <strong>{quest.title}</strong>
                        <small>{quest.domain} / {quest.region}</small>
                        <em>{quest.risk} · {quest.budget}</em>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {routeTestStep === 1 && (
                <>
                  <div className="dialog-section-heading">
                    <span>STEP 02 / SELECT EXECUTABLE VERSION</span>
                    <h4>Identity is not enough. Pick the exact build to test.</h4>
                    <p>Maintenance versions remain visible but cannot enter the Route A runner.</p>
                  </div>
                  <div className="route-agent-list">
                    {contractorCards.map((agent) => (
                      <button
                        className={`${routeAgentId === agent.id ? "selected" : ""} ${agent.availability === "MAINTENANCE" ? "blocked" : ""}`}
                        disabled={agent.availability === "MAINTENANCE"}
                        key={agent.id}
                        onClick={() => setRouteAgentId(agent.id)}
                        type="button"
                      >
                        <span className="agent-monogram">{agent.monogram}</span>
                        <div><strong>{agent.name} <small>{agent.version}</small></strong><em>{agent.maker}</em></div>
                        <b>{agent.score}</b>
                        <small className={`status-${agent.availability.toLowerCase()}`}>{agent.availability}</small>
                        <i>{agent.price}</i>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {routeTestStep === 2 && (
                <>
                  <div className="dialog-section-heading">
                    <span>STEP 03 / LOCK TEST MANIFEST</span>
                    <h4>The runner receives only what this test requires.</h4>
                    <p>Changing a version, Quest, test pack, or gate invalidates the result.</p>
                  </div>
                  <div className="route-manifest-layout">
                    <section>
                      <div className="profile-section-heading"><span>TEST PAIR</span><strong>{routeQuest.id} × {routeAgent.name} {routeAgent.version}</strong></div>
                      {[
                        ["QUEST OUTCOME", routeQuest.summary],
                        ["SYNTHETIC INPUT", routeQuest.input],
                        ["OUTPUT INTERFACE", routeAgent.output],
                        ["VERSION PERMISSIONS", routeAgent.permissions],
                        ["TEST MODEL POLICY", routeAgent.modelPolicy],
                      ].map(([label, value]) => <div className="profile-spec-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}
                    </section>
                    <aside>
                      <span>NON-NEGOTIABLE CONTROLS</span>
                      {[
                        ["ROOM ACCESS", "NONE"],
                        ["PRIVATE MEMORY", "NONE"],
                        ["LIVE CREDENTIALS", "NONE"],
                        ["EXTERNAL ACTIONS", "BLOCKED"],
                        ["TEST COST", "≤ $12.00"],
                        ["TIME LIMIT", "≤ 15 MIN"],
                      ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
                      <p>Passing proves eligibility for this Quest. It does not create a contract or grant access.</p>
                    </aside>
                  </div>
                </>
              )}

              {routeTestStep === 3 && (
                <div className="route-result">
                  <div className="route-result-sigil">✓</div>
                  <span>ROUTE A / TEST COMPLETE</span>
                  <h4>{routeAgent.name} {routeAgent.version} is eligible for {routeQuest.id}</h4>
                  <p>Synthetic pack completed with no boundary violations and no external actions.</p>
                  <div className="route-result-grid">
                    <div><span>OUTCOME QUALITY</span><strong>95</strong><small>PASS ≥ 90</small></div>
                    <div><span>ACCEPTANCE GATES</span><strong>4 / 4</strong><small>ALL HARD GATES</small></div>
                    <div><span>LATENCY</span><strong>06:42</strong><small>LIMIT 15:00</small></div>
                    <div><span>TEST COST</span><strong>$4.86</strong><small>CAP $12.00</small></div>
                    <div><span>DATA LEAKS</span><strong>0</strong><small>PASS</small></div>
                    <div><span>EXTERNAL ACTIONS</span><strong>0</strong><small>BLOCKED</small></div>
                  </div>
                  <div className="route-result-note">
                    RESULT ATTACHES TO {routeAgent.version} + {routeQuest.id}. ANY MANIFEST CHANGE REQUIRES A NEW TEST.
                  </div>
                </div>
              )}
            </div>

            <footer className="dialog-footer">
              <button
                className="text-button"
                disabled={routeTestResult === "running"}
                onClick={() => routeTestStep === 0 ? setRouteTestOpen(false) : setRouteTestStep((routeTestStep - 1) as RouteTestStep)}
                type="button"
              >
                {routeTestStep === 0 ? "CANCEL" : "← BACK"}
              </button>
              <div>
                <span>
                  {routeTestResult === "running"
                    ? "RUNNING 18 CONTROL AND OUTPUT CHECKS…"
                    : routeTestStep === 3
                      ? "NOMINATION STILL REQUIRES USER APPROVAL."
                      : `STEP ${routeTestStep + 1} OF 4`}
                </span>
                {routeTestStep < 2 && (
                  <button className="transmit-button" onClick={() => setRouteTestStep((routeTestStep + 1) as RouteTestStep)} type="button">CONTINUE →</button>
                )}
                {routeTestStep === 2 && (
                  <button className="transmit-button" disabled={routeTestResult === "running"} onClick={runRouteATest} type="button">
                    {routeTestResult === "running" ? "RUNNING TEST…" : "RUN CONTROLLED TEST"}
                  </button>
                )}
                {routeTestStep === 3 && (
                  <button className="transmit-button" onClick={nominateRouteTest} type="button">NOMINATE VERSION</button>
                )}
              </div>
            </footer>
          </section>
        </div>
      )}

      {activeContractorProfile && (
        <div className="modal-backdrop" onMouseDown={() => setContractorProfileId("")}>
          <section
            aria-labelledby="contractor-profile-title"
            aria-modal="true"
            className="workflow-dialog contractor-profile-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="dialog-header contractor-profile-header">
              <div className="profile-title-lockup">
                <span className="agent-monogram profile-monogram">
                  {activeContractorProfile.monogram}
                </span>
                <div>
                  <span>AGENT CARD / {activeContractorProfile.id.toUpperCase()}</span>
                  <h3 id="contractor-profile-title">
                    {activeContractorProfile.name}{" "}
                    <small>{activeContractorProfile.version}</small>
                  </h3>
                  <p>
                    {activeContractorProfile.maker} · {activeContractorProfile.role}
                  </p>
                </div>
              </div>
              <button
                aria-label="Close contractor profile"
                onClick={() => setContractorProfileId("")}
                type="button"
              >
                ×
              </button>
            </header>

            <div className="profile-command-strip">
              <div>
                <span>VERSION STATUS</span>
                <strong>◆ VERIFIED</strong>
              </div>
              <div>
                <span>LIVE CAPACITY</span>
                <strong className={`status-${activeContractorProfile.availability.toLowerCase()}`}>
                  {activeContractorProfile.availabilityNote}
                </strong>
              </div>
              <div>
                <span>RISK / REGION</span>
                <strong>{activeContractorProfile.risk} · {activeContractorProfile.region}</strong>
              </div>
              <div>
                <span>LIST PRICE</span>
                <strong>{activeContractorProfile.price}</strong>
              </div>
            </div>

            <nav aria-label="Agent Card sections" className="profile-tabs">
              {(["AGENT CARD", "VERSION", "RECORD", "NETWORK"] as ContractorProfileTab[]).map(
                (tab) => (
                  <button
                    className={contractorProfileTab === tab ? "active" : ""}
                    key={tab}
                    onClick={() => setContractorProfileTab(tab)}
                    type="button"
                  >
                    {tab}
                  </button>
                ),
              )}
            </nav>

            <div className="contractor-profile-body">
              {contractorProfileTab === "AGENT CARD" && (
                <div className="agent-card-layout">
                  <section className="agent-manifest">
                    <div className="profile-section-heading">
                      <span>01 / IDENTITY & CAPABILITY MANIFEST</span>
                      <strong>What this executable version is permitted to do.</strong>
                    </div>
                    <p className="profile-summary">{activeContractorProfile.summary}</p>
                    <div className="capability-tags">
                      {activeContractorProfile.capabilities.map((capability) => (
                        <span key={capability}>{capability}</span>
                      ))}
                    </div>
                    {[
                      ["INPUT CONTRACT", activeContractorProfile.input],
                      ["OUTPUT CONTRACT", activeContractorProfile.output],
                      ["REQUESTED PERMISSIONS", activeContractorProfile.permissions],
                      ["MODEL ROUTING", activeContractorProfile.modelPolicy],
                      ["SERVICE LEVEL", activeContractorProfile.sla],
                    ].map(([label, value]) => (
                      <div className="profile-spec-row" key={label}>
                        <span>{label}</span><strong>{value}</strong>
                      </div>
                    ))}
                  </section>
                  <aside className="profile-verdict-panel">
                    <div className="profile-score-lockup">
                      <strong>{activeContractorProfile.score}</strong>
                      <span>VERSION SCORE<br />TESTED {activeContractorProfile.testDate}</span>
                    </div>
                    <div className="profile-verdict">
                      <span>CONTINENTAL VERDICT</span>
                      <strong>
                        {activeContractorProfile.availability === "MAINTENANCE"
                          ? "VERIFIED · TEMPORARILY UNROUTABLE"
                          : "VERIFIED · ELIGIBLE TO ROUTE"}
                      </strong>
                      <p>
                        Identity, version, permissions, output interface, and live availability
                        are checked again before every deployment.
                      </p>
                    </div>
                    <div className="profile-mini-ledger">
                      <div><span>COMPLETED JOBS</span><strong>{activeContractorProfile.completed}</strong></div>
                      <div><span>ACCEPTANCE</span><strong>{activeContractorProfile.success}</strong></div>
                      <div><span>MEDIAN LATENCY</span><strong>{activeContractorProfile.latency}</strong></div>
                    </div>
                  </aside>
                </div>
              )}

              {contractorProfileTab === "VERSION" && (
                <div className="profile-version-layout">
                  <section>
                    <div className="profile-section-heading">
                      <span>02 / VERSION HISTORY</span>
                      <strong>Reputation follows the tested build, not the permanent identity.</strong>
                    </div>
                    <div className="version-history">
                      {activeContractorProfile.versions.map(
                        ([version, status, score, tested, change]) => (
                          <div className="version-row" key={version}>
                            <strong>{version}</strong>
                            <span>{status}</span>
                            <em>{score} SCORE</em>
                            <small>{tested}</small>
                            <p>{change}</p>
                          </div>
                        ),
                      )}
                    </div>
                  </section>
                  <section>
                    <div className="profile-section-heading">
                      <span>03 / ROUTE A SANDBOX</span>
                      <strong>Current build test record.</strong>
                    </div>
                    <div className="profile-test-list">
                      {activeContractorProfile.tests.map(([name, score, result]) => (
                        <div key={name}>
                          <span>{name}</span><i /><strong>{score}</strong><em>{result}</em>
                        </div>
                      ))}
                    </div>
                    <button
                      className="outline-button full-button"
                      onClick={() => showToast("SANDBOX BATTLE REPORT OPENED")}
                      type="button"
                    >
                      VIEW FULL BATTLE REPORT →
                    </button>
                  </section>
                </div>
              )}

              {contractorProfileTab === "RECORD" && (
                <div className="profile-record-layout">
                  <section className="record-hero-grid">
                    <div><span>VERIFIED JOBS</span><strong>{activeContractorProfile.completed}</strong><small>Immutable acceptance records</small></div>
                    <div><span>SUCCESS RATE</span><strong>{activeContractorProfile.success}</strong><small>Accepted without dispute</small></div>
                    <div><span>MEDIAN LATENCY</span><strong>{activeContractorProfile.latency}</strong><small>Last 30 verified runs</small></div>
                    <div><span>LIST PRICE</span><strong>{activeContractorProfile.price}</strong><small>Before model and tool use</small></div>
                  </section>
                  <section className="profile-outcome-table">
                    <div className="profile-section-heading">
                      <span>04 / RECENT VERIFIED OUTCOMES</span>
                      <strong>Customer data is hidden; acceptance evidence remains visible.</strong>
                    </div>
                    {[
                      ["RUN–7731", "APAC competitor intelligence", "ACCEPTED", "30 JUL", "96"],
                      ["RUN–7648", "Regulatory signal review", "ACCEPTED", "28 JUL", "94"],
                      ["RUN–7512", "Weekly strategy brief", "REVISED 1×", "25 JUL", "91"],
                      ["RUN–7429", "Executive monitoring pack", "ACCEPTED", "22 JUL", "95"],
                    ].map(([id, outcome, status, date, score]) => (
                      <div className="outcome-row" key={id}>
                        <span>{id}</span><strong>{outcome}</strong><em>{status}</em><small>{date}</small><b>{score}</b>
                      </div>
                    ))}
                  </section>
                </div>
              )}

              {contractorProfileTab === "NETWORK" && (
                <div className="profile-network-layout">
                  <section>
                    <div className="profile-section-heading">
                      <span>05 / VERIFIED RELATIONSHIPS</span>
                      <strong>Repeated delivery history informs routing, never overrides hard constraints.</strong>
                    </div>
                    <div className="relation-origin">
                      <span>DISCOVERY SIGNAL</span>
                      <strong>{activeContractorProfile.relation}</strong>
                      <p>
                        Referral commission is disclosed before contract and paid only from
                        Continental&apos;s platform fee after accepted delivery.
                      </p>
                    </div>
                    <div className="collaboration-list">
                      {activeContractorProfile.collaborations.map(([name, runs, result]) => (
                        <div key={name}>
                          <span>◆</span><strong>{name}</strong><small>{runs}</small><em>{result}</em>
                        </div>
                      ))}
                    </div>
                  </section>
                  <aside className="network-route-card">
                    <span>ROUTING PRINCIPLE</span>
                    <strong>Trust is evidence, not a shortcut.</strong>
                    <p>
                      Relationship data can improve discovery and sequencing. Availability,
                      permissions, interface compatibility, price, and Sandbox status remain
                      mandatory gates.
                    </p>
                    <div><span>PLATFORM FEE CAP</span><strong>5%</strong></div>
                    <div><span>REFERRAL PAID</span><strong>AFTER ACCEPTANCE</strong></div>
                    <div><span>CUSTOMER PRICE</span><strong>DISCLOSED UPFRONT</strong></div>
                  </aside>
                </div>
              )}
            </div>

            <footer className="dialog-footer profile-dialog-footer">
              <button
                className="text-button"
                onClick={() => showToast("AGENT CARD REFERENCE COPIED")}
                type="button"
              >
                COPY AGENT CARD ID
              </button>
              <div>
                <span>
                  {shortlistedContractors.includes(activeContractorProfile.id)
                    ? "THIS VERSION IS ON YOUR WORKFLOW SHORTLIST."
                    : "SHORTLISTING DOES NOT GRANT ROOM ACCESS OR CREATE A CONTRACT."}
                </span>
                <button
                  className={
                    shortlistedContractors.includes(activeContractorProfile.id)
                      ? "outline-button"
                      : "transmit-button"
                  }
                  onClick={() => toggleContractorShortlist(activeContractorProfile.id)}
                  type="button"
                >
                  {shortlistedContractors.includes(activeContractorProfile.id)
                    ? "REMOVE SHORTLIST"
                    : "SHORTLIST VERSION"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {replaceOpen && (
        <div className="modal-backdrop" onMouseDown={() => setReplaceOpen(false)}>
          <section
            aria-labelledby="replace-dialog-title"
            aria-modal="true"
            className="workflow-dialog replace-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="dialog-header">
              <div>
                <span>WORKFLOW CHANGE / {activeWorkflowNode.code}</span>
                <h3 id="replace-dialog-title">Replace contractor</h3>
                <p>{activeWorkflowNode.title} · current version {activeWorkflowNode.contractor}</p>
              </div>
              <button aria-label="Close replacement dialog" onClick={() => setReplaceOpen(false)} type="button">×</button>
            </header>

            <div className="wizard-steps compact">
              <div className={replaceStep === "select" ? "active" : "complete"}><span>01</span><strong>FILTER &amp; SELECT</strong></div>
              <i />
              <div className={replaceStep === "review" ? "active" : ""}><span>02</span><strong>REVIEW CHANGE</strong></div>
            </div>

            {replaceStep === "select" ? (
              <>
                <div className="candidate-filter-bar">
                  <label>
                    <span>SEARCH REGISTRY</span>
                    <input
                      onChange={(event) => setReplacementQuery(event.target.value)}
                      placeholder="NAME, MAKER, REGION…"
                      value={replacementQuery}
                    />
                  </label>
                  <label>
                    <span>OPERATIONAL STATUS</span>
                    <select
                      onChange={(event) => setReplacementAvailability(event.target.value)}
                      value={replacementAvailability}
                    >
                      <option value="ALL">ALL STATES</option>
                      <option value="AVAILABLE">AVAILABLE NOW</option>
                      <option value="LIMITED">LIMITED CAPACITY</option>
                      <option value="MAINTENANCE">MAINTENANCE</option>
                    </select>
                  </label>
                  <div>
                    <span>HARD FILTERS</span>
                    <strong>REGION · INTERFACE · RISK · PERMISSION</strong>
                  </div>
                </div>

                <div className="candidate-dialog-layout">
                  <div className="candidate-list" aria-label="Replacement candidates">
                    <div className="candidate-list-heading">
                      <span>{filteredReplacementPool.length} MATCHES</span>
                      <span>LIVE VERSION STATUS</span>
                    </div>
                    {filteredReplacementPool.length === 0 ? (
                      <div className="empty-candidate-state">NO CONTRACTOR MATCHES THE CURRENT FILTERS.</div>
                    ) : (
                      filteredReplacementPool.map((candidate) => {
                        const selectable = candidateCanRun(candidate);
                        return (
                          <button
                            aria-pressed={replacementId === candidate.id}
                            className={`candidate-row ${replacementId === candidate.id ? "selected" : ""} ${selectable ? "" : "blocked"}`}
                            key={candidate.id}
                            onClick={() => setReplacementId(candidate.id)}
                            type="button"
                          >
                            <div className="candidate-identity">
                              <span>{candidate.maker}</span>
                              <strong>{candidate.name} <small>{candidate.version}</small></strong>
                              <em className={`status-${candidate.status.toLowerCase()}`}>● {candidate.status} · {candidate.statusNote}</em>
                            </div>
                            <div className="candidate-stat"><span>FIT</span><strong>{candidate.fit}</strong></div>
                            <div className="candidate-stat"><span>SCORE</span><strong>{candidate.score}</strong></div>
                            <div className="candidate-stat"><span>PRICE</span><strong>${candidate.price}</strong></div>
                            <i className={candidate.compatibility === "FULL" ? "pass" : "warning-text"}>{candidate.compatibility}</i>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <aside className="candidate-inspector">
                    {replacementCandidate ? (
                      <>
                        <div className="inspector-heading">
                          <span>CANDIDATE INSPECTION</span>
                          <strong>{replacementCandidate.name} {replacementCandidate.version}</strong>
                          <small>{replacementCandidate.rationale}</small>
                        </div>
                        {[
                          ["OPERATIONAL STATE", `${replacementCandidate.status} · ${replacementCandidate.statusNote}`],
                          ["VERSION SCORE", `${replacementCandidate.score} / 100`],
                          ["WORK RECORD", `${replacementCandidate.jobs} jobs · ${replacementCandidate.success} accepted`],
                          ["REGION", replacementCandidate.region],
                          ["MEDIAN DELIVERY", replacementCandidate.eta],
                          ["ACCESS REQUEST", replacementCandidate.permissions],
                          ["INTERFACE", replacementCandidate.interfaces],
                          ["RISK TIER", replacementCandidate.risk],
                        ].map(([label, value]) => (
                          <div className="inspection-row" key={label}><span>{label}</span><strong>{value}</strong></div>
                        ))}
                        <div className={`compatibility-verdict ${candidateCanRun(replacementCandidate) ? "pass" : "fail"}`}>
                          <span>{candidateCanRun(replacementCandidate) ? "✓ ELIGIBLE FOR THIS NODE" : "! CANNOT BE SELECTED"}</span>
                          <p>
                            {candidateCanRun(replacementCandidate)
                              ? "All hard constraints pass. A replacement still invalidates the quote and previous Dry Run."
                              : "This version is unavailable or violates the Room’s current interface and permission policy."}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="empty-candidate-state">SELECT A CONTRACTOR TO INSPECT ITS LIVE VERSION.</div>
                    )}
                  </aside>
                </div>

                <footer className="dialog-footer">
                  <button className="text-button" onClick={() => setReplaceOpen(false)} type="button">CANCEL</button>
                  <div><span>NO CHANGE IS APPLIED UNTIL FINAL CONFIRMATION</span><button className="transmit-button" disabled={!replacementCandidate || !candidateCanRun(replacementCandidate)} onClick={() => setReplaceStep("review")} type="button">REVIEW REPLACEMENT →</button></div>
                </footer>
              </>
            ) : (
              replacementCandidate && (
                <>
                  <div className="replacement-review">
                    <div className="change-column current">
                      <span>CURRENT / WILL BE RELEASED</span>
                      <h4>{activeWorkflowNode.contractor}</h4>
                      <p>{activeWorkflowNode.owner}</p>
                      <div><span>VERSION SCORE</span><strong>{activeWorkflowNode.score}</strong></div>
                      <div><span>PRICE / RUN</span><strong>${activeWorkflowNode.priceValue}</strong></div>
                      <div><span>RISK</span><strong>{activeWorkflowNode.risk}</strong></div>
                      <div><span>ACCESS</span><strong>CURRENT NODE MANIFEST</strong></div>
                    </div>
                    <div className="change-arrow"><span>→</span><small>ATOMIC SWAP</small></div>
                    <div className="change-column proposed">
                      <span>PROPOSED / VERSION LOCKED</span>
                      <h4>{replacementCandidate.name} {replacementCandidate.version}</h4>
                      <p>{replacementCandidate.maker}</p>
                      <div><span>VERSION SCORE</span><strong>{replacementCandidate.score}</strong></div>
                      <div><span>PRICE / RUN</span><strong>${replacementCandidate.price}</strong></div>
                      <div><span>RISK</span><strong>{replacementCandidate.risk}</strong></div>
                      <div><span>ACCESS</span><strong>{replacementCandidate.permissions}</strong></div>
                    </div>
                  </div>
                  <div className="review-effects">
                    <div><span>PRICE DELTA</span><strong className={replacementCandidate.price > activeWorkflowNode.priceValue ? "warning-text" : "green-text"}>{replacementCandidate.price - activeWorkflowNode.priceValue >= 0 ? "+" : ""}${replacementCandidate.price - activeWorkflowNode.priceValue} / RUN</strong></div>
                    <div><span>QUOTE</span><strong className="warning-text">INVALIDATED</strong></div>
                    <div><span>DOWNSTREAM CONTRACT</span><strong className="green-text">INTERFACE PASS</strong></div>
                    <div><span>DRY RUN</span><strong className="warning-text">REQUIRED AGAIN</strong></div>
                  </div>
                  <div className="dialog-warning">
                    Replacing the contractor changes only this executable version. The previous contractor loses Room access immediately; historical records remain in the audit ledger.
                  </div>
                  <footer className="dialog-footer">
                    <button className="text-button" onClick={() => setReplaceStep("select")} type="button">← BACK TO CANDIDATES</button>
                    <div><span>THIS ACTION IS RECORDED IN THE WORKFLOW LEDGER</span><button className="transmit-button" onClick={confirmReplacement} type="button">CONFIRM &amp; REPLACE</button></div>
                  </footer>
                </>
              )
            )}
          </section>
        </div>
      )}

      {insertOpen && (
        <div className="modal-backdrop" onMouseDown={() => setInsertOpen(false)}>
          <section
            aria-labelledby="insert-dialog-title"
            aria-modal="true"
            className="workflow-dialog insert-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="dialog-header">
              <div>
                <span>WORKFLOW ARCHITECT / WF–8842</span>
                <h3 id="insert-dialog-title">Insert a new Agent node</h3>
                <p>Add a missing business step without exposing the rest of the Room.</p>
              </div>
              <button aria-label="Close insert Agent dialog" onClick={() => setInsertOpen(false)} type="button">×</button>
            </header>

            <div className="wizard-steps">
              {["DEFINE", "PLACE", "SELECT", "BOUNDARIES"].map((label, index) => (
                <div className={insertStep === index ? "active" : insertStep > index ? "complete" : ""} key={label}>
                  <span>{insertStep > index ? "✓" : `0${index + 1}`}</span><strong>{label}</strong>
                </div>
              ))}
            </div>

            <div className="insert-dialog-body">
              {insertStep === 0 && (
                <div className="insert-define">
                  <div className="dialog-section-heading">
                    <span>01 / DEFINE THE MISSING CAPABILITY</span>
                    <h4>What new work must happen?</h4>
                    <p>Choose a capability family, then state the concrete outcome. The network will only show versioned Agents that can satisfy the surrounding data contract.</p>
                  </div>
                  <div className="capability-choice-grid">
                    {insertTemplates.map((template) => (
                      <button className={insertTemplateId === template.id ? "selected" : ""} key={template.id} onClick={() => selectInsertTemplate(template)} type="button">
                        <span>{template.label}</span>
                        <strong>{template.title}</strong>
                        <p>{template.description}</p>
                      </button>
                    ))}
                  </div>
                  <label className="dialog-field">
                    <span>DESIRED BUSINESS OUTCOME</span>
                    <textarea className="dialog-textarea" onChange={(event) => setInsertOutcome(event.target.value)} value={insertOutcome} />
                  </label>
                </div>
              )}

              {insertStep === 1 && (
                <div className="insert-place">
                  <div className="dialog-section-heading">
                    <span>02 / CHOOSE THE INSERTION POINT</span>
                    <h4>Where does this work belong?</h4>
                    <p>The selected edge determines what the new Agent can read and which downstream interface it must satisfy.</p>
                  </div>
                  <div className="placement-list">
                    {workflowNodes.map((node, index) => (
                      <button className={insertAfter === index ? "selected" : ""} key={node.code} onClick={() => setInsertAfter(index)} type="button">
                        <span>AFTER {node.code}</span>
                        <strong>{node.title}</strong>
                        <small>Receives: {node.output}</small>
                        <em>Before: {workflowNodes[index + 1]?.title ?? "FINAL DELIVERY"}</em>
                      </button>
                    ))}
                  </div>
                  <div className="edge-contract">
                    <div><span>UPSTREAM OUTPUT</span><strong>{workflowNodes[insertAfter].output}</strong></div>
                    <span className="edge-arrow">→</span>
                    <div className="new-edge-node"><span>NEW NODE</span><strong>{selectedInsertTemplate.title}</strong></div>
                    <span className="edge-arrow">→</span>
                    <div><span>DOWNSTREAM EXPECTATION</span><strong>{workflowNodes[insertAfter + 1]?.input ?? "FINAL DELIVERABLE"}</strong></div>
                  </div>
                </div>
              )}

              {insertStep === 2 && (
                <div className="insert-select">
                  <div className="dialog-section-heading">
                    <span>03 / SELECT AN EXECUTABLE VERSION</span>
                    <h4>Choose who performs this node.</h4>
                    <p>Availability belongs to the live Agent version. Identity reputation is shown separately from version fit and operational state.</p>
                  </div>
                  <div className="insert-candidate-grid">
                    {insertCandidatePool.map((candidate) => {
                      const selectable = candidateCanRun(candidate);
                      return (
                        <button
                          className={`${insertCandidateId === candidate.id ? "selected" : ""} ${selectable ? "" : "blocked"}`}
                          key={candidate.id}
                          onClick={() => setInsertCandidateId(candidate.id)}
                          type="button"
                        >
                          <div><span>{candidate.maker}</span><strong>{candidate.name} <small>{candidate.version}</small></strong></div>
                          <em className={`status-${candidate.status.toLowerCase()}`}>● {candidate.status}<small>{candidate.statusNote}</small></em>
                          <p>{candidate.rationale}</p>
                          <div className="insert-candidate-metrics">
                            <span>FIT <strong>{candidate.fit}</strong></span>
                            <span>SCORE <strong>{candidate.score}</strong></span>
                            <span>PRICE <strong>${candidate.price}</strong></span>
                            <span>ETA <strong>{candidate.eta}</strong></span>
                          </div>
                          <b className={candidate.compatibility === "FULL" ? "green-text" : "warning-text"}>{candidate.compatibility}</b>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {insertStep === 3 && (
                <div className="insert-boundaries">
                  <div className="dialog-section-heading">
                    <span>04 / SET BOUNDARIES &amp; REVIEW</span>
                    <h4>Give the node only what it needs.</h4>
                    <p>The Agent is mounted into the Room with an isolated context capsule, explicit data scopes and a hard per-run ceiling.</p>
                  </div>
                  <div className="boundary-config-grid">
                    <section>
                      <h5>DATA SCOPE</h5>
                      {[
                        ["VERIFIED NODE OUTPUT", "The selected upstream node’s accepted output."],
                        ["BRAND KIT", "Approved logos, colors and typography only."],
                        ["ORGANIZATION CONTEXT", "Strategy capsule; remains read-only."],
                        ["CUSTOMER RECORDS", "Sensitive source; not required for this step."],
                      ].map(([scope, note]) => (
                        <label className={`scope-toggle ${scope === "CUSTOMER RECORDS" ? "sensitive" : ""}`} key={scope}>
                          <input checked={insertScopes.includes(scope)} onChange={() => toggleInsertScope(scope)} type="checkbox" />
                          <span>{scope}<small>{note}</small></span>
                        </label>
                      ))}
                      <label className="approval-toggle">
                        <input checked={insertApproval} onChange={(event) => setInsertApproval(event.target.checked)} type="checkbox" />
                        <span>HUMAN APPROVAL BEFORE DOWNSTREAM HANDOFF<small>Recommended for visual, compliance and external-facing work.</small></span>
                      </label>
                    </section>
                    <section className="insert-review-card">
                      <h5>NODE MANIFEST</h5>
                      {[
                        ["CAPABILITY", selectedInsertTemplate.title],
                        ["POSITION", `AFTER ${workflowNodes[insertAfter].code} / ${workflowNodes[insertAfter].title}`],
                        ["CONTRACTOR", `${selectedInsertCandidate.name} ${selectedInsertCandidate.version}`],
                        ["OPERATIONAL STATE", selectedInsertCandidate.status],
                        ["ACCESS", insertScopes.join(" · ") || "NO DATA SELECTED"],
                        ["OUTPUT", selectedInsertTemplate.output],
                        ["RISK TIER", selectedInsertCandidate.risk],
                      ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
                      <label className="budget-field">
                        <span>HARD CEILING / RUN</span>
                        <div><b>$</b><input inputMode="numeric" onChange={(event) => setInsertBudget(event.target.value)} value={insertBudget} /></div>
                      </label>
                      <div className="manifest-verdict">
                        <span>✓ INTERFACE CONTRACT PASSES</span>
                        <small>Adding this node invalidates the current quote and requires a new end-to-end Dry Run.</small>
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </div>

            <footer className="dialog-footer">
              <button className="text-button" onClick={() => insertStep === 0 ? setInsertOpen(false) : setInsertStep((insertStep - 1) as InsertStep)} type="button">{insertStep === 0 ? "CANCEL" : "← BACK"}</button>
              <div>
                <span>{insertStep === 3 ? "THE NODE REMAINS DRAFT UNTIL A NEW DRY RUN PASSES" : `STEP 0${insertStep + 1} OF 04`}</span>
                {insertStep < 3 ? (
                  <button
                    className="transmit-button"
                    disabled={(insertStep === 0 && !insertOutcome.trim()) || (insertStep === 2 && !candidateCanRun(selectedInsertCandidate))}
                    onClick={() => setInsertStep((insertStep + 1) as InsertStep)}
                    type="button"
                  >
                    CONTINUE →
                  </button>
                ) : (
                  <button className="transmit-button" disabled={!insertScopes.length || !insertBudget.trim()} onClick={confirmInsertAgent} type="button">INSERT &amp; REVALIDATE</button>
                )}
              </div>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
