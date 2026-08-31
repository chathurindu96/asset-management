import type { Device, ExtractedReceipt, MaintenanceLog, RuleSet, VaultDocument } from "../lib/types";
import { genSeries } from "../lib/healthEngine";

const d = (n: number) => {
  const t = new Date();
  t.setHours(12, 0, 0, 0);
  t.setDate(t.getDate() + n);
  return t.toISOString();
};

export const seedDevices: Device[] = [
  /* ---------------- Batteries & Portable Tech ---------------- */
  {
    id: "dev-mbp", name: "MacBook Pro 16″", brand: "Apple", category: "portable", serial: "C02XK1JGMD6T",
    location: "Home Office", status: "active", purchaseISO: d(-420), cost: 3499, currency: "USD",
    warrantyMonths: 12, extendedMonths: 24, expectedLifeYears: 6, issues: 0,
    specs: { Chip: "M3 Max", RAM: "36 GB", Storage: "1 TB", Display: "Liquid Retina XDR" },
    meta: { soh: 94, cycles: 214, tempC: 38.2 },
    schedules: [
      { id: "mbp-batt", label: "Battery diagnostic", kind: "time", everyDays: 180, lastDoneISO: d(-120) },
      { id: "mbp-os", label: "macOS integrity check", kind: "time", everyDays: 90, lastDoneISO: d(-30) },
    ],
    telemetry: [
      { id: "soh", label: "Battery SOH", unit: "%", points: genSeries(11, 24, 97.4, 93.9, 0.35), good: "high", decimals: 1 },
      { id: "temp", label: "Charge temp", unit: "°C", points: genSeries(12, 24, 33, 39, 1.6), good: "low", decimals: 1 },
      { id: "cycles", label: "Charge cycles", unit: "", points: genSeries(13, 24, 150, 214, 7), good: "low", decimals: 0 },
    ],
  },
  {
    id: "dev-ip15", name: "iPhone 15 Pro", brand: "Apple", category: "portable", serial: "F2LXV0H2PL1J",
    location: "Everyday carry", status: "active", purchaseISO: d(-697), cost: 1199, currency: "USD",
    warrantyMonths: 12, extendedMonths: 12, expectedLifeYears: 5, issues: 1,
    specs: { Storage: "256 GB", SoC: "A17 Pro", Modem: "Sub-6 + mmWave" },
    meta: { soh: 88, cycles: 412, tempC: 35.4 },
    schedules: [{ id: "ip-batt", label: "Battery health check", kind: "time", everyDays: 365, lastDoneISO: d(-200) }],
    telemetry: [
      { id: "soh", label: "Battery SOH", unit: "%", points: genSeries(21, 24, 99.5, 88, 0.5), good: "high", decimals: 1 },
      { id: "cycles", label: "Charge cycles", unit: "", points: genSeries(22, 24, 300, 412, 9), good: "low", decimals: 0 },
    ],
  },
  {
    id: "dev-ebike", name: "eBike PowerPack 625", brand: "Bosch", category: "portable", serial: "BPK-625-88213-DE",
    location: "Garage", status: "active", purchaseISO: d(-300), cost: 899, currency: "EUR",
    warrantyMonths: 24, extendedMonths: 0, expectedLifeYears: 5, issues: 0,
    specs: { Capacity: "625 Wh", Voltage: "36 V", Cells: "21700 Li-ion" },
    meta: { soh: 96, cycles: 118 },
    schedules: [{ id: "eb-cell", label: "Cell balance check", kind: "time", everyDays: 180, lastDoneISO: d(-140) }],
    telemetry: [
      { id: "soh", label: "Pack SOH", unit: "%", points: genSeries(31, 24, 100, 96, 0.3), good: "high", decimals: 1 },
      { id: "delta", label: "Cell delta", unit: "mV", points: genSeries(32, 24, 8, 14, 1.2), good: "low", decimals: 0 },
    ],
  },
  {
    id: "dev-ev", name: "Model 3 Long Range", brand: "Tesla", category: "portable", serial: "5YJ3E1EA7KF317X2",
    location: "Driveway", status: "active", purchaseISO: d(-820), cost: 48990, currency: "USD",
    warrantyMonths: 48, extendedMonths: 0, expectedLifeYears: 12, issues: 0,
    specs: { Range: "560 km", Odometer: "41,200 km", Pack: "79 kWh NMC" },
    meta: { soh: 91, cycles: 380 },
    schedules: [
      { id: "ev-brake", label: "Brake fluid flush", kind: "time", everyDays: 730, lastDoneISO: d(-720) },
      { id: "ev-cabin", label: "Cabin air filter", kind: "time", everyDays: 365, lastDoneISO: d(-355) },
    ],
    telemetry: [
      { id: "soh", label: "Pack SOH", unit: "%", points: genSeries(41, 24, 99, 91, 0.4), good: "high", decimals: 1 },
      { id: "eff", label: "Consumption", unit: "kWh/100km", points: genSeries(42, 24, 15.2, 16.3, 0.5), good: "low", decimals: 1 },
    ],
  },

  /* ---------------- HVAC & Major Appliances ---------------- */
  {
    id: "dev-ac", name: "Split AC 1.5T Inverter", brand: "Daikin", category: "hvac", serial: "FTKM50UV16-8842",
    location: "Living Room", status: "active", purchaseISO: d(-950), cost: 1240, currency: "USD",
    warrantyMonths: 12, extendedMonths: 24, expectedLifeYears: 10, issues: 0,
    specs: { Model: "FTKM50U", Refrigerant: "R-32", Rating: "5★ inverter" },
    meta: { runtimeHours: 3420 },
    schedules: [
      { id: "ac-filter", label: "Clean filters", kind: "time", everyDays: 90, lastDoneISO: d(-78) },
      { id: "ac-season", label: "Seasonal deep service", kind: "time", everyDays: 180, lastDoneISO: d(-170) },
    ],
    telemetry: [
      { id: "kw", label: "Draw", unit: "kW", points: genSeries(51, 24, 0.9, 1.35, 0.09), good: "low", decimals: 2 },
      { id: "comp", label: "Compressor cycles/day", unit: "", points: genSeries(52, 24, 210, 262, 8), good: "low", decimals: 0 },
      { id: "delta", label: "ΔT supply", unit: "°C", points: genSeries(53, 24, 11.5, 9.2, 0.6), good: "high", decimals: 1 },
    ],
  },
  {
    id: "dev-fridge", name: "Refrigerator 420L", brand: "LG", category: "hvac", serial: "GLB482-2211-QN7",
    location: "Kitchen", status: "service", purchaseISO: d(-742), cost: 980, currency: "USD",
    warrantyMonths: 24, extendedMonths: 0, expectedLifeYears: 12, issues: 1,
    specs: { Model: "GL-B482APQZ", Compressor: "Smart inverter", Class: "A++" },
    meta: { runtimeHours: 17760 },
    schedules: [
      { id: "fr-coil", label: "Condenser coil cleaning", kind: "time", everyDays: 365, lastDoneISO: d(-300) },
      { id: "fr-gasket", label: "Door gasket inspection", kind: "time", everyDays: 180, lastDoneISO: d(-185) },
    ],
    telemetry: [
      { id: "w", label: "Draw", unit: "kW", points: genSeries(61, 24, 0.12, 0.19, 0.015), good: "low", decimals: 2 },
      { id: "ft", label: "Freezer temp", unit: "°C", points: genSeries(62, 24, -18.6, -17.1, 0.5), good: "low", decimals: 1 },
    ],
  },
  {
    id: "dev-washer", name: "Washing Machine 9kg", brand: "Bosch", category: "hvac", serial: "WGG254A1IN-5519",
    location: "Utility Room", status: "active", purchaseISO: d(-500), cost: 820, currency: "USD",
    warrantyMonths: 24, extendedMonths: 0, expectedLifeYears: 12, issues: 0,
    specs: { Model: "WGG254A1IN", Drive: "EcoSilence", Speed: "1400 rpm" },
    meta: { runtimeHours: 1140 },
    schedules: [{ id: "wm-desc", label: "Drum descale & clean", kind: "time", everyDays: 180, lastDoneISO: d(-170) }],
    telemetry: [
      { id: "vib", label: "Spin vibration", unit: "mm/s", points: genSeries(71, 24, 3.2, 4.1, 0.25), good: "low", decimals: 1 },
      { id: "cyc", label: "Cycles", unit: "", points: genSeries(72, 24, 610, 690, 5), good: "low", decimals: 0 },
    ],
  },

  /* ---------------- IT Infra & Smart Home ---------------- */
  {
    id: "dev-udm", name: "UniFi Dream Machine Pro", brand: "Ubiquiti", category: "it", serial: "UDM-PRO-F092CE",
    location: "Server Rack", status: "active", purchaseISO: d(-600), cost: 379, currency: "USD",
    warrantyMonths: 24, extendedMonths: 0, expectedLifeYears: 6, issues: 0,
    specs: { Firmware: "4.1.2", WAN: "2.5 GbE", Storage: "1 TB HDD" },
    meta: { uptimePct: 99.72, connectivity: 98, kwhMonth: 14.2 },
    schedules: [{ id: "udm-fw", label: "Firmware review & patch", kind: "time", everyDays: 90, lastDoneISO: d(-95) }],
    telemetry: [
      { id: "up", label: "Uptime", unit: "%", points: genSeries(81, 24, 99.9, 99.7, 0.08), good: "high", decimals: 2 },
      { id: "thr", label: "Throughput", unit: "Mbps", points: genSeries(82, 24, 640, 920, 40), good: "high", decimals: 0 },
    ],
  },
  {
    id: "dev-nas", name: "RackStation RS1221+", brand: "Synology", category: "it", serial: "2050PDN123456",
    location: "Server Rack", status: "active", purchaseISO: d(-900), cost: 1099, currency: "USD",
    warrantyMonths: 36, extendedMonths: 0, expectedLifeYears: 7, issues: 0,
    specs: { Bays: "8 × 3.5″", RAM: "32 GB ECC", Array: "RAID-6 · 48 TB" },
    meta: { uptimePct: 99.98, connectivity: 99, kwhMonth: 61 },
    schedules: [
      { id: "nas-smart", label: "SMART extended test", kind: "time", everyDays: 30, lastDoneISO: d(-12) },
      { id: "nas-dust", label: "Dust purge & fan check", kind: "time", everyDays: 180, lastDoneISO: d(-90) },
    ],
    telemetry: [
      { id: "w", label: "Draw", unit: "W", points: genSeries(91, 24, 68, 74, 2), good: "low", decimals: 0 },
      { id: "io", label: "Array IOPS", unit: "k", points: genSeries(92, 24, 31, 44, 3), good: "high", decimals: 0 },
    ],
  },
  {
    id: "dev-shelly", name: "Shelly Switch Array · 14ch", brand: "Allterco", category: "it", serial: "SHLY-AR14-77B2E1",
    location: "Distribution Board", status: "active", purchaseISO: d(-260), cost: 322, currency: "EUR",
    warrantyMonths: 24, extendedMonths: 0, expectedLifeYears: 8, issues: 1,
    specs: { Protocol: "Wi-Fi + MQTT", Channels: "14 × 16 A", Metering: "per-channel kWh" },
    meta: { uptimePct: 99.1, connectivity: 92, kwhMonth: 8.4 },
    schedules: [{ id: "sh-mesh", label: "Node mesh audit", kind: "time", everyDays: 60, lastDoneISO: d(-52) }],
    telemetry: [
      { id: "rssi", label: "Worst-node RSSI", unit: "dBm", points: genSeries(101, 24, -70, -84, 2), good: "high", decimals: 0 },
      { id: "up", label: "Uptime", unit: "%", points: genSeries(102, 24, 99.6, 99.05, 0.12), good: "high", decimals: 2 },
    ],
  },

  /* ---------------- Industrial & Heavy Electricals ---------------- */
  {
    id: "dev-gen", name: "Diesel Generator 15 kVA", brand: "Kirloskar", category: "industrial", serial: "KG-15KVA-24-0871",
    location: "Plant Yard", status: "active", purchaseISO: d(-700), cost: 6800, currency: "USD",
    warrantyMonths: 24, extendedMonths: 0, expectedLifeYears: 15, issues: 1,
    specs: { Rating: "15 kVA / 12 kW", Fuel: "Diesel", Alternator: "Brushless AVR" },
    meta: { runtimeHours: 1240, vibration: 2.8, powerFactor: 0.93, tempC: 81 },
    schedules: [
      { id: "gen-oil", label: "Oil & filter change", kind: "runtime", everyHours: 250, lastDoneHours: 1210 },
      { id: "gen-volt", label: "Voltage calibration", kind: "runtime", everyHours: 500, lastDoneHours: 1000 },
      { id: "gen-cool", label: "Coolant replace", kind: "runtime", everyHours: 1000, lastDoneHours: 500 },
    ],
    telemetry: [
      { id: "vib", label: "Vibration", unit: "mm/s", points: genSeries(111, 24, 2.2, 2.8, 0.18), good: "low", decimals: 2 },
      { id: "load", label: "Load", unit: "kW", points: genSeries(112, 24, 6.4, 11.2, 0.7), good: "low", decimals: 1 },
      { id: "exh", label: "Exhaust temp", unit: "°C", points: genSeries(113, 24, 418, 462, 6), good: "low", decimals: 0 },
    ],
  },
  {
    id: "dev-motor", name: "3-Phase Induction Motor 7.5kW", brand: "ABB", category: "industrial", serial: "M3BP132SMB-44120",
    location: "Compressor Hall", status: "service", purchaseISO: d(-1100), cost: 2150, currency: "USD",
    warrantyMonths: 18, extendedMonths: 0, expectedLifeYears: 15, issues: 2,
    specs: { Frame: "132SMB", Poles: "4 · 1500 rpm", Class: "IE3 · IP55" },
    meta: { runtimeHours: 8200, vibration: 4.6, powerFactor: 0.91, tempC: 71 },
    schedules: [
      { id: "mo-grease", label: "Bearing re-grease", kind: "runtime", everyHours: 2000, lastDoneHours: 6050 },
      { id: "mo-align", label: "Shaft alignment check", kind: "time", everyDays: 365, lastDoneISO: d(-380) },
    ],
    telemetry: [
      { id: "vib", label: "DE bearing vibration", unit: "mm/s", points: genSeries(121, 24, 3.4, 4.6, 0.2), good: "low", decimals: 2 },
      { id: "wind", label: "Winding temp", unit: "°C", points: genSeries(122, 24, 58, 71, 1.4), good: "low", decimals: 0 },
      { id: "cur", label: "Line current", unit: "A", points: genSeries(123, 24, 11.8, 13.1, 0.3), good: "low", decimals: 1 },
    ],
  },
  {
    id: "dev-xfmr", name: "Isolation Transformer 25 kVA", brand: "Schneider", category: "industrial", serial: "TRF-ISO25-2408",
    location: "Substation B", status: "active", purchaseISO: d(-400), cost: 1890, currency: "USD",
    warrantyMonths: 24, extendedMonths: 0, expectedLifeYears: 25, issues: 0,
    specs: { Rating: "25 kVA", Vector: "Dyn11", Cooling: "AN dry-type" },
    meta: { tempC: 61, powerFactor: 0.96 },
    schedules: [{ id: "xf-ir", label: "Insulation resistance test", kind: "time", everyDays: 365, lastDoneISO: d(-40) }],
    telemetry: [
      { id: "ir", label: "IR @1kV", unit: "MΩ", points: genSeries(131, 24, 620, 505, 12), good: "high", decimals: 0 },
      { id: "oil", label: "Core temp", unit: "°C", points: genSeries(132, 24, 55, 61, 1), good: "low", decimals: 0 },
    ],
  },
];

