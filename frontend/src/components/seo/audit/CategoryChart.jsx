import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getScoreBand } from '../../../pages/SeoAnalyzer/utils/formatters.js';
import Card from '../ui/Card.jsx';

function CategoryTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">{item.label}</p>
      {item.isNotTested ? (
        <p className="mt-1 text-slate-600">Not tested (0 / 0 possible pts)</p>
      ) : (
        <>
          <p className="mt-1 font-medium text-slate-800">Score: {item.rawScore}%</p>
          <p className="text-slate-600">
            Points: {item.earned} / {item.possible} (weight: {item.weight} pts)
          </p>
        </>
      )}
    </div>
  );
}

export default function CategoryChart({ categoryScores = [] }) {
  const chartData = categoryScores.map((item) => {
    const isNotTested = item.score === null || item.score === undefined || item.possible === 0;
    const displayScore = isNotTested ? 0 : Math.round(item.score);
    const band = isNotTested ? null : getScoreBand(displayScore);

    return {
      category: item.category,
      label: item.label || item.category,
      weight: item.weight ?? 0,
      earned: item.earned ?? 0,
      possible: item.possible ?? 0,
      rawScore: isNotTested ? null : displayScore,
      chartValue: displayScore,
      isNotTested,
      fill: isNotTested ? '#94a3b8' : band.colorHex,
    };
  });

  return (
    <Card
      title="Category Score Breakdown"
      subtitle="Percentage score (0–100%) per SEO category, weighted by testable checks"
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 20, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(val) => `${val}%`}
              tick={{ fontSize: 12, fill: '#475569' }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={118}
              tick={{ fontSize: 12, fill: '#0f172a', fontWeight: 500 }}
            />
            <Tooltip content={<CategoryTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="chartValue" radius={[0, 6, 6, 0]} barSize={20} isAnimationActive={false}>
              {chartData.map((entry) => (
                <Cell key={entry.category} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-xs sm:grid-cols-3">
        {chartData.map((item) => (
          <div
            key={item.category}
            className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"
          >
            <span className="truncate font-medium text-slate-700">{item.label}</span>
            <span className="shrink-0 font-semibold text-slate-900">
              {item.isNotTested ? 'N/A' : `${item.earned}/${item.possible}`}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
