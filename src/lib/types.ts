/* ------------------------------------------------------------------ */
/*  ElectroCare — shared domain types                                  */
/* ------------------------------------------------------------------ */

export type CategoryId = "portable" | "hvac" | "it" | "industrial";
export type DeviceStatus = "active" | "service" | "dormant";
export type DocType =
  | "invoice"
  | "warranty-card"
  | "manual"
  | "service-report"
  | "insurance"
  | "claim-form";
export type Channel = "push" | "email" | "whatsapp" | "calendar";
export type Severity = "critical" | "warning" | "info";
export type ViewId = "overview" | "assets" | "vault" | "alerts" | "blueprint";

export interface ScheduleRule {
  id: string;
  label: string;
  kind: "time" | "runtime";
  everyDays?: number;
  everyHours?: number;
  lastDoneISO?: string;
  lastDoneHours?: number;
}

export interface TelemetrySeries {
  id: string;
  label: string;
  unit: string;
  points: number[];
  capacity?: number;
  good: "high" | "low";
  decimals?: number;
}

export interface Device {
  id: string;
  name: string;
  brand: string;
  category: CategoryId;
  serial: string;
  location: string;
  status: DeviceStatus;
  purchaseISO: string;
  cost: number;
  currency: string;
  warrantyMonths: number;
  extendedMonths: number;
  expectedLifeYears: number;
  issues: number;
  specs: Record<string, string | number>;
  meta: {
    soh?: number;
    cycles?: number;
    runtimeHours?: number;
    uptimePct?: number;
    connectivity?: number;
    vibration?: number;
    powerFactor?: number;
    kwhMonth?: number;
    tempC?: number;
  };
  schedules: ScheduleRule[];
  telemetry: TelemetrySeries[];
}

export interface MaintenanceLog {
  id: string;
  deviceId: string;
  dateISO: string;
  provider: string;
  action: string;
  parts?: string;
  cost: number;
  note?: string;
  warrantyOnPartsMonths?: number;
}

export interface VaultDocument {
  id: string;
  deviceId: string | null;
  type: DocType;
  title: string;
  sizeKB: number;
  addedISO: string;
  encrypted: boolean;
  source: "ocr" | "manual";
}

export interface AlertItem {
  id: string;
  severity: Severity;
  kind: "warranty" | "service" | "health";
  title: string;
  deviceName: string;
  deviceId: string;
  detail: string;
  daysLeft: number | null;
  channels: Channel[];
  ts: string;
}

export type EventKind = "warranty" | "service" | "health";

export interface RuleSet {
  channels: Record<EventKind, Channel[]>;
  thresholds: number[]; // days before expiry: 60 / 30 / 7 / 0
}

export interface ExtractedReceipt {
  merchant: string;
  brand: string;
  model: string;
  serial: string;
  purchaseISO: string;
  cost: number;
  currency: string;
  warrantyMonths: number;
  extendedMonths: number;
  docType: DocType;
  categorySuggestion: CategoryId;
  confidence: Record<string, number>;
}

export interface HealthResult {
  score: number;
  grade: "A" | "B" | "C" | "D" | "E";
  trend: -3 | -1 | 0 | 1 | 2;
  parts: { age: number; stress: number; maintenance: number; incidents: number };
}

export interface WarrantyInfo {
  endISO: string;
  totalDays: number;
  remainingDays: number;
  pctElapsed: number;
  tier: "expired" | "critical" | "warning" | "notice" | "ok";
}

export interface ServiceDue {
  rule: ScheduleRule;
  state: "overdue" | "soon" | "ok";
  remainingDays: number | null;
  remainingHours: number | null;
  remainingLabel: string;
}

export const CATEGORIES: {
  id: CategoryId;
  label: string;
  short: string;
  color: string;
}[] = [
  { id: "portable", label: "Batteries & Portable Tech", short: "Portable", color: "#2fe0be" },
  { id: "hvac", label: "HVAC & Major Appliances", short: "HVAC", color: "#6fb3ff" },
  { id: "it", label: "IT Infra & Smart Home", short: "IT / Smart", color: "#a8e05f" },
  { id: "industrial", label: "Industrial & Heavy Electricals", short: "Industrial", color: "#ffb224" },
];

export const CAT: Record<CategoryId, { label: string; short: string; color: string }> =
  Object.fromEntries(CATEGORIES.map((c) => [c.id, { label: c.label, short: c.short, color: c.color }])) as Record<
    CategoryId,
    { label: string; short: string; color: string }
  >;

export const DOC_TYPES: { id: DocType; label: string }[] = [
  { id: "invoice", label: "Invoice / Receipt" },
  { id: "warranty-card", label: "Warranty Card" },
  { id: "manual", label: "User Manual" },
  { id: "service-report", label: "Service Report" },
  { id: "insurance", label: "Insurance Policy" },
  { id: "claim-form", label: "Claim Form" },
];

export const DOC_LABEL: Record<DocType, string> = Object.fromEntries(
  DOC_TYPES.map((d) => [d.id, d.label]),
) as Record<DocType, string>;

export const CHANNELS: Channel[] = ["push", "email", "whatsapp", "calendar"];
