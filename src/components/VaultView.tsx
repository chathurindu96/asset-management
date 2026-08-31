import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  UploadCloud, FileImage, ShieldCheck, Lock, Receipt, BookOpen, ClipboardList,
  Umbrella, FileSignature, CheckCircle2, Circle, Loader2, X, Link2,
} from "lucide-react";
import type { Device, DocType, ExtractedReceipt, VaultDocument } from "../lib/types";
import { DOC_LABEL, DOC_TYPES } from "../lib/types";
import { fmtDate, mulberry32 } from "../lib/healthEngine";
import { ocrSamples } from "../data/seed";
import { FilterChip, Reveal } from "./ui";

const DOC_ICON: Record<DocType, typeof Receipt> = {
  invoice: Receipt, "warranty-card": ShieldCheck, manual: BookOpen,
  "service-report": ClipboardList, insurance: Umbrella, "claim-form": FileSignature,
};

const PHASES = [
  { id: "ingest", label: "INGEST · hash + format probe" },
  { id: "ocr", label: "OCR · gpt-4o vision (detail=high)" },
  { id: "extract", label: "EXTRACT · JSON-mode structured fields" },
  { id: "validate", label: "VALIDATE · serial checksum + date ISO" },
];

interface Props {
  docs: VaultDocument[];
  devices: Device[];
  onCommit: (doc: VaultDocument) => void;
  onToast: (msg: string, kind?: "ok" | "info" | "warn") => void;
}

