import { useCallback, useEffect, useState } from 'react';
import { getGlobalStats } from '../../../services/seo.api.js';

export function useGlobalStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGlobalStats({ signal });
      setStats(data);
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      setError({
        code: err.code ?? 'INTERNAL_ERROR',
        message: err.message || 'Unable to load platform audit metrics.',
      });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchStats(controller.signal);
    return () => controller.abort();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: () => fetchStats(),
  };
}

export default useGlobalStats;
