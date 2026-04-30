import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useInventoryItem, useTransactions, useCreateTransaction, useMarkOrdered } from "../lib/queries";

const TX_COLORS = {
  receipt: "bg-green-100 text-green-800",
  consumption: "bg-red-100 text-red-800",
  adjustment: "bg-blue-100 text-blue-800",
  return: "bg-purple-100 text-purple-800",
  initial: "bg-gray-100 text-gray-800",
};

const TX_TYPES = ["receipt", "consumption", "adjustment", "return", "initial"];

export default function InventoryDetail() {
  const { id } = useParams();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "receipt", quantity: "", reference: "", notes: "" });
  const [formError, setFormError] = useState("");

  const { data: itemResponse, isLoading } = useInventoryItem(id);
  const { data: txResponse } = useTransactions(id);
  const createTx = useCreateTransaction(id);
  const markOrdered = useMarkOrdered();

  const item = itemResponse?.data;
  const transactions = txResponse?.data ?? [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    const qty = parseFloat(form.quantity);
    if (isNaN(qty) || qty === 0) { setFormError("Enter a non-zero quantity"); return; }
    const payload = {
      type: form.type,
      quantity: form.type === "consumption" ? -Math.abs(qty) : Math.abs(qty),
      reference: form.reference,
      notes: form.notes,
    };
    try {
      await createTx.mutateAsync(payload);
      setForm({ type: "receipt", quantity: "", reference: "", notes: "" });
      setShowForm(false);
    } catch {
      setFormError("Failed to record transaction. Check the values and try again.");
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!item) return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400">Item not found</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-4">
        <Link to="/inventory" className="text-sm text-brand-600 hover:underline">← Inventory</Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">
            {item.category?.replace("_", " ")}{item.sku && ` · ${item.sku}`}
          </p>
        </div>
        {item.is_low_stock && (
          <span className="bg-red-100 text-red-800 text-sm px-3 py-1 rounded-full font-medium">⚠ Low stock</span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "In Stock", value: `${item.current_quantity} ${item.unit_of_measure}`, highlight: item.is_low_stock },
          { label: "Min Level", value: `${item.min_stock_level} ${item.unit_of_measure}` },
          { label: "Reorder Qty", value: `${item.reorder_quantity} ${item.unit_of_measure}` },
          { label: "Lead Time", value: `${item.lead_time_days} days` },
        ].map(({ label, value, highlight }) => (
          <div key={label} className={`bg-white rounded-lg border p-4 ${highlight ? "border-red-300" : "border-gray-200"}`}>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-xl font-bold mt-1 ${highlight ? "text-red-700" : "text-gray-900"}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          {showForm ? "Cancel" : "+ Record Transaction"}
        </button>
        {item.reorder_url && (
          <a href={item.reorder_url} target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors">
            Reorder ↗
          </a>
        )}
        <button
          onClick={() => markOrdered.mutate(id)}
          disabled={markOrdered.isPending}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {markOrdered.isPending ? "…" : "Mark Ordered"}
        </button>
        {item.last_ordered_date && (
          <span className="self-center text-xs text-gray-400">Last ordered: {item.last_ordered_date}</span>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-brand-200 rounded-lg p-5 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Record Transaction</h3>
          {formError && <p className="text-red-600 text-sm mb-3">{formError}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500">
                {TX_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Quantity ({item.unit_of_measure}) — enter as positive number
              </label>
              <input type="number" step="0.001" min="0.001" value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="0.000"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reference (PO#, etc.)</label>
              <input type="text" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
          </div>
          <button type="submit" disabled={createTx.isPending}
            className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50">
            {createTx.isPending ? "Saving…" : "Save Transaction"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Transaction History</h2>
          <span className="text-xs text-gray-400">{transactions.length} records</span>
        </div>
        {transactions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">No transactions recorded yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium text-gray-500 text-xs">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Type</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">Qty</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">Before → After</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Reference</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-5 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(tx.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TX_COLORS[tx.type] ?? "bg-gray-100 text-gray-800"}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono text-xs ${parseFloat(tx.quantity) < 0 ? "text-red-600" : "text-green-600"}`}>
                    {parseFloat(tx.quantity) > 0 ? "+" : ""}{tx.quantity}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-gray-400 font-mono">
                    {tx.quantity_before} → {tx.quantity_after}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{tx.reference || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{tx.created_by_email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
