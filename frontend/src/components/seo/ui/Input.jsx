import { useId } from 'react';

export default function Input({
  id,
  label,
  error,
  helperText,
  leadingIcon: LeadingIcon,
  className = '',
  inputClassName = '',
  ...rest
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const messageId = `${inputId}-message`;
  const hasError = Boolean(error);

  return (
    <div className={`w-full ${className}`}>
      {label ? (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-900">
          {label}
        </label>
      ) : null}

      <div className="relative">
        {LeadingIcon ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <LeadingIcon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}

        <input
          id={inputId}
          aria-invalid={hasError}
          aria-describedby={error || helperText ? messageId : undefined}
          className={`block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:-outline-offset-1 ${
            LeadingIcon ? 'pl-10' : ''
          } ${
            hasError
              ? 'border-red-400 focus:outline-red-600'
              : 'border-slate-300 focus:outline-blue-600'
          } disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${inputClassName}`}
          {...rest}
        />
      </div>

      {error ? (
        <p id={messageId} className="mt-1.5 text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p id={messageId} className="mt-1.5 text-xs text-slate-600">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