/* --------------------------- service ledger ------------------------ */

export const seedLogs: MaintenanceLog[] = [
  { id: "log-01", deviceId: "dev-mbp", dateISO: d(-120), provider: "Apple Genius Bar", action: "Battery diagnostic — PASS, 96% SOH", cost: 0 },
  { id: "log-02", deviceId: "dev-mbp", dateISO: d(-30), provider: "Self", action: "macOS 15.3 update + disk verify", cost: 0 },
  { id: "log-03", deviceId: "dev-ip15", dateISO: d(-200), provider: "Apple Store", action: "Battery health check — 90% SOH", cost: 0 },
  { id: "log-04", deviceId: "dev-ip15", dateISO: d(-95), provider: "uBreakiFix", action: "Charging port cleaning — intermittent fault resolved", parts: "Port gasket", cost: 49, warrantyOnPartsMonths: 6 },
  { id: "log-05", deviceId: "dev-ebike", dateISO: d(-140), provider: "Bosch eBike Dealer", action: "Cell balance check + firmware 2.4", cost: 0 },
  { id: "log-06", deviceId: "dev-ev", dateISO: d(-720), provider: "Tesla Service", action: "Brake fluid flush", cost: 180 },
  { id: "log-07", deviceId: "dev-ev", dateISO: d(-355), provider: "Tesla Service", action: "Cabin filter replacement", parts: "HEPA cabin filter", cost: 60, warrantyOnPartsMonths: 12 },
  { id: "log-08", deviceId: "dev-ac", dateISO: d(-78), provider: "Daikin ProService", action: "Filter deep clean + drain pan flush", cost: 35 },
  { id: "log-09", deviceId: "dev-ac", dateISO: d(-170), provider: "Daikin ProService", action: "Seasonal service — coil chem-wash, refrigerant 98%", parts: "R-32 top-up", cost: 90, warrantyOnPartsMonths: 6 },
  { id: "log-10", deviceId: "dev-fridge", dateISO: d(-300), provider: "LG SmartCare", action: "Condenser coil cleaning", cost: 45 },
  { id: "log-11", deviceId: "dev-fridge", dateISO: d(-60), provider: "LG SmartCare", action: "Gasket repair — cold air leak fault mitigated", parts: "Door gasket strip", cost: 75, warrantyOnPartsMonths: 12 },
  { id: "log-12", deviceId: "dev-washer", dateISO: d(-170), provider: "Bosch Service", action: "Drum descale & seal inspection", parts: "Descaler kit", cost: 40 },
  { id: "log-13", deviceId: "dev-udm", dateISO: d(-95), provider: "Self", action: "Firmware rollout 4.0.9 → 4.1.2", cost: 0 },
  { id: "log-14", deviceId: "dev-nas", dateISO: d(-12), provider: "Self", action: "SMART extended test — all drives PASS", cost: 0 },
  { id: "log-15", deviceId: "dev-nas", dateISO: d(-90), provider: "Self", action: "Dust purge, fan bearings lubricated", cost: 0 },
  { id: "log-16", deviceId: "dev-shelly", dateISO: d(-52), provider: "Self", action: "Mesh audit — node #9 RSSI −84 dBm flagged", cost: 0, note: "Relocation planned" },
  { id: "log-17", deviceId: "dev-gen", dateISO: d(-30), provider: "Kirloskar AMC", action: "Oil & filter change @1210 h", parts: "15W-40 6L + filter", cost: 145, warrantyOnPartsMonths: 6 },
  { id: "log-18", deviceId: "dev-gen", dateISO: d(-180), provider: "Kirloskar AMC", action: "Coolant flush @500 h", cost: 120 },
  { id: "log-19", deviceId: "dev-gen", dateISO: d(-400), provider: "Kirloskar AMC", action: "Voltage calibration @1000 h", cost: 95 },
  { id: "log-20", deviceId: "dev-motor", dateISO: d(-150), provider: "Facilities Team", action: "Vibration survey — 4.6 mm/s DE bearing, fault trend", cost: 0, note: "Re-grease pulled forward" },
  { id: "log-21", deviceId: "dev-motor", dateISO: d(-380), provider: "Facilities Team", action: "Shaft alignment + shimming", cost: 260 },
  { id: "log-22", deviceId: "dev-xfmr", dateISO: d(-40), provider: "Certified Electrician", action: "IR test 500 MΩ @1kV — PASS", cost: 120 },
];

