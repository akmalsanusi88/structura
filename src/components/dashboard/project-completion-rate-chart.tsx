
'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';

const chartConfig = {
    'Completed Projects': {
        label: 'Completed Projects',
        color: 'hsl(var(--chart-1))',
    },
} satisfies ChartConfig;

interface ProjectCompletionRateChartProps {
    data: { month: string; 'Completed Projects': number }[];
}

export default function ProjectCompletionRateChart({ data }: ProjectCompletionRateChartProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Project Completion Rate</CardTitle>
                <CardDescription>Monthly project completions</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <ResponsiveContainer>
                        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <XAxis dataKey="month" tickLine={false} axisLine={false} />
                            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
                            <Bar dataKey="Completed Projects" fill="var(--color-Completed Projects)" radius={4} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
