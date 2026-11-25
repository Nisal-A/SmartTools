import { useCallback, useEffect, useState } from 'react';
import { getAuditById } from '../../../services/seo.api.js';

export function useAuditDetail(auditId) {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(Boolean(auditId));
  const [error, setError] = useState(null);

  const fetchDetail = useCallback(
    async (signal) => {
      if (!auditId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getAuditById(auditId, { signal });
        setAudit(data);
      } catch (err) {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        setError({
          code: err.code ?? 'NOT_FOUND',
          message: err.message || 'Unable to load the requested audit report.',
        });
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [auditId]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchDetail(controller.signal);
    return () => controller.abort();
  }, [fetchDetail]);

  return {
    audit,
    loading,
    error,
    refetch: () => fetchDetail(),
  };
}

export default useAuditDetail;
