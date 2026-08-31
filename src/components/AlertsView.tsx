import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Smartphone, Mail, MessageCircle, CalendarDays, Check, ShieldCheck, Wrench, Activity } from "lucide-react";
import type { AlertItem, Channel, EventKind, RuleSet, Severity } from "../lib/types";
import { CHANNELS } from "../lib/types";
import { severityMeta } from "../lib/healthEngine";
import { FilterChip, Reveal, Toggle } from "./ui";

const CH_META: Record<Channel, { label: string; icon: typeof Mail }> = {
  push: { label: "Push", icon: Smartphone },
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  calendar: { label: "Calendar", icon: CalendarDays },
};

const EVENT_META: Record<EventKind, { label: string; desc: string; icon: typeof Mail; color: string }> = {
  warranty: { label: "Warranty expiry", desc: "60 / 30 / 7 / 0-day cadence before coverage lapses", icon: ShieldCheck, color: "#ffb224" },
  service: { label: "Service schedule", desc: "Calendar intervals + runtime-hour triggers", icon: Wrench, color: "#6fb3ff" },
  health: { label: "Health index drop", desc: "Fires when AHI crosses below 55 / 40", icon: Activity, color: "#2fe0be" },
};

interface Props {
  alerts: AlertItem[];
  ackedCount: number;
  rules: RuleSet;
  onRules: (r: RuleSet) => void;
  onAck: (id: string) => void;
}

