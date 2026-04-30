# Phase 1A Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 6 React pages (Vendors, Inventory, Reorder Queue, Machines + details) and notification bell that put a UI on top of the Phase 1A backend API.

**Architecture:** All API calls go through `src/lib/queries.js` (React Query v5 hooks). Pages import hooks and focus only on rendering. The `{data, errors, meta}` envelope means every response shape is `response.data` = array/object, `response.meta` = pagination. Tests use Vitest + React Testing Library with a mocked `api` module.

**Tech Stack:** React 18, React Router v6, TanStack React Query v5, Axios, Tailwind CSS 3, Vitest, @testing-library/react

---

## File Map

**Create:**
```
frontend/src/lib/queries.js               — all React Query hooks and mutations
frontend/src/test/setup.js                — @testing-library/jest-dom import
frontend/src/components/NotificationBell.jsx — bell icon + dropdown
frontend/src/pages/Vendors.jsx            — vendor directory list
frontend/src/pages/VendorDetail.jsx       — vendor contact + items + machines
frontend/src/pages/Inventory.jsx          — catalog with filters + low-stock highlight
frontend/src/pages/InventoryDetail.jsx    — item info + transaction history + record form
frontend/src/pages/ReorderQueue.jsx       — low-stock grouped by vendor with urgency
frontend/src/pages/Machines.jsx           — machine asset list
frontend/src/pages/MachineDetail.jsx      — device info + linked items tabs
```

**Modify:**
```
frontend/package.json                     — add vitest + RTL devDeps, add test script
frontend/vite.config.js                   — add test config block
frontend/src/components/NavBar.jsx        — add Machines + Reorder links, add NotificationBell
frontend/src/pages/Dashboard.jsx          — replace placeholders with real data widgets
frontend/src/App.jsx                      — add all new routes
```

---

## Task 1: Frontend Test Setup (Vitest + React Testing Library)

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.js`
- Create: `frontend/src/test/setup.js`

- [ ] **Step 1: Install test dependencies inside the frontend container**
```bash
docker-compose exec frontend npm install -D vitest@2 @testing-library/react@16 @testing-library/jest-dom@6 @testing-library/user-event@14 jsdom@25
```
Expected: `added N packages` with no errors

- [ ] **Step 2: Add test script to `frontend/package.json`**

Replace the `scripts` block:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "lint": "eslint src --ext js,jsx",
  "test": "vitest run",
  "test:watch": "vitest"
},
```

- [ ] **Step 3: Add test config to `frontend/vite.config.js`**

Replace the entire file:
```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.API_URL || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 4: Create `frontend/src/test/setup.js`**
```javascript
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Verify test runner works**
```bash
docker-compose exec frontend npm test 2>&1 | tail -5
```
Expected: `No test files found` or `0 tests` — no errors

- [ ] **Step 6: Commit**
```bash
git add frontend/package.json frontend/vite.config.js frontend/src/test/setup.js
git commit -m "test: add Vitest + React Testing Library to frontend"
```

---

## Task 2: API Query Hooks Library

**Files:**
- Create: `frontend/src/lib/queries.js`

