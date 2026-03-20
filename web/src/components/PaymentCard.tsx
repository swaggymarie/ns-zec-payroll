import { QRCodeSVG } from "qrcode.react";
import { Copy, Check } from "lucide-react";

export function PaymentCard({ title, uri, payments, totalZec, zecPrice, note, copied, onCopy }: {
  title: string;
  uri: string;
  payments: { name: string; amountZec: number; currency: string }[];
  totalZec: number;
  zecPrice: number | null;
  note?: string;
  copied: string | null;
  onCopy: (uri: string, label: string) => void;
}) {
  return (
    <div className="bg-[#0f0f1e] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2d2d52] flex items-center justify-between">
        <h3 className="text-white font-medium text-sm">{title}</h3>
        <div className="text-right">
          <span className="text-white font-bold font-mono text-sm">{totalZec.toFixed(4)} ZEC</span>
          {zecPrice && <span className="text-gray-500 text-xs ml-2">${(totalZec * zecPrice).toFixed(2)}</span>}
        </div>
      </div>
      {note && <div className="mx-5 mt-3 text-blue-400 text-xs bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">{note}</div>}
      <div className="flex flex-col lg:flex-row">
        <div className="flex flex-col items-center gap-3 p-5 lg:border-r border-[#2d2d52]">
          <div className="bg-white rounded-xl p-3"><QRCodeSVG value={uri} size={200} /></div>
          <button onClick={() => onCopy(uri, title)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[#2d2d52] text-gray-400 hover:text-amber-400 hover:border-amber-500/30 transition-colors">
            {copied === title ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied === title ? "Copied!" : "Copy URI"}
          </button>
        </div>
        <div className="flex-1 p-5">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-3">Recipients</div>
          <div className="space-y-0">
            {payments.map((p) => (
              <div key={p.name} className="flex items-center justify-between py-2 border-b border-[#2d2d52]/30 last:border-0">
                <span className="text-white text-sm">{p.name}</span>
                <div className="text-right">
                  <span className="text-gray-300 font-mono text-xs">{p.amountZec.toFixed(4)} ZEC</span>
                  {zecPrice && <span className="text-gray-500 text-xs ml-2">${(p.amountZec * zecPrice).toFixed(2)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
