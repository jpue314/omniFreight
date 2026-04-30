import { Link } from "react-router-dom";
import { useReorderQueue, useMarkOrdered } from "../lib/queries";

const URGENCY = {
  red: { badge: "bg-red-600 text-white", label: "Order TODAY" },
  amber: { badge: "bg-amber-500 text-white", label: "Order soon" },
  green: { badge: "bg-green-600 text-white", label: "Plan ahead" },
};

const today = () => new Date().toISOString().slice(0, 10);

export default function ReorderQueue() {
  const { data: response, isLoading, refetch } = useReorderQueue();
  const markOrdered = useMarkOrdered();
  const groups = response?.data ?? [];
  const total = response?.meta?.total_low_stock ?? 0;

  const handleMarkOrdered = async (itemId) => {
    await markOrdered.mutateAsync(itemId);
    refetch();
  };

  if (isLoading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reorder Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">Items at or below minimum stock level</p>
        </div>
        {total > 0 && (
          <span className="bg-red-100 text-red-800 text-sm font-medium px-3 py-1 rounded-full">
            {total} item{total !== 1 ? "s" : ""} need attention
          </span>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-lg border border-green-200 p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="font-semibold text-gray-900">All stocked</h3>
          <p className="text-sm text-gray-500 mt-1">No items are below their minimum stock level</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.vendor_id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-gray-900">{group.vendor_name}</span>
                  {group.vendor_phone && (
                    <span className="ml-3 text-sm text-gray-500">{group.vendor_phone}</span>
                  )}
                  {group.vendor_payment_terms && (
                    <span className="ml-3 text-xs text-gray-400">{group.vendor_payment_terms}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400">{group.items.length} item{group.items.length !== 1 ? "s" : ""}</span>
              </div>

              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr className="text-xs text-gray-500 font-medium">
                    <th className="text-left px-5 py-2.5">Item</th>
                    <th className="text-right px-4 py-2.5">Have</th>
                    <th className="text-right px-4 py-2.5">Min</th>
                    <th className="text-right px-4 py-2.5">Order Qty</th>
                    <th className="text-center px-4 py-2.5">Lead</th>
                    <th className="text-center px-4 py-2.5">Order By</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {group.items.map((item) => {
                    const urg = URGENCY[item.urgency] ?? URGENCY.red;
                    const t = today();
                    const orderByLabel = item.order_by_date === t ? "TODAY"
                      : item.order_by_date < t ? "OVERDUE"
                      : item.order_by_date;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <Link to={`/inventory/${item.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                            {item.name}
                          </Link>
                          {item.sku && <span className="ml-1.5 text-xs text-gray-400">{item.sku}</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-red-700 font-semibold">
                          {item.current_quantity} {item.unit_of_measure}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-500">
                          {item.min_stock_level}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-700">
                          {item.reorder_quantity}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500">
                          {item.lead_time_days}d
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${urg.badge}`}>
                            {orderByLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            {item.reorder_url && (
                              <a href={item.reorder_url} target="_blank" rel="noopener noreferrer"
                                className="text-xs px-2.5 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50">
                                Order ↗
                              </a>
                            )}
                            <button
                              onClick={() => handleMarkOrdered(item.id)}
                              disabled={markOrdered.isPending}
                              className="text-xs px-2.5 py-1 bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50"
                            >
                              Mark Ordered
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