- [ ] **Step 1: Create `frontend/src/lib/queries.js`**
```javascript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "./api";

// ── Vendors ──────────────────────────────────────────────────────────────────

export const useVendors = (params = {}) =>
  useQuery({
    queryKey: ["vendors", params],
    queryFn: () => api.get("/vendors/", { params }).then((r) => r.data),
  });

export const useVendor = (id) =>
  useQuery({
    queryKey: ["vendors", id],
    queryFn: () => api.get(`/vendors/${id}/`).then((r) => r.data),
    enabled: !!id,
  });

export const useVendorItems = (id) =>
  useQuery({
    queryKey: ["vendors", id, "items"],
    queryFn: () => api.get(`/vendors/${id}/items/`).then((r) => r.data),
    enabled: !!id,
  });

export const useVendorMachines = (id) =>
  useQuery({
    queryKey: ["vendors", id, "machines"],
    queryFn: () => api.get(`/vendors/${id}/machines/`).then((r) => r.data),
    enabled: !!id,
  });

// ── Inventory ─────────────────────────────────────────────────────────────────

export const useInventory = (params = {}) =>
  useQuery({
    queryKey: ["inventory", params],
    queryFn: () => api.get("/inventory/", { params }).then((r) => r.data),
  });

export const useInventoryItem = (id) =>
  useQuery({
    queryKey: ["inventory", id],
    queryFn: () => api.get(`/inventory/${id}/`).then((r) => r.data),
    enabled: !!id,
  });

export const useTransactions = (itemId) =>
  useQuery({
    queryKey: ["inventory", itemId, "transactions"],
    queryFn: () =>
      api.get(`/inventory/${itemId}/transactions/`).then((r) => r.data),
    enabled: !!itemId,
  });

export const useCreateTransaction = (itemId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) =>
      api.post(`/inventory/${itemId}/transactions/`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", itemId] });
      qc.invalidateQueries({ queryKey: ["inventory", itemId, "transactions"] });
      qc.invalidateQueries({ queryKey: ["reorder"] });
    },
  });
};

export const useMarkOrdered = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId) =>
      api.post(`/inventory/${itemId}/mark-ordered/`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["reorder"] });
    },
  });
};

// ── Reorder Queue ─────────────────────────────────────────────────────────────

export const useReorderQueue = () =>
  useQuery({
    queryKey: ["reorder"],
    queryFn: () => api.get("/reorder/").then((r) => r.data),
    refetchInterval: 5 * 60_000,
  });

// ── Machines ──────────────────────────────────────────────────────────────────

export const useMachines = () =>
  useQuery({
    queryKey: ["machines"],
    queryFn: () => api.get("/machines/").then((r) => r.data),
  });

export const useMachine = (id) =>
  useQuery({
    queryKey: ["machines", id],
    queryFn: () => api.get(`/machines/${id}/`).then((r) => r.data),
    enabled: !!id,
  });

export const useMachineItems = (id) =>
  useQuery({
    queryKey: ["machines", id, "items"],
    queryFn: () => api.get(`/machines/${id}/items/`).then((r) => r.data),
    enabled: !!id,
  });

// ── Notifications ─────────────────────────────────────────────────────────────

export const useNotifications = (params = {}) =>
  useQuery({
    queryKey: ["notifications", params],
    queryFn: () => api.get("/notifications/", { params }).then((r) => r.data),
    refetchInterval: 60_000,
  });

export const useUnreadCount = () =>
  useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () =>
      api.get("/notifications/unread-count/").then((r) => r.data),
    refetchInterval: 30_000,
  });

export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      api.post(`/notifications/${id}/read/`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
};

export const useMarkAllRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/notifications/read-all/").then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
};
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/lib/queries.js
git commit -m "feat: add React Query hooks library for all API endpoints (closes #15)"
```

---

