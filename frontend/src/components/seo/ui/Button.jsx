import { forwardRef } from 'react';
import Spinner from './Spinner.jsx';

const VARIANT_CLASSES = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-blue-600 shadow-xs border border-transparent',
  secondary:
    'bg-slate-900 text-white hover:bg-slate-800 focus-visible:outline-slate-900 shadow-xs border border-transparent',
  outline:
    'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 focus-visible:outline-blue-600 shadow-2xs',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:outline-blue-600 border border-transparent',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600 shadow-xs border border-transparent',
};

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

const Button = forwardRef(function Button(
  {
    type = 'button',
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const variantClass = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary;
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClass} ${sizeClass} ${className}`}
      {...rest}
    >
      {loading ? <Spinner size="sm" label="" className="text-current" /> : null}
      {children}
    </button>
  );
});

export default Button;
