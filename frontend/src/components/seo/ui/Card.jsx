export default function Card({ title, subtitle, action, className = '', children, ...rest }) {
  const hasHeader = Boolean(title || subtitle || action);

  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-2xs ${className}`}
      {...rest}
    >
      {hasHeader ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            {title ? <h2 className="text-base font-semibold text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p> : null}
          </div>
          {action ? <div>{action}</div> : null}
        </header>
      ) : null}
      <div className="p-6">{children}</div>
    </section>
  );
}