export default function VaultView({ docs, devices, onCommit, onToast }: Props) {
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [phase, setPhase] = useState(-1);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [result, setResult] = useState<ExtractedReceipt | null>(null);
  const [scanMeta, setScanMeta] = useState<{ filename: string; sizeKB: number } | null>(null);
  const [linkId, setLinkId] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<DocType | "all">("all");
  const [dragOver, setDragOver] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const push = (msg: string) => setLogLines((l) => [...l, `${stamp()} ${msg}`]);
  const stamp = () => new Date().toLocaleTimeString("en-GB", { hour12: false });

  const start = (filename: string, sizeKB: number, receipt: ExtractedReceipt) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStatus("running");
    setPhase(0);
    setLogLines([]);
    setResult(null);
    const rnd = mulberry32(sizeKB * 7 + filename.length);
    const hash = Array.from({ length: 12 }, () => "0123456789abcdef"[Math.floor(rnd() * 16)]).join("");
    const sched = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

    push(`ingest: ${filename} · ${sizeKB} KB · sha256 ${hash}…`);
    sched(() => push("ingest: MIME ok · orientation corrected · DPI 300"), 420);
    sched(() => { setPhase(1); push("ocr: dispatching to vision endpoint…"); }, 700);
    sched(() => push("ocr: 14 text blocks · 2 barcode regions · skew 0.4°"), 1350);
    sched(() => push(`ocr: merchant line → "${receipt.merchant}" (p=0.98)`), 1750);
    sched(() => { setPhase(2); push("extract: JSON schema enforced · temperature 0"); }, 2250);
    sched(() => push(`extract: serial ${receipt.serial} · ${(receipt.warrantyMonths / 12).toFixed(1)}y standard${receipt.extendedMonths ? ` +${receipt.extendedMonths}mo ext` : ""}`), 2750);
    sched(() => { setPhase(3); push("validate: checksum PASS · dates normalized to ISO-8601"); }, 3200);
    sched(() => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      setPhase(4);
      setStatus("done");
      setResult({ ...receipt, purchaseISO: today.toISOString() });
      const match = devices.find((d) => d.brand.toLowerCase() === receipt.brand.toLowerCase()) ?? null;
      setLinkId(match?.id ?? "");
      push("validate: ExtractedReceipt ready — awaiting operator commit");
    }, 3750);
  };

  const cancel = () => {
    timers.current.forEach(clearTimeout);
    setStatus("idle");
    setPhase(-1);
    setLogLines([]);
    setResult(null);
  };

  const commit = () => {
    if (!result || !scanMeta) return;
    onCommit({
      id: `doc-${Date.now()}`,
      deviceId: linkId || null,
      type: result.docType,
      title: `${result.merchant.split("·")[0].trim()} — ${result.model}`,
      sizeKB: scanMeta.sizeKB,
      addedISO: new Date().toISOString(),
      encrypted: true,
      source: "ocr",
    });
    onToast(`Parsed ${result.docType.replace("-", " ")} committed to vault`, "ok");
    cancel();
  };

  const onFile = (name: string, size: number) => {
    const sample = ocrSamples[Math.floor(Math.random() * ocrSamples.length)].receipt;
    start(name, Math.max(64, Math.round(size / 1024)), sample);
  };

  const filteredDocs = useMemo(
    () => (typeFilter === "all" ? docs : docs.filter((d) => d.type === typeFilter)),
    [docs, typeFilter],
  );
  const deviceName = (id: string | null) => devices.find((d) => d.id === id)?.name ?? "Unassigned";

  return (
    <div className="space-y-5">
      {/* scanner */}
      <Reveal>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_400px]">
          {/* dropzone + console */}
          <div className="panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="tech-label flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-teal pulse-dot" /> OCR INTAKE PIPELINE
              </span>
              {status === "running" && (
                <button onClick={cancel} className="chip hover:border-coral/60 hover:text-coral">
                  <X size={11} /> ABORT
                </button>
              )}
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) onFile(f.name, f.size);
              }}
              className={`relative overflow-hidden rounded-lg border border-dashed p-6 transition-colors ${
                dragOver ? "border-teal/70 bg-teal/[0.06]" : "border-line bg-panel2/30"
              }`}
            >
              {status === "running" && (
                <div className="scan-sweep pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent via-teal/15 to-transparent" />
              )}
              <div className="flex flex-wrap items-center gap-4">
                <UploadCloud size={30} className={dragOver ? "text-teal" : "text-faint"} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[14px] font-semibold text-ink">
                    Drop a receipt, warranty card or invoice
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-faint">
                    JPG / PNG / PDF up to 12 MB — parsed by the vision λ, encrypted AES-256-GCM before S3 upload.
                  </div>
                </div>
                <label className="cursor-pointer rounded-md border border-line px-3.5 py-2.5 text-[11px] font-semibold tracking-wider text-dim transition-colors hover:border-line2 hover:text-ink">
                  BROWSE
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onFile(f.name, f.size);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/70 pt-3.5">
                <span className="text-[9.5px] tracking-[0.18em] text-faint">DEMO SCANS:</span>
                {ocrSamples.map((s) => (
                  <button key={s.id} onClick={() => start(s.filename, s.sizeKB, s.receipt)} className="chip hover:border-teal/60 hover:text-teal">
                    <FileImage size={11} /> {s.filename}
                  </button>
                ))}
              </div>
            </div>

            {/* console */}
            <div className="mt-4 rounded-lg border border-line bg-[#0a101d] p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PHASES.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-1.5 text-[10px]">
                    {phase > i || status === "done" ? (
                      <CheckCircle2 size={12} className="text-teal" />
                    ) : phase === i ? (
                      <Loader2 size={12} className="animate-spin text-amber" />
                    ) : (
                      <Circle size={12} className="text-faint" />
                    )}
                    <span className={phase === i ? "text-ink" : "text-faint"}>{p.label}</span>
                  </div>
                ))}
              </div>
              <div className="num mt-3 h-[124px] overflow-y-auto border-t border-line/70 pt-2.5 text-[11px] leading-relaxed text-dim">
                {logLines.length === 0 && status === "idle" && (
                  <span className="text-faint">// pipeline idle — awaiting document<span className="blink-caret">▌</span></span>
                )}
                {logLines.map((l, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="whitespace-pre-wrap">
                    <span className="text-teal">›</span> {l}
                  </motion.div>
                ))}
                {status === "running" && <span className="blink-caret text-teal">▌</span>}
              </div>
            </div>
          </div>

          {/* extraction result */}
          <div className="panel flex flex-col p-5">
            <span className="tech-label">ExtractedReceipt · structured output</span>
            <AnimatePresence mode="wait">
              {status === "done" && result ? (
                <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 flex flex-1 flex-col">
                  <div className="space-y-2.5">
                    {(
                      [
                        ["merchant", result.merchant],
                        ["brand / model", `${result.brand} ${result.model}`],
                        ["serial / IMEI", result.serial],
                        ["purchase date", fmtDate(result.purchaseISO)],
                        ["cost", `${result.cost.toFixed(2)} ${result.currency}`],
                        ["warranty", `${result.warrantyMonths} mo${result.extendedMonths ? ` + ${result.extendedMonths} mo ext` : ""}`],
                        ["doc type", DOC_LABEL[result.docType]],
                        ["category (suggested)", result.categorySuggestion.toUpperCase()],
                      ] as [string, string][]
                    ).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-3 border-b border-line/60 pb-2 text-[12px]">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-faint">{k}</span>
                        <span className="num truncate text-right text-ink">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-5 gap-1.5">
                    {Object.entries(result.confidence).map(([k, v]) => (
                      <div key={k}>
                        <div className="text-center text-[8.5px] uppercase tracking-wider text-faint">{k}</div>
                        <div className="mt-1 h-[4px] overflow-hidden rounded-sm bg-[#1a2440]">
                          <motion.div
                            className="h-full rounded-sm"
                            style={{ background: v > 0.9 ? "#2fe0be" : "#ffb224" }}
                            initial={{ width: 0 }}
                            animate={{ width: `${v * 100}%` }}
                            transition={{ duration: 0.7, delay: 0.2 }}
                          />
                        </div>
                        <div className="num mt-0.5 text-center text-[9px] text-dim">{Math.round(v * 100)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Link2 size={13} className="text-faint" />
                    <select
                      value={linkId}
                      onChange={(e) => setLinkId(e.target.value)}
                      className="h-9 flex-1 rounded-md border border-line bg-panel px-2.5 text-[11.5px] text-ink"
                    >
                      <option value="">Link to asset — unassigned</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>{d.brand} {d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={commit}
                      className="flex-1 rounded-md border border-teal/60 bg-teal/15 py-2.5 text-[12px] font-bold tracking-wider text-teal transition-all hover:bg-teal/25"
                    >
                      COMMIT TO VAULT
                    </button>
                    <button onClick={cancel} className="rounded-md border border-line px-4 text-[11px] font-semibold tracking-wider text-dim hover:text-ink">
                      DISCARD
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                  <svg width="54" height="54" viewBox="0 0 48 48" fill="none" className="float-y opacity-70">
                    <rect x="6" y="8" width="36" height="32" rx="3" stroke="#2c3d63" strokeWidth="1.6" />
                    <path d="M6 18h36M14 26h12M14 32h20" stroke="#2c3d63" strokeWidth="1.6" strokeLinecap="round" />
                    <circle cx="34" cy="26" r="4.5" stroke="#2fe0be" strokeWidth="1.6" />
                    <path d="M37.5 29.5 41 33" stroke="#2fe0be" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <p className="max-w-[240px] text-[11.5px] leading-relaxed text-faint">
                    Structured fields land here: merchant, serial, purchase date, cost, warranty months and category suggestion — with per-field confidence.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Reveal>

      {/* vault grid */}
      <Reveal delay={0.08}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="tech-label mr-1">VAULT OBJECTS · {filteredDocs.length}</span>
          <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>ALL</FilterChip>
          {DOC_TYPES.map((t) => (
            <FilterChip key={t.id} active={typeFilter === t.id} color="#6fb3ff" onClick={() => setTypeFilter(typeFilter === t.id ? "all" : t.id)}>
              {t.label.toUpperCase()}
            </FilterChip>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {filteredDocs.map((doc, i) => {
              const I = DOC_ICON[doc.type];
              return (
                <motion.div
                  key={doc.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                  className="panel panel-live flex items-start gap-3 p-4"
                >
                  <span className="rounded-md border border-line bg-panel2 p-2.5 text-sky"><I size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold text-ink">{doc.title}</div>
                    <div className="mt-0.5 text-[10.5px] text-faint">{DOC_LABEL[doc.type]} · {deviceName(doc.deviceId)}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="chip !py-0.5 !text-[9px]"><Lock size={9} /> AES-256-GCM</span>
                      <span className="chip !py-0.5 !text-[9px]">{doc.source === "ocr" ? "OCR PARSED" : "MANUAL"}</span>
                      <span className="num chip !py-0.5 !text-[9px]">{doc.sizeKB} KB · {fmtDate(doc.addedISO)}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </Reveal>
    </div>
  );
}
