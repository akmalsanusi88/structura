
'use client';

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, XAxis, YAxis, Pie, PieChart, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { Project } from "@/lib/types";
import { useMemo } from "react";
import { differenceInDays, format, parseISO } from "date-fns";

const formatCurrency = (val: number | string) => `RM${Number(val).toLocaleString()}`;

// Revenue vs Costs
const revenueVsCostsConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--chart-1))" },
  cost: { label: "Cost", color: "hsl(var(--chart-5))" },
} satisfies ChartConfig;

export function RevenueVsCostsChart({ data }: { data: { month: string, revenue: number, cost: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue vs Costs</CardTitle>
        <CardDescription>Monthly comparison of revenue and costs</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={revenueVsCostsConfig} className="h-[250px] w-full">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid vertical={false} />
              <YAxis tickFormatter={(value) => `RM${Number(value) / 1000}k`} />
              <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />} />
              <Legend />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
              <Bar dataKey="cost" fill="var(--color-cost)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// Aging of Receivables
const agingConfig = {
    current: { label: 'Current', color: "hsl(var(--chart-3))" },
    thirtyDays: { label: '30 Days', color: "hsl(var(--chart-4))" },
    sixtyDays: { label: '60 Days', color: "hsl(var(--chart-5))" },
    ninetyPlusDays: { label: '90+ Days', color: "hsl(var(--destructive))" },
} satisfies ChartConfig;

export function AgingOfReceivablesChart({ projects }: { projects: Project[] }) {
    const agingData = useMemo(() => {
        const today = new Date();
        const dataByMonth: Record<string, { month: string; sortKey: string; current: number; thirtyDays: number; sixtyDays: number; ninetyPlusDays: number; }> = {};

        projects.forEach(p => {
            (p.clientClaims || []).forEach(c => {
                if (c.status !== 'Paid') {
                    const claimDate = parseISO(c.date);
                    const sortKey = format(claimDate, 'yyyy-MM');
                    const monthDisplay = format(claimDate, 'MMM yy');
                    const daysOutstanding = differenceInDays(today, claimDate);

                    if (!dataByMonth[sortKey]) {
                        dataByMonth[sortKey] = { month: monthDisplay, sortKey, current: 0, thirtyDays: 0, sixtyDays: 0, ninetyPlusDays: 0 };
                    }
                    
                    if (daysOutstanding <= 30) {
                        dataByMonth[sortKey].current += c.amount;
                    } else if (daysOutstanding <= 60) {
                        dataByMonth[sortKey].thirtyDays += c.amount;
                    } else if (daysOutstanding <= 90) {
                        dataByMonth[sortKey].sixtyDays += c.amount;
                    } else {
                        dataByMonth[sortKey].ninetyPlusDays += c.amount;
                    }
                }
            });
        });

        const sortedData = Object.values(dataByMonth).sort((a,b) => a.sortKey.localeCompare(b.sortKey));
        return sortedData.slice(-6); // Show last 6 months for readability
    }, [projects]);
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Aging of Receivables</CardTitle>
                <CardDescription>Track overdue invoices by aging buckets</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={agingConfig} className="h-[250px] w-full">
                    <ResponsiveContainer>
                        <BarChart data={agingData}>
                            <CartesianGrid vertical={false} />
                            <YAxis tickFormatter={(value) => `RM${Number(value) / 1000}k`} />
                            <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                            <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />} />
                            <Legend />
                            <Bar dataKey="current" name="Current" stackId="a" fill="var(--color-current)" />
                            <Bar dataKey="thirtyDays" name="30 Days" stackId="a" fill="var(--color-thirtyDays)" />
                            <Bar dataKey="sixtyDays" name="60 Days" stackId="a" fill="var(--color-sixtyDays)" />
                            <Bar dataKey="ninetyPlusDays" name="90+ Days" stackId="a" fill="var(--color-ninetyPlusDays)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}

// Cash Flow Forecast
const cashFlowConfig = {
  projected: { label: "Projected", color: "hsl(var(--chart-2))" },
  actual: { label: "Actual", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

export function CashFlowForecastChart({ data }: { data: { month: string; projected: number, actual: number }[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Projected vs Actual Cash Flow</CardTitle>
                <CardDescription>Comparison of projected and actual costs over time</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={cashFlowConfig} className="h-[250px] w-full">
                    <ResponsiveContainer>
                        <LineChart data={data}>
                            <CartesianGrid vertical={false} />
                             <YAxis tickFormatter={(value) => `RM${Number(value) / 1000}k`} />
                            <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                            <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />} />
                            <Legend />
                            <Line type="monotone" dataKey="projected" stroke="var(--color-projected)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            <Line type="monotone" dataKey="actual" stroke="var(--color-actual)" strokeWidth={2} dot={true} />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}


// Invoice Submission vs Payment Received
const invoiceConfig = {
  submitted: { label: "Submitted", color: "hsl(var(--chart-1))" },
  received: { label: "Received", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

export function InvoiceSubmissionChart({ data }: { data: { month: string, submitted: number, received: number }[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Invoice Submission vs. Payment Received</CardTitle>
                <CardDescription>Monthly comparison of submitted invoices and received payments</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={invoiceConfig} className="h-[250px] w-full">
                     <ResponsiveContainer>
                        <BarChart data={data}>
                          <CartesianGrid vertical={false} />
                          <YAxis tickFormatter={(value) => `RM${Number(value) / 1000}k`} />
                          <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                          <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />} />
                          <Legend />
                          <Bar dataKey="submitted" fill="var(--color-submitted)" radius={4} />
                          <Bar dataKey="received" fill="var(--color-received)" radius={4} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