## Task 3: App.jsx Routes + NavBar Links

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/NavBar.jsx`

- [ ] **Step 1: Replace `frontend/src/App.jsx`**
```javascript
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import NavBar from "./components/NavBar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Vendors from "./pages/Vendors";
import VendorDetail from "./pages/VendorDetail";
import Inventory from "./pages/Inventory";
import InventoryDetail from "./pages/InventoryDetail";
import ReorderQueue from "./pages/ReorderQueue";
import Machines from "./pages/Machines";
import MachineDetail from "./pages/MachineDetail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main>{children}</main>
    </div>
  );
}

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/vendors" element={<Protected><Vendors /></Protected>} />
            <Route path="/vendors/:id" element={<Protected><VendorDetail /></Protected>} />
            <Route path="/inventory" element={<Protected><Inventory /></Protected>} />
            <Route path="/inventory/:id" element={<Protected><InventoryDetail /></Protected>} />
            <Route path="/reorder" element={<Protected><ReorderQueue /></Protected>} />
            <Route path="/machines" element={<Protected><Machines /></Protected>} />
            <Route path="/machines/:id" element={<Protected><MachineDetail /></Protected>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Replace `frontend/src/components/NavBar.jsx`**
```javascript
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import NotificationBell from "./NotificationBell";

const navItems = [
  { label: "Dashboard", to: "/" },
  { label: "Inventory", to: "/inventory" },
  { label: "Reorder", to: "/reorder" },
  { label: "Vendors", to: "/vendors" },
  { label: "Machines", to: "/machines" },
];

const adminItems = [{ label: "Users", to: "/users" }];

export default function NavBar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const items = user?.role === "admin" ? [...navItems, ...adminItems] : navItems;

  return (
    <nav className="bg-brand-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <span className="font-bold text-lg tracking-tight">omniFreight</span>
            <div className="hidden md:flex gap-1">
              {items.map(({ label, to }) => (
                <Link
                  key={to}
                  to={to}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    pathname === to || (to !== "/" && pathname.startsWith(to))
                      ? "bg-brand-700 text-white"
                      : "text-blue-100 hover:bg-brand-700 hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <NotificationBell />
            <span className="text-blue-200">{user?.full_name}</span>
            <span className="px-2 py-0.5 rounded bg-brand-700 text-xs uppercase tracking-wide">
              {user?.role}
            </span>
            <button
              onClick={logout}
              className="ml-2 px-3 py-1.5 rounded border border-blue-400 text-blue-200 hover:bg-brand-700 hover:text-white transition-colors text-xs"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

Note: `NotificationBell` is created in Task 4. App.jsx imports pages created in Tasks 5–10. These imports will cause build errors until those tasks are complete — that's expected. The build only needs to succeed after Task 10.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/App.jsx frontend/src/components/NavBar.jsx
git commit -m "feat: add all routes and update NavBar links"
```

---

## Task 4: Notification Bell

**Files:**
- Create: `frontend/src/components/NotificationBell.jsx`

- [ ] **Step 1: Create `frontend/src/components/NotificationBell.jsx`**
```javascript
import { useState, useRef, useEffect } from "react";
import { useUnreadCount, useNotifications, useMarkRead, useMarkAllRead } from "../lib/queries";

const TYPE_COLORS = {
  low_stock: "bg-amber-100 text-amber-800",
  deadline: "bg-orange-100 text-orange-800",
  overdue: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const { data: countData } = useUnreadCount();
  const unread = countData?.data?.count ?? 0;

  const { data: notifData } = useNotifications({}, { enabled: open });
  const notifications = notifData?.data ?? [];

  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-1.5 rounded text-blue-200 hover:bg-brand-700 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-medium">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-gray-900 text-sm">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-brand-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">No notifications</p>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b last:border-0 ${!n.is_read ? "bg-blue-50" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[n.type] ?? TYPE_COLORS.info}`}>
                      {n.type.replace("_", " ")}
                    </span>
                    <p className="text-sm text-gray-700 flex-1">{n.message}</p>
                    {!n.is_read && (
                      <button
                        onClick={() => markRead.mutate(n.id)}
                        className="shrink-0 text-xs text-gray-400 hover:text-gray-700"
                        title="Mark read"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 pl-10">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/components/NotificationBell.jsx
git commit -m "feat: add notification bell with unread count and dropdown (closes #10)"
```

---

## Task 5: Vendors List Page

**Files:**
- Create: `frontend/src/pages/Vendors.jsx`

- [ ] **Step 1: Create `frontend/src/pages/Vendors.jsx`**
```javascript
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
```

- [ ] **Step 2: Verify build succeeds** (run after all pages are created in Task 10 — skip this check until then)

- [ ] **Step 3: Commit**
```bash
git add frontend/src/pages/Vendors.jsx
git commit -m "feat: add Vendors list page with search and type filter (closes #11 part 1)"
```

---

## Task 6: VendorDetail Page

**Files:**
- Create: `frontend/src/pages/VendorDetail.jsx`

- [ ] **Step 1: Create `frontend/src/pages/VendorDetail.jsx`**
```javascript
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
      {item.current_quantity} {item.unit_of_measure} {isLow ? "⚠ low" : ""}
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
        {/* Contact info */}
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

        {/* Additional contacts */}
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

        {/* Items supplied */}
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

        {/* Machines */}
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
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/pages/VendorDetail.jsx
git commit -m "feat: add VendorDetail page with contacts, items, and machines (closes #11 part 2)"
```

---

## Task 7: Inventory List Page

**Files:**
- Create: `frontend/src/pages/Inventory.jsx`

- [ ] **Step 1: Create `frontend/src/pages/Inventory.jsx`**
```javascript
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
                  <td className="px-4 py-3 text-gray-500">{item.vendor ?? "—"}</td>
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
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/pages/Inventory.jsx
git commit -m "feat: add Inventory catalog with category and low-stock filters (closes #12 part 1)"
```

---

## Task 8: InventoryDetail Page

**Files:**
- Create: `frontend/src/pages/InventoryDetail.jsx`

- [ ] **Step 1: Create `frontend/src/pages/InventoryDetail.jsx`**
```javascript
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
            {item.category?.replace("_", " ")} {item.sku && `· ${item.sku}`}
          </p>
        </div>
        {item.is_low_stock && (
          <span className="bg-red-100 text-red-800 text-sm px-3 py-1 rounded-full font-medium">⚠ Low stock</span>
        )}
      </div>

      {/* Stats row */}
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

      {/* Actions */}
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

      {/* Transaction form */}
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

      {/* Transaction history */}
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
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/pages/InventoryDetail.jsx
git commit -m "feat: add InventoryDetail with transaction history and record form (closes #12 part 2)"
```

---

## Task 9: Reorder Queue Page

**Files:**
- Create: `frontend/src/pages/ReorderQueue.jsx`

- [ ] **Step 1: Create `frontend/src/pages/ReorderQueue.jsx`**
```javascript
import { Link } from "react-router-dom";
import { useReorderQueue, useMarkOrdered } from "../lib/queries";

const URGENCY = {
  red: { badge: "bg-red-600 text-white", label: "Order TODAY" },
  amber: { badge: "bg-amber-500 text-white", label: "Order soon" },
  green: { badge: "bg-green-600 text-white", label: "Plan ahead" },
};

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
              {/* Vendor header */}
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

              {/* Items table */}
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
                            {item.order_by_date === new Date().toISOString().slice(0, 10)
                              ? "TODAY"
                              : item.order_by_date < new Date().toISOString().slice(0, 10)
                                ? "OVERDUE"
                                : item.order_by_date}
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
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/pages/ReorderQueue.jsx
git commit -m "feat: add Reorder Queue page with urgency colours and mark-ordered (closes #13)"
```

---

## Task 10: Machines List + MachineDetail Pages

**Files:**
- Create: `frontend/src/pages/Machines.jsx`
- Create: `frontend/src/pages/MachineDetail.jsx`

- [ ] **Step 1: Create `frontend/src/pages/Machines.jsx`**
```javascript
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
```

- [ ] **Step 2: Create `frontend/src/pages/MachineDetail.jsx`**
```javascript
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

      {/* Tabs */}
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
```

- [ ] **Step 3: Verify the frontend build compiles with all new pages**
```bash
docker-compose exec frontend npm run build 2>&1 | tail -10
```
Expected: `built in Xs` — no errors

- [ ] **Step 4: Commit**
```bash
git add frontend/src/pages/Machines.jsx frontend/src/pages/MachineDetail.jsx
git commit -m "feat: add Machines list and MachineDetail pages with linked items tab (closes #14)"
```

---

## Task 11: Dashboard Live Widgets + Verification

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: Replace `frontend/src/pages/Dashboard.jsx`**
```javascript
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

      {/* Reorder Queue preview */}
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
```

- [ ] **Step 2: Run build verification**
```bash
docker-compose exec frontend npm run build 2>&1 | tail -15
```
Expected: clean build, no errors, output like `dist/assets/index-[hash].js`

- [ ] **Step 3: Start dev server and verify each page loads**
```bash
# Dev server should already be running. Open these URLs in your browser:
# http://localhost:5173/vendors
# http://localhost:5173/inventory
# http://localhost:5173/reorder
# http://localhost:5173/machines
```
Expected: each page loads, shows loading spinner, then data from the API

- [ ] **Step 4: Push branch**
```bash
git add frontend/src/pages/Dashboard.jsx
git commit -m "feat: update Dashboard with live low-stock, reorder queue, and unread count widgets"
git push origin feat/phase1a-frontend
```

- [ ] **Step 5: Create PR**
```bash
gh pr create \
  --title "feat: Phase 1A Frontend — Vendor, Inventory, Reorder Queue, Machine pages" \
  --base main \
  --body "Adds all Phase 1A frontend pages connecting to the backend API built in PR #9.

## Pages added
- /vendors — searchable directory with type filter
- /vendors/:id — contact info, items supplied, machines
- /inventory — catalog with category/low-stock filters
- /inventory/:id — item detail + full transaction history + record transaction form
- /reorder — low-stock items grouped by vendor with urgency countdowns
- /machines — asset grid with warranty status
- /machines/:id — Info / Linked Items / Network Config tabs

## Components added
- NotificationBell — bell icon with unread count badge + dropdown

## Infrastructure
- src/lib/queries.js — all React Query hooks for every API endpoint
- Vitest + React Testing Library setup

Closes #10 #11 #12 #13 #14 #15

🤖 Generated with [Claude Code](https://claude.ai/claude-code)"
```

---

## Verification Checklist

- [ ] `npm run build` exits 0 — no compilation errors
- [ ] `/vendors` — list loads, search filters work, type filter pills work
- [ ] `/vendors/:id` — contact info shows, linked items with stock badges show
- [ ] `/inventory` — table loads with low-stock rows highlighted red
- [ ] `/inventory/:id` — transaction history shows, recording a receipt updates current_quantity
- [ ] `/reorder` — shows empty state when all stocked; shows vendor groups when items are low
- [ ] `/machines` — machine cards show with warranty warning on expired dates
- [ ] `/machines/:id` — tabs switch between Info / Linked Items / Network Config
- [ ] Notification bell shows unread count badge; clicking opens dropdown
- [ ] Dashboard shows live low-stock count and reorder urgency count
