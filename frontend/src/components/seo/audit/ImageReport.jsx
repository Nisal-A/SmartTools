import Card from '../ui/Card.jsx';

export default function ImageReport({ images }) {
  const total = images?.total ?? 0;
  const withAlt = images?.withAlt ?? 0;
  const missingAlt = images?.missingAlt ?? 0;
  const emptyAlt = images?.emptyAlt ?? 0;
  const altCoverage = images?.altCoverage;
  const missingAltSamples = Array.isArray(images?.missingAltSamples) ? images.missingAltSamples : [];

  const stats = [
    { label: 'Total Images', value: total },
    { label: 'With ALT', value: withAlt },
    { label: 'Missing ALT', value: missingAlt },
    { label: 'Decorative (alt="")', value: emptyAlt },
    { label: 'ALT Coverage', value: altCoverage === null || altCoverage === undefined ? 'N/A' : `${altCoverage}%` },
  ];

  return (
    <Card
      title="Image Accessibility Report"
      subtitle="ALT attribute inventory separating missing ALT from decorative empty alt=&quot;&quot;"
    >
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center"
          >
            <p className="text-lg font-bold text-slate-900">{stat.value}</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-600">{stat.label}</p>
          </div>
        ))}
      </div>

      {total === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          No <code>&lt;img&gt;</code> elements were found on this page. Image ALT coverage is marked as{' '}
          <strong>Not tested</strong> rather than counted as a pass.
        </p>
      ) : missingAltSamples.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sample Images Missing ALT ({missingAltSamples.length} shown of {missingAlt})
          </h3>
          <ul className="mt-2 space-y-1.5">
            {missingAltSamples.map((src, index) => (
              <li
                key={`${src}-${index}`}
                className="rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 font-mono text-xs break-all text-red-900"
                title={src}
              >
                {src}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-green-800">
          Every non-decorative image on this page includes an ALT attribute.
        </p>
      )}
    </Card>
  );
}
