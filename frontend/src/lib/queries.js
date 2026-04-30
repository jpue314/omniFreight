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
    mutationFn: (data) => {
      if (!itemId) return Promise.reject(new Error("itemId is required"));
      return api.post(`/inventory/${itemId}/transactions/`, data).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
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

export const useNotifications = (params = {}, options = {}) =>
  useQuery({
    queryKey: ["notifications", params],
    queryFn: () => api.get("/notifications/", { params }).then((r) => r.data),
    refetchInterval: 60_000,
    ...options,
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
