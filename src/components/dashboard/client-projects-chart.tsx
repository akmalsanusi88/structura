
'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useMemo } from 'react';
import type { Project } from '@/lib/types';

const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
];

interface ClientProjectsChartProps {
    projects: Project[];
}

export default function ClientProjectsChart({ projects }: ClientProjectsChartProps) {
    const clientData = useMemo(() => {
        const counts: Record<string, number> = {};
        projects.forEach(p => {
            counts[p.client] = (counts[p.client] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [projects]);

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle>Client Projects</CardTitle>
                <CardDescription>Distribution of projects by client</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center pb-6">
                {clientData.length > 0 ? (
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: 'var(--radius)',
                                    }}
                                />
                                <Pie
                                    data={clientData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    labelLine={false}
                                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                >
                                    {clientData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Legend iconSize={10} wrapperStyle={{fontSize: '12px', paddingTop: '20px'}} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        No project data to display.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
