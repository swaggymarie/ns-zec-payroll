import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { api } from "../lib/api";

export function TelegramSettings({ onClose, onSaved }: { onClose: () => void; onSaved?: (enabled: boolean) => void }) {
  const [chatId, setChatId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    api.getTelegram().then((config) => {
      setChatId(config.chatId);
      setEnabled(config.enabled);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await api.setTelegram({ chatId, enabled });
      setMessage({ type: "success", text: "Settings saved" });
      onSaved?.(enabled && !!chatId);
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    try {
      await api.testTelegram();
      setMessage({ type: "success", text: "Test message sent! Check your Telegram." });
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to send test" });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <div className="text-gray-500 text-center py-8">Loading...</div>;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-semibold text-lg">Notifications</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between bg-[#0f0f1e] rounded-xl px-4 py-3">
          <div>
            <div className="text-white text-sm font-medium">Telegram</div>
            <div className="text-gray-500 text-xs mt-0.5">Biweekly payment reminders</div>
          </div>
          <button onClick={() => setEnabled(!enabled)}
            className={`w-10 h-6 rounded-full transition-colors relative ${enabled ? "bg-emerald-500" : "bg-[#2d2d52]"}`}>
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${enabled ? "translate-x-5" : "translate-x-1"}`} />
          </button>
        </div>

        <div className="bg-[#0f0f1e] rounded-xl px-4 py-3 text-xs text-gray-500 space-y-1">
          <p>1. Open <span className="text-amber-400">@ns_payroll_bot</span> on Telegram and press <span className="text-gray-300">Start</span></p>
          <p>2. Message <span className="text-amber-400">@userinfobot</span> to get your numeric ID</p>
          <p>3. Paste your ID below</p>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Your Telegram ID</label>
          <input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="e.g. 123456789"
            className="w-full px-4 py-2.5 bg-[#0f0f1e] border border-[#2d2d52] rounded-xl text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors" />
        </div>

        {message && (
          <div className={`text-sm rounded-lg px-3 py-2 ${
            message.type === "success" ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : "text-red-400 bg-red-500/10 border border-red-500/20"
          }`}>{message.text}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={handleTest} disabled={testing || !chatId}
            className="flex-1 py-2.5 bg-[#2d2d52] text-gray-300 rounded-xl font-medium hover:bg-[#3d3d62] transition-colors text-sm disabled:opacity-50">
            {testing ? "Sending..." : "Send Test"}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-amber-500 text-black rounded-xl font-medium hover:bg-amber-400 transition-colors text-sm disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
