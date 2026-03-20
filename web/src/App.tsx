import { useState, useEffect, useRef } from "react";
import { api, type Recipient, type RecipientDetail, type ScheduleResponse, type PreviewResponse, type PayResponse } from "./lib/api";
import { UnlockScreen } from "./components/UnlockScreen";
import { Modal } from "./components/Modal";
import { Avatar } from "./components/Avatar";
import { PaymentCard } from "./components/PaymentCard";
import { AddRecipientForm } from "./components/AddRecipientForm";
import { EditRecipientForm } from "./components/EditRecipientForm";
import { EditableRecipientInfo } from "./components/EditableRecipientInfo";
import { TelegramSettings } from "./components/TelegramSettings";
import { QRCodeSVG } from "qrcode.react";
import {
  Lock, CheckCircle, Pencil, Settings, Search,
  Plus, Upload, Trash2, Send, X, RefreshCw, Banknote,
} from "lucide-react";

export default function App() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

  useEffect(() => {
    api.status().then((s) => setUnlocked(s.unlocked)).catch(() => setUnlocked(false));
  }, []);

  if (unlocked === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f1e]">
        <div className="text-gray-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!unlocked) {
    return <UnlockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return <MainView onLock={() => { api.lock(); setUnlocked(false); }} />;
}

// ─── Main single-page view ──────────────────────────────────────────────────

