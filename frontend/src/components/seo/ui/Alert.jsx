import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const VARIANT_STYLES = {
  error: {
    icon: XCircle,
    container: 'border-red-200 bg-red-50 text-red-900',
    iconColor: 'text-red-600',
  },
  warning: {
    icon: AlertTriangle,
    container: 'border-amber-200 bg-amber-50 text-amber-900',
    iconColor: 'text-amber-600',
  },
  success: {
    icon: CheckCircle2,
    container: 'border-green-200 bg-green-50 text-green-900',
    iconColor: 'text-green-600',
  },
  info: {
    icon: Info,
    container: 'border-blue-200 bg-blue-50 text-blue-900',
    iconColor: 'text-blue-600',
  },
};

export default function Alert({
  variant = 'info',
  title,
  children,
  onDismiss,
  action,
  className = '',
}) {
  const style = VARIANT_STYLES[variant] ?? VARIANT_STYLES.info;
  const Icon = style.icon;

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex items-start justify-between gap-3 rounded-lg border p-4 text-sm ${style.container} ${className}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconColor}`} aria-hidden="true" />
        <div>
          {title ? <h3 className="font-semibold">{title}</h3> : null}
          {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>

      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="rounded-md p-1 opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
