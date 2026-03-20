import { useState } from "react";
import type { Recipient, RecipientDetail } from "../lib/api";
import { AmountInput } from "./AmountInput";

export function EditableRecipientInfo({ detail, onSave }: {
  detail: RecipientDetail;
  onSave: (updates: Partial<Recipient>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(detail.amount));
  const [currency, setCurrency] = useState(detail.currency);
  const [schedule, setSchedule] = useState(detail.schedule);
  const [memo, setMemo] = useState(detail.memo || "");
  const [group, setGroup] = useState(detail.group || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        amount: parseFloat(amount),
        currency: currency as "USD" | "ZEC" | "USDC",
        schedule,
        memo,
        group: group || undefined,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="space-y-2 mb-5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Amount</span>
          <span className="text-white">{detail.amount} {detail.currency}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Schedule</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${detail.schedule === "one-time" ? "bg-purple-500/15 text-purple-400" :
            detail.schedule === "weekly" ? "bg-blue-500/15 text-blue-400" :
              detail.schedule === "biweekly" ? "bg-cyan-500/15 text-cyan-400" :
                "bg-amber-500/15 text-amber-400"
            }`}>{detail.schedule}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Wallet</span>
          <code className="text-xs text-gray-300">{detail.wallet.slice(0, 16)}...{detail.wallet.slice(-8)}</code>
        </div>
        {detail.group && (
          <div className="flex justify-between">
            <span className="text-gray-400">Group</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-indigo-500/15 text-indigo-400">{detail.group}</span>
          </div>
        )}
        {detail.memo && (
          <div className="flex justify-between">
            <span className="text-gray-400">Memo</span>
            <span className="text-gray-300">{detail.memo}</span>
          </div>
        )}
        <button onClick={() => setEditing(true)}
          className="text-amber-400 text-xs hover:text-amber-300 transition-colors mt-1">
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-5">
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Amount</label>
        <AmountInput amount={amount} currency={currency}
          onAmountChange={setAmount}
          onCurrencyChange={(v) => setCurrency(v as "USD" | "ZEC" | "USDC")} />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Schedule</label>
        <select value={schedule} onChange={(e) => setSchedule(e.target.value as "weekly" | "biweekly" | "monthly" | "one-time")}
          className="w-full px-3 py-1.5 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50">
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
          <option value="one-time">One-time</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Group</label>
        <input value={group} onChange={(e) => setGroup(e.target.value)}
          className="w-full px-3 py-1.5 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
          placeholder="e.g. Engineering" />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Memo</label>
        <input value={memo} onChange={(e) => setMemo(e.target.value)}
          className="w-full px-3 py-1.5 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
          placeholder="Optional" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-gray-400 text-xs hover:text-gray-300">Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="px-3 py-1.5 bg-amber-500 text-black text-xs font-medium rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50">
          {saving ? "..." : "Save"}
        </button>
      </div>
    </div>
  );
}
