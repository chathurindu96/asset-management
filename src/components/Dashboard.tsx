import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check, Smartphone, Mail, MessageCircle, CalendarDays, Receipt, ShieldCheck,
  BookOpen, ClipboardList, Umbrella, FileSignature, ScanLine, ArrowUpRight, Wrench,
} from "lucide-react";
import type {
  AlertItem, CategoryId, Device, DocType, MaintenanceLog, VaultDocument, ViewId,
} from "../lib/types";
import { CAT, CATEGORIES } from "../lib/types";
import {
  computeHealth, depreciatedValue, fmtMoney, healthColor, nextServices, severityMeta, tierMeta, warrantyInfo,
} from "../lib/healthEngine";
import { CountUp, FilterChip, Reveal } from "./ui";
import { HealthRing, Sparkline, WarrantyHorizon } from "./charts";

const DOC_ICON: Record<DocType, typeof Receipt> = {
  invoice: Receipt, "warranty-card": ShieldCheck, manual: BookOpen,
  "service-report": ClipboardList, insurance: Umbrella, "claim-form": FileSignature,
};
const CH_ICON = { push: Smartphone, email: Mail, whatsapp: MessageCircle, calendar: CalendarDays };

function Head({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <span className="tech-label flex items-center gap-2">
        <span className="inline-block h-[5px] w-[5px] rotate-45 bg-amber" />
        {label}
      </span>
      {right}
    </div>
  );
}

interface Props {
  devices: Device[];
  logs: MaintenanceLog[];
  docs: VaultDocument[];
  alerts: AlertItem[];
  onOpenAsset: (id: string) => void;
  onNavigate: (v: ViewId) => void;
  onAck: (id: string) => void;
  onQuickService: (deviceId: string, label: string) => void;
  category: CategoryId | "all";
  setCategory: (c: CategoryId | "all") => void;
}

