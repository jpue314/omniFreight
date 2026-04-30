import { useState } from "react";
import { Link } from "react-router-dom";
import { useVendors } from "../lib/queries";

const TYPE_LABELS = {
  supplier: { label: "Supplier", color: "bg-blue-100 text-blue-800" },
  manufacturer: { label: "Manufacturer", color: "bg-purple-100 text-purple-800" },
  freight_forwarder: { label: "Forwarder", color: "bg-pink-100 text-pink-800" },
  carrier: { label: "Carrier", color: "bg-gray-100 text-gray-800" },
};

const TYPES = ["", "supplier", "manufacturer", "freight_forwarder", "carrier"];
const TYPE_NAMES = { "": "All", supplier: "Supplier", manufacturer: "Manufacturer", freight_forwarder: "Forwarder", carrier: "Carrier" };

export default function Vendors() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");

  const params = {};
  if (search) params.search = search;
  if (type) params.type = type;

  const { data: response, isLoading } = useVendors(params);
  const vendors = response?.data ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
        <span className="text-sm text-gray-500">{response?.meta?.count ?? 0} vendors</span>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search vendors…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <div className="flex gap-1">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                type === t ? "bg-brand-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {TYPE_NAMES[t]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : vendors.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No vendors found</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {vendors.map((v) => {
            const badge = TYPE_LABELS[v.type] ?? { label: v.type, color: "bg-gray-100 text-gray-800" };
            return (
              <Link
                key={v.id}
                to={`/vendors/${v.id}`}
                className="flex items-center px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{v.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {v.primary_contact_name && <span>{v.primary_contact_name}</span>}
                    {v.primary_contact_email && <span className="ml-2 text-gray-400">{v.primary_contact_email}</span>}
                  </div>
                </div>
                <div className="text-sm text-gray-400 shrink-0">{v.payment_terms}</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
