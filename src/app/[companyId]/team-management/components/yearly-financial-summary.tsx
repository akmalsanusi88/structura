
'use client';

import * as React from 'react';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { Bar, ComposedChart, XAxis, YAxis, ResponsiveContainer, Legend, CartesianGrid, Tooltip, Line } from 'recharts';
import type { Project, InHouseTeam, PlantUnit, GeneralTeamCost } from '@/lib/types';
import { Briefcase, DollarSign } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { format, parseISO } from 'date-fns';

interface YearlyFinancialSummaryProps {
  projects: Project[];
  teams: InHouseTeam[];
  plantUnits: PlantUnit[];
  generalCosts: GeneralTeamCost[];
}

const chartConfig = {
  revenue: { label: 'Revenue (RM)', color: 'hsl(var(--chart-1))' },
  expenses: { label: 'Expenses (RM)', color: 'hsl(var(--chart-5))' },
  pl_rm: { label: 'P/L (RM)', color: 'hsl(var(--chart-3))' },
  pl_percent: { label: 'P/L (%)', color: 'hsl(var(--chart-4))' },
} satisfies ChartConfig;

export default function YearlyFinancialSummary({ projects, teams, plantUnits, generalCosts }: YearlyFinancialSummaryProps) {
    const allYears = useMemo(() => {
        const years = new Set<string>();
        (projects || []).forEach(p => {
            if (p.startDate) years.add(p.startDate.substring(0, 4));
            if (p.targetCompletionDate) years.add(p.targetCompletionDate.substring(0, 4));
        });
         (generalCosts || []).forEach(c => {
            if (c.month) years.add(c.month.substring(0, 4));
        });
        return ['all', ...Array.from(years).sort((a,b) => Number(b) - Number(a))];
    }, [projects, generalCosts]);
    
    const [selectedYear, setSelectedYear] = useState<string>(allYears.find(y => y !== 'all') || 'all');

  const formatCurrency = (amount: number, fractionDigits = 2) => {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  };
  
  const yearlyData = useMemo(() => {
    const safeProjects = projects || [];
    const safePlantUnits = plantUnits || [];
    const safeGeneralCosts = generalCosts || [];
    
    const dateFilter = (dateStr: string) => {
        if (!dateStr) return false;
        if (selectedYear === 'all') return true;
        return dateStr.startsWith(selectedYear);
    };

    const plantUnitMap = new Map(safePlantUnits.map(pu => [pu.id, pu]));
    const engineeringBoqMapByProject = new Map(safeProjects.map(p => [p.id, new Map(p.engineeringBoq.map(item => [item.id, item]))]));

    const revenueByMonth: Record<string, number> = {};
    const expensesByMonth: Record<string, number> = {};
    const projectsWorkedOn = new Set<string>();

    safeProjects.forEach(p => {
        let projectInvolved = false;
        const projectEngBoqMap = engineeringBoqMapByProject.get(p.id);

        p.dailyActivities?.forEach(log => {
            if (dateFilter(log.date)) {
                log.work.forEach(w => {
                    if (w.teamId) {
                        projectInvolved = true;
                        const month = log.date.substring(0, 7);
                        let rate = 0;
                        const engBoqItem = projectEngBoqMap?.get(w.boqItemId);
                        if (engBoqItem) {
                            rate = engBoqItem.rate;
                        } else {
                            const pu = plantUnitMap.get(w.boqItemId);
                            if (pu) rate = pu.rate;
                        }
                        revenueByMonth[month] = (revenueByMonth[month] || 0) + (w.quantity * rate);
                    }
                });
            }
        });

        p.teamCosts?.forEach(c => {
            if (dateFilter(c.month)) {
                projectInvolved = true;
                const month = c.month;
                expensesByMonth[month] = (expensesByMonth[month] || 0) + (c.salary + c.petrolAndToll + c.siteExpenses + c.machineryAndUpkeep);
            }
        });
        
        if (projectInvolved) {
            projectsWorkedOn.add(p.id);
        }
    });

    safeGeneralCosts.forEach(c => {
        if(dateFilter(c.month)) {
            const month = c.month;
            expensesByMonth[month] = (expensesByMonth[month] || 0) + (c.ppe + c.vehicleUpkeep + c.other);
        }
    });

    const allMonths = new Set([...Object.keys(revenueByMonth), ...Object.keys(expensesByMonth)]);
    const sortedMonths = Array.from(allMonths).sort();

    const chartData = sortedMonths.map(month => {
        const revenue = revenueByMonth[month] || 0;
        const expenses = expensesByMonth[month] || 0;
        const pl_rm = revenue - expenses;
        const pl_percent = revenue > 0 ? (pl_rm / revenue) * 100 : (expenses > 0 ? -100 : 0);
        return {
            month: format(parseISO(`${month}-01`), 'MMM'),
            revenue,
            expenses,
            pl_rm,
            pl_percent
        };
    });

    const totalRevenue = Object.values(revenueByMonth).reduce((sum, val) => sum + val, 0);
    const totalExpenses = Object.values(expensesByMonth).reduce((sum, val) => sum + val, 0);
    const profitAndLoss = totalRevenue - totalExpenses;
    const plPercentage = totalRevenue > 0 ? (profitAndLoss / totalRevenue) * 100 : (totalExpenses > 0 ? -100 : 0);

    const kpis = {
        totalProjects: projectsWorkedOn.size,
        totalRevenue,
        totalExpenses,
        profitAndLoss,
        plPercentage
    };

    return { kpis, chartData };
  }, [projects, generalCosts, selectedYear, plantUnits]);

  return (
    <Card id="yearly-summary-card">
        <CardHeader>
            <div className='flex justify-between items-center'>
                 <CardTitle className='font-headline'>Yearly Financial Summary</CardTitle>
                 <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent>
                       {allYears.map(year => (
                            <SelectItem key={year} value={year}>{year === 'all' ? 'All Years' : year}</SelectItem>
                       ))}
                    </SelectContent>
                </Select>
            </div>
        </CardHeader>
        <CardContent className='space-y-6'>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{yearlyData.kpis.totalProjects}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(yearlyData.kpis.totalRevenue)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(yearlyData.kpis.totalExpenses)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                            <CardTitle className="text-sm font-medium">P&amp;L</CardTitle>
                            <span className={`text-sm font-bold ${yearlyData.kpis.plPercentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>{isFinite(yearlyData.kpis.plPercentage) ? yearlyData.kpis.plPercentage.toFixed(0) : 'N/A'}%</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold mb-1">{formatCurrency(yearlyData.kpis.profitAndLoss)}</div>
                        <Progress value={Math.max(0, yearlyData.kpis.plPercentage)} aria-label={`${yearlyData.kpis.plPercentage.toFixed(0)}% Profit`} />
                    </CardContent>
                </Card>
            </div>
            
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <ComposedChart data={yearlyData.chartData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis yAxisId="left" orientation="left" stroke="#888888" tickFormatter={(value) => `${Number(value) / 1000}k`} />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-4))" tickFormatter={(value) => `${value.toFixed(0)}%`} />
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                const activePayload = payload.map(p => ({
                                    name: chartConfig[p.dataKey as keyof typeof chartConfig]?.label || p.name,
                                    value: p.value,
                                    color: chartConfig[p.dataKey as keyof typeof chartConfig]?.color || p.color,
                                    dataKey: p.dataKey
                                }));
                                return (
                                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                                        <div className="text-center font-bold mb-2">{label}</div>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                            {activePayload.map((p, i) => (
                                                <React.Fragment key={i}>
                                                    <div className="flex items-center gap-2 text-sm" >
                                                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: p.color}}></div>
                                                        {p.name}
                                                    </div>
                                                    <div className="font-bold text-right text-sm">
                                                        {p.dataKey === 'pl_percent' ? `${(p.value as number).toFixed(2)}%` : formatCurrency(p.value as number, 2)}
                                                    </div>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="revenue" fill="var(--color-revenue)" name="Revenue (RM)" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="expenses" fill="var(--color-expenses)" name="Expenses (RM)" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="left" type="monotone" dataKey="pl_rm" name="P/L (RM)" stroke="var(--color-pl_rm)" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="pl_percent" name="P/L (%)" stroke="var(--color-pl_percent)" strokeWidth={2} />
                </ComposedChart>
            </ChartContainer>

        </CardContent>
    </Card>
  )
}
