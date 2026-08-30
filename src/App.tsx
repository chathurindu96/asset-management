import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CategoryId, MaintenanceLog, RuleSet, VaultDocument, ViewId } from "./lib/types";
import { buildAlerts, computeHealth } from "./lib/healthEngine";
import { defaultRules, seedDevices, seedDocs, seedLogs } from "./data/seed";
import { NavRail, TopBar } from "./components/shell";
import { ToastHost, type Toast } from "./components/ui";
import Dashboard from "./components/Dashboard";
import AssetsView from "./components/AssetsView";
import VaultView from "./components/VaultView";
import AlertsView from "./components/AlertsView";
import BlueprintView from "./components/BlueprintView";

export default function App() {
  const [view, setView] = useState<ViewId>("overview");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>("dev-mbp");
  const [devices, setDevices] = useState(seedDevices);
  const [logs, setLogs] = useState<MaintenanceLog[]>(seedLogs);
  const [docs, setDocs] = useState<VaultDocument[]>(seedDocs);
  const [rules, setRules] = useState<RuleSet>(defaultRules);
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((msg: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  const logsByDevice = useMemo(() => {
    const m: Record<string, MaintenanceLog[]> = {};
    for (const l of logs) (m[l.deviceId] ??= []).push(l);
    return m;
  }, [logs]);

  const alerts = useMemo(
    () => buildAlerts(devices, logsByDevice, rules).filter((a) => !acked.has(a.id)),
    [devices, logsByDevice, rules, acked],
  );

  /* ----------------------------- actions ---------------------------- */

  const ack = (id: string) => {
    setAcked((s) => new Set(s).add(id));
    toast("Alert acknowledged", "info");
  };

  const completeSchedule = (deviceId: string, label: string) =>
    setDevices((ds) =>
      ds.map((d) =>
        d.id !== deviceId
          ? d
          : {
              ...d,
              schedules: d.schedules.map((s) =>
                s.label !== label
                  ? s
                  : s.kind === "time"
                    ? { ...s, lastDoneISO: new Date().toISOString() }
                    : { ...s, lastDoneHours: d.meta.runtimeHours ?? 0 },
              ),
            },
      ),
    );

  const quickService = (deviceId: string, label: string) => {
    const dev = devices.find((d) => d.id === deviceId)!;
    const before = computeHealth(dev, logsByDevice[deviceId] ?? []).score;
    const entry: MaintenanceLog = {
      id: `log-${Date.now()}`,
      deviceId,
      dateISO: new Date().toISOString(),
      provider: "Self",
      action: `${label} — completed`,
      cost: 0,
    };
    const rescheduled = {
      ...dev,
      schedules: dev.schedules.map((s) =>
        s.label !== label
          ? s
          : s.kind === "time"
            ? { ...s, lastDoneISO: new Date().toISOString() }
            : { ...s, lastDoneHours: dev.meta.runtimeHours ?? 0 },
      ),
    };
    setLogs((l) => [...l, entry]);
    completeSchedule(deviceId, label);
    const after = computeHealth(rescheduled, [...(logsByDevice[deviceId] ?? []), entry]).score;
    const delta = after - before;
    toast(`${label} logged · health ${before} → ${after}${delta >= 0 ? ` (+${delta})` : ""}`, "ok");
  };

  const logService = (deviceId: string, e: { provider: string; action: string; cost: number }) => {
    const before = computeHealth(
      devices.find((d) => d.id === deviceId)!,
      logsByDevice[deviceId] ?? [],
    ).score;
    const entry: MaintenanceLog = {
      id: `log-${Date.now()}`,
      deviceId,
      dateISO: new Date().toISOString(),
      ...e,
    };
    setLogs((l) => [...l, entry]);
    const after = computeHealth(devices.find((d) => d.id === deviceId)!, [...(logsByDevice[deviceId] ?? []), entry]).score;
    const delta = after - before;
    toast(`Ledger updated · health ${before} → ${after}${delta >= 0 ? ` (+${delta})` : ""}`, "ok");
  };

  const commitDoc = (doc: VaultDocument) => setDocs((d) => [doc, ...d]);

  const openAsset = (id: string) => {
    setSelectedId(id);
    setView("assets");
  };

  /* ------------------------------ render ---------------------------- */

  return (
    <div className="min-h-screen">
      <TopBar
        view={view}
        query={query}
        onQuery={(q) => {
          setQuery(q);
          if (q && view !== "assets") setView("assets");
        }}
        alertCount={alerts.length}
      />
      <NavRail view={view} setView={setView} alertCount={alerts.length} />

      <main className="pt-14 lg:pl-16 xl:pl-48">
        <div className="mx-auto max-w-[1380px] px-4 py-5 pb-24 lg:px-6 lg:pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.22, 0.9, 0.3, 1] }}
            >
              {view === "overview" && (
                <Dashboard
                  devices={devices}
                  logs={logs}
                  docs={docs}
                  alerts={alerts}
                  onOpenAsset={openAsset}
                  onNavigate={setView}
                  onAck={ack}
                  onQuickService={quickService}
                  category={category}
                  setCategory={setCategory}
                />
              )}
              {view === "assets" && (
                <AssetsView
                  devices={devices}
                  logs={logs}
                  docs={docs}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  query={query}
                  onLogService={logService}
                  onToast={toast}
                />
              )}
              {view === "vault" && <VaultView docs={docs} devices={devices} onCommit={commitDoc} onToast={toast} />}
              {view === "alerts" && (
                <AlertsView alerts={alerts} ackedCount={acked.size} rules={rules} onRules={setRules} onAck={ack} />
              )}
              {view === "blueprint" && <BlueprintView />}
            </motion.div>
          </AnimatePresence>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 pb-6">
            <span className="num text-[10px] text-faint">ElectroCare OS · core v2.4.1 · demo telemetry seeded from live models</span>
            <span className="num text-[10px] text-faint">schema 11 models · parser λ p95 3.8 s · scheduler queue {alerts.length} pending</span>
          </footer>
        </div>
      </main>

      <ToastHost toasts={toasts} dismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}
