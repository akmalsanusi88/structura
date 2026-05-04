
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, CartesianGrid, Tooltip } from 'recharts';
import { ChartContainer, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';

interface ChartData {
    month: string;
    planned: number;
    actual: number;
}

const chartConfig = {
  planned: {
    label: 'Planned',
    color: 'hsl(var(--chart-3))',
  },
  actual: {
    label: 'Actual',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

export default function ProjectDeliveryPerformanceChart({ data = [] }: { data: ChartData[] }) {
    return (
        <Card id="project-delivery-performance-chart" className="flex flex-col">
            <CardHeader>
                 <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Project Delivery Performance</CardTitle>
                        <CardDescription>Planned vs actual project completions</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1">
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <ResponsiveContainer>
                        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid vertical={false} />
                            <YAxis allowDecimals={false} />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                            <Tooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Bar dataKey="planned" fill="var(--color-planned)" radius={4} />
                            <Bar dataKey="actual" fill="var(--color-actual)" radius={4} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
