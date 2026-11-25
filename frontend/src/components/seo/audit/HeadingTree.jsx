import Card from '../ui/Card.jsx';

const HEADING_LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const LISTED_LEVELS = [
  { key: 'h1', label: 'H1 Headings', badgeClass: 'bg-blue-50 text-blue-800 border-blue-200' },
  { key: 'h2', label: 'H2 Headings', badgeClass: 'bg-slate-100 text-slate-800 border-slate-200' },
  { key: 'h3', label: 'H3 Headings', badgeClass: 'bg-slate-50 text-slate-700 border-slate-200' },
];

export default function HeadingTree({ headings }) {
  const counts = headings?.counts ?? { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  const totalHeadings = HEADING_LEVELS.reduce((sum, key) => sum + (counts[key] ?? 0), 0);

  return (
    <Card
      title="Heading Structure"
      subtitle="Extracted H1–H6 counts and sampled H1–H3 outline (capped at 50 per level)"
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {HEADING_LEVELS.map((level) => (
          <div
            key={level}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center"
          >
            <p className="text-[11px] font-semibold uppercase text-slate-500">{level}</p>
            <p className="mt-0.5 text-lg font-bold text-slate-900">{counts[level] ?? 0}</p>
          </div>
        ))}
      </div>

      {totalHeadings === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No non-empty headings were found on this page.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {LISTED_LEVELS.map(({ key, label, badgeClass }) => {
            const items = Array.isArray(headings?.[key]) ? headings[key] : [];
            return (
              <div key={key}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {label} ({counts[key] ?? 0})
                </h3>
                {items.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">None found.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {items.map((text, index) => (
                      <li
                        key={`${key}-${index}`}
                        className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs text-slate-800"
                      >
                        <span
                          className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${badgeClass}`}
                        >
                          {key}
                        </span>
                        <span className="min-w-0 break-words" title={text}>
                          {text}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