/* ------------------------------ vault ------------------------------ */

export const seedDocs: VaultDocument[] = [
  { id: "doc-01", deviceId: "dev-mbp", type: "invoice", title: "Apple Store invoice #88121", sizeKB: 412, addedISO: d(-420), encrypted: true, source: "ocr" },
  { id: "doc-02", deviceId: "dev-mbp", type: "warranty-card", title: "AppleCare+ agreement APP-77X21", sizeKB: 268, addedISO: d(-419), encrypted: true, source: "ocr" },
  { id: "doc-03", deviceId: "dev-ip15", type: "invoice", title: "Carrier receipt #4410-2291", sizeKB: 388, addedISO: d(-697), encrypted: true, source: "ocr" },
  { id: "doc-04", deviceId: "dev-ebike", type: "manual", title: "PowerPack 625 user manual", sizeKB: 4820, addedISO: d(-300), encrypted: true, source: "manual" },
  { id: "doc-05", deviceId: "dev-ev", type: "insurance", title: "Comprehensive EV policy #EV-88213", sizeKB: 1240, addedISO: d(-800), encrypted: true, source: "manual" },
  { id: "doc-06", deviceId: "dev-ev", type: "invoice", title: "Tesla delivery invoice #10024511", sizeKB: 356, addedISO: d(-820), encrypted: true, source: "ocr" },
  { id: "doc-07", deviceId: "dev-ac", type: "warranty-card", title: "Daikin warranty card + compressor ext.", sizeKB: 298, addedISO: d(-950), encrypted: true, source: "ocr" },
  { id: "doc-08", deviceId: "dev-ac", type: "service-report", title: "Seasonal service report #DSP-2291", sizeKB: 512, addedISO: d(-170), encrypted: true, source: "manual" },
  { id: "doc-09", deviceId: "dev-ac", type: "manual", title: "FTKM50U installation manual", sizeKB: 6210, addedISO: d(-950), encrypted: true, source: "manual" },
  { id: "doc-10", deviceId: "dev-fridge", type: "invoice", title: "LG invoice #LG-77120", sizeKB: 344, addedISO: d(-742), encrypted: true, source: "ocr" },
  { id: "doc-11", deviceId: "dev-washer", type: "invoice", title: "Bosch invoice #BW-11892", sizeKB: 301, addedISO: d(-500), encrypted: true, source: "ocr" },
  { id: "doc-12", deviceId: "dev-udm", type: "invoice", title: "Ubiquiti order #UI-55213", sizeKB: 220, addedISO: d(-600), encrypted: true, source: "ocr" },
  { id: "doc-13", deviceId: "dev-nas", type: "invoice", title: "Synology invoice #SY-90112", sizeKB: 264, addedISO: d(-900), encrypted: true, source: "ocr" },
  { id: "doc-14", deviceId: "dev-gen", type: "manual", title: "Kirloskar O&M manual 15 kVA", sizeKB: 8840, addedISO: d(-700), encrypted: true, source: "manual" },
  { id: "doc-15", deviceId: "dev-gen", type: "warranty-card", title: "AMC contract #AMC-24-0871", sizeKB: 410, addedISO: d(-695), encrypted: true, source: "ocr" },
  { id: "doc-16", deviceId: "dev-motor", type: "claim-form", title: "Bearing claim draft #CLM-0119", sizeKB: 190, addedISO: d(-40), encrypted: true, source: "manual" },
  { id: "doc-17", deviceId: "dev-motor", type: "service-report", title: "Vibration survey report VIB-118", sizeKB: 720, addedISO: d(-150), encrypted: true, source: "manual" },
  { id: "doc-18", deviceId: "dev-xfmr", type: "invoice", title: "Schneider invoice #SE-30921", sizeKB: 287, addedISO: d(-400), encrypted: true, source: "ocr" },
];

