import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Boxes, ScanLine, BellRing, Braces, Search } from "lucide-react";
import type { ViewId } from "../lib/types";

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <path
        d="M20 2 35.6 11v18L20 38 4.4 29V11L20 2Z"
        stroke="#ffb224"
        strokeWidth="2.2"
        fill="rgba(255,178,36,0.07)"
      />
      <path d="M22.5 9 13 22h5.4L17 31l10-13.6h-5.8L22.5 9Z" fill="#ffb224" />
    </svg>
  );
}

const NAV: { id: ViewId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Command", icon: LayoutDashboard },
  { id: "assets", label: "Assets", icon: Boxes },
  { id: "vault", label: "Vault · OCR", icon: ScanLine },
  { id: "alerts", label: "Alerts", icon: BellRing },
  { id: "blueprint", label: "Blueprint", icon: Braces },
];

const VIEW_TITLE: Record<ViewId, string> = {
  overview: "Fleet Command",
  assets: "Asset Registry",
  vault: "Document Vault · OCR Parser",
  alerts: "Predictive Alerting Matrix",
  blueprint: "Systems Blueprint",
};

export function TopBar({
  view,
  query,
  onQuery,
  alertCount,
}: {
  view: ViewId;
  query: string;
  onQuery: (q: string) => void;
  alertCount: number;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const clock = now.toLocaleTimeString("en-GB", { hour12: false });

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-4 border-b border-line bg-bg/85 px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-2.5">
        <BrandMark />
        <div className="leading-none">
          <div className="font-display text-[15px] font-bold tracking-[0.12em] text-ink">
            ELECTRO<span className="text-amber">CARE</span>
          </div>
          <div className="mt-0.5 text-[8.5px] font-medium tracking-[0.3em] text-faint">ASSET LIFECYCLE OS</div>
        </div>
      </div>

      <div className="mx-2 hidden h-6 w-px bg-line sm:block" />
      <span className="tech-label hidden sm:block">{VIEW_TITLE[view]}</span>

      <div className="ml-auto flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search serial, brand, asset…"
            className="h-8 w-[230px] rounded-md border border-line bg-panel pl-8 pr-3 text-[12px] text-ink placeholder:text-faint transition-colors focus:border-amber/60"
          />
        </div>

        <div className="num hidden text-[12px] text-dim sm:block">{clock} UTC</div>

        <div
          className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.14em] ${
            alertCount > 3
              ? "border-coral/50 bg-coral/10 text-coral"
              : "border-teal/40 bg-teal/10 text-teal"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${alertCount > 3 ? "bg-coral pulse-dot-red" : "bg-teal pulse-dot"}`} />
          {alertCount > 3 ? "ATTENTION" : "NOMINAL"}
        </div>
      </div>
    </header>
  );
}

function RailItem({
  item,
  active,
  onClick,
  badge,
  compact,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  onClick: () => void;
  badge?: number;
  compact?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
        compact ? "flex-1 flex-col gap-1 px-1 py-1.5 text-[9px]" : "w-full"
      } ${active ? "text-amber" : "text-dim hover:text-ink"}`}
    >
      {active && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 rounded-lg border border-amber/35 bg-amber/10"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      <span className="relative">
        <Icon size={compact ? 17 : 16} strokeWidth={active ? 2.2 : 1.8} />
        {badge != null && badge > 0 && (
          <span className="num absolute -right-2 -top-1.5 rounded-sm bg-coral px-1 text-[9px] font-semibold leading-[13px] text-[#1a0505]">
            {badge}
          </span>
        )}
      </span>
      <span className={`relative tracking-wide ${compact ? "" : "font-display"}`}>{item.label}</span>
    </button>
  );
}

export function NavRail({
  view,
  setView,
  alertCount,
}: {
  view: ViewId;
  setView: (v: ViewId) => void;
  alertCount: number;
}) {
  return (
    <>
      <aside className="fixed bottom-0 left-0 top-14 z-30 hidden w-16 flex-col border-r border-line bg-panel/60 px-2.5 py-4 backdrop-blur-md lg:flex xl:w-48">
        <nav className="space-y-1">
          {NAV.map((n) => (
            <RailItem
              key={n.id}
              item={n}
              active={view === n.id}
              onClick={() => setView(n.id)}
              badge={n.id === "alerts" ? alertCount : undefined}
            />
          ))}
        </nav>
        <div className="mt-auto space-y-2">
          <div className="rounded-md border border-line bg-panel2 px-2 py-2 text-center xl:text-left">
            <div className="num text-[9.5px] text-faint">core v2.4.1 · 8f3ca2</div>
            <div className="mt-1 flex items-center justify-center gap-1.5 text-[9px] tracking-wider text-teal xl:justify-start">
              <span className="h-1 w-1 rounded-full bg-teal pulse-dot" /> OFFLINE-READY
            </div>
          </div>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-panel/95 px-2 py-1 backdrop-blur-md lg:hidden">
        {NAV.map((n) => (
          <RailItem
            key={n.id}
            item={n}
            compact
            active={view === n.id}
            onClick={() => setView(n.id)}
            badge={n.id === "alerts" ? alertCount : undefined}
          />
        ))}
      </nav>
    </>
  );
}
