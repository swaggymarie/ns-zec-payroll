import { useState, useEffect, useRef, type ReactNode } from "react";
import { Check } from "lucide-react";

const CHAINS: { value: string; label: string; icon: ReactNode }[] = [
  {
    value: "ethereum", label: "Ethereum",
    icon: <svg viewBox="0 0 32 32" className="w-5 h-5"><path fill="#627EEA" d="M16 0l-.4.2v21.8l.4.2 10-5.9z"/><path fill="#8C8C8C" d="M16 0L6 16.3l10 5.9V0z"/><path fill="#627EEA" d="M16 24.1l-.2.3v7.7l.2.5L26 18.2z"/><path fill="#8C8C8C" d="M16 32.6V24.1L6 18.2z"/><path fill="#3C3C3B" d="M16 22.2l10-5.9L16 12z"/><path fill="#8C8C8C" d="M6 16.3l10 5.9V12z"/></svg>,
  },
  {
    value: "solana", label: "Solana",
    icon: <svg viewBox="0 0 32 32" className="w-5 h-5"><defs><linearGradient id="sol" x1="0" y1="32" x2="32" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#9945FF"/><stop offset="0.5" stopColor="#14F195"/><stop offset="1" stopColor="#00D1FF"/></linearGradient></defs><path fill="url(#sol)" d="M7.4 22.3a.9.9 0 01.6-.3h20.8a.5.5 0 01.3.8l-4 4a.9.9 0 01-.6.3H3.7a.5.5 0 01-.3-.8l4-4zm0-12.6a.9.9 0 01.6-.3h20.8a.5.5 0 01.3.8l-4 4a.9.9 0 01-.6.3H3.7a.5.5 0 01-.3-.8l4-4zm21.4 6a.9.9 0 00-.6-.3H7.4a.5.5 0 00-.3.8l4 4a.9.9 0 00.6.3h20.8a.5.5 0 00.3-.8l-4-4z"/></svg>,
  },
  {
    value: "near", label: "NEAR",
    icon: <svg viewBox="0 0 32 32" className="w-5 h-5"><path fill="#fff" d="M22.2 4.8L18 11.6a.5.5 0 00.7.7l4-3.4a.3.3 0 01.5.2v13.7a.3.3 0 01-.5.2l-13-17.6A2.6 2.6 0 008 4.5H7.4A3.4 3.4 0 004 7.9v16.2a3.4 3.4 0 005.8 2.4l4.2-6.8a.5.5 0 00-.7-.7l-4 3.4a.3.3 0 01-.5-.2V8.5a.3.3 0 01.5-.2l13 17.6a2.6 2.6 0 001.7.9h.6a3.4 3.4 0 003.4-3.4V7.2a3.4 3.4 0 00-5.8-2.4z"/></svg>,
  },
  {
    value: "base", label: "Base",
    icon: <svg viewBox="0 0 32 32" className="w-5 h-5"><circle cx="16" cy="16" r="16" fill="#0052FF"/><path fill="#fff" d="M16 27.5c6.4 0 11.5-5.1 11.5-11.5S22.4 4.5 16 4.5C9.9 4.5 5 9.1 4.5 14.9h15.2v2.2H4.5C5 23 9.9 27.5 16 27.5z"/></svg>,
  },
  {
    value: "arbitrum", label: "Arbitrum",
    icon: <svg viewBox="0 0 32 32" className="w-5 h-5"><circle cx="16" cy="16" r="16" fill="#213147"/><path fill="#12AAFF" d="M18.7 16.8l2.7 4.3 2.9-1.7-3.5-5.6-2.1 3zm6.6 5.4l-1.4-2.2-2.9 1.7 1.1 1.7 1.6 1-1.3.8-5.2-8.4h3.4l4.4 7.1-.4.2c-.4.3-1 .3-1.3.1z"/><path fill="#fff" d="M16 5.7l-9.3 5.4v10.8l3 1.7 5.1-8.2h3.4l5.2 8.4-3 1.7L16 26.3l-9.3-5.4 1.1-.6L16 5.7z"/></svg>,
  },
  {
    value: "polygon", label: "Polygon",
    icon: <svg viewBox="0 0 32 32" className="w-5 h-5"><path fill="#8247E5" d="M22.3 12.8c-.5-.3-1.1-.3-1.6 0l-3.7 2.2-2.5 1.4-3.7 2.2c-.5.3-1.1.3-1.6 0l-2.9-1.7c-.5-.3-.8-.8-.8-1.4v-3.3c0-.6.3-1.1.8-1.4l2.9-1.7c.5-.3 1.1-.3 1.6 0l2.9 1.7c.5.3.8.8.8 1.4v2.2l2.5-1.5v-2.2c0-.6-.3-1.1-.8-1.4l-5.3-3.1c-.5-.3-1.1-.3-1.6 0l-5.4 3.1c-.5.3-.8.8-.8 1.4v6.2c0 .6.3 1.1.8 1.4l5.4 3.1c.5.3 1.1.3 1.6 0l3.7-2.1 2.5-1.5 3.7-2.1c.5-.3 1.1-.3 1.6 0l2.9 1.7c.5.3.8.8.8 1.4v3.3c0 .6-.3 1.1-.8 1.4l-2.9 1.7c-.5.3-1.1.3-1.6 0l-2.9-1.7c-.5-.3-.8-.8-.8-1.4v-2.1l-2.5 1.5v2.1c0 .6.3 1.1.8 1.4l5.4 3.1c.5.3 1.1.3 1.6 0l5.4-3.1c.5-.3.8-.8.8-1.4v-6.2c0-.6-.3-1.1-.8-1.4l-5.5-3.2z"/></svg>,
  },
];

export function ChainSelect({ value, onChange, className = "" }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = CHAINS.find((c) => c.value === value) ?? CHAINS[0];

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
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#0f0f1e] border border-[#2d2d52] rounded-xl text-white text-sm font-medium hover:border-amber-500/30 transition-colors"
      >
        {selected.icon}
        <span className="flex-1 text-left">{selected.label}</span>
        <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-full bg-[#1a1a2e] border border-[#2d2d52] rounded-xl shadow-xl shadow-black/40 overflow-hidden">
          {CHAINS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => { onChange(c.value); setOpen(false); }}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-sm transition-colors ${
                c.value === value ? "bg-amber-500/10 text-white" : "text-gray-300 hover:bg-white/5"
              }`}
            >
              {c.icon}
              <span className="font-medium">{c.label}</span>
              {c.value === value && <Check className="w-3.5 h-3.5 text-amber-400 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
