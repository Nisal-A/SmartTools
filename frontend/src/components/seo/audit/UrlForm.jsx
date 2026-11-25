import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Search } from 'lucide-react';
import useAnalyzeAudit from '../../../pages/SeoAnalyzer/hooks/useAnalyzeAudit.js';
import Alert from '../ui/Alert.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';

export default function UrlForm({ initialUrl = '', onSuccess }) {
  const [url, setUrl] = useState(initialUrl);
  const [validationError, setValidationError] = useState(null);
  const { analyze, loading, error, clearError } = useAnalyzeAudit();
  const navigate = useNavigate();

  const handleChange = (event) => {
    setUrl(event.target.value);
    if (validationError) setValidationError(null);
    if (error) clearError();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmed = url.trim();
    if (!trimmed) {
      setValidationError('Please enter a website URL to analyze (for example, https://example.com).');
      return;
    }

    setValidationError(null);
    const audit = await analyze(trimmed);

    if (audit && audit._id) {
      if (typeof onSuccess === 'function') {
        onSuccess(audit);
      }
      navigate(`/tools/seo-analyzer/audits/${audit._id}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Input
            id="audit-url-input"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://example.com"
            aria-label="Website URL to analyze"
            value={url}
            onChange={handleChange}
            disabled={loading}
            leadingIcon={Globe}
            error={validationError}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={loading}
          className="h-[42px] shrink-0 sm:px-6"
        >
          {!loading ? <Search className="h-4 w-4" aria-hidden="true" /> : null}
          <span>{loading ? 'Analyzing page…' : 'Analyze URL'}</span>
        </Button>
      </div>

      {error ? (
        <Alert
          variant="error"
          title="Unable to analyze URL"
          onDismiss={clearError}
        >
          {error.message}
        </Alert>
      ) : null}
    </form>
  );
}
