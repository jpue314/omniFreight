import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back, {user?.full_name}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { label: "Active Shipments", value: "—", description: "Shipments module coming soon" },
          { label: "Low Stock Alerts", value: "—", description: "Inventory module coming soon" },
          { label: "Payments Due", value: "—", description: "Payments module coming soon" },
        ].map(({ label, value, description }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-brand-900">{value}</p>
            <p className="mt-1 text-xs text-gray-400">{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
