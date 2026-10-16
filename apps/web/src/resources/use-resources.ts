import useSWR from "swr";
import { listResources, type Resource } from "./api.ts";

export type ResourcesState = {
  resources: Resource[];
  loading: boolean;
  error?: string;
  reload: () => void;
};

const RESOURCES_KEY = "/api/resources";

/** Shares one cached list across components; call reload after changing the resources. */
export function useResources(): ResourcesState {
  const { data, error, isLoading, mutate } = useSWR(RESOURCES_KEY, () => listResources());
  return {
    resources: data ?? [],
    loading: isLoading,
    error: error && (error instanceof Error ? error.message : String(error)),
    reload: () => void mutate(),
  };
}
