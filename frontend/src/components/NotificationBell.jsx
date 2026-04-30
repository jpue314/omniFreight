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
