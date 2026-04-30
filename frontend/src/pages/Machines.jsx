import { Link } from "react-router-dom";
import { useMachines } from "../lib/queries";

const TYPE_ICONS = { printer: "🖨", cutter: "✂️", laminator: "📄", other: "⚙️" };

export default function Machines() {
  const { data: response, isLoading } = useMachines();
  const machines = response?.data ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Machines</h1>
        <span className="text-sm text-gray-500">{machines.length} assets</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : machines.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No machines registered yet</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {machines.map((m) => (
            <Link key={m.id} to={`/machines/${m.id}`}
              className="bg-white rounded-lg border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{TYPE_ICONS[m.type] ?? "⚙️"}</span>
                {!m.is_active && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900">{m.name}</h3>
              {m.asset_id && <p className="text-xs text-gray-400 mt-0.5">#{m.asset_id}</p>}
              <p className="text-sm text-gray-500 mt-1">{m.make} {m.model}</p>
              {m.serial_number && <p className="text-xs text-gray-400">S/N: {m.serial_number}</p>}
              {m.warranty_expiration && (
                <p className={`text-xs mt-2 ${new Date(m.warranty_expiration) < new Date() ? "text-red-500" : "text-gray-400"}`}>
                  Warranty: {m.warranty_expiration}
                  {new Date(m.warranty_expiration) < new Date() ? " ⚠ expired" : ""}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
