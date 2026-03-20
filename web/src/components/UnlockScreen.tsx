import { useState } from "react";
import { api } from "../lib/api";
import { Lock, KeyRound, Plus, Dices, Eye, EyeOff, Copy, Check } from "lucide-react";

export function UnlockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isNew) {
        if (passphrase !== confirm) {
          setError("Passphrases do not match");
          setLoading(false);
          return;
        }
        await api.init(passphrase);
      } else {
        await api.unlock(passphrase);
      }
      onUnlock();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const { passphrase: generated } = await api.generatePassphrase();
      setPassphrase(generated);
      setConfirm(generated);
      setShowPass(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(passphrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f1e] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 mb-4">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">ZEC Payroll</h1>
          <p className="text-gray-400">Private payroll with shielded Zcash</p>
        </div>

        <div className="bg-[#1a1a2e] border border-[#2d2d52] rounded-2xl p-6">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setIsNew(false); setError(""); setShowPass(false); }}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                !isNew ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-gray-400 hover:text-gray-300"
              }`}
            >
              <KeyRound className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Unlock
            </button>
            <button
              onClick={() => { setIsNew(true); setError(""); }}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                isNew ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-gray-400 hover:text-gray-300"
              }`}
            >
              <Plus className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              New Store
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-gray-400">Passphrase</label>
                {isNew && (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
                  >
                    <Dices className="w-3.5 h-3.5" />
                    {generating ? "Generating..." : "Generate secure passphrase"}
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full px-4 py-2.5 pr-20 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors font-mono text-sm"
                  placeholder="Enter your passphrase"
                  autoFocus
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {passphrase && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                      title="Copy"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {isNew && showPass && passphrase && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <p className="text-amber-400 text-xs font-medium mb-1">Save this passphrase!</p>
                <p className="text-gray-400 text-xs">
                  Write it down or store it in a password manager. You cannot recover your data without it.
                </p>
              </div>
            )}

            {isNew && (
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Confirm Passphrase</label>
                <input
                  type={showPass ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0f0f1e] border border-[#2d2d52] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors font-mono text-sm"
                  placeholder="Confirm your passphrase"
                />
              </div>
            )}

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !passphrase}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:hover:bg-amber-500 text-black font-medium rounded-lg transition-colors"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {isNew ? "Creating store..." : "Unlocking vault..."}
                </span>
              ) : isNew ? "Create Store" : "Unlock"}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">
          AES-256-GCM encrypted &middot; Data never leaves your machine
        </p>
      </div>
    </div>
  );
}
