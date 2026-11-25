import { useEffect, useId, useState } from 'react';
import { Search, X } from 'lucide-react';

const DEBOUNCE_MS = 300;

export default function SearchBar({ value = '', onChange, placeholder = 'Search by URL or page title…' }) {
  const [localValue, setLocalValue] = useState(value);
  const inputId = useId();

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [localValue, value, onChange]);

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <div className="relative w-full sm:max-w-md">
      <label htmlFor={inputId} className="sr-only">
        Search audit history by URL or page title
      </label>

      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
        <Search className="h-4 w-4" aria-hidden="true" />
      </span>

      <input
        id={inputId}
        type="search"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-10 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-1 focus:outline-blue-600"
      />

      {localValue ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search query"
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
