import { useState, useEffect, useRef } from "react";
import { Check } from "lucide-react";

const CURRENCIES: { value: string; label: string; logo?: string; disabled?: boolean }[] = [
  { value: "ZEC", label: "ZEC", logo: "/zec-logo.png" },
  { value: "USDC", label: "USDC", disabled: true },
];

export function AmountInput({ amount, currency, onAmountChange, onCurrencyChange, required, className = "" }: {
  amount: string;
  currency: string;
  onAmountChange: (v: string) => void;
  onCurrencyChange: (v: string) => void;
  required?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = CURRENCIES.find((c) => c.value === currency) ?? CURRENCIES[0];

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <div className="flex items-center bg-[#0f0f1e] border border-[#2d2d52] rounded-xl focus-within:border-amber-500/50 transition-colors">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^\d*\.?\d*$/.test(v)) onAmountChange(v);
          }}
          required={required}
          className="flex-1 bg-transparent px-4 py-3 text-white text-lg font-mono placeholder-gray-600 focus:outline-none min-w-0"
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-1.5 mr-2 bg-[#1a1a2e] hover:bg-[#222244] rounded-lg text-white text-sm font-medium transition-colors shrink-0"
        >
          {selected.logo ? (
            <img src={selected.logo} alt="" className="w-5 h-5 rounded-full" />
          ) : (
            <span className="w-5 h-5 rounded-full bg-blue-500/15 flex items-center justify-center text-[10px] font-bold text-blue-400">$</span>
          )}
          <span>{selected.label}</span>
          <svg className={`w-3 h-3 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute z-50 top-full mt-1 right-0 w-40 bg-[#1a1a2e] border border-[#2d2d52] rounded-xl shadow-xl shadow-black/40 overflow-hidden">
          {CURRENCIES.map((c) => (
            <button
              key={c.value}
              type="button"
              disabled={c.disabled}
              onClick={() => { if (!c.disabled) { onCurrencyChange(c.value); setOpen(false); } }}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-sm transition-colors ${
                c.disabled ? "opacity-40 cursor-not-allowed" :
                c.value === currency ? "bg-amber-500/10 text-white" : "text-gray-300 hover:bg-white/5"
              }`}
            >
              {c.logo ? (
                <img src={c.logo} alt="" className="w-5 h-5 rounded-full" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-blue-500/15 flex items-center justify-center text-[10px] font-bold text-blue-400">$</span>
              )}
              <span className="font-medium">{c.label}</span>
              {c.disabled && <span className="text-[10px] text-gray-600 ml-auto">soon</span>}
              {!c.disabled && c.value === currency && <Check className="w-3.5 h-3.5 text-amber-400 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
