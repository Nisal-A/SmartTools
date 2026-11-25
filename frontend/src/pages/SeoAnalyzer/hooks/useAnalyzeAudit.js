import { useCallback, useState } from 'react';
import { analyzeUrl } from '../../../services/seo.api.js';

export function useAnalyzeAudit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const analyze = useCallback(async (rawUrl) => {
    setLoading(true);
    setError(null);
    try {
      const audit = await analyzeUrl(rawUrl);
      return audit;
    } catch (err) {
      setError({
        code: err.code ?? 'INTERNAL_ERROR',
        message: err.message || 'Could not complete the SEO audit.',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    analyze,
    loading,
    error,
    clearError,
  };
}

export default useAnalyzeAudit;
