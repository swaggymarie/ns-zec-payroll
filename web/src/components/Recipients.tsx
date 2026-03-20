import { useEffect, useState, useRef } from "react";
import { api, type Recipient } from "../lib/api";
import { QRCodeSVG } from "qrcode.react";
import {
  Plus, Upload, Trash2, Send, CheckCircle, XCircle, X,
} from "lucide-react";

type Filter = "all" | "recurring" | "one-time";

export function Recipients() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [testQr, setTestQr] = useState<{ name: string; uri: string } | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      const data = await api.getRecipients();
      setRecipients(data.recipients);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

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
      const result = await api.importCsv(text);
      setShowImport(false);
      setError("");
      refresh();
      alert(`Imported ${result.imported} recipients (${result.total} total)`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  }

  async function handleLoadSample() {
    try {
      const { csv } = await api.sampleCsv();
      const result = await api.importCsv(csv);
      setShowImport(false);
      setError("");
      refresh();
      alert(`Imported ${result.imported} sample recipients (${result.total} total)`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load sample data");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Recipients</h2>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowImport(true); setShowAdd(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] border border-[#2d2d52] text-gray-300 rounded-lg hover:border-amber-500/40 transition-colors text-sm"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button
            onClick={() => { setShowAdd(true); setShowImport(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {(["all", "recurring", "one-time"] as Filter[]).map((f) => {
          const count = f === "all" ? recipients.length
            : f === "recurring" ? recipients.filter((r) => r.schedule !== "one-time").length
            : recipients.filter((r) => r.schedule === "one-time").length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "text-gray-400 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              {f === "all" ? "All" : f === "recurring" ? "Recurring" : "One-time"}
              <span className="ml-1.5 text-gray-500">{count}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {showImport && (
        <div className="mb-4 bg-[#1a1a2e] border border-[#2d2d52] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-medium">Import CSV</h3>
            <button onClick={() => setShowImport(false)} className="text-gray-500 hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-gray-400 text-sm mb-3">
            CSV columns: <code className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded text-xs">name, wallet, amount, currency, schedule, memo</code>
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleCsvUpload}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-amber-500/20 file:text-amber-400 hover:file:bg-amber-500/30 file:cursor-pointer"
          />
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#2d2d52]">
            <span className="text-gray-500 text-xs">or</span>
            <button
              onClick={handleLoadSample}
              className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              Load sample data
            </button>
          </div>
        </div>
      )}

      {showAdd && <AddRecipientForm onDone={() => { setShowAdd(false); refresh(); }} onCancel={() => setShowAdd(false)} />}

      {/* Test QR modal */}
      {testQr && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setTestQr(null)}>
          <div className="bg-[#1a1a2e] border border-[#2d2d52] rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold mb-1">Test Transaction</h3>
            <p className="text-gray-400 text-sm mb-4">Scan with Zodl to send 0.0001 ZEC to {testQr.name}</p>
            <div className="flex justify-center bg-white rounded-xl p-4 mb-4">
              <QRCodeSVG value={testQr.uri} size={220} />
            </div>
            <div className="bg-[#0f0f1e] rounded-lg p-3 mb-4">
              <code className="text-xs text-amber-400 break-all">{testQr.uri}</code>
            </div>
            <button onClick={() => setTestQr(null)} className="w-full py-2 bg-amber-500 text-black rounded-lg font-medium hover:bg-amber-400 transition-colors">
              Done
            </button>
          </div>
        </div>
      )}

      {(() => {
        const filtered = filter === "all" ? recipients
          : filter === "recurring" ? recipients.filter((r) => r.schedule !== "one-time")
          : recipients.filter((r) => r.schedule === "one-time");
        return loading ? (
        <div className="text-gray-500 text-center py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No recipients yet</p>
          <p className="text-sm mt-1">Import a CSV or add recipients manually</p>
        </div>
      ) : (
        <div className="bg-[#1a1a2e] border border-[#2d2d52] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2d2d52]">
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-3">Name</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-3">Amount</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-3">Schedule</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-3">Wallet</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-3">Test TX</th>
                <th className="text-right text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.name} className="border-b border-[#2d2d52]/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="text-white font-medium">{r.name}</span>
                    {r.memo && <span className="block text-xs text-gray-500 mt-0.5">{r.memo}</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-white">{r.amount}</span>
                    <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded ${
                      r.currency === "ZEC" ? "bg-amber-500/15 text-amber-400" :
                      r.currency === "USDC" ? "bg-blue-500/15 text-blue-400" :
                      "bg-green-500/15 text-green-400"
                    }`}>
                      {r.currency}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      r.schedule === "one-time" ? "bg-purple-500/15 text-purple-400" :
                      r.schedule === "weekly" ? "bg-blue-500/15 text-blue-400" :
                      r.schedule === "biweekly" ? "bg-cyan-500/15 text-cyan-400" :
                      "bg-amber-500/15 text-amber-400"
                    }`}>
                      {r.schedule}
                    </span>
                    {r.paid && <span className="ml-1.5 text-xs text-gray-500">(paid)</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <code className="text-xs text-gray-400">{r.wallet.slice(0, 16)}...{r.wallet.slice(-8)}</code>
                  </td>
                  <td className="px-5 py-3.5">
                    {r.testTxConfirmed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                        <CheckCircle className="w-3.5 h-3.5" /> Confirmed
                      </span>
                    ) : r.testTxSent ? (
                      <button
                        onClick={() => handleConfirmTest(r.name)}
                        className="inline-flex items-center gap-1 text-amber-400 text-xs hover:text-amber-300 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Confirm
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-500 text-xs">
                        <XCircle className="w-3.5 h-3.5" /> Not sent
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!r.testTxConfirmed && (
                        <button
                          onClick={() => handleTestTx(r.name)}
                          className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                          title="Send test TX"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(r.name)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      })()}
    </div>
  );
}

function Users({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function AddRecipientForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: "", wallet: "", amount: "", currency: "ZEC", schedule: "monthly", memo: "" });
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.addRecipient({
        name: form.name,
        wallet: form.wallet,
        amount: parseFloat(form.amount),
        currency: form.currency as "USD" | "ZEC" | "USDC",
        schedule: form.schedule as "weekly" | "biweekly" | "monthly" | "one-time",
        memo: form.memo,
      });
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="mb-4 bg-[#1a1a2e] border border-[#2d2d52] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium">Add Recipient</h3>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-300">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="px-3 py-2 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
          required
        />
        <input
          placeholder="Amount"
          type="number"
          step="any"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="px-3 py-2 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
          required
        />
        <input
          placeholder="Zcash wallet address"
          value={form.wallet}
          onChange={(e) => setForm({ ...form, wallet: e.target.value })}
          className="px-3 py-2 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500/50 md:col-span-2"
          required
        />
        <select
          value={form.currency}
          onChange={(e) => setForm({ ...form, currency: e.target.value })}
          className="px-3 py-2 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
        >
          <option value="ZEC">ZEC</option>
          <option value="USD">USD</option>
          <option value="USDC">USDC</option>
        </select>
        <select
          value={form.schedule}
          onChange={(e) => setForm({ ...form, schedule: e.target.value })}
          className="px-3 py-2 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
        >
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
          <option value="one-time">One-time</option>
        </select>
        <input
          placeholder="Memo (optional)"
          value={form.memo}
          onChange={(e) => setForm({ ...form, memo: e.target.value })}
          className="px-3 py-2 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
        />
        {error && <div className="text-red-400 text-sm md:col-span-2">{error}</div>}
        <div className="md:col-span-2 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-400 text-sm hover:text-gray-300">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 bg-amber-500 text-black text-sm font-medium rounded-lg hover:bg-amber-400 transition-colors">
            Add Recipient
          </button>
        </div>
      </form>
    </div>
  );
}
