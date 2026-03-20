import { useState } from "react";
import { X } from "lucide-react";
import { api, type Recipient } from "../lib/api";
import { AmountInput } from "./AmountInput";
import { ChainSelect } from "./ChainSelect";

export function EditRecipientForm({ recipient, onDone, onCancel }: {
  recipient: Recipient;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(String(recipient.amount));
  const [currency, setCurrency] = useState(recipient.currency);
  const [schedule, setSchedule] = useState(recipient.schedule);
  const [memo, setMemo] = useState(recipient.memo || "");
  const [group, setGroup] = useState(recipient.group || "");
  const [usdcAddress, setUsdcAddress] = useState(recipient.usdcAddress || "");
  const [usdcChain, setUsdcChain] = useState(recipient.usdcChain || "ethereum");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await api.updateRecipient(recipient.name, {
        amount: parseFloat(amount),
        currency,
        schedule,
        memo,
        group: group || undefined,
        usdcAddress: currency === "USDC" ? usdcAddress : undefined,
        usdcChain: currency === "USDC" ? usdcChain as "ethereum" | "solana" | "near" | "base" | "arbitrum" | "polygon" : undefined,
      });
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-lg">Edit {recipient.name}</h3>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Amount</label>
          <AmountInput amount={amount} currency={currency}
            onAmountChange={setAmount}
            onCurrencyChange={(v) => setCurrency(v as "USD" | "ZEC" | "USDC")} />
        </div>
        {currency === "USDC" && (
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">USDC Destination Address</label>
              <input value={usdcAddress} onChange={(e) => setUsdcAddress(e.target.value)}
                placeholder="0x... or recipient address"
                className="w-full px-3 py-2 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-white text-sm font-mono placeholder-gray-500 focus:outline-none focus:border-amber-500/50" required />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Chain</label>
              <ChainSelect value={usdcChain} onChange={(v) => setUsdcChain(v as typeof usdcChain)} />
            </div>
          </div>
        )}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Schedule</label>
          <select value={schedule} onChange={(e) => setSchedule(e.target.value as "weekly" | "biweekly" | "monthly" | "one-time")}
            className="w-full px-3 py-2 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50">
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
            <option value="one-time">One-time</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Memo</label>
          <input value={memo} onChange={(e) => setMemo(e.target.value)}
            className="w-full px-3 py-2 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
            placeholder="Optional" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Group</label>
          <input value={group} onChange={(e) => setGroup(e.target.value)}
            className="w-full px-3 py-2 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
            placeholder="e.g. Engineering" />
        </div>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onCancel} className="px-4 py-2 text-gray-400 text-sm hover:text-gray-300">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-amber-500 text-black text-sm font-medium rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
