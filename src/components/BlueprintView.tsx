import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Database, Cpu, Cloud, BellRing, ScanLine, Smartphone } from "lucide-react";
import SCHEMA from "../blueprint/schema.prisma?raw";
import PARSER from "../blueprint/ocrParser.ts?raw";
import ENGINE from "../lib/healthEngine.ts?raw";
import { Reveal } from "./ui";

/* --------------------------- tiny highlighter ----------------------- */

type Tok = { text: string; cls: string };

const KW_TS =
  "import|export|from|const|let|async|await|function|return|if|else|for|of|in|new|type|interface|extends|class|default|switch|case|break|continue|try|catch|throw|typeof|keyof|readonly|as|void|null|undefined|true|false|this";
const KW_PRISMA =
  "model|enum|generator|datasource|provider|url|env|relation|fields|references|onDelete|default|unique|index|map|updatedAt|now|true|false";

function tokenize(code: string, lang: "ts" | "prisma"): Tok[] {
  const kw = lang === "ts" ? KW_TS : KW_PRISMA;
  const re = new RegExp(
    `(\\/\\/[^\\n]*)|(\\/\\*[\\s\\S]*?\\*\\/)|("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\`(?:[^\`\\\\]|\\\\.)*\`)|(@{1,2}[A-Za-z_][\\w.]*)|(\\b(?:${kw})\\b)|(\\b\\d[\\d_.]*\\b)|(\\b[A-Z][A-Za-z0-9_]*\\b)`,
    "g",
  );
  const toks: Tok[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m.index > last) toks.push({ text: code.slice(last, m.index), cls: "" });
    const cls = m[1] || m[2] ? "tok-com" : m[3] ? "tok-str" : m[4] || m[5] ? "tok-kw" : m[6] ? "tok-num" : "tok-type";
    toks.push({ text: m[0], cls });
    last = m.index + m[0].length;
  }
  if (last < code.length) toks.push({ text: code.slice(last), cls: "" });
  return toks;
}

