import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts';
import { getScoreBand } from '../../../pages/SeoAnalyzer/utils/formatters.js';
import Badge from '../ui/Badge.jsx';
import Card from '../ui/Card.jsx';

export default function ScoreGauge({ overallScore = 0, scoreCoverage = 0 }) {
  const safeScore = Math.min(100, Math.max(0, Math.round(Number(overallScore) || 0)));
  const safeCoverage = Math.min(100, Math.max(0, Math.round(Number(scoreCoverage) || 0)));
  const band = getScoreBand(safeScore);

  const chartData = [
    {
      name: 'Score',
      value: safeScore,
      fill: band.colorHex,
    },
  ];

  return (
    <Card className="flex flex-col items-center justify-center text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Educational audit score
      </p>

      <div className="relative mt-2 h-48 w-48">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="74%"
            outerRadius="100%"
            barSize={14}
            data={chartData}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: '#e2e8f0' }}
              dataKey="value"
              cornerRadius={10}
              isAnimationActive={false}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold tracking-tight text-slate-900">{safeScore}</span>
          <span className="text-xs font-medium text-slate-500">out of 100</span>
        </div>
      </div>

      <div className="mt-2 flex flex-col items-center gap-2">
        <Badge variant={band.variant}>{band.label}</Badge>
        <p className="text-xs font-medium text-slate-600">
          Score based on <span className="font-semibold text-slate-900">{safeCoverage}%</span> of checks
        </p>
      </div>
    </Card>
  );
}
