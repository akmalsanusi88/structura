
'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Legend, Tooltip, LabelList } from "recharts";

interface MaterialAnalyticsData {
    costTrackingData: {
        id: string;
        description: string;
        budgetedQty: number;
        budgetedCost: number;
        usedQty: number;
        actualCost: number;
        variance: number;
    }[];
    topConsumedMaterials: {
        name: string;
        value: number;
    }[];
    reconciliationData: {
        name: string;
        budgeted: number;
        issued: number;
        used: number;
    }[];
    monthlyCostData: {
        month: string;
        cost: number;
    }[];
}

interface MaterialAnalyticsProps {
    data: MaterialAnalyticsData;
}

const formatCurrency = (amount: number, fractionDigits = 0) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(amount);

const MaterialConsumptionChart = ({ data }: { data: { name: string, value: number }[] }) => (
    <Card>
        <CardHeader>
            <CardTitle>Top 10 Consumed Materials</CardTitle>
            <CardDescription>By actual cost value</CardDescription>
        </CardHeader>
        <CardContent>
            <ChartContainer config={{ value: { label: 'Value', color: 'hsl(var(--chart-1))' } }} className="h-[250px] w-full">
                <BarChart data={data} layout="vertical" margin={{ left: 100, right: 30 }}>
                    <CartesianGrid horizontal={false} />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={120} />
                    <XAxis type="number" hide />
                    <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltipContent formatter={(v) => formatCurrency(v as number)} />} />
                    <Bar dataKey="value" radius={4}>
                         <LabelList dataKey="value" position="right" offset={8} className="fill-foreground text-xs" formatter={(v: number) => formatCurrency(v)} />
                    </Bar>
                </BarChart>
            </ChartContainer>
        </CardContent>
    </Card>
);

const MonthlyMaterialCostChart = ({ data }: { data: { month: string; cost: number; }[] }) => (
    <Card>
        <CardHeader>
            <CardTitle>Monthly Material Cost</CardTitle>
            <CardDescription>Total value of materials used per month</CardDescription>
        </CardHeader>
        <CardContent>
            <ChartContainer config={{ cost: { label: 'Cost', color: 'hsl(var(--chart-1))' } }} className="h-[250px] w-full">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickFormatter={(value) => `RM${Number(value) / 1000}k`} />
                    <Tooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} indicator="dot" />} />
                    <Area dataKey="cost" type="natural" fill="var(--color-cost)" fillOpacity={0.4} stroke="var(--color-cost)" />
                </AreaChart>
            </ChartContainer>
        </CardContent>
    </Card>
);


export default function MaterialAnalytics({ data }: MaterialAnalyticsProps) {
    if (!data) return null;
    
    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
                <MaterialConsumptionChart data={data.topConsumedMaterials} />
                <MonthlyMaterialCostChart data={data.monthlyCostData} />
            </div>
        </div>
    )
}
