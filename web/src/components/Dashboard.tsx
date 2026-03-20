import { useEffect, useState } from "react";
import { api, type ScheduleResponse } from "../lib/api";
import { Calendar, Users, CheckCircle, AlertTriangle, DollarSign } from "lucide-react";

export function Dashboard() {
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.schedule().then(setSchedule).catch(() => {});
    api.getPrice().then((p) => setPrice(p.price)).catch(() => {});
  }, []);

  async function refreshPrice() {
    setPriceLoading(true);
    try {
      const p = await api.getPrice();
      setPrice(p.price);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch price");
    } finally {
      setPriceLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Dashboard</h2>

      {error && (
        <div className="mb-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card
          icon={Users}
          label="Recipients"
          value={schedule?.recipientCount ?? "..."}
          sub="total payees"
        />
        <Card
          icon={CheckCircle}
          label="Confirmed"
          value={schedule?.confirmedCount ?? "..."}
          sub="test tx verified"
          color="green"
        />
        <Card
          icon={Calendar}
          label="Due Now"
          value={schedule?.dueCount ?? "..."}
          sub={schedule?.dueCount ? "ready to pay" : "no payments due"}
          color={schedule?.dueCount ? "red" : "blue"}
        />
        <Card
          icon={DollarSign}
          label="ZEC Price"
          value={price ? `$${price.toFixed(2)}` : "---"}
          sub={
            <button
              onClick={refreshPrice}
              disabled={priceLoading}
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              {priceLoading ? "fetching..." : "refresh"}
            </button>
          }
          color="amber"
        />
      </div>

      {schedule && schedule.dueCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 flex items-start gap-4 mb-6">
          <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-white font-semibold mb-1">
              {schedule.dueCount} payment{schedule.dueCount !== 1 ? "s" : ""} due
            </h3>
            <p className="text-gray-400 text-sm">
              Go to the{" "}
              <a href="/pay" className="text-amber-400 hover:underline">Pay</a>{" "}
              tab to preview and generate payment URIs.
            </p>
          </div>
        </div>
      )}

      {/* Per-recipient schedule breakdown */}
      {schedule && schedule.recipients.length > 0 && (
        <div className="bg-[#1a1a2e] border border-[#2d2d52] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2d2d52]">
            <h3 className="text-white font-semibold">Schedule</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2d2d52]">
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-2.5">Name</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-2.5">Frequency</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-2.5">Last Paid</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-2.5">Next Due</th>
                <th className="text-left text-xs text-gray-500 uppercase tracking-wider font-medium px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {schedule.recipients.map((r) => (
                <tr key={r.name} className="border-b border-[#2d2d52]/50">
                  <td className="px-5 py-3 text-white font-medium">{r.name}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      r.schedule === "one-time" ? "bg-purple-500/15 text-purple-400" :
                      r.schedule === "weekly" ? "bg-blue-500/15 text-blue-400" :
                      r.schedule === "biweekly" ? "bg-cyan-500/15 text-cyan-400" :
                      "bg-amber-500/15 text-amber-400"
                    }`}>
                      {r.schedule}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-sm">
                    {r.lastPaid || "Never"}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-sm">
                    {r.paid ? "Completed" : r.nextDue || "—"}
                  </td>
                  <td className="px-5 py-3">
                    {r.paid ? (
                      <span className="text-gray-500 text-xs">Paid</span>
                    ) : r.isDue ? (
                      <span className="text-red-400 text-xs font-medium">Due</span>
                    ) : (
                      <span className="text-emerald-400 text-xs">Upcoming</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {schedule && schedule.recipientCount === 0 && (
        <div className="bg-[#1a1a2e] border border-[#2d2d52] rounded-xl p-5">
          <h3 className="text-white font-semibold mb-2">Get started</h3>
          <p className="text-gray-400 text-sm">
            Add recipients in the <a href="/recipients" className="text-amber-400 hover:underline">Recipients</a> tab by
            importing a CSV or adding them manually.
          </p>
        </div>
      )}
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  sub,
  color = "gray",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub: React.ReactNode;
  color?: string;
}) {
  const colors: Record<string, string> = {
    gray: "text-gray-400",
    green: "text-emerald-400",
    red: "text-red-400",
    blue: "text-blue-400",
    amber: "text-amber-400",
  };

  return (
    <div className="bg-[#1a1a2e] border border-[#2d2d52] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${colors[color]}`} />
        <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="text-xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-gray-500">{sub}</div>
    </div>
  );
}