function MainView({ onLock }: { onLock: () => void }) {
  // ── State ──
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [payResult, setPayResult] = useState<PayResponse | null>(null);
  const [lastPayment, setLastPayment] = useState<{ totalZec: number; totalUsd: number; count: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [priceLoading, setPriceLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState<boolean | null>(null);

  const [testQr, setTestQr] = useState<{ name: string; uri: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "recurring" | "one-time">("all");
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [detail, setDetail] = useState<RecipientDetail | null>(null);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  // ── Data loading ──
  async function refresh() {
    setLoading(true);
    try {
      const [recData, schedData] = await Promise.all([
        api.getRecipients(),
        api.schedule(),
      ]);
      setRecipients(recData.recipients);
      setSchedule(schedData);
      // Auto-load preview if there are due recipients
      if (schedData.dueCount > 0) {
        try {
          await api.getPrice().then((p) => setPrice(p.price));
          const prev = await api.preview();
          setPreview(prev);
        } catch { /* price or preview may fail, that's ok */ }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    // Also try to get price
    try {
      const p = await api.getPrice();
      setPrice(p.price);
    } catch { /* ok */ }
  }

  useEffect(() => {
    refresh();
    api.getTelegram().then((t) => setTelegramEnabled(t.enabled && !!t.chatId)).catch(() => { });
  }, []);

  async function refreshPrice() {
    setPriceLoading(true);
    try {
      const p = await api.getPrice();
      setPrice(p.price);
      // Refresh preview with new price
      try {
        const prev = await api.preview();
        setPreview(prev);
      } catch { /* ok */ }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch price");
    } finally {
      setPriceLoading(false);
    }
  }

  // ── Recipient detail ──
  async function openDetail(name: string) {
    try {
      const d = await api.getRecipient(name);
      setDetail(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load details");
    }
  }

  // ── Recipient actions ──
  async function handleDelete(name: string) {
    if (!confirm(`Remove ${name} from payroll?`)) return;
    await api.deleteRecipient(name);
    refresh();
  }

  async function handleTestTx(name: string) {
    try {
      const result = await api.testTx(name);
      setTestQr(result);
      refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleConfirmTest(name: string) {
    await api.confirmTest(name);
    refresh();
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      await api.importCsv(text);
      setShowImport(false);
      setError("");
      refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  }

  async function handleLoadSample() {
    try {
      const { csv } = await api.sampleCsv();
      await api.importCsv(csv);
      setShowImport(false);
      setError("");
      refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load sample data");
    }
  }

  // ── Pay actions ──
  async function handlePay() {
    setError("");
    setPayLoading(true);
    try {
      const data = await api.pay();
      setPayResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate payment");
    } finally {
      setPayLoading(false);
    }
  }

  function copyUri(uri: string, label: string) {
    navigator.clipboard.writeText(uri);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  // ── Schedule lookup by name ──
  const scheduleMap = new Map(schedule?.recipients.map((r) => [r.name, r]) ?? []);

  // ── Groups ──
  const groups = [...new Set(recipients.map((r) => r.group).filter(Boolean))] as string[];

  // ── Filtered recipients ──
  const filtered = recipients
    .filter((r) => filter === "all" ? true : filter === "recurring" ? r.schedule !== "one-time" : r.schedule === "one-time")
    .filter((r) => groupFilter === "all" ? true : r.group === groupFilter)
    .filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()));

  // ── Render ──
  return (
    <div className="min-h-screen bg-[#0f0f1e]">
      {/* Header */}
      <header className="border-b border-[#2d2d52] px-8 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <img src="/zec-logo.png" alt="ZEC" className="w-6 h-6" />
          ZEC Payroll
        </h1>
        <button onClick={refreshPrice} disabled={priceLoading}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-amber-400 transition-colors disabled:opacity-50">
          {priceLoading ? "..." : price ? `ZEC $${price.toFixed(2)}` : "Fetch price"}
        </button>
        <div className="flex items-center gap-4">

          <button onClick={() => setShowSettings(true)}
            className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors">
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onLock}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Lock className="w-4 h-4" /> Lock
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 md:p-8 space-y-6">
        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
            {error}
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-300 shrink-0 ml-4"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* ── Pay + Telegram row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pay card */}
          <div className="lg:col-span-2 bg-gradient-to-br from-[#1a1a2e] to-[#13132a] border border-[#2d2d52] rounded-2xl overflow-hidden">
            {lastPayment ? (
              <div className="px-6 pt-5 pb-5">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium uppercase tracking-wider">Payment Confirmed</span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold text-white font-mono tracking-tight">{lastPayment.totalZec.toFixed(4)}</div>
                    <div className="text-gray-500 text-sm mt-1">
                      {lastPayment.totalUsd > 0 && <>≈ ${lastPayment.totalUsd.toFixed(2)} · </>}
                      {lastPayment.count} recipient{lastPayment.count !== 1 ? "s" : ""} paid
                    </div>
                  </div>
                  <img src="/zec-logo.png" alt="ZEC" className="w-10 h-10 opacity-80" />
                </div>
              </div>
            ) : preview ? (
              <>
                <div className="px-6 pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs text-amber-400 font-medium uppercase tracking-wider">Payment Ready</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-3xl font-bold text-white font-mono tracking-tight">{preview.totalZec.toFixed(4)}</div>
                      <div className="text-gray-500 text-sm mt-1">≈ ${preview.totalUsd.toFixed(2)} · {preview.recipientCount} recipient{preview.recipientCount !== 1 ? "s" : ""}</div>
                    </div>
                    <img src="/zec-logo.png" alt="ZEC" className="w-10 h-10 opacity-80" />
                  </div>
                </div>
                <div className="px-6 pb-5">
                  <button onClick={handlePay} disabled={payLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 transition-colors font-medium disabled:opacity-50">
                    {payLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                    Initiate Payment
                  </button>
                </div>
              </>
            ) : (
              <div className="px-5 py-5 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-emerald-400 font-medium">All caught up</span>
                  </div>
                  <div className="text-white text-sm font-medium">No payments due</div>
                  <div className="text-gray-500 text-xs mt-1">All recipients are up to date</div>
                </div>
              </div>
            )}
          </div>

          {/* Telegram card */}
          <button onClick={() => setShowSettings(true)}
              className={`bg-[#1a1a2e] border rounded-2xl px-5 py-5 flex flex-col justify-between text-left transition-colors ${telegramEnabled ? "border-emerald-500/20 hover:border-emerald-500/40" : "border-[#2d2d52] hover:border-amber-500/30"
                }`}>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Send className={`w-4 h-4 ${telegramEnabled ? "text-emerald-400" : "text-blue-400"}`} />
                  <span className={`text-xs font-medium ${telegramEnabled ? "text-emerald-400" : "text-blue-400"}`}>
                    {telegramEnabled ? "Notifications on" : "Telegram"}
                  </span>
                </div>
                <div className="text-white text-sm font-medium">
                  {telegramEnabled ? "You'll be notified" : "Get reminders"}
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  {telegramEnabled ? "Biweekly when payments are due" : "Never miss a payment deadline"}
                </div>
              </div>
              {!telegramEnabled && (
                <div className="text-amber-400 text-xs font-medium mt-3">Set up →</div>
              )}
            </button>
        </div>

        {/* ── Recipients ── */}
        <section className="bg-[#1a1a2e] border border-[#2d2d52] rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d2d52]">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-semibold text-white">Recipients</h2>
              <div className="flex gap-0.5 bg-[#0f0f1e] rounded-lg p-0.5">
                {(["all", "recurring", "one-time"] as const).map((f) => {
                  const count = f === "all" ? recipients.length
                    : f === "recurring" ? recipients.filter((r) => r.schedule !== "one-time").length
                      : recipients.filter((r) => r.schedule === "one-time").length;
                  return (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filter === f
                          ? "bg-[#2d2d52] text-white"
                          : "text-gray-500 hover:text-gray-300"
                        }`}>
                      {f === "all" ? "All" : f === "recurring" ? "Recurring" : "One-time"}
                      <span className={`ml-1 ${filter === f ? "text-gray-400" : "text-gray-600"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
              {groups.length > 0 && (
                <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}
                  className="px-2.5 py-1 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-xs text-gray-400 focus:outline-none focus:border-amber-500/50">
                  <option value="all">All groups</option>
                  {groups.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors w-40"
                />
              </div>
              <button onClick={() => { setShowImport(true); setShowAdd(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-gray-300 text-xs transition-colors">
                <Upload className="w-3.5 h-3.5" /> Import
              </button>
              <button onClick={() => { setShowAdd(true); setShowImport(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors text-xs font-medium">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-gray-500 text-center py-12">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-2xl bg-[#0f0f1e] flex items-center justify-center mx-auto mb-3">
                <Plus className="w-5 h-5 text-gray-600" />
              </div>
              <p className="text-gray-400 text-sm">No {filter !== "all" ? filter + " " : ""}recipients yet</p>
              <p className="text-gray-600 text-xs mt-1">Import a CSV or add recipients manually</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2d2d52]/50">
                  <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider font-medium px-6 py-2.5">Name</th>
                  <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider font-medium px-4 py-2.5">Amount</th>
                  <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider font-medium px-4 py-2.5">Schedule</th>
                  <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider font-medium px-4 py-2.5">Group</th>
                  <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider font-medium px-4 py-2.5">Last Paid</th>
                  <th className="text-left text-[10px] text-gray-500 uppercase tracking-wider font-medium px-4 py-2.5">Status</th>
                  <th className="text-right text-[10px] text-gray-500 uppercase tracking-wider font-medium px-6 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const s = scheduleMap.get(r.name);
                  return (
                    <tr key={r.name} onClick={() => openDetail(r.name)} className="border-b border-[#2d2d52]/30 last:border-0 hover:bg-white/[0.015] transition-colors cursor-pointer">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar src={r.avatar} name={r.name} size="md" />
                          <div className="flex flex-col gap-1">
                            <span className="text-white font-medium text-sm">{r.name}</span>
                            <code className="text-[10px] text-gray-600 font-mono">{r.wallet.slice(0, 8)}…{r.wallet.slice(-4)}</code>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-white text-sm font-mono">{r.amount}</span>
                        <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-medium ${r.currency === "ZEC" ? "bg-amber-500/15 text-amber-400" :
                          r.currency === "USDC" ? "bg-blue-500/15 text-blue-400" :
                            "bg-green-500/15 text-green-400"
                          }`}>{r.currency}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${r.schedule === "one-time" ? "bg-purple-500/15 text-purple-400" :
                          r.schedule === "weekly" ? "bg-blue-500/15 text-blue-400" :
                            r.schedule === "biweekly" ? "bg-cyan-500/15 text-cyan-400" :
                              "bg-amber-500/15 text-amber-400"
                          }`}>{r.schedule}</span>
                        {r.paid && <span className="ml-1.5 text-[10px] text-gray-500">(paid)</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {r.group ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-indigo-500/15 text-indigo-400">{r.group}</span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-gray-500 text-xs">
                        {s?.lastPaid || "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        {(() => {
                          if (!s) return <span className="text-gray-600 text-xs">—</span>;
                          if (s.paid) return <span className="text-gray-500 text-xs">Completed</span>;
                          if (s.isDue) return <span className="inline-flex items-center gap-1 text-red-400 text-xs font-medium"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Due</span>;
                          return <span className="text-emerald-400/70 text-xs">{s.nextDue || "Upcoming"}</span>;
                        })()}
                      </td>
                      <td className="px-6 py-3.5 text-right cursor-default" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {r.testTxConfirmed ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400/70 text-[10px] font-medium mr-1"><CheckCircle className="w-3 h-3" /> Verified</span>
                          ) : (
                            <button onClick={() => handleTestTx(r.name)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-amber-400 hover:bg-amber-500/10 rounded-md transition-colors mr-0.5"
                              title="Verify recipient">
                              <Send className="w-3 h-3" /> Verify
                            </button>
                          )}
                          <button onClick={() => setEditingRecipient(r)} className="p-1.5 text-gray-600 hover:text-gray-300 rounded-md transition-colors" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(r.name)} className="p-1.5 text-gray-600 hover:text-red-400 rounded-md transition-colors" title="Remove">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

      </main>

      {/* Payment result modal */}
      <Modal open={!!payResult} onClose={() => setPayResult(null)} maxWidth="max-w-3xl">
        {payResult && (<div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Payment Ready</h2>
                <p className="text-gray-500 text-xs">Scan or copy to send payment</p>
              </div>
            </div>
            <button onClick={() => setPayResult(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
          </div>

          {payResult.zec && (
            <PaymentCard title="ZEC" uri={payResult.zec.uri} payments={payResult.zec.payments}
              totalZec={payResult.zec.totalZec} zecPrice={price} copied={copied} onCopy={copyUri} />
          )}
          {payResult.usdc && (
            <PaymentCard title="USDC (via NEAR Intents)" uri={payResult.usdc.uri} payments={payResult.usdc.payments}
              totalZec={payResult.usdc.totalZec} zecPrice={price} note={payResult.usdc.note} copied={copied} onCopy={copyUri} />
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setPayResult(null)}
              className="flex-1 py-2.5 bg-[#2d2d52] text-gray-300 rounded-lg font-medium hover:bg-[#3d3d62] transition-colors text-sm">
              Close
            </button>
            <button disabled={confirmLoading} onClick={async () => {
              setConfirmLoading(true);
              try {
                const zecTotal = payResult.zec?.totalZec ?? 0;
                const usdcTotal = payResult.usdc?.totalZec ?? 0;
                const totalZec = zecTotal + usdcTotal;
                const count = (payResult.zec?.payments.length ?? 0) + (payResult.usdc?.payments.length ?? 0);
                await api.confirmPay();
                setPayResult(null);
                setPreview(null);
                setLastPayment({ totalZec, totalUsd: price ? totalZec * price : 0, count });
                refresh();
                setTimeout(() => setLastPayment(null), 8000);
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Failed to confirm payment");
              } finally {
                setConfirmLoading(false);
              }
            }}
              className="flex-1 py-2.5 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-400 disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2">
              {confirmLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {confirmLoading ? "Confirming..." : "Payment Made"}
            </button>
          </div>
        </div>)}
      </Modal>

      {/* Add recipient modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)}>
        <AddRecipientForm onDone={() => { setShowAdd(false); refresh(); }} onCancel={() => setShowAdd(false)} />
      </Modal>

      {/* Import CSV modal */}
      <Modal open={showImport} onClose={() => setShowImport(false)} maxWidth="max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">Import CSV</h3>
          <button onClick={() => setShowImport(false)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          Upload a CSV file with the following columns:
        </p>
        <div className="bg-[#0f0f1e] rounded-lg px-4 py-3 mb-4">
          <code className="text-amber-400 text-xs">name, wallet, amount, currency, schedule, memo</code>
        </div>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvUpload}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-amber-500/20 file:text-amber-400 hover:file:bg-amber-500/30 file:cursor-pointer mb-4" />
        <div className="flex items-center gap-3 mb-4 pt-3 border-t border-[#2d2d52]">
          <span className="text-gray-500 text-xs">or</span>
          <button onClick={handleLoadSample} className="text-sm text-amber-400 hover:text-amber-300 transition-colors">
            Load sample data
          </button>
        </div>
        <button onClick={() => setShowImport(false)}
          className="w-full py-2.5 bg-[#2d2d52] text-gray-300 rounded-lg font-medium hover:bg-[#3d3d62] transition-colors text-sm">
          Cancel
        </button>
      </Modal>

      {/* Verify recipient modal */}
      <Modal open={!!testQr} onClose={() => setTestQr(null)} maxWidth="max-w-sm">
        {testQr && (<>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-lg">Verify Recipient</h3>
            <button onClick={() => setTestQr(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-gray-400 text-sm mb-4">Send 0.0001 ZEC to <span className="text-white font-medium">{testQr.name}</span> and ask them to confirm they received it.</p>
          <div className="flex justify-center bg-white rounded-xl p-4 mb-4">
            <QRCodeSVG value={testQr.uri} size={220} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setTestQr(null)}
              className="flex-1 py-2.5 bg-[#2d2d52] text-gray-300 rounded-lg font-medium hover:bg-[#3d3d62] transition-colors text-sm">
              Cancel
            </button>
            <button onClick={async () => {
              await handleConfirmTest(testQr.name);
              setTestQr(null);
            }}
              className="flex-1 py-2.5 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-400 transition-colors text-sm flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Received Money
            </button>
          </div>
        </>)}
      </Modal>

      {/* Edit recipient modal */}
      <Modal open={!!editingRecipient} onClose={() => setEditingRecipient(null)} maxWidth="max-w-sm">
        {editingRecipient && (
          <EditRecipientForm
            recipient={editingRecipient}
            onDone={() => { setEditingRecipient(null); refresh(); }}
            onCancel={() => setEditingRecipient(null)}
          />
        )}
      </Modal>

      {/* Settings modal */}
      <Modal open={showSettings} onClose={() => setShowSettings(false)} maxWidth="max-w-md">
        <TelegramSettings onClose={() => setShowSettings(false)} onSaved={(enabled) => setTelegramEnabled(enabled)} />
      </Modal>

      {/* Recipient detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)}>
        {detail && (<>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Avatar src={detail.avatar} name={detail.name} size="lg" />
              <h3 className="text-white font-semibold text-lg">{detail.name}</h3>
            </div>
            <button onClick={() => setDetail(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-[#0f0f1e] rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Total Paid</div>
              <div className="text-white font-bold font-mono">{detail.totalPaidZec.toFixed(4)} ZEC</div>
            </div>
            <div className="bg-[#0f0f1e] rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Payments</div>
              <div className="text-white font-bold">{detail.totalPayments}</div>
            </div>
            <div className="bg-[#0f0f1e] rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Next Due</div>
              <div className="text-white font-bold text-sm">{detail.nextDueDate || "—"}</div>
            </div>
          </div>

          {/* Editable info */}
          <EditableRecipientInfo detail={detail} onSave={async (updates) => {
            await api.addRecipient({ ...detail, ...updates });
            const refreshed = await api.getRecipient(detail.name);
            setDetail(refreshed);
            refresh();
          }} />

          {/* Payment history */}
          <h4 className="text-white font-medium text-sm mb-2">Payment History</h4>
          {(detail.history ?? []).length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No payments yet</p>
          ) : (
            <div className="bg-[#0f0f1e] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2d2d52]">
                    <th className="text-left text-xs text-gray-500 font-medium px-3 py-2">Date</th>
                    <th className="text-right text-xs text-gray-500 font-medium px-3 py-2">Amount (ZEC)</th>
                    <th className="text-right text-xs text-gray-500 font-medium px-3 py-2">Original</th>
                    <th className="text-right text-xs text-gray-500 font-medium px-3 py-2">ZEC Price</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(detail.history ?? [])].reverse().map((h, i) => (
                    <tr key={i} className="border-b border-[#2d2d52]/30">
                      <td className="px-3 py-2 text-gray-300 text-sm">{h.date}</td>
                      <td className="px-3 py-2 text-white text-sm font-mono text-right">{h.amountZec.toFixed(4)}</td>
                      <td className="px-3 py-2 text-gray-400 text-sm text-right">{h.amountOriginal} {h.currency}</td>
                      <td className="px-3 py-2 text-gray-400 text-sm text-right">{h.zecPriceUsd ? `$${h.zecPriceUsd.toFixed(2)}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button onClick={() => setDetail(null)} className="w-full mt-4 py-2 bg-[#2d2d52] text-gray-300 rounded-lg font-medium hover:bg-[#3d3d62] transition-colors text-sm">
            Close
          </button>
        </>)}
      </Modal>
    </div>
  );
}