function CodePane({ code, lang }: { code: string; lang: "ts" | "prisma" }) {
  const lines = useMemo(() => {
    const toks = tokenize(code, lang);
    const out: Tok[][] = [[]];
    for (const t of toks) {
      const parts = t.text.split("\n");
      parts.forEach((p, i) => {
        if (i > 0) out.push([]);
        if (p) out[out.length - 1].push({ text: p, cls: t.cls });
      });
    }
    return out;
  }, [code, lang]);

  return (
    <div className="code-scroll max-h-[520px] overflow-auto rounded-lg border border-line bg-[#0a101d] p-4">
      {lines.map((ln, i) => (
        <div key={i} className="flex">
          <span className="w-9 shrink-0 select-none pr-3 text-right text-faint/45">{i + 1}</span>
          <span className="whitespace-pre">
            {ln.map((t, j) => (
              <span key={j} className={t.cls}>{t.text}</span>
            ))}
            {ln.length === 0 && " "}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ diagram ----------------------------- */

function FlowBox({ x, y, w, label, sub, color }: { x: number; y: number; w: number; label: string; sub: string; color: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={46} rx={6} fill="#141d31" stroke={color} strokeOpacity={0.55} />
      <text x={x + w / 2} y={y + 19} textAnchor="middle" fill="#e9effa" fontSize="11" fontFamily="Chakra Petch, sans-serif" fontWeight={600}>
        {label}
      </text>
      <text x={x + w / 2} y={y + 34} textAnchor="middle" fill="#8b99b6" fontSize="8.5" fontFamily="IBM Plex Mono, monospace">
        {sub}
      </text>
    </g>
  );
}

function Flow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const mid = (y1 + y2) / 2;
  return (
    <path
      d={`M${x1},${y1} C${x1},${mid} ${x2},${mid} ${x2},${y2}`}
      fill="none"
      stroke="#2c3d63"
      strokeWidth="1.4"
      strokeDasharray="5 4"
      className="dash-flow"
    />
  );
}

const STACK = [
  "Next.js 15 · App Router", "React 19", "Tailwind CSS v4", "Framer Motion", "Lucide",
  "Prisma ORM · PostgreSQL 16", "Redis 7 · ZSET scheduler", "OpenAI Vision gpt-4o",
  "S3 / GCS + KMS envelope encryption", "Expo · SQLite offline sync", "TypeScript strict monorepo",
];

const DEPLOY_NOTES = [
  ["01", "Partition UsageTelemetry monthly with pg_partman (or TimescaleDB hypertables) — retention 24 months hot, then columnar cold storage."],
  ["02", "Row-level security per tenant_id on every table; Prisma middleware injects the tenant scope from the JWT."],
  ["03", "Vault objects encrypted client-side with AES-256-GCM; DEKs wrapped by KMS — the API never sees plaintext."],
  ["04", "OCR results cached by sha256 of the upload; p95 parse budget 4 s, with a Tesseract.js fallback worker for on-prem installs."],
  ["05", "Nightly cron hydrates Redis ZSETs (warranty / service / health) from Postgres; scheduler worker fans out to push, SMTP, WhatsApp Business and ICS."],
  ["06", "Claim PDFs built idempotently in a worker (pdfkit) keyed by claim reference; status machine draft → submitted → settled."],
  ["07", "Expo client syncs via an outbox queue with tombstones — full offline-first capture of receipts and meter readings."],
];

/* ------------------------------- view ------------------------------- */

export default function BlueprintView() {
  const tabs = [
    { id: "schema", file: "apps/api/prisma/schema.prisma", lang: "prisma" as const, code: SCHEMA },
    { id: "parser", file: "apps/api/functions/ocr-parser.ts", lang: "ts" as const, code: PARSER },
    { id: "engine", file: "apps/core/src/lifecycle/healthEngine.ts", lang: "ts" as const, code: ENGINE },
  ];
  const [tab, setTab] = useState("schema");
  const [copied, setCopied] = useState(false);
  const active = tabs.find((t) => t.id === tab)!;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(active.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="space-y-5">
      {/* dataflow */}
      <Reveal>
        <div className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="tech-label flex items-center gap-2">
              <span className="inline-block h-[5px] w-[5px] rotate-45 bg-amber" /> SYSTEM DATAFLOW
            </span>
            <span className="num text-[10px] text-faint">monorepo · apps/{`{web, api, mobile}`} · packages/core</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <svg viewBox="0 0 780 300" className="mx-auto block w-full max-w-[780px]">
              <FlowBox x={20} y={30} w={170} label="Web · Next.js 15" sub="App Router + RSC" color="#6fb3ff" />
              <FlowBox x={20} y={110} w={170} label="Mobile · Expo" sub="SQLite offline outbox" color="#6fb3ff" />
              <FlowBox x={290} y={70} w={190} label="API Gateway" sub="route handlers · tRPC" color="#a8e05f" />
              <FlowBox x={560} y={8} w={200} label="OCR Parser λ" sub="gpt-4o vision + zod" color="#2fe0be" />
              <FlowBox x={560} y={78} w={200} label="Lifecycle Engine" sub="healthEngine.ts · pure TS" color="#ffb224" />
              <FlowBox x={560} y={148} w={200} label="PostgreSQL 16" sub="Prisma · JSONB specs" color="#a8e05f" />
              <FlowBox x={290} y={208} w={190} label="Redis 7" sub="ZSET notification queues" color="#ff6259" />
              <FlowBox x={560} y={238} w={200} label="Notifier" sub="push · mail · WA · ICS" color="#ff6259" />
              <FlowBox x={20} y={208} w={170} label="S3 / GCS Vault" sub="KMS envelope enc." color="#2fe0be" />

              <Flow x1={190} y1={53} x2={290} y2={85} />
              <Flow x1={190} y1={133} x2={290} y2={100} />
              <Flow x1={480} y1={82} x2={560} y2={31} />
              <Flow x1={480} y1={93} x2={560} y2={98} />
              <Flow x1={660} y1={54} x2={660} y2={148} />
              <Flow x1={480} y1={104} x2={560} y2={165} />
              <Flow x1={660} y1={124} x2={660} y2={148} />
              <Flow x1={385} y1={116} x2={385} y2={208} />
              <Flow x1={480} y1={231} x2={560} y2={255} />
              <Flow x1={190} y1={231} x2={290} y2={231} />
              <Flow x1={640} y1={194} x2={480} y2={225} />
            </svg>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {STACK.map((s) => (
              <span key={s} className="chip hover:border-line2 hover:text-ink">{s}</span>
            ))}
          </div>
        </div>
      </Reveal>

      {/* code console */}
      <Reveal delay={0.06}>
        <div className="panel p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tech-label mr-2">SOURCE ARTIFACTS</span>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative rounded-md px-3 py-2 text-[11px] font-semibold tracking-wide transition-colors ${
                  tab === t.id ? "text-amber" : "text-dim hover:text-ink"
                }`}
              >
                {tab === t.id && (
                  <motion.span layoutId="code-tab" className="absolute inset-0 rounded-md border border-amber/40 bg-amber/10" />
                )}
                <span className="num relative">{t.file.split("/").pop()}</span>
              </button>
            ))}
            <button onClick={copy} className="ml-auto flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-[10.5px] font-semibold tracking-wider text-dim transition-colors hover:border-teal/60 hover:text-teal">
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "COPIED" : "COPY"}
            </button>
          </div>
          <div className="num mt-2 text-[10px] text-faint">{active.file} · {active.code.split("\n").length} lines</div>
          <div className="mt-3">
            <CodePane key={tab} code={active.code} lang={active.lang} />
          </div>
        </div>
      </Reveal>

      {/* module notes + deployment */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal delay={0.08}>
          <div className="panel h-full p-5">
            <span className="tech-label">Core Modules</span>
            <div className="mt-4 space-y-3">
              {[
                { i: ScanLine, c: "#2fe0be", t: "OCR Document Vault", d: "Camera/PDF intake → vision-LLM structured extraction → per-field confidence → KMS-encrypted S3 storage with client-side access control." },
                { i: Cpu, c: "#a8e05f", t: "Category-Aware Lifecycle Engine", d: "Portable: charge cycles + SOH. HVAC: run-hours + compressor cycles. IT: uptime + kWh. Industrial: vibration, oil/coolant cadence, power factor." },
                { i: BellRing, c: "#ffb224", t: "Predictive Alerting Matrix", d: "Configurable 60/30/7/0-day warranty cadence across push, email, WhatsApp and calendar sync — scheduled on Redis sorted sets." },
                { i: Smartphone, c: "#6fb3ff", t: "Offline-First Mobile", d: "Expo client captures receipts and meter readings offline; SQLite outbox replays with tombstone-aware merge on reconnect." },
              ].map((m) => (
                <div key={m.t} className="flex gap-3 rounded-md border border-line bg-panel2/40 p-3.5 transition-colors hover:border-line2">
                  <m.i size={17} className="mt-0.5 shrink-0" style={{ color: m.c }} />
                  <div>
                    <div className="font-display text-[13px] font-semibold text-ink">{m.t}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-dim">{m.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="panel h-full p-5">
            <span className="tech-label flex items-center gap-2"><Database size={12} /> Deployment & Ops Notes</span>
            <div className="mt-4 space-y-2.5">
              {DEPLOY_NOTES.map(([n, txt]) => (
                <div key={n} className="flex gap-3 rounded-md border border-line bg-panel2/40 px-3.5 py-2.5">
                  <span className="num text-[11px] font-semibold text-amber">{n}</span>
                  <p className="text-[11px] leading-relaxed text-dim">{txt}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-line bg-panel2/40 px-3.5 py-2.5">
              <Cloud size={14} className="text-sky" />
              <p className="text-[11px] text-dim">
                Reference topology: Fly.io/EC2 API tier, RDS Postgres multi-AZ, ElastiCache Redis, S3 vault with bucket policies — all infra as code in <span className="num text-ink">infra/pulumi</span>.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
