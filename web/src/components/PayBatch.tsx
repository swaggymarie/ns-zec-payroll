import { useState, useEffect } from "react";
import { api, type PreviewResponse, type PayResponse } from "../lib/api";
import { QRCodeSVG } from "qrcode.react";
import { Banknote, RefreshCw, Copy, Check } from "lucide-react";

export function PayBatch() {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [payResult, setPayResult] = useState<PayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function loadPreview() {
    setError("");
    setLoading(true);
    setPayResult(null);
    try {
      await api.getPrice();
      const data = await api.preview();
      setPreview(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to preview");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPreview(); }, []);

  async function handlePay() {
    setError("");
    setLoading(true);
    try {
      const data = await api.pay();
      setPayResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate payment");
    } finally {
      setLoading(false);
    }
  }

  function copyUri(uri: string, label: string) {
    navigator.clipboard.writeText(uri);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Pay</h2>
        <button
          onClick={loadPreview}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] border border-[#2d2d52] text-gray-300 rounded-lg hover:border-amber-500/40 transition-colors text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {loading && !preview && (
        <div className="text-center py-16 text-gray-500">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-30" />
          <p>Loading batch preview...</p>
        </div>
      )}

      {/* Preview */}
      {preview && !payResult && (
        <div className="space-y-4">
          <div className="bg-[#1a1a2e] border border-[#2d2d52] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2d2d52] flex items-center justify-between">
              <h3 className="text-white font-semibold">Batch Preview</h3>
              <div className="text-sm text-gray-400">
                ZEC @ <span className="text-amber-400">${preview.zecPrice.toFixed(2)}</span>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2d2d52]">
                  <th className="text-left text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-2.5">Recipient</th>
                  <th className="text-left text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-2.5">Amount (ZEC)</th>
                  <th className="text-left text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-2.5">Type</th>
                  <th className="text-left text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-2.5">Wallet</th>
                </tr>
              </thead>
              <tbody>
                {preview.payments.map((p) => (
                  <tr key={p.name} className="border-b border-[#2d2d52]/50">
                    <td className="px-5 py-3 text-white font-medium">{p.name}</td>
                    <td className="px-5 py-3 text-white font-mono">{p.amountZec.toFixed(8)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        p.currency === "USDC" ? "bg-blue-500/15 text-blue-400" : "bg-amber-500/15 text-amber-400"
                      }`}>
                        {p.currency}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <code className="text-xs text-gray-400">{p.wallet.slice(0, 16)}...</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-4 border-t border-[#2d2d52] flex items-center justify-between">
              <div>
                <span className="text-gray-400 text-sm">Total: </span>
                <span className="text-white font-bold font-mono">{preview.totalZec.toFixed(8)} ZEC</span>
                <span className="text-gray-500 text-sm ml-2">(~${preview.totalUsd.toFixed(2)})</span>
              </div>
              <button
                onClick={handlePay}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors text-sm font-medium disabled:opacity-50"
              >
                <Banknote className="w-4 h-4" />
                Generate Payment URIs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment result */}
      {payResult && (
        <div className="space-y-6">
          {payResult.zec && (
            <PaymentCard
              title="ZEC Recipients"
              uri={payResult.zec.uri}
              payments={payResult.zec.payments}
              totalZec={payResult.zec.totalZec}
              copied={copied}
              onCopy={copyUri}
            />
          )}

          {payResult.usdc && (
            <PaymentCard
              title="USDC Recipients (via NEAR Intents)"
              uri={payResult.usdc.uri}
              payments={payResult.usdc.payments}
              totalZec={payResult.usdc.totalZec}
              note={payResult.usdc.note}
              copied={copied}
              onCopy={copyUri}
            />
          )}

          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-center">
            <p className="text-emerald-400 font-medium">
              ZIP-321 multi-payment URI generated
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Copy the URI or scan the QR code with a ZIP-321 compatible wallet.
            </p>
          </div>

          <button
            onClick={() => { setPayResult(null); loadPreview(); }}
            className="text-gray-400 text-sm hover:text-gray-300 transition-colors"
          >
            &larr; Back to preview
          </button>
        </div>
      )}
    </div>
  );
}

function PaymentCard({
  title,
  uri,
  payments,
  totalZec,
  note,
  copied,
  onCopy,
}: {
  title: string;
  uri: string;
  payments: { name: string; amountZec: number; currency: string }[];
  totalZec: number;
  note?: string;
  copied: string | null;
  onCopy: (uri: string, label: string) => void;
}) {
  return (
    <div className="bg-[#1a1a2e] border border-[#2d2d52] rounded-xl p-6">
      <h3 className="text-white font-semibold mb-4">{title}</h3>

      {note && (
        <div className="mb-4 text-blue-400 text-sm bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
          {note}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* QR */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white rounded-xl p-4">
            <QRCodeSVG value={uri} size={240} />
          </div>
          <button
            onClick={() => onCopy(uri, title)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-amber-400 transition-colors"
          >
            {copied === title ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied === title ? "Copied!" : "Copy URI"}
          </button>
        </div>

        {/* Details */}
        <div className="flex-1 space-y-2">
          {payments.map((p) => (
            <div key={p.name} className="flex items-center justify-between py-2 border-b border-[#2d2d52]/50">
              <span className="text-white text-sm">{p.name}</span>
              <span className="text-gray-300 font-mono text-sm">{p.amountZec.toFixed(8)} ZEC</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <span className="text-gray-400 font-medium text-sm">Total</span>
            <span className="text-white font-bold font-mono">{totalZec.toFixed(8)} ZEC</span>
          </div>

          <div className="mt-4 bg-[#0f0f1e] rounded-lg p-3">
            <code className="text-xs text-amber-400 break-all leading-relaxed">{uri}</code>
          </div>
        </div>
      </div>
    </div>
  );
}