export default function AlertsView({ alerts, ackedCount, rules, onRules, onAck }: Props) {
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");
  const visible = alerts.filter((a) => sevFilter === "all" || a.severity === sevFilter);

  const toggleChannel = (kind: EventKind, ch: Channel) => {
    const cur = rules.channels[kind];
    onRules({
      ...rules,
      channels: { ...rules.channels, [kind]: cur.includes(ch) ? cur.filter((c) => c !== ch) : [...cur, ch] },
    });
  };
  const toggleThreshold = (t: number) =>
    onRules({
      ...rules,
      thresholds: rules.thresholds.includes(t) ? rules.thresholds.filter((x) => x !== t) : [...rules.thresholds, t].sort((a, b) => b - a),
    });

  const counts = useMemo(
    () => ({
      critical: alerts.filter((a) => a.severity === "critical").length,
      warning: alerts.filter((a) => a.severity === "warning").length,
      info: alerts.filter((a) => a.severity === "info").length,
    }),
    [alerts],
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[400px_1fr]">
      {/* rules */}
      <Reveal>
        <div className="panel h-fit p-5 lg:sticky lg:top-[72px]">
          <span className="tech-label">Notification Rule Matrix</span>
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            Multi-channel fan-out hydrated nightly into Redis ZSETs (<span className="num text-dim">score = eventTs − leadDays</span>) and dispatched by the scheduler worker.
          </p>

          {/* threshold cadence */}
          <div className="mt-5">
            <div className="mb-2 text-[9.5px] tracking-[0.18em] text-faint">WARRANTY LEAD-TIME CADENCE (DAYS)</div>
            <div className="flex gap-2">
              {[60, 30, 7, 0].map((t) => {
                const on = rules.thresholds.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleThreshold(t)}
                    className="num flex-1 rounded-md border py-2 text-[13px] font-semibold transition-all"
                    style={
                      on
                        ? { borderColor: "#ffb22488", background: "#ffb22414", color: "#ffb224" }
                        : { borderColor: "var(--color-line)", color: "var(--color-faint)" }
                    }
                  >
                    {t === 0 ? "D0" : `D-${t}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* matrix */}
          <div className="mt-5 overflow-hidden rounded-md border border-line">
            <div className="grid grid-cols-[1fr_repeat(4,44px)] items-center bg-panel2/70 px-3 py-2">
              <span className="text-[9px] tracking-[0.18em] text-faint">EVENT \ CHANNEL</span>
              {CHANNELS.map((c) => {
                const I = CH_META[c].icon;
                return <I key={c} size={13} className="justify-self-center text-dim" aria-label={CH_META[c].label} />;
              })}
            </div>
            {(Object.keys(EVENT_META) as EventKind[]).map((kind) => {
              const E = EVENT_META[kind];
              const EIcon = E.icon;
              return (
                <div key={kind} className="grid grid-cols-[1fr_repeat(4,44px)] items-center border-t border-line/70 px-3 py-3">
                  <div className="pr-2">
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                      <EIcon size={12} style={{ color: E.color }} /> {E.label}
                    </div>
                    <div className="mt-0.5 text-[9.5px] leading-snug text-faint">{E.desc}</div>
                  </div>
                  {CHANNELS.map((c) => (
                    <div key={c} className="justify-self-center">
                      <Toggle on={rules.channels[kind].includes(c)} onChange={() => toggleChannel(kind, c)} color={E.color} label={`${E.label} via ${c}`} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-md border border-line bg-panel2/40 p-3">
            <div className="text-[9.5px] tracking-[0.18em] text-faint">SCHEDULER PREVIEW</div>
            <div className="mt-2 space-y-1.5">
              {alerts.slice(0, 4).map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-[10.5px]">
                  <span className="h-1 w-1 rounded-full" style={{ background: severityMeta[a.severity].color }} />
                  <span className="min-w-0 flex-1 truncate text-dim">{a.deviceName} — {a.title}</span>
                  <span className="flex gap-1">
                    {a.channels.map((c) => {
                      const I = CH_META[c].icon;
                      return <I key={c} size={10} className="text-faint" />;
                    })}
                  </span>
                </div>
              ))}
              {alerts.length === 0 && <div className="text-[10.5px] text-faint">Queue empty — nothing scheduled.</div>}
            </div>
          </div>
        </div>
      </Reveal>

      {/* feed */}
      <Reveal delay={0.06}>
        <div className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="tech-label">Live Alert Feed</span>
            <div className="flex items-center gap-2">
              <FilterChip active={sevFilter === "all"} onClick={() => setSevFilter("all")}>ALL · {alerts.length}</FilterChip>
              {(["critical", "warning", "info"] as const).map((s) => (
                <FilterChip key={s} active={sevFilter === s} color={severityMeta[s].color} onClick={() => setSevFilter(sevFilter === s ? "all" : s)}>
                  {severityMeta[s].label} · {counts[s]}
                </FilterChip>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <AnimatePresence initial={false}>
              {visible.map((a) => {
                const sev = severityMeta[a.severity];
                return (
                  <motion.div
                    key={a.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-start gap-3 rounded-md border border-line bg-panel2/40 p-3.5"
                    style={{ borderLeft: `3px solid ${sev.color}` }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-ink">{a.title}</span>
                        <span className="chip !py-0.5 !text-[9px] font-bold" style={{ color: sev.color, borderColor: `${sev.color}55` }}>
                          {sev.label}
                        </span>
                        <span className="chip !py-0.5 !text-[9px]">{a.kind.toUpperCase()}</span>
                      </div>
                      <div className="mt-1 text-[11.5px] text-dim">{a.deviceName} — {a.detail}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[9px] tracking-[0.16em] text-faint">FAN-OUT:</span>
                        {a.channels.map((c) => {
                          const I = CH_META[c].icon;
                          return (
                            <span key={c} className="chip !gap-1 !px-1.5 !py-0.5 !text-[9px]">
                              <I size={9} /> {CH_META[c].label.toUpperCase()}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => onAck(a.id)}
                      className="flex shrink-0 items-center gap-1.5 rounded-md border border-line px-3 py-2 text-[10.5px] font-semibold tracking-wider text-dim transition-colors hover:border-teal/60 hover:text-teal"
                    >
                      <Check size={12} /> ACK
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {visible.length === 0 && (
              <div className="rounded-md border border-dashed border-line px-3 py-10 text-center">
                <div className="text-[13px] font-semibold text-dim">Feed clear</div>
                <div className="mt-1 text-[11.5px] text-faint">
                  {ackedCount > 0 ? `${ackedCount} alert${ackedCount > 1 ? "s" : ""} acknowledged this session.` : "No alerts match this filter."}
                </div>
              </div>
            )}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
