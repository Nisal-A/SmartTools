import Card from '../ui/Card.jsx';

export default function LinkReport({ links }) {
  const internal = links?.internal ?? 0;
  const external = links?.external ?? 0;
  const invalid = links?.invalid ?? 0;
  const invalidSamples = Array.isArray(links?.invalidSamples) ? links.invalidSamples : [];

  const stats = [
    { label: 'Internal Links', value: internal },
    { label: 'External Links', value: external },
    { label: 'Invalid Hrefs', value: invalid },
  ];

  return (
    <Card
      title="Link Inventory"
      subtitle="Internal, external, and invalid anchor href counts (informational + href hygiene)"
    >
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-center"
          >
            <p className="text-xl font-bold text-slate-900">{stat.value}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-600">{stat.label}</p>
          </div>
        ))}
      </div>

      {internal + external + invalid === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No anchor links were found on this page.</p>
      ) : invalidSamples.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sample Invalid Hrefs ({invalidSamples.length} shown of {invalid})
          </h3>
          <ul className="mt-2 space-y-1.5">
            {invalidSamples.map((href, index) => (
              <li
                key={`${href}-${index}`}
                className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 font-mono text-xs break-all text-amber-900"
                title={href}
              >
                {href}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-green-800">
          No empty, <code>#</code>-only, or <code>javascript:</code> href attributes were detected.
        </p>
      )}
    </Card>
  );
}
