import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, Banknote, LogOut } from "lucide-react";

const links = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/recipients", icon: Users, label: "Recipients" },
  { to: "/pay", icon: Banknote, label: "Pay" },
];

export function Sidebar({ onLock }: { onLock: () => void }) {
  return (
    <aside className="w-60 bg-[#1a1a2e] border-r border-[#2d2d52] flex flex-col min-h-screen">
      <div className="p-5 border-b border-[#2d2d52]">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-amber-400">Z</span>EC Payroll
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Shielded payments</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-amber-500/15 text-amber-400"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`
            }
          >
            <Icon className="w-4.5 h-4.5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-[#2d2d52]">
        <button
          onClick={onLock}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 w-full transition-colors"
        >
          <LogOut className="w-4.5 h-4.5" />
          Lock
        </button>
      </div>
    </aside>
  );
}
