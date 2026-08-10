import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

interface PassRateDonutProps {
  /** 0..1 */
  passRate: number;
}

// Pass/fail is a state, not an arbitrary series — status hues are the right tool here,
// always paired with an explicit label (never color alone).
const PASS_COLOR = '#0ca30c';
const FAIL_COLOR = '#d03b3b';

export function PassRateDonut({ passRate }: PassRateDonutProps) {
  const passPercent = Math.round(passRate * 100);
  const data = [
    { name: 'Đạt', value: passPercent },
    { name: 'Không đạt', value: 100 - passPercent },
  ];

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={70}
            outerRadius={100}
            paddingAngle={2}
            stroke="#ffffff"
            strokeWidth={2}
          >
            <Cell fill={PASS_COLOR} />
            <Cell fill={FAIL_COLOR} />
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 8, borderColor: '#e6e5e2', fontSize: 13 }}
            formatter={(value: number, name: string) => [`${value}%`, name]}
          />
          <Legend verticalAlign="bottom" height={32} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-8">
        <span className="text-2xl font-semibold text-neutral-900">{passPercent}%</span>
        <span className="text-xs text-neutral-500">tỷ lệ đạt</span>
      </div>
    </div>
  );
}
