import { useId } from "react";
import { motion } from "framer-motion";
import type { Device } from "../lib/types";
import { CAT } from "../lib/types";
import { healthColor, tierMeta, warrantyInfo } from "../lib/healthEngine";

/* ------------------------------ HealthRing -------------------------- */

export function HealthRing({
  score,
  size = 104,
  stroke = 8,
  children,
}: {
  score: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const color = healthColor(score);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(44,61,99,0.35)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - score / 100) }}
          transition={{ duration: 1.1, ease: [0.22, 0.9, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* ------------------------------- Sparkline -------------------------- */

export function Sparkline({
  points,
  color,
  height = 56,
  capacity,
  decimals = 1,
}: {
  points: number[];
  color: string;
  height?: number;
  capacity?: number;
  decimals?: number;
}) {
  const gid = useId();
  const W = 300;
  const H = 80;
  const min = Math.min(...points, capacity ?? Infinity);
  const max = Math.max(...points, capacity ?? -Infinity);
  const pad = (max - min) * 0.15 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height }} className="block">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {capacity != null && (
        <line
          x1="0"
          x2={W}
          y1={y(capacity)}
          y2={y(capacity)}
          stroke={color}
          strokeOpacity="0.35"
          strokeWidth="1"
          strokeDasharray="4 5"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
      <circle cx={x(points.length - 1)} cy={y(last)} r="3" fill={color}>
        <animate attributeName="opacity" values="1;0.35;1" dur="1.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ------------------------------ FactorBar --------------------------- */

export function FactorBar({ label, value, delay = 0 }: { label: string; value: number; delay?: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="text-dim">{label}</span>
        <span className="num" style={{ color: healthColor(pct) }}>
          {pct}
        </span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-sm bg-[#1a2440]">
        <motion.div
          className="h-full rounded-sm"
          style={{ background: healthColor(pct) }}
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay, ease: [0.22, 0.9, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

/* --------------------------- WarrantyHorizon ------------------------ */

export function WarrantyHorizon({
  devices,
  now,
  onSelect,
  rowH = 30,
}: {
  devices: Device[];
  now: Date;
  onSelect: (id: string) => void;
  rowH?: number;
}) {
  const enriched = devices.map((d) => ({ d, w: warrantyInfo(d, now) }));
  const min = Math.min(...enriched.map((e) => new Date(e.d.purchaseISO).getTime()));
  const max = Math.max(...enriched.map((e) => new Date(e.w.endISO).getTime()), now.getTime() + 90 * 86400000);
  const span = max - min;
  const pct = (t: number) => `${(((t - min) / span) * 100).toFixed(2)}%`;
  const todayPct = pct(now.getTime());

  return (
    <div className="relative">
      {/* today marker */}
      <div className="absolute bottom-0 top-0 z-10 w-px bg-amber/70" style={{ left: todayPct }}>
        <span className="num absolute -top-1 left-1.5 text-[9px] tracking-wider text-amber">NOW</span>
      </div>
      <div className="space-y-[6px]">
        {enriched.map(({ d, w }) => {
          const startT = new Date(d.purchaseISO).getTime();
          const endT = new Date(w.endISO).getTime();
          const elapsedEnd = Math.min(endT, now.getTime());
          const tier = tierMeta[w.tier];
          const remainingColor = w.remainingDays < 0 ? "#3a2430" : tier.color;
          return (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              className="group flex w-full items-center gap-3 text-left"
              style={{ height: rowH }}
            >
              <span className="w-[148px] shrink-0 truncate text-[11.5px] text-dim transition-colors group-hover:text-ink">
                {d.name}
              </span>
              <span className="relative h-[10px] flex-1 overflow-hidden rounded-[3px] bg-[#151e33] ring-1 ring-inset ring-[#1e2a44] transition-shadow group-hover:ring-[#2c3d63]">
                {/* elapsed coverage */}
                <span
                  className="absolute inset-y-0 left-0 opacity-45"
                  style={{
                    width: `${Math.max(0, ((elapsedEnd - startT) / span) * 100)}%`,
                    marginLeft: pct(startT),
                    background: CAT[d.category].color,
                  }}
                />
                {/* remaining coverage */}
                <span
                  className="absolute inset-y-0"
                  style={{
                    left: pct(Math.max(startT, elapsedEnd)),
                    width: `${Math.max(0.4, ((endT - Math.max(startT, elapsedEnd)) / span) * 100)}%`,
                    background: remainingColor,
                    boxShadow: w.tier === "critical" || w.tier === "expired" ? `0 0 8px ${remainingColor}` : undefined,
                  }}
                />
              </span>
              <span className="num w-[74px] shrink-0 text-right text-[11px]" style={{ color: tier.color }}>
                {w.remainingDays < 0 ? `${-w.remainingDays}d ago` : `${w.remainingDays}d`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
