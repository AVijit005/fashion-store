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

export const usersApi = {
  getAddresses: () => apiClient.get<Address[]>("/users/me/addresses"),
  addAddress: (data: Omit<Address, "id">) =>
    apiClient.post<Address>("/users/me/addresses", { ...data, zip: data.postalCode }),
  updateAddress: (id: string, data: Partial<Address>) =>
    apiClient.put<Address>(`/users/me/addresses/${id}`, { ...data, zip: data.postalCode }),
  deleteAddress: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/users/me/addresses/${id}`),
  updatePreferences: (data: any) => apiClient.put<any>("/users/me/preferences", data),
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