export default function Dashboard({
  devices, logs, docs, alerts, onOpenAsset, onNavigate, onAck, onQuickService, category, setCategory,
}: Props) {
  const now = useMemo(() => new Date(), []);
  const filtered = useMemo(
    () => (category === "all" ? devices : devices.filter((d) => d.category === category)),
    [devices, category],
  );
  const logsBy = useMemo(() => {
    const m: Record<string, MaintenanceLog[]> = {};
    for (const l of logs) (m[l.deviceId] ??= []).push(l);
    return m;
  }, [logs]);
  const healthOf = useMemo(() => {
    const m: Record<string, ReturnType<typeof computeHealth>> = {};
    for (const d of filtered) m[d.id] = computeHealth(d, logsBy[d.id] ?? [], now);
    return m;
  }, [filtered, logsBy, now]);

  const avg = filtered.length
    ? Math.round(filtered.reduce((a, d) => a + healthOf[d.id].score, 0) / filtered.length)
    : 0;
  const totalValue = filtered.reduce((a, d) => a + depreciatedValue(d, healthOf[d.id].score, now), 0);
  const covered = filtered.filter((d) => warrantyInfo(d, now).remainingDays >= 0).length;

  const queue = useMemo(
    () =>
      filtered
        .flatMap((d) => nextServices(d, logsBy[d.id] ?? [], now).filter((s) => s.state !== "ok").map((s) => ({ ...s, dev: d })))
        .sort((a, b) => (a.state === b.state ? 0 : a.state === "overdue" ? -1 : 1))
        .slice(0, 6),
    [filtered, logsBy, now],
  );

  return (
    <div className="space-y-5">
      {/* command strip */}
      <Reveal className="flex flex-wrap items-center gap-2">
        <span className="tech-label mr-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-teal pulse-dot" /> LIVE FLEET · {filtered.length} ASSETS
        </span>
        <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
          ALL
        </FilterChip>
        {CATEGORIES.map((c) => (
          <FilterChip key={c.id} active={category === c.id} color={c.color} onClick={() => setCategory(c.id)}>
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
            {c.short.toUpperCase()}
          </FilterChip>
        ))}
      </Reveal>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* ------------ fleet vitals ------------ */}
        <Reveal className="lg:col-span-4 lg:row-span-2" delay={0.02}>
          <div className="panel panel-live flex h-full flex-col p-5">
            <Head label="Fleet Vitals" />
            <div className="flex items-center gap-6">
              <HealthRing score={avg} size={128} stroke={10}>
                <span className="num text-[30px] font-semibold leading-none" style={{ color: healthColor(avg) }}>
                  {avg}
                </span>
                <span className="mt-1 text-[9px] tracking-[0.22em] text-faint">HEALTH IDX</span>
              </HealthRing>
              <div className="grid flex-1 grid-cols-2 gap-3">
                {[
                  { l: "ASSETS", v: <CountUp value={filtered.length} className="num text-xl font-semibold text-ink" /> },
                  { l: "PORTFOLIO", v: <CountUp value={totalValue} prefix="$" className="num text-xl font-semibold text-ink" /> },
                  { l: "COVERED", v: <span className="num text-xl font-semibold text-ink">{covered}<span className="text-[12px] text-faint">/{filtered.length}</span></span> },
                  { l: "OPEN ALERTS", v: <span className="num text-xl font-semibold text-coral">{alerts.length}</span> },
                ].map((s) => (
                  <div key={s.l} className="rounded-md border border-line bg-panel2/60 px-3 py-2.5">
                    <div className="text-[9px] tracking-[0.18em] text-faint">{s.l}</div>
                    <div className="mt-1">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-2.5">
              {CATEGORIES.map((c, i) => {
                const n = devices.filter((d) => d.category === c.id).length;
                const pct = devices.length ? (n / devices.length) * 100 : 0;
                return (
                  <button key={c.id} onClick={() => setCategory(category === c.id ? "all" : c.id)} className="block w-full text-left">
                    <div className="mb-1 flex justify-between text-[11px]">
                      <span className={category === c.id ? "text-ink" : "text-dim"}>{c.label}</span>
                      <span className="num text-faint">{n}</span>
                    </div>
                    <div className="h-[5px] overflow-hidden rounded-sm bg-[#1a2440]">
                      <motion.div
                        className="h-full rounded-sm"
                        style={{ background: c.color }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: 0.1 + i * 0.06 }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-auto pt-5 text-[10.5px] leading-relaxed text-faint">
              Health index blends age, operational stress, maintenance adherence and incident history — recomputed on every ledger write.
            </p>
          </div>
        </Reveal>

        {/* ------------ warranty horizon ------------ */}
        <Reveal className="lg:col-span-8" delay={0.06}>
          <div className="panel panel-live h-full p-5">
            <Head
              label="Warranty Horizon"
              right={
                <div className="flex flex-wrap justify-end gap-1.5">
                  {(["ok", "notice", "warning", "critical", "expired"] as const).map((t) => (
                    <span key={t} className="chip !px-2 !py-1" style={{ color: tierMeta[t].color, borderColor: `${tierMeta[t].color}44` }}>
                      {tierMeta[t].label}
                    </span>
                  ))}
                </div>
              }
            />
            <WarrantyHorizon
              devices={[...filtered].sort((a, b) => warrantyInfo(a, now).remainingDays - warrantyInfo(b, now).remainingDays)}
              now={now}
              onSelect={onOpenAsset}
            />
          </div>
        </Reveal>

        {/* ------------ alert matrix ------------ */}
        <Reveal className="lg:col-span-4" delay={0.08}>
          <div className="panel panel-live h-full p-5">
            <Head
              label="Alert Matrix"
              right={<button onClick={() => onNavigate("alerts")} className="chip hover:border-line2 hover:text-ink">CONFIGURE</button>}
            />
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {alerts.slice(0, 6).map((a) => {
                  const sev = severityMeta[a.severity];
                  return (
                    <motion.div
                      key={a.id}
                      layout
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 14 }}
                      className="group flex items-start gap-2.5 rounded-md border border-line bg-panel2/50 px-3 py-2.5"
                      style={{ borderLeft: `2px solid ${sev.color}` }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[12px] font-semibold text-ink">{a.title}</span>
                        </div>
                        <div className="mt-0.5 truncate text-[10.5px] text-faint">{a.deviceName} · {a.detail}</div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          {a.channels.map((c) => {
                            const I = CH_ICON[c];
                            return <I key={c} size={11} className="text-faint" />;
                          })}
                        </div>
                      </div>
                      <button
                        onClick={() => onAck(a.id)}
                        aria-label="Acknowledge"
                        className="mt-0.5 rounded border border-line p-1 text-faint opacity-0 transition-all hover:border-teal/60 hover:text-teal group-hover:opacity-100"
                      >
                        <Check size={12} />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {alerts.length === 0 && (
                <div className="rounded-md border border-dashed border-line px-3 py-6 text-center text-[12px] text-faint">
                  All clear — no unacknowledged alerts.
                </div>
              )}
            </div>
          </div>
        </Reveal>

        {/* ------------ telemetry pulse ------------ */}
        <TelemetryPulse devices={filtered} category={category} />

        {/* ------------ maintenance queue ------------ */}
        <Reveal className="lg:col-span-6" delay={0.1}>
          <div className="panel panel-live h-full p-5">
            <Head label="Preventive Maintenance Queue" right={<Wrench size={13} className="text-faint" />} />
            <div className="space-y-1.5">
              {queue.map((q) => (
                <div key={`${q.dev.id}-${q.rule.id}`} className="flex items-center gap-3 rounded-md border border-line bg-panel2/40 px-3 py-2">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${q.state === "overdue" ? "bg-coral pulse-dot-red" : "bg-amber"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-ink">{q.rule.label}</div>
                    <div className="truncate text-[10.5px] text-faint">{q.dev.name} · {q.rule.kind === "runtime" ? "runtime interval" : "calendar interval"}</div>
                  </div>
                  <span
                    className="chip !py-1"
                    style={{
                      color: q.state === "overdue" ? "#ff6259" : "#ffb224",
                      borderColor: q.state === "overdue" ? "#ff625955" : "#ffb22444",
                    }}
                  >
                    {q.remainingLabel.toUpperCase()}
                  </span>
                  <button
                    onClick={() => onQuickService(q.dev.id, q.rule.label)}
                    className="rounded border border-line px-2 py-1 text-[10px] font-semibold tracking-wider text-dim transition-colors hover:border-teal/60 hover:text-teal"
                  >
                    DONE
                  </button>
                </div>
              ))}
              {queue.length === 0 && (
                <div className="rounded-md border border-dashed border-line px-3 py-6 text-center text-[12px] text-faint">
                  No overdue or upcoming service — fleet is on schedule.
                </div>
              )}
            </div>
          </div>
        </Reveal>

        {/* ------------ vault snapshot ------------ */}
        <Reveal className="lg:col-span-6" delay={0.12}>
          <div className="panel panel-live flex h-full flex-col p-5">
            <Head label="Document Vault" right={<ScanLine size={13} className="text-faint" />} />
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DOC_ICON) as DocType[]).map((t) => {
                const I = DOC_ICON[t];
                const n = docs.filter((doc) => doc.type === t).length;
                return (
                  <div key={t} className="rounded-md border border-line bg-panel2/40 px-3 py-2.5 transition-colors hover:border-line2">
                    <I size={14} className="text-sky" />
                    <div className="num mt-1.5 text-lg font-semibold leading-none text-ink">{n}</div>
                    <div className="mt-1 text-[9px] leading-tight tracking-wide text-faint">{t.replace("-", " ").toUpperCase()}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-auto flex items-center justify-between pt-4">
              <span className="text-[10.5px] text-faint">{docs.length} encrypted objects · AES-256-GCM envelope</span>
              <button
                onClick={() => onNavigate("vault")}
                className="flex items-center gap-1.5 rounded-md border border-amber/50 bg-amber/10 px-3 py-2 text-[11px] font-semibold tracking-wider text-amber transition-all hover:bg-amber/20"
              >
                LAUNCH OCR SCANNER <ArrowUpRight size={12} />
              </button>
            </div>
          </div>
        </Reveal>

        {/* ------------ asset tiles ------------ */}
        <Reveal className="lg:col-span-12" delay={0.14}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {filtered.map((d, i) => {
              const h = healthOf[d.id];
              const w = warrantyInfo(d, now);
              const tier = tierMeta[w.tier];
              return (
                <motion.button
                  key={d.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.4) }}
                  onClick={() => onOpenAsset(d.id)}
                  className="panel panel-live relative overflow-hidden p-4 text-left"
                >
                  <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: CAT[d.category].color }} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-display text-[14px] font-semibold text-ink">{d.name}</div>
                      <div className="mt-0.5 truncate text-[11px] text-faint">{d.brand} · {d.location}</div>
                      <div className="num mt-2 text-[10px] tracking-wide text-faint">SN {d.serial}</div>
                    </div>
                    <HealthRing score={h.score} size={54} stroke={5}>
                      <span className="num text-[13px] font-semibold" style={{ color: healthColor(h.score) }}>{h.score}</span>
                    </HealthRing>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="chip !py-1" style={{ color: tier.color, borderColor: `${tier.color}44` }}>{tier.label}</span>
                    <span className="num text-[12px] font-medium text-dim">
                      {fmtMoney(depreciatedValue(d, h.score, now), d.currency)}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </Reveal>
      </div>
    </div>
  );
}

/* ---------------------- telemetry pulse card ------------------------ */

function TelemetryPulse({ devices, category }: { devices: Device[]; category: CategoryId | "all" }) {
  const [idx, setIdx] = useState(0);
  const dev = devices.length ? devices[idx % devices.length] : null;
  const series = dev?.telemetry.slice(0, 2) ?? [];

  const [bufA, setBufA] = useState<number[]>([]);
  const [bufB, setBufB] = useState<number[]>([]);

  useEffect(() => {
    setIdx(0);
  }, [category]);

  useEffect(() => {
    if (!dev) return;
    setBufA([...dev.telemetry[0].points]);
    setBufB(dev.telemetry[1] ? [...dev.telemetry[1].points] : []);
    const rot = setInterval(() => setIdx((i) => i + 1), 4600);
    return () => clearInterval(rot);
  }, [dev?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dev) return;
    const t = setInterval(() => {
      const jit = (arr: number[], amt: number) =>
        arr.length ? [...arr.slice(1), Math.max(0, arr[arr.length - 1] + (Math.random() - 0.5) * amt)] : arr;
      setBufA((a) => jit(a, dev.telemetry[0] ? (Math.max(...dev.telemetry[0].points) - Math.min(...dev.telemetry[0].points)) * 0.25 : 1));
      setBufB((b) => jit(b, dev.telemetry[1] ? (Math.max(...dev.telemetry[1].points) - Math.min(...dev.telemetry[1].points)) * 0.25 : 1));
    }, 2600);
    return () => clearInterval(t);
  }, [dev?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Reveal className="lg:col-span-4" delay={0.09}>
      <div className="panel panel-live h-full p-5">
        <Head
          label="Telemetry Pulse"
          right={
            dev ? (
              <span className="chip !py-1" style={{ color: CAT[dev.category].color, borderColor: `${CAT[dev.category].color}55` }}>
                <span className="h-1 w-1 rounded-full pulse-dot" style={{ background: CAT[dev.category].color }} />
                STREAMING
              </span>
            ) : undefined
          }
        />
        <AnimatePresence mode="wait">
          {dev && (
            <motion.div key={dev.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <div className="font-display text-[13px] font-semibold text-ink">{dev.name}</div>
              <div className="space-y-3 pt-3">
                {series.map((s, i) => {
                  const buf = i === 0 ? bufA : bufB;
                  const last = buf.length ? buf[buf.length - 1] : s.points[s.points.length - 1];
                  const color = CAT[dev.category].color;
                  return (
                    <div key={s.id}>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-[10.5px] text-dim">{s.label}</span>
                        <span className="num text-[13px] font-semibold" style={{ color }}>
                          {last.toFixed(s.decimals ?? 1)}
                          <span className="ml-1 text-[9px] font-normal text-faint">{s.unit}</span>
                        </span>
                      </div>
                      {buf.length > 1 && <Sparkline points={buf} color={color} height={44} decimals={s.decimals ?? 1} capacity={s.capacity} />}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {!dev && <div className="py-8 text-center text-[12px] text-faint">No devices in this category.</div>}
      </div>
    </Reveal>
  );
}
