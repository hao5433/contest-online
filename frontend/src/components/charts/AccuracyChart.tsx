import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { QuestionAccuracy } from '@/types';

interface AccuracyChartProps {
  data: QuestionAccuracy[];
}

// Same primary hue as the score chart — reused deliberately so "blue = magnitude"
// reads consistently across every chart in the app.
const BAR_COLOR = '#2a78d6';

export function AccuracyChart({ data }: AccuracyChartProps) {
  const chartData = data.map((item, index) => ({
    label: `Câu ${index + 1}`,
    accuracy: Math.round(item.accuracy * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} stroke="#e6e5e2" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#5c5b56', fontSize: 12 }}
          axisLine={{ stroke: '#d4d3cf' }}
          tickLine={false}
          interval={0}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
          tick={{ fill: '#5c5b56', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          label={{ value: 'Tỷ lệ trả lời đúng', angle: -90, position: 'insideLeft', fill: '#5c5b56', fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: '#f4f4f3' }}
          contentStyle={{ borderRadius: 8, borderColor: '#e6e5e2', fontSize: 13 }}
          formatter={(value: number) => [`${value}%`, 'Tỷ lệ đúng']}
        />
        <Bar dataKey="accuracy" name="Tỷ lệ đúng" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
