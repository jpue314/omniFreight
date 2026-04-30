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
