import { useParams, Link } from "react-router-dom";
import { useVendor, useVendorItems, useVendorMachines } from "../lib/queries";

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500 w-36 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 flex-1">{value}</span>
    </div>
  );
}

function StockBadge({ item }) {
  const isLow = item.is_low_stock;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      isLow ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
    }`}>
      {item.current_quantity} {item.unit_of_measure}{isLow ? " ⚠ low" : ""}
    </span>
  );
}

export default function VendorDetail() {
  const { id } = useParams();
  const { data: vResponse, isLoading } = useVendor(id);
  const { data: itemsResponse } = useVendorItems(id);
  const { data: machinesResponse } = useVendorMachines(id);

  const vendor = vResponse?.data;
  const items = itemsResponse?.data ?? [];
  const machines = machinesResponse?.data ?? [];

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!vendor) return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400">Vendor not found</div>;

  const additionalContacts = Array.isArray(vendor.additional_contacts) ? vendor.additional_contacts : [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-4">
        <Link to="/vendors" className="text-sm text-brand-600 hover:underline">← Vendors</Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{vendor.name}</h1>
          <span className="text-sm text-gray-500 capitalize">{vendor.type?.replace("_", " ")}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Primary Contact</h2>
          <InfoRow label="Name" value={vendor.primary_contact_name} />
          <InfoRow label="Email" value={vendor.primary_contact_email} />
          <InfoRow label="Phone" value={vendor.primary_contact_phone} />
          <InfoRow label="Payment terms" value={vendor.payment_terms} />
          <InfoRow label="Payment method" value={vendor.preferred_payment_method} />
          <InfoRow label="Website" value={vendor.website} />
          {vendor.portal_notes && (
            <div className="mt-3 p-3 bg-amber-50 rounded text-sm text-amber-900">
              <span className="font-medium">Portal notes: </span>{vendor.portal_notes}
            </div>
          )}
        </div>

        {additionalContacts.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Additional Contacts</h2>
            {additionalContacts.map((c, i) => (
              <div key={i} className="py-2 border-b last:border-0">
                <div className="font-medium text-sm text-gray-900">{c.name} <span className="font-normal text-gray-500">{c.title}</span></div>
                <div className="text-xs text-gray-500">{c.email} · {c.phone}</div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-5 lg:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-3">Items Supplied ({items.length})</h2>
          {items.length === 0 ? (
            <p className="text-sm text-gray-400">No inventory items linked to this vendor</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map((item) => (
                <Link key={item.id} to={`/inventory/${item.id}`}
                  className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{item.category}</span>
                  </div>
                  <StockBadge item={item} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {machines.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-5 lg:col-span-2">
            <h2 className="font-semibold text-gray-900 mb-3">Machines ({machines.length})</h2>
            <div className="divide-y divide-gray-50">
              {machines.map((m) => (
                <Link key={m.id} to={`/machines/${m.id}`}
                  className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
                  <span className="text-sm font-medium text-gray-900">{m.name}</span>
                  <span className="text-xs text-gray-400">{m.make} {m.model}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
