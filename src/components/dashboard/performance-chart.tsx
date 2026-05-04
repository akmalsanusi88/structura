
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';

const chartConfig = {
  profit: {
    label: 'Profit / Loss',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

interface PerformanceChartProps {
    data: { month: string; profit: number }[];
}

export default function PerformanceChart({ data }: PerformanceChartProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline">P/L Trend</CardTitle>
        <CardDescription>
          Monthly profit and loss amount
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pl-2">
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis 
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `RM ${Number(value) / 1000}k`}
              />
              <ChartTooltip content={<ChartTooltipContent formatter={(val) => `RM ${Number(val).toLocaleString()}`} />} />
              <Legend />
              <Line
                dataKey="profit"
                type="monotone"
                stroke="var(--color-profit)"
                strokeWidth={2}
                dot={{
                  fill: "var(--color-profit)",
                }}
                activeDot={{
                  r: 6,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
