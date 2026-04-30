import { useState } from "react";
import { Link } from "react-router-dom";
import { useInventory } from "../lib/queries";

const CATEGORIES = ["", "ink", "spare_part", "raw_material", "packaging", "other"];
const CAT_LABELS = { "": "All", ink: "Ink", spare_part: "Spare Part", raw_material: "Raw Material", packaging: "Packaging", other: "Other" };

function StockStatus({ item }) {
  if (item.is_low_stock) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-medium">⚠ Low</span>;
  }
  return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">OK</span>;
}

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lowStock, setLowStock] = useState(false);

  const params = {};
  if (search) params.search = search;
  if (category) params.category = category;
  if (lowStock) params.low_stock = "true";

  const { data: response, isLoading } = useInventory(params);
  const items = response?.data ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <div className="flex items-center gap-2">
          {lowStock && (
            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-medium">
              Showing low stock only
            </span>
          )}
          <span className="text-sm text-gray-500">{response?.meta?.count ?? 0} items</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <div className="flex gap-1">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                category === c ? "bg-brand-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}>
              {CAT_LABELS[c]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setLowStock((v) => !v)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            lowStock ? "bg-red-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}>
          ⚠ Low stock only
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No items found</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Item</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">In Stock</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Min</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vendor</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item) => (
                <tr key={item.id}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors ${item.is_low_stock ? "bg-red-50 hover:bg-red-100" : ""}`}
                  onClick={() => (window.location.href = `/inventory/${item.id}`)}>
                  <td className="px-5 py-3 font-medium text-gray-900">
                    <Link to={`/inventory/${item.id}`} className="hover:text-brand-600" onClick={(e) => e.stopPropagation()}>
                      {item.name}
                    </Link>
                    {item.sku && <span className="ml-2 text-xs text-gray-400">{item.sku}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{item.category?.replace("_", " ")}</td>
                  <td className={`px-4 py-3 text-right font-mono ${item.is_low_stock ? "text-red-700 font-bold" : "text-gray-900"}`}>
                    {item.current_quantity} {item.unit_of_measure}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500">
                    {item.min_stock_level} {item.unit_of_measure}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{item.vendor_name ?? "—"}</td>
                  <td className="px-4 py-3 text-center"><StockStatus item={item} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
