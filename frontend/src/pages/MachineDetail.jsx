import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMachine, useMachineItems } from "../lib/queries";

const TABS = ["Info", "Linked Items", "Network Config"];

export default function MachineDetail() {
  const { id } = useParams();
  const [tab, setTab] = useState("Info");

  const { data: mResponse, isLoading } = useMachine(id);
  const { data: itemsResponse } = useMachineItems(id);

  const machine = mResponse?.data;
  const items = itemsResponse?.data ?? [];

  if (isLoading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!machine) return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400">Machine not found</div>;

  const network = machine.network_config ?? {};

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-4">
        <Link to="/machines" className="text-sm text-brand-600 hover:underline">← Machines</Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{machine.name}</h1>
        <p className="text-sm text-gray-500 mt-0.5 capitalize">{machine.type} · {machine.make} {machine.model}</p>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-brand-600 text-brand-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t}
            {t === "Linked Items" && items.length > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${items.some(i => i.is_low_stock) ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                {items.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "Info" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Asset Details</h2>
            {[
              ["Asset ID", machine.asset_id],
              ["Make", machine.make],
              ["Model", machine.model],
              ["Serial Number", machine.serial_number],
              ["Purchase Date", machine.purchase_date],
              ["Purchase Price", machine.purchase_price ? `$${machine.purchase_price}` : null],
              ["Warranty Expires", machine.warranty_expiration],
            ].map(([label, value]) => value ? (
              <div key={label} className="flex gap-3 py-2 border-b border-gray-50 last:border-0 text-sm">
                <span className="text-gray-500 w-36 shrink-0">{label}</span>
                <span className="text-gray-900">{value}</span>
              </div>
            ) : null)}
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Support Contact</h2>
            {[
              ["Name", machine.support_contact_name],
              ["Phone", machine.support_contact_phone],
              ["Email", machine.support_contact_email],
            ].map(([label, value]) => value ? (
              <div key={label} className="flex gap-3 py-2 border-b border-gray-50 last:border-0 text-sm">
                <span className="text-gray-500 w-16 shrink-0">{label}</span>
                <span className="text-gray-900">{value}</span>
              </div>
            ) : null)}
            {machine.service_notes && (
              <div className="mt-3 p-3 bg-gray-50 rounded text-sm text-gray-700">
                <span className="font-medium text-gray-600">Service notes: </span>{machine.service_notes}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "Linked Items" && (
        <div className="bg-white rounded-lg border border-gray-200">
          {items.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">No inventory items linked to this machine</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Item</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">In Stock</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Min</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => (
                  <tr key={item.id} className={`hover:bg-gray-50 ${item.is_low_stock ? "bg-red-50" : ""}`}>
                    <td className="px-5 py-3">
                      <Link to={`/inventory/${item.id}`} className="font-medium text-gray-900 hover:text-brand-600">{item.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{item.category?.replace("_", " ")}</td>
                    <td className={`px-4 py-3 text-right font-mono ${item.is_low_stock ? "text-red-700 font-bold" : "text-gray-900"}`}>
                      {item.current_quantity} {item.unit_of_measure}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">{item.min_stock_level}</td>
                    <td className="px-4 py-3 text-center">
                      {item.is_low_stock
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-medium">⚠ Low</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "Network Config" && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          {Object.keys(network).length === 0 ? (
            <p className="text-sm text-gray-400">No network configuration set</p>
          ) : (
            <>
              {[["IP Address", network.ip], ["Hostname", network.hostname], ["SNMP Community", network.snmp_community]].map(([label, value]) =>
                value ? (
                  <div key={label} className="flex gap-3 py-2 border-b border-gray-50 last:border-0 text-sm">
                    <span className="text-gray-500 w-36 shrink-0">{label}</span>
                    <code className="text-gray-900 font-mono">{value}</code>
                  </div>
                ) : null
              )}
            </>
          )}
          <p className="mt-4 text-xs text-gray-400">Phase 2: live ink levels via SNMP polling will appear here.</p>
        </div>
      )}
    </div>
  );
}
