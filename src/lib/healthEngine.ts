/* ================================================================== */
/*  ElectroCare — Asset Lifecycle & Health Scoring Engine             */
/*  Pure TypeScript service module. No framework dependencies.        */
/*  Mirrors `apps/core/src/lifecycle/healthEngine.ts` in the monorepo */
/*  blueprint — this exact file is what the server scheduler runs     */
/*  nightly to hydrate the Redis notification ZSETs.                  */
/* ================================================================== */

import type {
  AlertItem,
  Device,
  EventKind,
  HealthResult,
  MaintenanceLog,
  RuleSet,
  ServiceDue,
  WarrantyInfo,
} from "./types";

export const DAY_MS = 86_400_000;

/* ----------------------------- utils ------------------------------ */

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

export const daysUntil = (iso: string, now = new Date()) =>
  Math.round((new Date(iso).getTime() - now.getTime()) / DAY_MS);

export const addDaysISO = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

export const addMonthsISO = (iso: string, months: number) => {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
};

export const ageYears = (purchaseISO: string, now = new Date()) =>
  (now.getTime() - new Date(purchaseISO).getTime()) / (DAY_MS * 365.25);

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export const fmtMoney = (v: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);

export const fmtCompact = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`;

export const fmtNum = (v: number, decimals = 0) =>
  v.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });

/** Deterministic PRNG so demo telemetry is stable across renders. */
export const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const genSeries = (seed: number, n: number, start: number, end: number, noise: number, decimals = 1) => {
  const rnd = mulberry32(seed);
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const base = start + (end - start) * (t * t * (3 - 2 * t)); // smoothstep drift
    const wobble = (rnd() - 0.5) * 2 * noise;
    const v = base + wobble * (0.35 + 0.65 * Math.sin(t * Math.PI));
    const f = 10 ** decimals;
    return Math.round(v * f) / f;
  });
};

/* ------------------------- warranty math -------------------------- */

export const warrantyInfo = (d: Device, now = new Date()): WarrantyInfo => {
  const start = new Date(d.purchaseISO).getTime();
  const endISO = addMonthsISO(d.purchaseISO, d.warrantyMonths + d.extendedMonths);
  const end = new Date(endISO).getTime();
  const totalDays = Math.round((end - start) / DAY_MS);
  const remainingDays = daysUntil(endISO, now);
  const pctElapsed = clamp((now.getTime() - start) / (end - start));
  const tier: WarrantyInfo["tier"] =
    remainingDays < 0 ? "expired" : remainingDays <= 7 ? "critical" : remainingDays <= 30 ? "warning" : remainingDays <= 60 ? "notice" : "ok";
  return { endISO, totalDays, remainingDays, pctElapsed, tier };
};

/* ---------------------- health index (0–100) ---------------------- */
/*  score = 28% age + 30% operational stress + 24% maintenance        */
/*          adherence + 18% incident history                          */

const runtimeHours = (d: Device) => d.meta.runtimeHours ?? 0;

const ageScore = (d: Device, now: Date) => clamp(1 - ageYears(d.purchaseISO, now) / d.expectedLifeYears);

const stressScore = (d: Device): number => {
  const life = d.expectedLifeYears;
  switch (d.category) {
    case "portable": {
      const soh = clamp((d.meta.soh ?? 95) / 100);
      const cycles = clamp(1 - (d.meta.cycles ?? 0) / 1200);
      return clamp(soh * 0.72 + cycles * 0.28);
    }
    case "hvac":
      return clamp(1 - runtimeHours(d) / (life * 1900));
    case "it": {
      const up = clamp((d.meta.uptimePct ?? 99) / 100);
      const conn = clamp((d.meta.connectivity ?? 97) / 100);
      return clamp(up * 0.6 + conn * 0.4);
    }
    case "industrial": {
      const vib = clamp(1 - (d.meta.vibration ?? 2) / 7.1);
      const hrs = clamp(1 - runtimeHours(d) / (life * 3200));
      const pf = clamp(((d.meta.powerFactor ?? 0.94) - 0.8) / 0.2);
      return clamp(vib * 0.42 + hrs * 0.38 + pf * 0.2);
    }
  }
};

const maintenanceScore = (d: Device, logs: MaintenanceLog[], now: Date): number => {
  if (d.schedules.length === 0) return 0.75;
  const scores = d.schedules.map((s) => {
    if (s.kind === "time" && s.everyDays && s.lastDoneISO) {
      const elapsed = (now.getTime() - new Date(s.lastDoneISO).getTime()) / DAY_MS;
      return clamp(1 - Math.max(0, elapsed - s.everyDays) / s.everyDays);
    }
    if (s.kind === "runtime" && s.everyHours && s.lastDoneHours != null) {
      const used = runtimeHours(d) - s.lastDoneHours;
      return clamp(1 - Math.max(0, used - s.everyHours) / s.everyHours);
    }
    return 0.75;
  });
  const recencyBoost = logs.length ? clamp(0.08 * logs.length, 0, 0.15) : 0;
  return clamp(scores.reduce((a, b) => a + b, 0) / scores.length + recencyBoost);
};

const incidentScore = (d: Device, logs: MaintenanceLog[]) => {
  const failures = logs.filter((l) => /fault|fail|repair|replac/i.test(l.action)).length;
  return clamp(1 - d.issues * 0.28 - failures * 0.06);
};

export const computeHealth = (d: Device, logs: MaintenanceLog[], now = new Date()): HealthResult => {
  const parts = {
    age: ageScore(d, now),
    stress: stressScore(d),
    maintenance: maintenanceScore(d, logs, now),
    incidents: incidentScore(d, logs),
  };
  const score = Math.round(
    100 * (parts.age * 0.28 + parts.stress * 0.3 + parts.maintenance * 0.24 + parts.incidents * 0.18),
  );
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "E";
  const trend: HealthResult["trend"] =
    d.issues === 0 && parts.maintenance > 0.82 ? 2 : d.issues > 1 ? -3 : parts.maintenance < 0.55 ? -1 : 0;
  return { score, grade, trend, parts };
};

export const healthColor = (score: number) =>
  score >= 85 ? "#2fe0be" : score >= 70 ? "#a8e05f" : score >= 55 ? "#ffb224" : score >= 40 ? "#ff8a3d" : "#ff6259";

export const tierMeta = {
  ok: { label: "COVERED", color: "#2fe0be" },
  notice: { label: "60-DAY", color: "#a8e05f" },
  warning: { label: "30-DAY", color: "#ffb224" },
  critical: { label: "≤7 DAYS", color: "#ff8a3d" },
  expired: { label: "EXPIRED", color: "#ff6259" },
} as const;

/* --------------------------- depreciation -------------------------- */

export const depreciatedValue = (d: Device, health: number, now = new Date()) => {
  const usedMonths = Math.max(0, (now.getTime() - new Date(d.purchaseISO).getTime()) / (DAY_MS * 30.44));
  const straight = d.cost * Math.max(0.05, 1 - usedMonths / (d.expectedLifeYears * 12));
  return Math.round(straight * (0.55 + 0.45 * (health / 100)));
};

/** Straight-line curve purchase → end of life (48 pts), health-adjusted. */
export const valueCurve = (d: Device, health: number, n = 48) => {
  const lifeMonths = d.expectedLifeYears * 12;
  const adj = 0.55 + 0.45 * (health / 100);
  return Array.from({ length: n }, (_, i) => {
    const m = (i / (n - 1)) * lifeMonths;
    return Math.round(d.cost * Math.max(0.05, 1 - m / lifeMonths) * (m <= lifeMonths * 0.4 ? 1 : adj + (1 - adj) * 0.35));
  });
};

/* ----------------------- service scheduling ------------------------ */

export const nextServices = (d: Device, logs: MaintenanceLog[], now = new Date()): ServiceDue[] => {
  return d.schedules
    .map((rule): ServiceDue => {
      if (rule.kind === "time" && rule.everyDays && rule.lastDoneISO) {
        const due = new Date(rule.lastDoneISO).getTime() + rule.everyDays * DAY_MS;
        const remainingDays = Math.round((due - now.getTime()) / DAY_MS);
        const state: ServiceDue["state"] = remainingDays < 0 ? "overdue" : remainingDays <= 14 ? "soon" : "ok";
        return {
          rule,
          state,
          remainingDays,
          remainingHours: null,
          remainingLabel:
            remainingDays < 0 ? `${-remainingDays}d overdue` : remainingDays === 0 ? "due today" : `in ${remainingDays}d`,
        };
      }
      const used = runtimeHours(d) - (rule.lastDoneHours ?? 0);
      const remainingHours = Math.round((rule.everyHours ?? 0) - used);
      const state: ServiceDue["state"] = remainingHours < 0 ? "overdue" : remainingHours <= 50 ? "soon" : "ok";
      return {
        rule,
        state,
        remainingDays: null,
        remainingHours,
        remainingLabel: remainingHours < 0 ? `${-remainingHours}h overdue` : `${remainingHours}h left`,
      };
    })
    .sort((a, b) => {
      const rank = { overdue: 0, soon: 1, ok: 2 } as const;
      if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state];
      const av = a.remainingDays ?? a.remainingHours ?? 9999;
      const bv = b.remainingDays ?? b.remainingHours ?? 9999;
      return av - bv;
    });
};

/* ------------------------ alerting matrix -------------------------- */

export const buildAlerts = (
  devices: Device[],
  logsByDevice: Record<string, MaintenanceLog[]>,
  rules: RuleSet,
  now = new Date(),
): AlertItem[] => {
  const out: AlertItem[] = [];
  const ts = now.toISOString();
  for (const d of devices) {
    const w = warrantyInfo(d, now);
    const ch = (k: EventKind) => rules.channels[k];
    if (w.tier === "expired" && rules.thresholds.includes(0))
      out.push({
        id: `${d.id}-w0`, severity: "critical", kind: "warranty", deviceId: d.id, deviceName: d.name,
        title: "Warranty expired",
        detail: `${d.brand} coverage lapsed ${fmtDate(w.endISO)} — ${-w.remainingDays}d ago. Consider extended cover or inspection.`,
        daysLeft: w.remainingDays, channels: ch("warranty"), ts,
      });
    else if (w.tier === "critical" && rules.thresholds.includes(7))
      out.push({
        id: `${d.id}-w7`, severity: "critical", kind: "warranty", deviceId: d.id, deviceName: d.name,
        title: "Warranty ends in " + w.remainingDays + "d",
        detail: `Final window to file pre-expiry claims. Packet auto-assembled from vault documents.`,
        daysLeft: w.remainingDays, channels: ch("warranty"), ts,
      });
    else if (w.tier === "warning" && rules.thresholds.includes(30))
      out.push({
        id: `${d.id}-w30`, severity: "warning", kind: "warranty", deviceId: d.id, deviceName: d.name,
        title: "Warranty ends in " + w.remainingDays + "d",
        detail: `Schedule any pending pre-expiry inspections before ${fmtDate(w.endISO)}.`,
        daysLeft: w.remainingDays, channels: ch("warranty"), ts,
      });
    else if (w.tier === "notice" && rules.thresholds.includes(60))
      out.push({
        id: `${d.id}-w60`, severity: "info", kind: "warranty", deviceId: d.id, deviceName: d.name,
        title: "60-day warranty notice",
        detail: `${d.name} exits coverage on ${fmtDate(w.endISO)}. Reminder cadence armed.`,
        daysLeft: w.remainingDays, channels: ch("warranty"), ts,
      });

    for (const s of nextServices(d, logsByDevice[d.id] ?? [], now).filter((s) => s.state !== "ok")) {
      out.push({
        id: `${d.id}-s-${s.rule.id}`,
        severity: s.state === "overdue" ? "critical" : "warning",
        kind: "service", deviceId: d.id, deviceName: d.name,
        title: `${s.rule.label} — ${s.remainingLabel}`,
        detail:
          s.rule.kind === "time"
            ? `Interval: every ${s.rule.everyDays} days. Last completed ${s.rule.lastDoneISO ? fmtDate(s.rule.lastDoneISO) : "—"}.`
            : `Interval: every ${s.rule.everyHours} run-hours at current duty cycle.`,
        daysLeft: s.remainingDays, channels: ch("service"), ts,
      });
    }

    const h = computeHealth(d, logsByDevice[d.id] ?? [], now);
    if (h.score < 55)
      out.push({
        id: `${d.id}-h`, severity: h.score < 40 ? "critical" : "warning", kind: "health",
        deviceId: d.id, deviceName: d.name,
        title: `Health index at ${h.score}%`,
        detail: `Grade ${h.grade}. Weakest factor: ${weakestFactor(h)}. Recommended: full diagnostic within 14 days.`,
        daysLeft: null, channels: ch("health"), ts,
      });
  }
  const sevRank = { critical: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
};

const weakestFactor = (h: HealthResult) => {
  const entries = Object.entries(h.parts) as [keyof HealthResult["parts"], number][];
  entries.sort((a, b) => a[1] - b[1]);
  return entries[0][0];
};

export const severityMeta = {
  critical: { label: "CRITICAL", color: "#ff6259" },
  warning: { label: "WARNING", color: "#ffb224" },
  info: { label: "NOTICE", color: "#6fb3ff" },
} as const;

/* ------------------------ claim packet ----------------------------- */

export const buildClaimHTML = (
  d: Device,
  opts: { issue: string; docs: string[]; logs: MaintenanceLog[]; warranty: WarrantyInfo; health: number },
) => {
  const rows = opts.logs
    .map(
      (l) =>
        `<tr><td>${fmtDate(l.dateISO)}</td><td>${l.provider}</td><td>${l.action}</td><td>${l.parts ?? "—"}</td><td>${fmtMoney(l.cost, d.currency)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Claim — ${d.name}</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;color:#14203c;max-width:760px;margin:32px auto;padding:0 24px}
h1{font-size:20px;border-bottom:3px solid #14203c;padding-bottom:8px}h2{font-size:14px;margin-top:28px;text-transform:uppercase;letter-spacing:.08em;color:#5a6a8c}
table{width:100%;border-collapse:collapse;font-size:12px}td,th{border:1px solid #c9d4ea;padding:6px 8px;text-align:left}th{background:#eef2fa}
.badge{display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:700;color:#fff;background:${opts.warranty.remainingDays >= 0 ? "#0e9f6e" : "#e02424"}}
.meta{font-size:12px;color:#5a6a8c}.sig{margin-top:40px;display:flex;gap:60px;font-size:12px}</style></head><body>
<h1>WARRANTY / INSURANCE CLAIM PACKET</h1>
<p class="meta">Generated by ElectroCare OS · ${fmtDate(new Date().toISOString())} · Ref EC-${d.serial.slice(-6).toUpperCase()}</p>
<h2>1 · Asset identification</h2>
<table><tr><th>Asset</th><td>${d.brand} ${d.name}</td><th>Serial / IMEI</th><td>${d.serial}</td></tr>
<tr><th>Category</th><td>${d.category}</td><th>Location</th><td>${d.location}</td></tr>
<tr><th>Purchased</th><td>${fmtDate(d.purchaseISO)} · ${fmtMoney(d.cost, d.currency)}</td><th>Coverage status</th><td><span class="badge">${opts.warranty.remainingDays >= 0 ? `IN WARRANTY · ${opts.warranty.remainingDays}d LEFT` : "OUT OF WARRANTY"}</span></td></tr></table>
<h2>2 · Reported issue</h2><p>${opts.issue || "—"}</p>
<h2>3 · Attached evidence (${opts.docs.length})</h2><ul>${opts.docs.map((t) => `<li>${t}</li>`).join("")}</ul>
<h2>4 · Service history</h2>
<table><tr><th>Date</th><th>Provider</th><th>Action</th><th>Parts</th><th>Cost</th></tr>${rows || "<tr><td colspan=5>No prior interventions recorded</td></tr>"}</table>
<h2>5 · Diagnostics summary</h2><p>Asset Health Index: <b>${opts.health}/100</b> at time of claim. Telemetry snapshots and OCR-verified purchase documents are embedded in the digital annex.</p>
<div class="sig"><div>_____________________<br>Claimant signature</div><div>_____________________<br>OEM / Insurer stamp</div></div>
</body></html>`;
};

export const downloadFile = (filename: string, content: string, mime = "text/html") => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
};
