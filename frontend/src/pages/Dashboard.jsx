import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useReorderQueue, useInventory, useUnreadCount } from "../lib/queries";

function StatCard({ label, value, sub, to, urgent }) {
  const inner = (
    <div className={`bg-white rounded-lg border p-6 shadow-sm ${urgent ? "border-red-300" : "border-gray-200"}`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${urgent ? "text-red-700" : "text-brand-900"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
  return to ? <Link to={to} className="hover:opacity-90 transition-opacity">{inner}</Link> : inner;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: reorderData } = useReorderQueue();
  const { data: lowStockData } = useInventory({ low_stock: "true" });
  const { data: countData } = useUnreadCount();

  const urgentReorder = (reorderData?.data ?? [])
    .flatMap((g) => g.items)
    .filter((i) => i.urgency === "red").length;

  const lowStockCount = lowStockData?.meta?.count ?? "—";
  const unreadCount = countData?.data?.count ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Welcome back, {user?.full_name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Low Stock Items"
          value={lowStockCount}
          sub="Items below minimum level"
          to="/inventory?low_stock=true"
          urgent={lowStockCount > 0}
        />
        <StatCard
          label="Urgent Reorders"
          value={urgentReorder}
          sub="Must order today"
          to="/reorder"
          urgent={urgentReorder > 0}
        />
        <StatCard
          label="Unread Alerts"
          value={unreadCount}
          sub="Notifications waiting"
          urgent={unreadCount > 0}
        />
        <StatCard
          label="Active Shipments"
          value="—"
          sub="Shipment tracker coming in Phase 1B"
        />
      </div>

      {(reorderData?.data ?? []).length > 0 && (
        <div className="bg-white rounded-lg border border-red-200">
          <div className="px-5 py-3 border-b border-red-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">⚠ Reorder Queue</h2>
            <Link to="/reorder" className="text-sm text-brand-600 hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {(reorderData?.data ?? []).slice(0, 3).flatMap((g) =>
              g.items.slice(0, 2).map((item) => (
                <div key={item.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{g.vendor_name}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    item.urgency === "red" ? "bg-red-600 text-white" :
                    item.urgency === "amber" ? "bg-amber-500 text-white" :
                    "bg-green-600 text-white"
                  }`}>
                    {item.order_by_date}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