/* ------------------------ notification rules ----------------------- */

export const defaultRules: RuleSet = {
  channels: {
    warranty: ["push", "email", "whatsapp"],
    service: ["push", "calendar"],
    health: ["push", "email"],
  },
  thresholds: [60, 30, 7, 0],
};

/* --------------------------- OCR samples --------------------------- */

export interface OcrSample { id: string; filename: string; sizeKB: number; receipt: ExtractedReceipt }

export const ocrSamples: OcrSample[] = [
  {
    id: "smp-dyson", filename: "croma_invoice_dyson.jpg", sizeKB: 1840,
    receipt: {
      merchant: "Croma Retail · Store #0412", brand: "Dyson", model: "V15 Detect Absolute",
      serial: "K4B-US-PFW1234A", purchaseISO: "", cost: 749, currency: "USD",
      warrantyMonths: 24, extendedMonths: 0, docType: "invoice", categorySuggestion: "hvac",
      confidence: { merchant: 0.98, serial: 0.96, date: 0.99, amount: 0.97, warranty: 0.9 },
    },
  },
  {
    id: "smp-apc", filename: "amazon_apc_ups_invoice.pdf", sizeKB: 262,
    receipt: {
      merchant: "Amazon Business", brand: "APC", model: "Back-UPS 1600VA",
      serial: "3B1927X55112", purchaseISO: "", cost: 212, currency: "USD",
      warrantyMonths: 36, extendedMonths: 12, docType: "invoice", categorySuggestion: "it",
      confidence: { merchant: 0.99, serial: 0.93, date: 0.99, amount: 0.99, warranty: 0.86 },
    },
  },
  {
    id: "smp-crompton", filename: "crompton_warranty_card.jpg", sizeKB: 1210,
    receipt: {
      merchant: "Crompton Authorised Dealer", brand: "Crompton", model: "Arno Neo 1200mm Ceiling Fan",
      serial: "CGL240911876", purchaseISO: "", cost: 38, currency: "USD",
      warrantyMonths: 24, extendedMonths: 0, docType: "warranty-card", categorySuggestion: "hvac",
      confidence: { merchant: 0.94, serial: 0.97, date: 0.92, amount: 0.88, warranty: 0.95 },
    },
  },
];
