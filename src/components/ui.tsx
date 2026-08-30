import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

/* ------------------------------ Reveal ----------------------------- */

export function Reveal({
  children,
  delay = 0,
  className,
  y = 18,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 0.9, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------ CountUp ---------------------------- */

export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 900,
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || started.current) return;
        started.current = true;
        const t0 = performance.now();
        const step = (t: number) => {
          const p = Math.min(1, (t - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setDisplay(value * eased);
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        io.disconnect();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/* ------------------------------ Toggle ------------------------------ */

export function Toggle({
  on,
  onChange,
  color = "#2fe0be",
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  color?: string;
  label?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label ?? "toggle"}
      onClick={() => onChange(!on)}
      className="relative h-[18px] w-[34px] shrink-0 rounded-full border transition-colors duration-200"
      style={{
        background: on ? `${color}26` : "rgba(20,29,49,0.8)",
        borderColor: on ? `${color}88` : "var(--color-line)",
      }}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 32 }}
        className="absolute top-[2px] h-[12px] w-[12px] rounded-full"
        style={{ left: on ? 18 : 3, background: on ? color : "var(--color-faint)" }}
      />
    </button>
  );
}

/* ------------------------------ FilterChip -------------------------- */

export function FilterChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="chip transition-all duration-200 hover:-translate-y-px"
      style={
        active
          ? { borderColor: `${color ?? "#ffb224"}99`, color: color ?? "#ffb224", background: `${color ?? "#ffb224"}14` }
          : undefined
      }
    >
      {children}
    </button>
  );
}

/* -------------------------------- Modal ----------------------------- */

export function Modal({
  open,
  onClose,
  children,
  width = 620,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[#04070e]/80 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.22, 0.9, 0.3, 1] }}
            className="panel relative max-h-[88vh] w-full overflow-y-auto shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
            style={{ maxWidth: width }}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 rounded-md border border-line bg-panel2 p-1.5 text-dim transition-colors hover:border-line2 hover:text-ink"
            >
              <X size={14} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------- Toasts ---------------------------- */

export interface Toast {
  id: number;
  msg: string;
  kind: "ok" | "info" | "warn";
}

export function ToastHost({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  const icon = {
    ok: <CheckCircle2 size={15} className="text-teal" />,
    info: <Info size={15} className="text-sky" />,
    warn: <AlertTriangle size={15} className="text-amber" />,
  };
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[320px] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 30, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="panel pointer-events-auto flex items-center gap-2.5 border-l-2 px-3.5 py-3 text-[13px] shadow-xl"
            style={{ borderLeftColor: t.kind === "ok" ? "#2fe0be" : t.kind === "warn" ? "#ffb224" : "#6fb3ff" }}
            onClick={() => dismiss(t.id)}
          >
            {icon[t.kind]}
            <span className="text-ink/90">{t.msg}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
