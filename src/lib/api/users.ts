import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface Address {
  id: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export type Preferences = Record<string, unknown>;

export const usersApi = {
  getAddresses: () => apiClient.get<Address[]>("/users/me/addresses"),
  addAddress: (data: Omit<Address, "id">) =>
    apiClient.post<Address>("/users/me/addresses", { ...data, zip: data.postalCode }),
  updateAddress: (id: string, data: Partial<Address>) =>
    apiClient.put<Address>(`/users/me/addresses/${id}`, { ...data, zip: data.postalCode }),
  deleteAddress: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/users/me/addresses/${id}`),
  updatePreferences: (data: Preferences) =>
    apiClient.put<Preferences>("/users/me/preferences", data),

  // GDPR data export (Art. 20) — returns full user document as JSON.
  exportData: () => apiClient.get<unknown>("/users/me/export"),

  // GDPR account deletion (Art. 17) — soft-delete, revoke sessions.
  deleteAccount: () => apiClient.delete<{ message: string }>("/users/me"),
};

export function useUpdatePreferences() {
  return useMutation({
    mutationFn: usersApi.updatePreferences,
  });
}

export function useAddresses() {
  return useQuery({
    queryKey: ["addresses"],
    queryFn: usersApi.getAddresses,
  });
}

export function useAddAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.addAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
    },
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Address> }) =>
      usersApi.updateAddress(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
    },
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.deleteAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
    },
  });
}

/**
 * Trigger a browser download of the user's full data export. The
 * fetch path is intentionally a direct call (not useQuery) because
 * the result is a one-shot download, not data we want to cache.
 */
export function useExportData() {
  return useMutation({
    mutationFn: usersApi.exportData,
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.deleteAccount,
    onSuccess: () => {
      // Drop every cached query — the account is gone.
      queryClient.clear();
    },
  });
}
