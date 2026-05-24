import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const providerProfileKeys = {
  all: () => ["provider-profiles"] as const,
};

export function providerProfilesOptions() {
  return queryOptions({
    queryKey: providerProfileKeys.all(),
    queryFn: () => api.getProviderProfiles(),
    staleTime: 5 * 60 * 1000,
  });
}
