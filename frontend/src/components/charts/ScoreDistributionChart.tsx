import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ScoreBucket } from '@/types';

interface ScoreDistributionChartProps {
  data: ScoreBucket[];
}

// Single deliberate hue (primary blue) — this is one series (count per score bucket),
// so no legend is needed; the chart title names the series.
const BAR_COLOR = '#2a78d6';

export function ScoreDistributionChart({ data }: ScoreDistributionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} stroke="#e6e5e2" />
        <XAxis
          dataKey="bucket"
          tick={{ fill: '#5c5b56', fontSize: 12 }}
          axisLine={{ stroke: '#d4d3cf' }}
          tickLine={false}
          label={{ value: 'Khoảng điểm', position: 'insideBottom', offset: -4, fill: '#5c5b56', fontSize: 12 }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: '#5c5b56', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          label={{ value: 'Số lượt thi', angle: -90, position: 'insideLeft', fill: '#5c5b56', fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: '#f4f4f3' }}
          contentStyle={{ borderRadius: 8, borderColor: '#e6e5e2', fontSize: 13 }}
          formatter={(value: number) => [`${value} lượt`, 'Số lượt thi']}
          labelFormatter={(label) => `Khoảng điểm: ${label}`}
        />
        <Bar dataKey="count" name="Số lượt thi" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={56} />
      </BarChart>
    </ResponsiveContainer>
  );
}
