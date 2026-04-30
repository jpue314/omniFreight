import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import NotificationBell from "./NotificationBell";

const navItems = [
  { label: "Dashboard", to: "/" },
  { label: "Inventory", to: "/inventory" },
  { label: "Reorder", to: "/reorder" },
  { label: "Vendors", to: "/vendors" },
  { label: "Machines", to: "/machines" },
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const items = navItems;

  return (
    <nav className="bg-brand-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <span className="font-bold text-lg tracking-tight">omniFreight</span>
            <div className="hidden md:flex gap-1">
              {items.map(({ label, to }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded text-sm font-medium transition-colors ${
                      isActive ? "bg-brand-700 text-white" : "text-blue-100 hover:bg-brand-700 hover:text-white"
                    }`
                  }
                >
                  {label}
                </NavLink>
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
