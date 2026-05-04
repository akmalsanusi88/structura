
'use client';

import * as React from 'react';
import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Pie, PieChart, ResponsiveContainer, Cell, Legend } from 'recharts';
import type { Project, InHouseTeam, PlantUnit, GeneralTeamCost } from '@/lib/types';
import { Briefcase, DollarSign, Target, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { format, parseISO } from 'date-fns';

interface MonthlyTeamPerformanceProps {
  projects: Project[];
  teams: InHouseTeam[];
  plantUnits: PlantUnit[];
  generalCosts: GeneralTeamCost[];
}

export default function MonthlyTeamPerformance({ projects, teams, plantUnits, generalCosts }: MonthlyTeamPerformanceProps) {

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

    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        const dateFilter = (dateStr: string) => {
            if (!dateStr) return false;
            if (selectedYear === 'all') return true;
            return dateStr.startsWith(selectedYear);
        }

        ;(projects || []).forEach(p => {
            p.teamCosts?.forEach(c => { if(dateFilter(c.month)) months.add(c.month) });
            p.dailyActivities?.forEach(log => {
                const month = log.date.substring(0, 7);
                if (dateFilter(month)) months.add(month);
            });
        });
        ;(generalCosts || []).forEach(c => { if(dateFilter(c.month)) months.add(c.month) });

        const sortedMonths = Array.from(months).sort().reverse();
        return ['all', ...sortedMonths];
    }, [projects, generalCosts, selectedYear]);

    const [selectedMonth, setSelectedMonth] = useState('all');

    useEffect(() => {
       setSelectedMonth('all');
    }, [selectedYear]);


    const formatCurrency = (amount: number, fractionDigits = 2) => {
        return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(amount);
    };

    const { kpis, teamPnlDetails } = useMemo(() => {
        const safeProjects = projects || [];
        const safeTeams = teams || [];
        const safePlantUnits = plantUnits || [];
        const safeGeneralCosts = generalCosts || [];

        const dateFilter = (dateStr: string) => {
            if (!dateStr) return false;
            if (selectedYear === 'all') return true;
            if (selectedMonth === 'all') return dateStr.startsWith(selectedYear);
            return dateStr.startsWith(selectedMonth);
        };

        const plantUnitMap = new Map((safePlantUnits || []).map(pu => [pu.id, pu]));
        const engineeringBoqMapByProject = new Map((safeProjects || []).map(p => [p.id, new Map(p.engineeringBoq.map(item => [item.id, item]))]));

        const pnlByTeam = new Map<string, { 
            name: string, 
            revenue: number, 
            siteExpenses: {
                wages: number;
                petrolAndToll: number;
                siteExpenses: number;
                machineryAndUpkeep: number;
                total: number;
            },
             generalExpenses: {
                ppe: number;
                vehicleUpkeep: number;
                other: number;
                total: number;
            },
        }>();
        
        const processPnlEntry = (teamId: string) => {
            if (!pnlByTeam.has(teamId)) {
                const team = safeTeams.find(t => t.id === teamId);
                if (team) {
                    pnlByTeam.set(team.id, { 
                        name: team.name, 
                        revenue: 0, 
                        siteExpenses: { wages: 0, petrolAndToll: 0, siteExpenses: 0, machineryAndUpkeep: 0, total: 0 },
                        generalExpenses: { ppe: 0, vehicleUpkeep: 0, other: 0, total: 0 },
                    });
                }
            }
            return pnlByTeam.get(teamId);
        }
        
        const projectsWorkedOn = new Set<string>();
        
        safeProjects.forEach(p => {
            let projectInvolvedThisMonth = false;
            const projectEngBoqMap = engineeringBoqMapByProject.get(p.id);

            (p.dailyActivities || []).forEach(log => {
                if (dateFilter(log.date)) {
                    log.work.forEach(w => {
                        if (w.teamId) {
                            projectInvolvedThisMonth = true;
                            const teamData = processPnlEntry(w.teamId);
                            if(teamData) {
                                let rate = 0;
                                const engBoqItem = projectEngBoqMap?.get(w.boqItemId);
                                if (engBoqItem) {
                                    rate = engBoqItem.rate;
                                } else {
                                    const pu = plantUnitMap.get(w.boqItemId);
                                    if (pu) rate = pu.rate;
                                }
                                teamData.revenue += w.quantity * rate;
                            }
                        }
                    });
                }
            });

            (p.teamCosts || []).forEach(c => {
                if (dateFilter(c.month)) {
                    projectInvolvedThisMonth = true;
                    const teamData = processPnlEntry(c.teamId);
                    if(teamData) {
                        teamData.siteExpenses.wages += c.salary;
                        teamData.siteExpenses.petrolAndToll += c.petrolAndToll;
                        teamData.siteExpenses.siteExpenses += c.siteExpenses;
                        teamData.siteExpenses.machineryAndUpkeep += c.machineryAndUpkeep;
                    }
                }
            });

            if(projectInvolvedThisMonth) {
                projectsWorkedOn.add(p.id);
            }
        });

        safeGeneralCosts.forEach(c => {
             if (dateFilter(c.month)) {
                 const teamData = processPnlEntry(c.teamId);
                 if(teamData) {
                    teamData.generalExpenses.ppe += (c.ppe || 0);
                    teamData.generalExpenses.vehicleUpkeep += (c.vehicleUpkeep || 0);
                    teamData.generalExpenses.other += (c.other || 0);
                 }
            }
        });
        
        const details = Array.from(pnlByTeam.values())
            .map(d => {
                const siteTotal = d.siteExpenses.wages + d.siteExpenses.petrolAndToll + d.siteExpenses.siteExpenses + d.siteExpenses.machineryAndUpkeep;
                const generalTotal = d.generalExpenses.ppe + d.generalExpenses.vehicleUpkeep + d.generalExpenses.other;
                return { 
                    ...d, 
                    siteExpenses: { ...d.siteExpenses, total: siteTotal },
                    generalExpenses: { ...d.generalExpenses, total: generalTotal },
                    profit: d.revenue - siteTotal - generalTotal,
                }
            })
            .filter(d => d.revenue > 0 || d.siteExpenses.total > 0 || d.generalExpenses.total > 0);

        const totalRevenue = details.reduce((sum, d) => sum + d.revenue, 0);
        const totalExpenses = details.reduce((sum, d) => sum + d.siteExpenses.total + d.generalExpenses.total, 0);
        const profitAndLoss = totalRevenue - totalExpenses;
        const plPercentage = totalRevenue > 0 ? (profitAndLoss / totalRevenue) * 100 : (totalExpenses > 0 ? -100 : 0);

        const kpisResult = {
            totalProjects: projectsWorkedOn.size,
            totalRevenue,
            totalExpenses,
            profitAndLoss,
            plPercentage
        };

        return { kpis: kpisResult, teamPnlDetails: details };

    }, [projects, teams, plantUnits, generalCosts, selectedMonth, selectedYear]);
    
    const pnlTeamChartConfig: ChartConfig = {
      revenue: { label: "Revenue", color: "hsl(var(--chart-1))" },
      siteExpenses: { label: "Site Expenses", color: "hsl(var(--chart-2))" },
      generalExpenses: { label: "General Expenses", color: "hsl(var(--chart-5))" },
    };
    
    return (
        <Card id="monthly-performance-card">
            <CardHeader>
                <div className='flex justify-between items-center'>
                    <div className='flex items-center gap-2'>
                        <Target className='h-6 w-6 text-primary' />
                        <CardTitle className='font-headline'>Monthly Performance</CardTitle>
                    </div>
                     <div className="flex items-center gap-2">
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Select Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {allYears.map(year => (
                                    <SelectItem key={year} value={year}>{year === 'all' ? 'All Years' : year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={selectedYear === 'all'}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select Month" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableMonths.map(month => (
                                    <SelectItem key={month} value={month}>
                                        {month === 'all' ? 'All Months' : format(parseISO(`${month}-01`), 'MMMM yyyy')}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
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
                            <div className="text-2xl font-bold">{kpis.totalProjects}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(kpis.totalRevenue)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(kpis.totalExpenses)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                                <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                                <span className={`text-sm font-bold ${kpis.plPercentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {isFinite(kpis.plPercentage) ? `${kpis.plPercentage.toFixed(0)}%` : 'N/A'}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold mb-1">{formatCurrency(kpis.profitAndLoss)}</div>
                            <Progress value={isFinite(kpis.plPercentage) ? Math.max(0, kpis.plPercentage) : 0} aria-label={`${isFinite(kpis.plPercentage) ? kpis.plPercentage.toFixed(0) : 'N/A'}% Profit`} />
                        </CardContent>
                    </Card>
                </div>
                 
                <Card>
                    <CardHeader>
                        <CardTitle>P&amp;L Breakdown by Team</CardTitle>
                        <CardDescription>Compares project-specific revenue vs. total expenses (site + general).</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {(teamPnlDetails.length === 0) ? (
                            <div className="text-center py-10 text-muted-foreground col-span-full">
                                No team activity recorded for {selectedMonth && selectedMonth !== 'all' ? format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy') : 'this period'}.
                            </div>
                        ) : (
                           teamPnlDetails.map((team) => {
                             const chartData = [
                               { item: "revenue", value: team.revenue, name: "Revenue" },
                               { item: "siteExpenses", value: team.siteExpenses.total, name: "Site Expenses" },
                               { item: "generalExpenses", value: team.generalExpenses.total, name: "General Expenses" },
                             ].filter(d => d.value > 0);
                             
                             const profitPercentage = team.revenue > 0 ? (team.profit / team.revenue) * 100 : (team.profit < 0 ? -100 : 0);

                             const siteExpenseDetails = [
                                 { label: 'Wages/Salary', value: team.siteExpenses.wages },
                                 { label: 'Petrol & Toll', value: team.siteExpenses.petrolAndToll },
                                 { label: 'Site Expenses', value: team.siteExpenses.siteExpenses },
                                 { label: 'Machinery/Vehicle', value: team.siteExpenses.machineryAndUpkeep },
                             ].filter(e => e.value > 0);
                             
                             const generalExpenseDetails = [
                                { label: 'PPE', value: team.generalExpenses.ppe },
                                { label: 'Vehicle Upkeep', value: team.generalExpenses.vehicleUpkeep },
                                { label: 'Other', value: team.generalExpenses.other },
                             ].filter(e => e.value > 0);

                             return (
                               <div key={team.name} className='flex flex-col items-center gap-4 p-4 border rounded-lg'>
                                    <h3 className='font-semibold text-lg'>{team.name}</h3>
                                    <ChartContainer config={pnlTeamChartConfig} className="relative mx-auto aspect-square h-[150px]">
                                        <div className='absolute inset-0 flex flex-col items-center justify-center'>
                                            <p className='text-xs text-muted-foreground'>Gross Profit</p>
                                            <p className={`text-xl font-bold ${team.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {isFinite(profitPercentage) ? profitPercentage.toFixed(0) : 'N/A'}%
                                            </p>
                                        </div>
                                        <PieChart>
                                        <ChartTooltip
                                            cursor={false}
                                            content={<ChartTooltipContent 
                                                hideLabel
                                                formatter={(value, name) => `${name}: ${formatCurrency(value as number)}`}
                                            />}
                                        />
                                        <Pie
                                            data={chartData}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius={50}
                                            outerRadius={70}
                                            strokeWidth={2}
                                            stroke="hsl(var(--background))"
                                        >
                                            {chartData.map((entry) => (
                                                <Cell key={entry.item} fill={`var(--color-${entry.item})`} />
                                            ))}
                                        </Pie>
                                        </PieChart>
                                    </ChartContainer>
                                    <div className="w-full space-y-2 text-sm">
                                        <div className="flex justify-between font-semibold">
                                            <span>Revenue:</span>
                                            <span className="font-medium">{formatCurrency(team.revenue)}</span>
                                        </div>
                                        {siteExpenseDetails.length > 0 && (
                                            <div>
                                                <div className="flex justify-between font-semibold">
                                                    <span>Site Expenses:</span>
                                                    <span>{formatCurrency(team.siteExpenses.total)}</span>
                                                </div>
                                                <div className="pl-2 space-y-1">
                                                    {siteExpenseDetails.map(exp => (
                                                        <div key={exp.label} className="flex justify-between text-muted-foreground text-xs">
                                                            <span>- {exp.label}</span>
                                                            <span>{formatCurrency(exp.value)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                         {generalExpenseDetails.length > 0 && (
                                            <div>
                                                <div className="flex justify-between font-semibold">
                                                    <span>General Expenses:</span>
                                                    <span>{formatCurrency(team.generalExpenses.total)}</span>
                                                </div>
                                                <div className="pl-2 space-y-1">
                                                    {generalExpenseDetails.map(exp => (
                                                        <div key={exp.label} className="flex justify-between text-muted-foreground text-xs">
                                                            <span>- {exp.label}</span>
                                                            <span>{formatCurrency(exp.value)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div className={`flex justify-between font-bold pt-1 border-t ${team.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            <span>Gross Profit:</span>
                                            <span>{formatCurrency(team.profit)}</span>
                                        </div>
                                    </div>
                               </div>
                             )
                           })
                        )}
                    </CardContent>
                </Card>
            </CardContent>
        </Card>
    );
}
