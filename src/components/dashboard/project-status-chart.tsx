
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS: Record<string, string> = {
  Implementation: '#667EEA',
  Planning: '#9F7AEA',
  Completed: '#34D399',
  Closed: '#374151',
  Setup: '#FBBF24',
  Overdue: '#EF4444',
  KIV: '#A78BFA',
  Cancelled: '#9CA3AF',
};

interface ProjectStatusChartProps {
    data: { status: string; count: number }[];
}

export default function ProjectStatusChart({ data }: ProjectStatusChartProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline">Project Status</CardTitle>
        <CardDescription>Distribution of projects by status</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center pb-6">
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                }}
              />
              <Pie
                data={data}
                dataKey="count"
                nameKey="status"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                labelLine={false}
                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                  const RADIAN = Math.PI / 180;
                  const radius = innerRadius + (outerRadius - innerRadius) * 1.3; // Position label outside the slice
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);

                  return (
                    <text x={x} y={y} fill="currentColor" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-semibold">
                      {`${(percent * 100).toFixed(0)}%`}
                    </text>
                  );
                }}
              >
                 {data.map((entry) => (
                    <Cell
                      key={`cell-${entry.status}`}
                      fill={COLORS[entry.status as keyof typeof COLORS] || '#CCCCCC'}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                  ))}
              </Pie>
              <Legend 
                iconSize={10} 
                wrapperStyle={{
                    fontSize: '12px',
                    paddingTop: '20px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
