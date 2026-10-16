import { useCallback, useEffect, useState } from "react";
import { listResources, type Resource } from "./api.ts";

export type ResourcesState = {
  resources: Resource[];
  loading: boolean;
  error?: string;
  reload: () => void;
};

/** Loads the stored resources on mount; call reload after changing them. */
export function useResources(): ResourcesState {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    listResources(controller.signal)
      .then((result) => {
        setResources(result);
        setError(undefined);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { resources, loading, error, reload };
}
