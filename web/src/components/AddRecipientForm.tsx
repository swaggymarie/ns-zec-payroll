import { useState } from "react";
import { X } from "lucide-react";
import { api } from "../lib/api";
import { AmountInput } from "./AmountInput";

export function AddRecipientForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: "", wallet: "", amount: "", currency: "ZEC", schedule: "monthly", memo: "", avatar: "", group: "" });
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
        avatar: form.avatar || undefined,
        group: form.group || undefined,
      });
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-semibold text-lg">Add Recipient</h3>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-row items-center gap-3">
          <div className="w-28 h-28 rounded-full bg-[#0f0f1e] border border-[#2d2d52] overflow-hidden flex items-center justify-center shrink-0">
            {form.avatar ? (
              <img src={form.avatar} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <span className="text-gray-600 text-xl font-bold">{form.name ? form.name[0].toUpperCase() : "?"}</span>
            )}
          </div>
          <div className="flex flex-col gap-3 flex-1">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Name</label>
              <input placeholder="e.g. Alice" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#0f0f1e] border border-[#2d2d52] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors" required />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Profile Picture <span className="text-gray-600">(optional)</span></label>
              <input placeholder="https://example.com/photo.jpg" value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })}
                className="flex-1 px-4 py-2.5 bg-[#0f0f1e] border border-[#2d2d52] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors w-full" />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Amount</label>
          <AmountInput
            amount={form.amount} currency={form.currency}
            onAmountChange={(v) => setForm({ ...form, amount: v })}
            onCurrencyChange={(v) => setForm({ ...form, currency: v })}
            required />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Wallet Address</label>
          <input placeholder="Zcash shielded address" value={form.wallet} onChange={(e) => setForm({ ...form, wallet: e.target.value })}
            className="w-full px-4 py-2.5 bg-[#0f0f1e] border border-[#2d2d52] rounded-xl text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <label className="text-xs text-gray-500 mb-1.5 block">Schedule</label>
            <select value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })}
              className="w-full px-4 py-2.5 pr-9 bg-[#0f0f1e] border border-[#2d2d52] rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors appearance-none cursor-pointer">
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
              <option value="one-time">One-time</option>
            </select>
            <svg className="w-4 h-4 text-gray-500 absolute right-3 bottom-3 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Memo <span className="text-gray-600">(optional)</span></label>
            <input placeholder="Payment note" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })}
              className="w-full px-4 py-2.5 bg-[#0f0f1e] border border-[#2d2d52] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors" />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Group <span className="text-gray-600">(optional)</span></label>
          <input placeholder="e.g. Engineering" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}
            className="w-full px-4 py-2.5 bg-[#0f0f1e] border border-[#2d2d52] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors" />
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2.5 bg-[#2d2d52] text-gray-300 rounded-xl font-medium hover:bg-[#3d3d62] transition-colors text-sm">
            Cancel
          </button>
          <button type="submit"
            className="flex-1 py-2.5 bg-amber-500 text-black rounded-xl font-medium hover:bg-amber-400 transition-colors text-sm">
            Add Recipient
          </button>
        </div>
      </form>
    </>
  );
}
