import { useState, useCallback } from 'react';

interface UseApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: any;
  execute: (promise: Promise<T>) => Promise<T | void>;
}

export const useApi = <T = any>(options?: UseApiOptions): UseApiReturn<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const execute = useCallback(
    async (promise: Promise<T>): Promise<T | void> => {
      setLoading(true);
      setError(null);

      try {
        const result = await promise;
        setData(result);
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        setError(err);
        options?.onError?.(err);
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  return { data, loading, error, execute };
};

export default useApi;
