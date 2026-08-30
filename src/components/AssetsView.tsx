import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Receipt, ShieldCheck, BookOpen, ClipboardList, Umbrella, FileSignature,
  Download, Copy, TrendingUp, TrendingDown, Minus, CalendarClock, MapPin, FileText,
} from "lucide-react";
import type { Device, DocType, MaintenanceLog, VaultDocument } from "../lib/types";
import { CAT, DOC_LABEL } from "../lib/types";
import {
  buildClaimHTML, computeHealth, depreciatedValue, downloadFile, fmtDate, fmtMoney,
  healthColor, nextServices, severityMeta, tierMeta, valueCurve, warrantyInfo,
} from "../lib/healthEngine";
import { Modal } from "./ui";
import { FactorBar, HealthRing, Sparkline } from "./charts";

const DOC_ICON: Record<DocType, typeof Receipt> = {
  invoice: Receipt, "warranty-card": ShieldCheck, manual: BookOpen,
  "service-report": ClipboardList, insurance: Umbrella, "claim-form": FileSignature,
};

interface Props {
  devices: Device[];
  logs: MaintenanceLog[];
  docs: VaultDocument[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  query: string;
  onLogService: (deviceId: string, entry: { provider: string; action: string; cost: number }) => void;
  onToast: (msg: string, kind?: "ok" | "info" | "warn") => void;
}

export default function AssetsView({ devices, logs, docs, selectedId, onSelect, query, onLogService, onToast }: Props) {
  const now = useMemo(() => new Date(), []);
  const [claimFor, setClaimFor] = useState<Device | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((d) =>
      [d.name, d.brand, d.serial, d.location, d.category].join(" ").toLowerCase().includes(q),
    );
  }, [devices, query]);

  const selected = devices.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      {/* registry list */}
      <div className="panel h-fit max-h-[calc(100vh-120px)] overflow-y-auto p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="tech-label">Registry · {visible.length}</span>
          {query && <span className="chip !py-0.5">“{query}”</span>}
        </div>
        <div className="space-y-1.5">
          {visible.map((d) => {
            const h = computeHealth(d, logs.filter((l) => l.deviceId === d.id), now);
            const w = warrantyInfo(d, now);
            const active = d.id === selectedId;
            return (
              <button
                key={d.id}
                onClick={() => onSelect(d.id)}
                className={`relative w-full overflow-hidden rounded-md border px-3 py-2.5 text-left transition-all ${
                  active ? "border-amber/50 bg-amber/[0.07]" : "border-line bg-panel2/40 hover:border-line2 hover:bg-panel2/70"
                }`}
              >
                <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: CAT[d.category].color }} />
                <div className="flex items-center gap-3 pl-1.5">
                  <HealthRing score={h.score} size={40} stroke={4}>
                    <span className="num text-[11px] font-semibold" style={{ color: healthColor(h.score) }}>{h.score}</span>
                  </HealthRing>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold text-ink">{d.name}</div>
                    <div className="truncate text-[10.5px] text-faint">{d.brand} · <span className="num">SN {d.serial.slice(0, 12)}</span></div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="chip !px-1.5 !py-0.5 !text-[9px]" style={{ color: tierMeta[w.tier].color, borderColor: `${tierMeta[w.tier].color}44` }}>
                        {tierMeta[w.tier].label}
                      </span>
                      {d.issues > 0 && <span className="chip !px-1.5 !py-0.5 !text-[9px] !text-coral !border-coral/40">{d.issues} ISSUE{d.issues > 1 ? "S" : ""}</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {visible.length === 0 && (
            <div className="rounded-md border border-dashed border-line px-3 py-8 text-center text-[12px] text-faint">
              No assets match “{query}”.
            </div>
          )}
        </div>
      </div>

      {/* detail */}
      {selected ? (
        <Detail
          key={selected.id}
          device={selected}
          logs={logs.filter((l) => l.deviceId === selected.id)}
          docs={docs.filter((d) => d.deviceId === selected.id)}
          onLogService={onLogService}
          onClaim={() => setClaimFor(selected)}
        />
      ) : (
        <div className="panel flex min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center">
          <svg width="64" height="64" viewBox="0 0 40 40" fill="none" className="float-y opacity-60">
            <path d="M20 2 35.6 11v18L20 38 4.4 29V11L20 2Z" stroke="#2c3d63" strokeWidth="1.5" />
            <path d="M22.5 9 13 22h5.4L17 31l10-13.6h-5.8L22.5 9Z" fill="#2c3d63" />
          </svg>
          <p className="font-display text-[15px] font-semibold text-dim">Select an asset from the registry</p>
          <p className="max-w-[320px] text-[12px] leading-relaxed text-faint">
            Health factors, coverage timeline, telemetry, maintenance ledger and one-click claim packets render here.
          </p>
        </div>
      )}

      {claimFor && (
        <ClaimModal
          device={claimFor}
          logs={logs.filter((l) => l.deviceId === claimFor.id)}
          docs={docs.filter((d) => d.deviceId === claimFor.id)}
          onClose={() => setClaimFor(null)}
          onToast={onToast}
        />
      )}
    </div>
  );
}

/* ------------------------------- detail ------------------------------ */

function Detail({
  device: d,
  logs,
  docs,
  onLogService,
  onClaim,
}: {
  device: Device;
  logs: MaintenanceLog[];
  docs: VaultDocument[];
  onLogService: Props["onLogService"];
  onClaim: () => void;
}) {
  const now = useMemo(() => new Date(), []);
  const h = computeHealth(d, logs, now);
  const w = warrantyInfo(d, now);
  const tier = tierMeta[w.tier];
  const services = nextServices(d, logs, now);
  const value = depreciatedValue(d, h.score, now);
  const [formOpen, setFormOpen] = useState<string | null>(null);
  const [provider, setProvider] = useState("Self");
  const [cost, setCost] = useState(0);

  const sorted = [...logs].sort((a, b) => +new Date(b.dateISO) - +new Date(a.dateISO));
  const cat = CAT[d.category];

  const submitLog = (label: string) => {
    onLogService(d.id, { provider: provider.trim() || "Self", action: `${label} — logged`, cost });
    setFormOpen(null);
    setCost(0);
  };

  return (
    <div className="space-y-4">
      {/* header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel relative overflow-hidden p-5">
        <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: cat.color }} />
        <div className="flex flex-wrap items-center gap-5">
          <HealthRing score={h.score} size={104} stroke={9}>
            <span className="num text-[26px] font-semibold leading-none" style={{ color: healthColor(h.score) }}>{h.score}</span>
            <span className="mt-1 flex items-center gap-1 text-[9px] tracking-widest text-faint">
              GRADE {h.grade}
              {h.trend > 0 ? <TrendingUp size={10} className="text-teal" /> : h.trend < 0 ? <TrendingDown size={10} className="text-coral" /> : <Minus size={10} />}
            </span>
          </HealthRing>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold text-ink">{d.name}</h2>
              <span className="chip !py-1" style={{ color: cat.color, borderColor: `${cat.color}55` }}>{cat.short.toUpperCase()}</span>
              <span className={`chip !py-1 ${d.status === "active" ? "!text-teal !border-teal/40" : "!text-amber !border-amber/40"}`}>
                {d.status.toUpperCase()}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-dim">
              <span>{d.brand}</span>
              <span className="num">SN {d.serial}</span>
              <span className="flex items-center gap-1"><MapPin size={11} /> {d.location}</span>
              <span className="num">Purchased {fmtDate(d.purchaseISO)} · {fmtMoney(d.cost, d.currency)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.entries(d.specs).map(([k, v]) => (
                <span key={k} className="chip">{k}: <b className="text-dim">{String(v)}</b></span>
              ))}
            </div>
          </div>
          <button
            onClick={onClaim}
            className="flex items-center gap-2 rounded-md border border-amber/60 bg-amber/12 px-4 py-2.5 text-[12px] font-semibold tracking-wider text-amber transition-all hover:bg-amber/20"
          >
            <FileText size={14} /> 1-CLICK CLAIM PACKET
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* health factors */}
        <div className="panel p-5">
          <span className="tech-label">Health Index Decomposition</span>
          <div className="mt-4 space-y-3.5">
            <FactorBar label="Age vs expected lifecycle" value={h.parts.age} delay={0.05} />
            <FactorBar label="Operational stress (category model)" value={h.parts.stress} delay={0.1} />
            <FactorBar label="Maintenance adherence" value={h.parts.maintenance} delay={0.15} />
            <FactorBar label="Incident history" value={h.parts.incidents} delay={0.2} />
          </div>
          <p className="mt-4 text-[10.5px] leading-relaxed text-faint">
            Weighting — age 28% · stress 30% · maintenance 24% · incidents 18%. Category-aware stress model:{" "}
            {d.category === "portable" && "SOH + charge cycles"}
            {d.category === "hvac" && "run-hours vs compressor life"}
            {d.category === "it" && "uptime + connectivity"}
            {d.category === "industrial" && "vibration + load + power factor"}
            .
          </p>
        </div>

        {/* coverage & value */}
        <div className="panel p-5">
          <div className="flex items-center justify-between">
            <span className="tech-label">Coverage & Residual Value</span>
            <span className="chip !py-1" style={{ color: tier.color, borderColor: `${tier.color}55` }}>{tier.label}</span>
          </div>
          <div className="mt-4">
            <div className="relative h-[10px] overflow-hidden rounded-[3px] bg-[#151e33] ring-1 ring-inset ring-line">
              <div className="absolute inset-y-0 left-0" style={{ width: `${w.pctElapsed * 100}%`, background: `${cat.color}55` }} />
              <div
                className="absolute inset-y-0"
                style={{
                  left: `${w.pctElapsed * 100}%`,
                  width: `${(1 - w.pctElapsed) * 100}%`,
                  background: tier.color,
                  boxShadow: `0 0 10px ${tier.color}66`,
                }}
              />
              <div className="absolute inset-y-[-3px] w-[2px] bg-ink/80" style={{ left: `${w.pctElapsed * 100}%` }} />
            </div>
            <div className="num mt-1.5 flex justify-between text-[10px] text-faint">
              <span>{fmtDate(d.purchaseISO)}</span>
              <span style={{ color: tier.color }}>
                {w.remainingDays >= 0 ? `${w.remainingDays} days remaining` : `expired ${-w.remainingDays} days ago`}
              </span>
              <span>{fmtDate(w.endISO)}</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { l: "PAID", v: fmtMoney(d.cost, d.currency) },
              { l: "RESIDUAL", v: fmtMoney(value, d.currency), c: healthColor(h.score) },
              { l: "COVERAGE", v: `${d.warrantyMonths}+${d.extendedMonths} mo` },
            ].map((s) => (
              <div key={s.l} className="rounded-md border border-line bg-panel2/50 px-3 py-2.5">
                <div className="text-[9px] tracking-[0.18em] text-faint">{s.l}</div>
                <div className="num mt-1 text-[14px] font-semibold" style={{ color: s.c ?? "var(--color-ink)" }}>{s.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="mb-1 text-[10.5px] text-dim">Depreciation curve · {d.expectedLifeYears}-year lifecycle</div>
            <Sparkline points={valueCurve(d, h.score)} color={cat.color} height={52} />
          </div>
        </div>

        {/* telemetry */}
        <div className="panel p-5">
          <span className="tech-label flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full pulse-dot" style={{ background: cat.color }} />
            Live Telemetry · {d.telemetry.length} channels
          </span>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {d.telemetry.map((s) => (
              <div key={s.id}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[11px] text-dim">{s.label}</span>
                  <span className="num text-[13px] font-semibold" style={{ color: cat.color }}>
                    {s.points[s.points.length - 1].toFixed(s.decimals ?? 1)}
                    <span className="ml-1 text-[9px] font-normal text-faint">{s.unit}</span>
                  </span>
                </div>
                <Sparkline points={s.points} color={cat.color} height={46} decimals={s.decimals ?? 1} capacity={s.capacity} />
              </div>
            ))}
          </div>
        </div>

        {/* schedules */}
        <div className="panel p-5">
          <span className="tech-label flex items-center gap-2"><CalendarClock size={12} /> Preventive Schedule Engine</span>
          <div className="mt-4 space-y-2">
            {services.map((s) => (
              <div key={s.rule.id} className="rounded-md border border-line bg-panel2/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-ink">{s.rule.label}</span>
                  <span
                    className="chip !py-1"
                    style={{
                      color: s.state === "overdue" ? severityMeta.critical.color : s.state === "soon" ? severityMeta.warning.color : "#2fe0be",
                      borderColor: `${s.state === "overdue" ? severityMeta.critical.color : s.state === "soon" ? severityMeta.warning.color : "#2fe0be"}44`,
                    }}
                  >
                    {s.remainingLabel.toUpperCase()}
                  </span>
                </div>
                <div className="mt-1 text-[10.5px] text-faint">
                  Every {s.rule.kind === "time" ? `${s.rule.everyDays} days` : `${s.rule.everyHours} run-hours`}
                  {s.rule.lastDoneISO && ` · last ${fmtDate(s.rule.lastDoneISO)}`}
                  {s.rule.lastDoneHours != null && ` · last @${s.rule.lastDoneHours}h`}
                </div>
                <AnimatePresence>
                  {formOpen === s.rule.id ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Provider"
                          className="h-8 w-[130px] rounded-md border border-line bg-panel px-2.5 text-[11.5px] text-ink placeholder:text-faint" />
                        <input type="number" min={0} value={cost} onChange={(e) => setCost(Number(e.target.value))} placeholder="Cost"
                          className="h-8 w-[90px] rounded-md border border-line bg-panel px-2.5 text-[11.5px] text-ink placeholder:text-faint" />
                        <button onClick={() => submitLog(s.rule.label)}
                          className="h-8 rounded-md border border-teal/60 bg-teal/12 px-3 text-[11px] font-semibold tracking-wider text-teal hover:bg-teal/20">
                          LOG SERVICE
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <button onClick={() => setFormOpen(s.rule.id)} className="mt-2 text-[10.5px] font-semibold tracking-wider text-sky hover:text-ink">
                      + LOG COMPLETION
                    </button>
                  )}
                </AnimatePresence>
              </div>
            ))}
            {services.length === 0 && <p className="text-[12px] text-faint">No preventive rules defined for this asset.</p>}
          </div>
        </div>
      </div>

      {/* ledger */}
      <div className="panel p-5">
        <span className="tech-label">Service & Repair Ledger · {sorted.length} entries</span>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[11.5px]">
            <thead>
              <tr className="text-[9.5px] tracking-[0.16em] text-faint">
                <th className="pb-2 pr-4 font-medium">DATE</th>
                <th className="pb-2 pr-4 font-medium">PROVIDER</th>
                <th className="pb-2 pr-4 font-medium">ACTION</th>
                <th className="pb-2 pr-4 font-medium">PARTS</th>
                <th className="pb-2 pr-4 font-medium">PARTS WTY</th>
                <th className="pb-2 text-right font-medium">COST</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((l) => (
                <tr key={l.id} className="border-t border-line/70 transition-colors hover:bg-panel2/40">
                  <td className="num py-2.5 pr-4 text-dim">{fmtDate(l.dateISO)}</td>
                  <td className="py-2.5 pr-4 text-ink">{l.provider}</td>
                  <td className="py-2.5 pr-4 text-dim">{l.action}</td>
                  <td className="py-2.5 pr-4 text-dim">{l.parts ?? "—"}</td>
                  <td className="py-2.5 pr-4">{l.warrantyOnPartsMonths ? <span className="chip !py-0.5 !text-[9.5px] !text-teal !border-teal/40">{l.warrantyOnPartsMonths} MO</span> : <span className="text-faint">—</span>}</td>
                  <td className="num py-2.5 text-right text-ink">{l.cost ? fmtMoney(l.cost, d.currency) : "—"}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-faint">No interventions recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* docs */}
      <div className="panel p-5">
        <span className="tech-label">Linked Vault Documents · {docs.length}</span>
        <div className="mt-3 flex flex-wrap gap-2">
          {docs.map((doc) => {
            const I = DOC_ICON[doc.type];
            return (
              <span key={doc.id} className="chip !py-1.5 !text-[11px] hover:border-line2 hover:text-ink">
                <I size={12} className="text-sky" /> {doc.title}
                <span className="text-faint">· {DOC_LABEL[doc.type]}</span>
              </span>
            );
          })}
          {docs.length === 0 && <span className="text-[12px] text-faint">No documents linked — scan one from the Vault.</span>}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- claim modal --------------------------- */

function ClaimModal({
  device: d,
  logs,
  docs,
  onClose,
  onToast,
}: {
  device: Device;
  logs: MaintenanceLog[];
  docs: VaultDocument[];
  onClose: () => void;
  onToast: Props["onToast"];
}) {
  const now = new Date();
  const w = warrantyInfo(d, now);
  const h = computeHealth(d, logs, now);
  const [issue, setIssue] = useState("");
  const docTitles = docs.length ? docs.map((x) => `${DOC_LABEL[x.type]} — ${x.title}`) : ["No vault documents attached"];

  const download = () => {
    downloadFile(`ElectroCare-Claim-${d.serial}.html`, buildClaimHTML(d, { issue, docs: docTitles, logs, warranty: w, health: h.score }));
    onToast("Claim packet downloaded — ready for OEM submission", "ok");
  };
  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({ ref: `EC-${d.serial.slice(-6).toUpperCase()}`, asset: d.name, serial: d.serial, issue, coverage: w, attachments: docTitles }, null, 2),
      );
      onToast("Claim JSON copied to clipboard", "info");
    } catch {
      onToast("Clipboard unavailable in this browser", "warn");
    }
  };

  return (
    <Modal open onClose={onClose} width={640}>
      <div className="p-6">
        <div className="flex items-center justify-between border-b-2 border-line pb-3">
          <div>
            <div className="font-display text-[16px] font-bold tracking-wide text-ink">WARRANTY / INSURANCE CLAIM PACKET</div>
            <div className="num mt-0.5 text-[10.5px] text-faint">
              Ref EC-{d.serial.slice(-6).toUpperCase()} · generated {fmtDate(now.toISOString())}
            </div>
          </div>
          <span
            className="chip !py-1.5 !text-[10px] font-bold"
            style={
              w.remainingDays >= 0
                ? { color: "#2fe0be", borderColor: "#2fe0be66", background: "#2fe0be14" }
                : { color: "#ff6259", borderColor: "#ff625966", background: "#ff625914" }
            }
          >
            {w.remainingDays >= 0 ? `IN WARRANTY · ${w.remainingDays}D LEFT` : "OUT OF WARRANTY"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-[11.5px] sm:grid-cols-4">
          {[
            { l: "ASSET", v: `${d.brand} ${d.name}` },
            { l: "SERIAL", v: d.serial },
            { l: "PURCHASED", v: fmtDate(d.purchaseISO) },
            { l: "HEALTH IDX", v: `${h.score}/100 (grade ${h.grade})` },
          ].map((f) => (
            <div key={f.l} className="rounded-md border border-line bg-panel2/50 px-3 py-2">
              <div className="text-[8.5px] tracking-[0.18em] text-faint">{f.l}</div>
              <div className="num mt-0.5 break-words text-[11px] text-ink">{f.v}</div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="text-[9.5px] tracking-[0.18em] text-faint">REPORTED ISSUE (editable)</div>
          <textarea
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            rows={3}
            placeholder="Describe the fault, when it occurs, error codes…"
            className="mt-1.5 w-full rounded-md border border-line bg-panel p-3 text-[12px] text-ink placeholder:text-faint focus:border-amber/60"
          />
        </div>

        <div className="mt-4">
          <div className="text-[9.5px] tracking-[0.18em] text-faint">AUTO-ASSEMBLED EVIDENCE</div>
          <div className="mt-1.5 space-y-1">
            {docTitles.map((t) => (
              <div key={t} className="flex items-center gap-2 rounded border border-line bg-panel2/40 px-2.5 py-1.5 text-[11.5px] text-dim">
                <ShieldCheck size={12} className="shrink-0 text-teal" /> {t}
              </div>
            ))}
            <div className="flex items-center gap-2 rounded border border-line bg-panel2/40 px-2.5 py-1.5 text-[11.5px] text-dim">
              <ClipboardList size={12} className="shrink-0 text-teal" /> Service history — {logs.length} ledger entries
            </div>
            <div className="flex items-center gap-2 rounded border border-line bg-panel2/40 px-2.5 py-1.5 text-[11.5px] text-dim">
              <Receipt size={12} className="shrink-0 text-teal" /> OCR-verified proof of purchase ({fmtMoney(d.cost, d.currency)})
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button onClick={copyJson} className="flex items-center gap-2 rounded-md border border-line px-4 py-2.5 text-[11.5px] font-semibold tracking-wider text-dim hover:border-line2 hover:text-ink">
            <Copy size={13} /> COPY JSON
          </button>
          <button onClick={download} className="flex items-center gap-2 rounded-md border border-amber/60 bg-amber px-4 py-2.5 text-[11.5px] font-bold tracking-wider text-[#1a1206] transition-all hover:brightness-110">
            <Download size={13} /> DOWNLOAD PACKET
          </button>
        </div>
      </div>
    </Modal>
  );
}
