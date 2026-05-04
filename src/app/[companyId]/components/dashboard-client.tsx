
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DollarSign,
  Briefcase,
  TrendingUp,
  AlertTriangle,
  Target,
  CalendarDays,
  History,
  FileDown,
  TrendingDown,
  Package,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import PerformanceChart from '@/components/dashboard/performance-chart';
import ProjectStatusChart from '@/components/dashboard/project-status-chart';
import { AgingOfReceivablesChart, CashFlowForecastChart, InvoiceSubmissionChart } from '@/components/dashboard/financials-charts';
import ProjectTimelineOverview from '@/components/dashboard/project-timeline-overview';
import ResourceUtilization from '@/components/dashboard/resource-utilization';
import ProjectCompletionRateChart from '@/components/dashboard/project-completion-rate-chart';
import ClientProjectsChart from '@/components/dashboard/client-projects-chart';
import ProjectDeliveryPerformanceChart from '@/components/dashboard/project-delivery-performance-chart';
import ClientPerformanceAnalysis from '@/components/dashboard/client-performance-analysis';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { differenceInDays, differenceInMonths, format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths, startOfQuarter, endOfQuarter, subQuarters, addMonths } from 'date-fns';
import type { Project, ProjectStatus, PlantUnit, Company, InHouseTeam, MaterialPurchaseOrder, DeliveryOrder, SupplierInvoice } from '@/lib/types';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, AreaChart, Area, LabelList } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';


const MonthlyMaterialCostChart = ({ data }: { data: { month: string; cost: number; }[] }) => (
    <Card>
        <CardHeader>
            <CardTitle>Monthly Material Cost Trend</CardTitle>
            <CardDescription>Total value of materials used per month across all projects.</CardDescription>
        </CardHeader>
        <CardContent>
            <ChartContainer config={{ cost: { label: 'Cost', color: 'hsl(var(--chart-1))' } }} className="h-[250px] w-full">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickFormatter={(value) => `RM${Number(value) / 1000}k`} />
                    <Tooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number, 2)} indicator="dot" />} />
                    <Area dataKey="cost" type="natural" fill="var(--color-cost)" fillOpacity={0.4} stroke="var(--color-cost)" />
                </AreaChart>
            </ChartContainer>
        </CardContent>
    </Card>
);

const formatCurrency = (amount: number, fractionDigits = 2) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(amount);

const TopConsumedMaterialsChart = ({ data }: { data: { name: string, value: number }[] }) => (
    <Card>
        <CardHeader>
            <CardTitle>Top 10 Consumed Materials</CardTitle>
            <CardDescription>By actual cost value across all projects.</CardDescription>
        </CardHeader>
        <CardContent>
            <ChartContainer config={{ value: { label: 'Value', color: 'hsl(var(--chart-1))' } }} className="h-[250px] w-full">
                <BarChart data={data} layout="vertical" margin={{ left: 120, right: 50 }}>
                    <CartesianGrid horizontal={false} />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={120} />
                    <XAxis type="number" hide />
                    <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltipContent formatter={(v) => formatCurrency(v as number)} />} />
                    <Bar dataKey="value" radius={4} fill="var(--color-value)">
                        <LabelList dataKey="value" position="right" offset={8} className="fill-foreground text-xs" formatter={(v: number) => formatCurrency(v, 0)} />
                    </Bar>
                </BarChart>
            </ChartContainer>
        </CardContent>
    </Card>
);

const MaterialReconciliationChart = ({ data }: { data: { name: string; budgeted: number; issued: number; used: number; }[] }) => {
    const chartConfig: ChartConfig = {
      budgeted: { label: 'Budgeted', color: 'hsl(var(--chart-3))' },
      issued: { label: 'Issued', color: 'hsl(var(--chart-1))' },
      used: { label: 'Used', color: 'hsl(var(--chart-2))' },
    };
    return (
        <Card>
            <CardHeader>
                <CardTitle>Material Reconciliation</CardTitle>
                <CardDescription>Budgeted vs. Issued vs. Used Qty for top materials</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} angle={-15} textAnchor="end" height={50} />
                        <YAxis />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar dataKey="budgeted" fill="var(--color-budgeted)" radius={4} />
                        <Bar dataKey="issued" fill="var(--color-issued)" radius={4} />
                        <Bar dataKey="used" fill="var(--color-used)" radius={4} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
};

type MaterialCostItem = { id: string; description: string; budgetedCost: number; actualCost: number; variance: number; };
type SortKey = keyof MaterialCostItem;

const MaterialCostVsBudgetTable = ({ data }: { data: MaterialCostItem[] }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

    const sortedData = useMemo(() => {
        let sortableItems = [...data];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                
                let comparison = 0;
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    comparison = aValue - bValue;
                } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                    comparison = aValue.localeCompare(bValue, undefined, { numeric: true });
                }

                return sortConfig.direction === 'asc' ? comparison : -comparison;
            });
        }
        return sortableItems;
    }, [data, sortConfig]);

    const requestSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const renderHeader = (label: string, sortKey: SortKey, className?: string) => (
        <TableHead className={className}>
            <Button variant="ghost" className="w-full justify-start px-0" onClick={() => requestSort(sortKey)}>
                {label} {getSortIcon(sortKey)}
            </Button>
        </TableHead>
    );
    const renderNumericHeader = (label: string, sortKey: SortKey, className?: string) => (
         <TableHead className={className}>
            <Button variant="ghost" className="w-full justify-end px-0" onClick={() => requestSort(sortKey)}>
                {label} {getSortIcon(sortKey)}
            </Button>
        </TableHead>
    );

    const totals = data.reduce((acc, item) => {
        acc.budgeted += item.budgetedCost;
        acc.actual += item.actualCost;
        acc.variance += item.variance;
        return acc;
    }, { budgeted: 0, actual: 0, variance: 0 });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Material Cost Tracking</CardTitle>
                <CardDescription>Monitors actual material cost vs. budget.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg max-h-[500px] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                                {renderHeader('Material', 'description')}
                                {renderNumericHeader('Budgeted Cost', 'budgetedCost', 'text-right')}
                                {renderNumericHeader('Actual Cost', 'actualCost', 'text-right')}
                                {renderNumericHeader('Variance', 'variance', 'text-right')}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedData.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.description}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.budgetedCost, 2)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.actualCost, 2)}</TableCell>
                                    <TableCell className={`text-right font-medium ${item.variance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                        {formatCurrency(item.variance, 2)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter className="sticky bottom-0 bg-muted/50">
                            <TableRow>
                                <TableCell className="font-bold">Total</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totals.budgeted, 2)}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totals.actual, 2)}</TableCell>
                                <TableCell className={`text-right font-bold ${totals.variance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    {formatCurrency(totals.variance, 2)}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}

const ProjectProfitabilityTable = ({ projects }: { projects: Project[] }) => {
    const data = useMemo(() => {
        return projects.map(p => ({
            id: p.id,
            name: p.name,
            revenue: p.revenue,
            actualRevenue: p.actualRevenue,
            budgetedCost: p.budgetedCost,
            actualCost: p.actualCost,
            estGrossProfit: p.estGrossProfit,
            actualGrossProfit: p.actualGrossProfit,
            actualGrossMargin: p.actualRevenue > 0 ? (p.actualGrossProfit / p.actualRevenue) * 100 : 0,
        }));
    }, [projects]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Project Profitability</CardTitle>
                <CardDescription>Line-by-line financial performance of each project.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg max-h-[500px] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                                <TableHead>Project</TableHead>
                                <TableHead className="text-right">Budgeted Revenue</TableHead>
                                <TableHead className="text-right">Actual Revenue</TableHead>
                                <TableHead className="text-right">Budgeted Cost</TableHead>
                                <TableHead className="text-right">Actual Cost</TableHead>
                                <TableHead className="text-right">Actual Profit</TableHead>
                                <TableHead className="text-right">Margin</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-medium">{p.name}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(p.revenue, 0)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(p.actualRevenue, 0)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(p.budgetedCost, 0)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(p.actualCost, 0)}</TableCell>
                                    <TableCell className="text-right font-bold">{formatCurrency(p.actualGrossProfit, 0)}</TableCell>
                                    <TableCell className={`text-right font-medium ${p.actualGrossMargin >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {p.actualGrossMargin.toFixed(1)}%
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

const MonthlyPoChart = ({ title, description, data, dataKey, color }: { title: string; description: string; data: any[]; dataKey: string, color: string }) => {
    const chartConfig: ChartConfig = {
      [dataKey]: { label: title, color: `hsl(var(--${color}))` },
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <ResponsiveContainer>
                        <BarChart data={data}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis tickFormatter={(value) => `RM${Number(value) / 1000}k`} />
                            <Tooltip
                                content={<ChartTooltipContent
                                    formatter={(value, name, props) => <span>{title}: {formatCurrency(value as number, 2)}</span>}
                                />}
                            />
                            <Bar dataKey={dataKey} fill={chartConfig[dataKey].color} radius={[4, 4, 0, 0]} name={title} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    )
};


interface DashboardClientProps {
    projects: Project[];
    plantUnits: PlantUnit[];
    teams: InHouseTeam[];
    company: Company | null;
    companyId: string;
    generalPurchaseOrders: MaterialPurchaseOrder[];
    deliveryOrders: DeliveryOrder[];
    supplierInvoices: SupplierInvoice[];
}

export default function DashboardClient({ projects: initialProjects, plantUnits, teams, company, companyId, generalPurchaseOrders, deliveryOrders, supplierInvoices }: DashboardClientProps) {

    const uniqueYears = useMemo(() => {
        const years = new Set<string>();
        initialProjects.forEach(p => {
            if (p.startDate) {
                years.add(p.startDate.substring(0, 4));
            }
            (p.purchaseOrders || []).forEach(po => {
                if (po.poDate) {
                    years.add(po.poDate.substring(0, 4));
                }
            });
        });
        const sortedYears = Array.from(years).sort((a, b) => Number(b) - Number(a));
        return ['all', ...sortedYears];
    }, [initialProjects]);

    const latestYear = uniqueYears.find(y => y !== 'all') || 'all';
    const [selectedYear, setSelectedYear] = useState<string>(latestYear);
    const [isClient, setIsClient] = useState(false);
    
    useEffect(() => {
        setIsClient(true);
    }, []);

    const projectsWithCalculatedValues = useMemo(() => {
        const projects = initialProjects
            .filter(p => p.status !== 'Closed') // Exclude closed projects from all dashboard calculations
            .filter(p => {
                if (selectedYear === 'all') return true;
    
                const hasActivityInYear = (p.startDate && p.startDate.startsWith(selectedYear)) ||
                                         (p.purchaseOrders || []).some(po => po.poDate && po.poDate.startsWith(selectedYear));
    
                return hasActivityInYear;
            });
        
        return projects.map(project => {
            const budgetedRevenue = (project.clientBoq?.length)
                ? project.clientBoq.reduce((acc, item) => acc + (item.quantity * item.rate) + (item.managementFee || 0), 0)
                : project.revenue;
            
            const claimsNetValue = (project.clientClaims || [])
                .filter(claim => claim.status === 'Paid' || claim.status === 'Submitted')
                .reduce((total, claim) => total + (claim.amount - (claim.retentionAmount || 0)), 0);

            let progress = 0;
            if (budgetedRevenue > 0) {
                progress = Math.round((claimsNetValue / budgetedRevenue) * 100);
            } else if (project.status === 'Completed') {
                progress = 100;
            }

            const subconPoCost = project.purchaseOrders
                ?.filter(po => po.type === 'Subcontractor')
                .reduce((total, po) => 
                    total + po.items.reduce((itemTotal, item) => itemTotal + (item.quantity * item.rate), 0),
                0) || 0;

            const materialBudgetedCost = project.materialBoq
                ?.reduce((total, item) => total + (item.quantity * item.rate), 0) || 0;
            
            const calculatedBudgetedCost = subconPoCost + materialBudgetedCost;
                
            const subconActualCost = (project.subconClaims || [])
                .reduce((total, claim) => total + claim.amount, 0);
            
            const rateMap = new Map<string, number>();
            project.materialBoq?.forEach(item => rateMap.set(item.id, item.rate));
            plantUnits.filter(pu => pu.category === 'Material PU').forEach(item => rateMap.set(item.id, item.rate));
            
            const materialSummaryMap = new Map<string, { issuedQty: number; returnedQty: number }>();
            (project.materialIssuances || []).flatMap(i => i.items).forEach(item => {
                const entry = materialSummaryMap.get(item.sourceId) ?? { issuedQty: 0, returnedQty: 0 };
                entry.issuedQty += item.quantity;
                materialSummaryMap.set(item.sourceId, entry);
            });
            (project.materialReturns || []).flatMap(r => r.items).forEach(item => {
                const entry = materialSummaryMap.get(item.sourceId) ?? { issuedQty: 0, returnedQty: 0 };
                entry.returnedQty += item.quantity;
                materialSummaryMap.set(item.sourceId, entry);
            });

            let materialActualCost = 0;
            materialSummaryMap.forEach((data, sourceId) => {
                const usedQty = data.issuedQty - data.returnedQty;
                const rate = rateMap.get(sourceId) || 0;
                materialActualCost += usedQty * rate;
            });

            const teamActualCost = project.teamCosts?.reduce((sum, cost) => sum + cost.salary + cost.petrolAndToll + cost.siteExpenses + cost.machineryAndUpkeep, 0) || 0;
            
            const totalActualCost = subconActualCost + materialActualCost + teamActualCost;

            const estGrossProfit = budgetedRevenue - calculatedBudgetedCost;
            const actualGrossProfit = claimsNetValue - totalActualCost;

            return {
                ...project,
                progress: Math.min(progress, 100),
                budgetedCost: calculatedBudgetedCost,
                actualCost: totalActualCost,
                revenue: budgetedRevenue,
                actualRevenue: claimsNetValue,
                estGrossProfit,
                actualGrossProfit,
                 subconActualCost,
                materialActualCost,
                teamActualCost,
            };
        });
    }, [initialProjects, selectedYear, plantUnits]);

    const dashboardKpis = useMemo(() => {
        // --- Base Metrics ---
        const totalRevenue = projectsWithCalculatedValues.reduce((acc, p) => acc + p.actualRevenue, 0);
        const totalGrossProfit = projectsWithCalculatedValues.reduce((acc, p) => acc + p.actualGrossProfit, 0);
        
        // --- Budget Variance for COMPLETED projects only ---
        const completedProjects = projectsWithCalculatedValues.filter(p => p.status === 'Completed' || p.status === 'Closed');
        const totalBudgetedCostCompleted = completedProjects.reduce((acc, p) => acc + p.budgetedCost, 0);
        const totalActualCostCompleted = completedProjects.reduce((acc, p) => acc + p.actualCost, 0);
        const budgetVariance = totalActualCostCompleted - totalBudgetedCostCompleted;
        const budgetVariancePercentage = totalBudgetedCostCompleted > 0 ? (Math.abs(budgetVariance) / totalBudgetedCostCompleted) * 100 : 0;
        
        // --- Card 2: Active Projects ---
        const activeProjects = projectsWithCalculatedValues.filter(p => p.status === 'Implementation' || p.status === 'Planning').length;
        const planningProjects = projectsWithCalculatedValues.filter(p => p.status === 'Planning').length;
        const implementationProjects = projectsWithCalculatedValues.filter(p => p.status === 'Implementation').length;

        // --- Card 3: Gross Profit ---
        const grossProfitMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
        
        // --- Card 6: Avg Project Duration ---
        const closedProjectsForDuration = projectsWithCalculatedValues.filter(p => (p.status === 'Completed' || p.status === 'Closed') && p.startDate && p.targetCompletionDate);
        const avgDuration = closedProjectsForDuration.length > 0
            ? closedProjectsForDuration.reduce((acc, p) => acc + differenceInMonths(parseISO(p.targetCompletionDate!), parseISO(p.startDate!)), 0) / closedProjectsForDuration.length
            : 0;

        return { 
            totalRevenue,
            activeProjects,
            planningProjects,
            implementationProjects,
            totalGrossProfit,
            grossProfitMargin,
            budgetVariance,
            budgetVariancePercentage,
            avgDuration,
        };
    }, [projectsWithCalculatedValues]);
    
    // Time-sensitive KPIs
    const [dynamicKpis, setDynamicKpis] = useState({
        revenueChangePercentage: 0,
        startedThisMonth: 0,
        completedThisMonth: 0,
        onTimeCompletion: 0,
        onTimeCompletionChange: 0,
    });
    
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const now = new Date();
        const startOfCurrentMonth = startOfMonth(now);
        const endOfCurrentMonth = endOfMonth(now);
        const startOfLastMonth = startOfMonth(subMonths(now, 1));
        const endOfLastMonth = endOfMonth(subMonths(now, 1));
        const startOfLastQuarter = startOfQuarter(subQuarters(now, 1));
        const endOfLastQuarter = endOfQuarter(subQuarters(now, 1));

        // --- Card 1: Total Revenue ---
        const revenueThisMonthClaims = projectsWithCalculatedValues
            .flatMap(p => p.clientClaims?.filter(c => c.date && isWithinInterval(parseISO(c.date), { start: startOfCurrentMonth, end: endOfCurrentMonth })) || []);
        const revenueThisMonth = revenueThisMonthClaims.reduce((sum, c) => sum + (c.amount - (c.retentionAmount || 0)), 0);
        
        const revenueLastMonthClaims = projectsWithCalculatedValues
            .flatMap(p => p.clientClaims?.filter(c => c.date && isWithinInterval(parseISO(c.date), { start: startOfLastMonth, end: endOfLastMonth })) || []);
        const revenueLastMonth = revenueLastMonthClaims.reduce((sum, c) => sum + (c.amount - (c.retentionAmount || 0)), 0);

        const revenueChangePercentage = revenueLastMonth > 0 
            ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100 
            : (revenueThisMonth > 0 ? 100 : 0);
            
        // --- Card 5: Projects This Month ---
        const startedThisMonth = projectsWithCalculatedValues.filter(p => p.startDate && isWithinInterval(parseISO(p.startDate), { start: startOfCurrentMonth, end: endOfCurrentMonth })).length;
        const completedThisMonth = projectsWithCalculatedValues.filter(p => p.actualCompletionDate && isWithinInterval(parseISO(p.actualCompletionDate), { start: startOfCurrentMonth, end: endOfCurrentMonth })).length;
        
        // --- Card 7: On-Time Completion ---
        const closedProjectsForCompletion = projectsWithCalculatedValues.filter(p => (p.status === 'Completed' || p.status === 'Closed') && p.targetCompletionDate && p.actualCompletionDate);
        const onTimeCompletion = closedProjectsForCompletion.length > 0
            ? (closedProjectsForCompletion.filter(p => p.actualCompletionDate && p.targetCompletionDate && new Date(p.actualCompletionDate) <= new Date(p.targetCompletionDate)).length / closedProjectsForCompletion.length) * 100
            : 0;
        
        const closedLastQuarter = projectsWithCalculatedValues.filter(p => 
            (p.status === 'Completed' || p.status === 'Closed') && 
            p.targetCompletionDate && 
            p.actualCompletionDate && 
            isWithinInterval(parseISO(p.actualCompletionDate), { start: startOfLastQuarter, end: endOfLastQuarter })
        );

        const onTimeCompletionLastQuarter = closedLastQuarter.length > 0
            ? (closedLastQuarter.filter(p => p.actualCompletionDate && p.targetCompletionDate && new Date(p.actualCompletionDate) <= new Date(p.targetCompletionDate)).length / closedLastQuarter.length) * 100
            : 0;
        
        const onTimeCompletionChange = onTimeCompletion - onTimeCompletionLastQuarter;
        
        setDynamicKpis({
            revenueChangePercentage,
            startedThisMonth,
            completedThisMonth,
            onTimeCompletion,
            onTimeCompletionChange
        });

    }, [projectsWithCalculatedValues]);


    const projectStatusData = useMemo(() => {
        const statusCounts: Record<ProjectStatus, number> = { 'Setup': 0, 'Planning': 0, 'Implementation': 0, 'Overdue': 0, 'Closed': 0, 'Completed': 0, 'KIV': 0, 'Cancelled': 0 };
        projectsWithCalculatedValues.forEach(p => {
            if(statusCounts[p.status] !== undefined) {
                statusCounts[p.status]++;
            }
        });
        return Object.entries(statusCounts).map(([status, count]) => ({ status, count })).filter(d => d.count > 0);
    }, [projectsWithCalculatedValues]);

    const monthlyPerformanceData = useMemo(() => {
        const dataByMonth: Record<string, { sortKey: string, month: string, revenue: number, cost: number, profit: number }> = {};
        
        const dateFilter = (dateStr: string | undefined) => {
            if (!dateStr) return false;
            if (selectedYear === 'all') return true;
            return dateStr.startsWith(selectedYear);
        };

        const rateMap = new Map<string, number>();
        projectsWithCalculatedValues.forEach(project => {
          (project.materialBoq || []).forEach(item => rateMap.set(item.id, item.rate));
        });
        plantUnits.filter(pu => pu.category === 'Material PU').forEach(item => {
            if (!rateMap.has(item.id)) rateMap.set(item.id, item.rate);
        });

        const getEntry = (dateStr: string) => {
            const date = parseISO(dateStr.length === 7 ? `${dateStr}-01` : dateStr);
            const sortKey = format(date, 'yyyy-MM');
            const monthLabel = format(date, 'MMM yy');
            if (!dataByMonth[sortKey]) dataByMonth[sortKey] = { sortKey, month: monthLabel, revenue: 0, cost: 0, profit: 0 };
            return dataByMonth[sortKey];
        };

        projectsWithCalculatedValues.forEach(p => {
            // Revenue from client claims
            (p.clientClaims || []).filter(c => dateFilter(c.date)).forEach(claim => {
                if (!claim.date) return;
                getEntry(claim.date).revenue += claim.amount;
            });
    
            // Cost from subcon claims
            (p.subconClaims || []).filter(c => dateFilter(c.date)).forEach(claim => {
                if (!claim.date) return;
                getEntry(claim.date).cost += claim.amount;
            });
    
            // Cost from team costs
            p.teamCosts?.filter(c => dateFilter(c.month)).forEach(cost => {
                if (!cost.month) return;
                getEntry(`${cost.month}-01`).cost += cost.salary + cost.petrolAndToll + cost.siteExpenses + cost.machineryAndUpkeep;
            });

            // Cost from material issuance
            (p.materialIssuances || []).filter(i => dateFilter(i.date)).forEach(issuance => {
                if (!issuance.date) return;
                const entry = getEntry(issuance.date);
                issuance.items.forEach(item => {
                    const itemRate = rateMap.get(item.sourceId) || 0;
                    entry.cost += item.quantity * itemRate;
                })
            });
    
            // Subtract cost from material returns
            (p.materialReturns || []).filter(r => dateFilter(r.date)).forEach(ret => {
                if (!ret.date) return;
                const entry = getEntry(ret.date);
                ret.items.forEach(item => {
                    const itemRate = rateMap.get(item.sourceId) || 0;
                    entry.cost -= item.quantity * itemRate;
                })
            });
        });
    
        const result = Object.values(dataByMonth).map(monthData => {
            monthData.profit = monthData.revenue - monthData.cost;
            return monthData;
        });
    
        return result.sort((a,b) => a.sortKey.localeCompare(b.sortKey));
    }, [projectsWithCalculatedValues, plantUnits, selectedYear]);
    
    const costBreakdownData = useMemo(() => {
        const costs = projectsWithCalculatedValues.reduce((acc, p) => {
            acc.labor += p.teamActualCost;
            acc.materials += p.materialActualCost;
            acc.subcon += p.subconActualCost;
            return acc;
        }, { labor: 0, materials: 0, subcon: 0 });
        if (costs.labor + costs.materials + costs.subcon === 0) return [];
        return [
            { name: 'Labor', value: costs.labor, fill: 'hsl(var(--chart-3))' },
            { name: 'Materials', value: costs.materials, fill: 'hsl(var(--chart-1))' },
            { name: 'Subcontractor', value: costs.subcon, fill: 'hsl(var(--chart-2))' }
        ].filter(d => d.value > 0);
    }, [projectsWithCalculatedValues]);

    const completionRateData = useMemo(() => {
        const completionsByMonth: Record<string, { sortKey: string, month: string, count: number }> = {};
        
        const dateFilter = (dateStr: string | undefined) => {
            if (!dateStr) return false;
            if (selectedYear === 'all') return true;
            return dateStr.startsWith(selectedYear);
        };

        const closedProjects = projectsWithCalculatedValues.filter(p => (p.status === 'Completed' || p.status === 'Closed') && p.targetCompletionDate);
        
        closedProjects.forEach(p => {
            if (p.actualCompletionDate && dateFilter(p.actualCompletionDate)) {
              const date = parseISO(p.actualCompletionDate);
              const sortKey = format(date, 'yyyy-MM');
              const monthLabel = format(date, 'MMM yy');
              if (!completionsByMonth[sortKey]) {
                  completionsByMonth[sortKey] = { sortKey, month: monthLabel, count: 0 };
              }
              completionsByMonth[sortKey].count += 1;
            }
        });

        return Object.values(completionsByMonth)
            .sort((a,b) => a.sortKey.localeCompare(b.sortKey))
            .map(d => ({ month: d.month, 'Completed Projects': d.count }));
    }, [projectsWithCalculatedValues, selectedYear]);

    const invoiceData = useMemo(() => {
        const dataByMonth: Record<string, { sortKey: string, month: string, submitted: number, received: number }> = {};
        
        const dateFilter = (dateStr: string | undefined) => {
            if (!dateStr) return false;
            if (selectedYear === 'all') return true;
            return dateStr.startsWith(selectedYear);
        };

        projectsWithCalculatedValues.forEach(p => {
            (p.clientClaims || []).filter(c => dateFilter(c.date)).forEach(claim => {
                 if (!claim.date) return;
                const date = parseISO(claim.date);
                const sortKey = format(date, 'yyyy-MM');
                const month = format(date, 'MMM yy');
                if (!dataByMonth[sortKey]) dataByMonth[sortKey] = { sortKey, month, submitted: 0, received: 0 };
                dataByMonth[sortKey].submitted += (claim.amount - (claim.retentionAmount || 0));
                if (claim.status === 'Paid') {
                    dataByMonth[sortKey].received += (claim.amount - (claim.retentionAmount || 0));
                }
            });
        });
        return Object.values(dataByMonth).sort((a,b) => a.sortKey.localeCompare(b.sortKey));
    }, [projectsWithCalculatedValues, selectedYear]);

    const cashFlowData = useMemo(() => {
        const dataByMonth: Record<string, { sortKey: string, month: string, projected: number, actual: number }> = {};
        
        const dateFilter = (dateStr: string | undefined) => {
            if (!dateStr) return false;
            if (selectedYear === 'all') return true;
            return dateStr.startsWith(selectedYear);
        };

        const rateMap = new Map<string, number>();
        projectsWithCalculatedValues.forEach(project => {
          (project.materialBoq || []).forEach(item => rateMap.set(item.id, item.rate));
        });
        plantUnits.filter(pu => pu.category === 'Material PU').forEach(item => {
            if (!rateMap.has(item.id)) rateMap.set(item.id, item.rate);
        });

        const getEntry = (dateStr: string) => {
            const date = parseISO(dateStr.length === 7 ? `${dateStr}-01` : dateStr);
            const sortKey = format(date, 'yyyy-MM');
            const monthLabel = format(date, 'MMM yy');
            if (!dataByMonth[sortKey]) dataByMonth[sortKey] = { sortKey, month: monthLabel, projected: 0, actual: 0 };
            return dataByMonth[sortKey];
        };

        projectsWithCalculatedValues.forEach(p => {
            // Projected costs from BOQ based on project timeline
            const durationMonths = p.startDate && p.targetCompletionDate ? differenceInMonths(parseISO(p.targetCompletionDate), parseISO(p.startDate)) + 1 : 1;
            const monthlyProjectedCost = p.budgetedCost / durationMonths;
            
            if(p.startDate && p.targetCompletionDate) {
                for(let i=0; i<durationMonths; i++) {
                    const date = addMonths(parseISO(p.startDate), i);
                    const dateStr = format(date, 'yyyy-MM-dd');
                    if (dateFilter(dateStr)) {
                        getEntry(dateStr).projected += monthlyProjectedCost;
                    }
                }
            }
            
            // Actual costs
            (p.subconClaims || []).filter(c => dateFilter(c.date)).forEach(claim => {
                 if (!claim.date) return;
                getEntry(claim.date).actual += claim.amount;
            });
    
            (p.teamCosts || []).filter(c => dateFilter(c.month)).forEach(cost => {
                 if (!cost.month) return;
                getEntry(`${cost.month}-01`).actual += cost.salary + cost.petrolAndToll + cost.siteExpenses + cost.machineryAndUpkeep;
            });

            // Cost from material issuance
            (p.materialIssuances || []).filter(i => dateFilter(i.date)).forEach(issuance => {
                if (!issuance.date) return;
                const entry = getEntry(issuance.date);
                issuance.items.forEach(item => {
                    const itemRate = rateMap.get(item.sourceId) || 0;
                    entry.actual += item.quantity * itemRate;
                })
            });
    
            // Subtract cost from material returns
            (p.materialReturns || []).filter(r => dateFilter(r.date)).forEach(ret => {
                if (!ret.date) return;
                const entry = getEntry(ret.date);
                ret.items.forEach(item => {
                    const itemRate = rateMap.get(item.sourceId) || 0;
                    entry.actual -= item.quantity * itemRate;
                })
            });
        });
        return Object.values(dataByMonth).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }, [projectsWithCalculatedValues, plantUnits, selectedYear]);
    
    const materialDashboardData = useMemo(() => {
        const totalPoValue = generalPurchaseOrders.reduce((total, po) => 
            total + po.items.reduce((sum, item) => sum + item.quantity * item.rate, 0), 0);

        const poItemRateMap = new Map<string, number>();
        generalPurchaseOrders.forEach(po => {
            po.items.forEach(item => {
                poItemRateMap.set(item.id, item.rate);
            });
        });

        const valueOfGoodsReceived = deliveryOrders.reduce((total, doo) =>
            total + doo.items.reduce((sum, item) => {
                const rate = poItemRateMap.get(item.poItemId) || 0;
                return sum + item.receivedQuantity * rate;
            }, 0), 0);

        const plantUnitRateMap = new Map<string, number>();
        plantUnits.filter(pu => pu.category === 'Material PU').forEach(pu => {
            plantUnitRateMap.set(pu.id, pu.rate);
        });

        let totalMaterialUsedCost = 0;
        const monthlyCostData: Record<string, { sortKey: string, month: string, cost: number }> = {};
        const topConsumedMaterialsMap = new Map<string, {name: string, value: number}>();
        
        const dateFilter = (dateStr: string | undefined) => {
            if (!dateStr) return false;
            if (selectedYear === 'all') return true;
            return dateStr.startsWith(selectedYear);
        };

        projectsWithCalculatedValues.forEach(p => {
            (p.materialIssuances || []).filter(i => dateFilter(i.date)).forEach(issuance => {
                if (!issuance.date) return;
                const date = parseISO(issuance.date);
                const sortKey = format(date, 'yyyy-MM');
                const monthLabel = format(date, 'MMM yy');
                if (!monthlyCostData[sortKey]) monthlyCostData[sortKey] = { sortKey, month: monthLabel, cost: 0 };

                issuance.items.forEach(item => {
                    const rate = plantUnitRateMap.get(item.sourceId) || 0;
                    const cost = item.quantity * rate;
                    totalMaterialUsedCost += cost;
                    monthlyCostData[sortKey].cost += cost;

                    const consumedEntry = topConsumedMaterialsMap.get(item.sourceId) || { name: item.description, value: 0 };
                    consumedEntry.value += cost;
                    topConsumedMaterialsMap.set(item.sourceId, consumedEntry);
                });
            });
            (p.materialReturns || []).filter(r => dateFilter(r.date)).forEach(ret => {
                if (!ret.date) return;
                const date = parseISO(ret.date);
                const sortKey = format(date, 'yyyy-MM');
                const monthLabel = format(date, 'MMM yy');
                if (!monthlyCostData[sortKey]) monthlyCostData[sortKey] = { sortKey, month: monthLabel, cost: 0 };
                
                ret.items.forEach(item => {
                    const rate = plantUnitRateMap.get(item.sourceId) || 0;
                    const cost = item.quantity * rate;
                    totalMaterialUsedCost -= cost;
                    monthlyCostData[sortKey].cost -= cost;

                    const consumedEntry = topConsumedMaterialsMap.get(item.sourceId);
                    if (consumedEntry) {
                      consumedEntry.value -= cost;
                    }
                });
            });
        });

        const stockOnHandValue = valueOfGoodsReceived - totalMaterialUsedCost;

        const topConsumedMaterials = Array.from(topConsumedMaterialsMap.values())
            .sort((a,b) => b.value - a.value)
            .slice(0, 10);

        return {
            totalPoValue,
            totalMaterialUsedCost,
            stockOnHandValue,
            monthlyCostData: Object.values(monthlyCostData).sort((a,b) => a.sortKey.localeCompare(b.sortKey)),
            topConsumedMaterials,
        };
    }, [projectsWithCalculatedValues, plantUnits, generalPurchaseOrders, deliveryOrders, selectedYear]);
    
    const materialAnalyticsData = useMemo(() => {
        const summaryMap = new Map<string, {
            id: string;
            description: string;
            budgetedQty: number;
            budgetedCost: number;
            issuedQty: number;
            returnedQty: number;
            usedQty: number;
            actualCost: number;
        }>();
        
        const rateMap = new Map<string, number>();
        plantUnits.filter(pu => pu.category === 'Material PU').forEach(item => rateMap.set(item.id, item.rate));
        
        projectsWithCalculatedValues.forEach(p => {
            (p.materialBoq || []).forEach(item => {
                if (!rateMap.has(item.id)) rateMap.set(item.id, item.rate);
                
                const key = item.description;
                const entry = summaryMap.get(key) || {
                    id: key,
                    description: item.description,
                    budgetedQty: 0,
                    budgetedCost: 0,
                    issuedQty: 0,
                    returnedQty: 0,
                    usedQty: 0,
                    actualCost: 0
                };
                entry.budgetedQty += item.quantity;
                entry.budgetedCost += item.quantity * item.rate;
                summaryMap.set(key, entry);
            });

            (p.materialIssuances || []).forEach(issuance => {
                issuance.items.forEach(item => {
                    const key = item.description;
                    const entry = summaryMap.get(key);
                    if (entry) {
                        entry.issuedQty += item.quantity;
                    }
                });
            });
            
            (p.materialReturns || []).forEach(ret => {
                ret.items.forEach(item => {
                    const key = item.description;
                    const entry = summaryMap.get(key);
                    if (entry) {
                        entry.returnedQty += item.quantity;
                    }
                });
            });
        });
        
        summaryMap.forEach(entry => {
            entry.usedQty = entry.issuedQty - entry.returnedQty;
            
            let totalActualCost = 0;
            projectsWithCalculatedValues.forEach(p => {
                (p.materialIssuances || []).forEach(issuance => {
                    issuance.items.forEach(item => {
                        if (item.description === entry.description) {
                            const rate = rateMap.get(item.sourceId) || 0;
                            totalActualCost += item.quantity * rate;
                        }
                    });
                });
                (p.materialReturns || []).forEach(ret => {
                    ret.items.forEach(item => {
                        if (item.description === entry.description) {
                            const rate = rateMap.get(item.sourceId) || 0;
                            totalActualCost -= item.quantity * rate;
                        }
                    });
                });
            });
            entry.actualCost = totalActualCost;
        });

        const summaryList = Array.from(summaryMap.values());
        
        const costTrackingData = summaryList.map(item => ({
            ...item,
            variance: item.actualCost - item.budgetedCost,
        }));
        
        const reconciliationData = [...summaryList]
            .sort((a,b) => b.budgetedCost - a.budgetedCost)
            .slice(0, 10)
            .map(item => ({
                name: item.description,
                budgeted: item.budgetedQty,
                issued: item.issuedQty,
                used: item.usedQty,
            }));


        return {
            costTrackingData,
            reconciliationData,
        };
    }, [projectsWithCalculatedValues, plantUnits]);
    
    const projectDeliveryData = useMemo(() => {
        const dataByMonth: Record<string, { sortKey: string, month: string, planned: number, actual: number }> = {};
        
        const dateFilter = (dateStr: string | undefined) => {
            if (!dateStr) return false;
            if (selectedYear === 'all') return true;
            return dateStr.startsWith(selectedYear);
        };

        const getEntry = (dateStr: string) => {
            const date = parseISO(dateStr);
            const sortKey = format(date, 'yyyy-MM');
            const monthLabel = format(date, 'MMM yy');
            if (!dataByMonth[sortKey]) dataByMonth[sortKey] = { sortKey, month: monthLabel, planned: 0, actual: 0 };
            return dataByMonth[sortKey];
        };

        projectsWithCalculatedValues.forEach(p => {
            if (p.targetCompletionDate && dateFilter(p.targetCompletionDate)) {
                getEntry(p.targetCompletionDate).planned++;
            }
            if (p.actualCompletionDate && dateFilter(p.actualCompletionDate)) {
                getEntry(p.actualCompletionDate).actual++;
            }
        });
        return Object.values(dataByMonth).sort((a,b) => a.sortKey.localeCompare(b.sortKey));
    }, [projectsWithCalculatedValues, selectedYear]);
    
    const clientPerformanceData = useMemo(() => {
        const clientMap = new Map<string, { projects: any[], totalRevenue: number }>();
        projectsWithCalculatedValues.forEach(p => {
            if (!clientMap.has(p.client)) clientMap.set(p.client, { projects: [], totalRevenue: 0 });
            const entry = clientMap.get(p.client)!;
            entry.projects.push(p);
            entry.totalRevenue += p.actualRevenue;
        });

        return Array.from(clientMap.entries()).map(([name, data]) => {
            const closed = data.projects.filter(p => (p.status === 'Completed' || p.status === 'Closed') && p.targetCompletionDate && p.actualCompletionDate);
            const onTime = closed.filter(p => new Date(p.actualCompletionDate!) <= new Date(p.targetCompletionDate!)).length;
            return {
                clientName: name, projectCount: data.projects.length, totalRevenue: data.totalRevenue,
                satisfaction: closed.length > 0 ? Math.round((onTime / closed.length) * 100) : 100
            };
        });
    }, [projectsWithCalculatedValues]);
    
    const poSummaryData = useMemo(() => {
        const dataByMonth: Record<string, { sortKey: string, month: string, clientPoValue: number; subconPoValue: number; }> = {};
        
        initialProjects.forEach(p => {
            (p.purchaseOrders || []).forEach(po => {
                if (!po.poDate || (selectedYear !== 'all' && !po.poDate.startsWith(selectedYear))) {
                    return;
                }
                const date = parseISO(po.poDate);
                const sortKey = format(date, 'yyyy-MM');
                const monthLabel = format(date, 'MMM yy');
                if (!dataByMonth[sortKey]) dataByMonth[sortKey] = { sortKey, month: monthLabel, clientPoValue: 0, subconPoValue: 0 };
                
                const subtotal = po.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
                const managementFee = po.items.reduce((sum, item) => sum + (item.managementFee || 0), 0);
                const sstAmount = (subtotal + managementFee) * ((po.sstPercentage || 0) / 100);
                const poValue = subtotal + managementFee + sstAmount;

                if (po.type === 'Client') {
                    dataByMonth[sortKey].clientPoValue += poValue;
                } else if (po.type === 'Subcontractor') {
                    dataByMonth[sortKey].subconPoValue += poValue;
                }
            });
        });
        return Object.values(dataByMonth).sort((a,b) => a.sortKey.localeCompare(b.sortKey));
    }, [initialProjects, selectedYear]);
    
    const clientPoData = useMemo(() => {
        return poSummaryData.map(d => ({ month: d.month, clientPoValue: d.clientPoValue }));
    }, [poSummaryData]);

    const subconPoData = useMemo(() => {
        return poSummaryData.map(d => ({ month: d.month, subconPoValue: d.subconPoValue }));
    }, [poSummaryData]);


    const handleExportPdf = useCallback(async (elementId: string, tabName: string) => {
        const { default: jsPDF } = await import('jspdf');
        const { default: html2canvas } = await import('html2canvas');

        const companyName = company ? company.name : 'Structura';
        const date = new Date();
        const monthYear = format(date, 'MMMM yyyy');

        const filename = `${companyName.replace(/\s+/g, '_')}_${tabName}_${format(date, 'yyyyMMdd')}.pdf`;
        const title = `${companyName} - ${tabName}`;
        const subtitle = `Report for ${selectedYear === 'all' ? 'All Time' : selectedYear} (Generated: ${monthYear})`;

        const element = document.getElementById(elementId);
        if (!element) return;

        const canvas = await html2canvas(element, { 
            scale: 2,
            backgroundColor: 'white'
        });
        const imgData = canvas.toDataURL('image/png');
        
        const pdf = new jsPDF('p', 'mm', 'a4');
        const page_width = pdf.internal.pageSize.getWidth();
        const margin = 14;
        const max_width = page_width - margin * 2;

        pdf.setFontSize(18);
        const titleLines = pdf.splitTextToSize(title, max_width);
        pdf.text(titleLines, margin, 22);
        
        const titleHeight = pdf.getTextDimensions(titleLines).h;
        let y_pos = 22 + titleHeight;
        
        pdf.setFontSize(11);
        pdf.setTextColor(100);
        const subtitleLines = pdf.splitTextToSize(subtitle, max_width);
        pdf.text(subtitleLines, margin, y_pos);
        y_pos += pdf.getTextDimensions(subtitleLines).h;
        
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = imgWidth / imgHeight;
        
        const startY = y_pos + 8;
        let finalImgWidth = page_width - (margin * 2);
        let finalImgHeight = finalImgWidth / ratio;
        
        const availableHeight = pdfHeight - startY - margin;

        if (finalImgHeight > availableHeight) {
            finalImgHeight = availableHeight;
            finalImgWidth = finalImgHeight * ratio;
        }

        const xOffset = (pdfWidth - finalImgWidth) / 2;

        pdf.addImage(imgData, 'PNG', xOffset, startY, finalImgWidth, finalImgHeight);
        pdf.save(filename);
    }, [selectedYear, companyId, company]);
    
  const financialConfig = {
      revenue: { label: 'Revenue', color: 'hsl(var(--chart-1))' },
      cost: { label: 'Cost', color: 'hsl(var(--chart-2))' },
      profit: { label: 'Profit', color: 'hsl(var(--chart-3))' }
    } satisfies ChartConfig;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">
            Dashboard
          </h2>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your projects for {selectedYear === 'all' ? 'all time' : selectedYear}.
          </p>
        </div>
        <div className="flex items-center space-x-2">
           <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                    {uniqueYears.map(year => <SelectItem key={year} value={year}>{year === 'all' ? 'All Time' : year}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
      </div>
      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
        </TabsList>
        <TabsContent value="projects" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => handleExportPdf('projects-content', 'Projects')} variant="outline"><FileDown className="mr-2 h-4 w-4"/>Export PDF</Button>
            </div>
            <div id="projects-content" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold">{dashboardKpis.activeProjects}</div>
                        <p className="text-xs text-muted-foreground">
                            {dashboardKpis.planningProjects} planning, {dashboardKpis.implementationProjects} implementation
                        </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Projects This Month</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        {isClient ? <div className="text-2xl font-bold">{dynamicKpis.startedThisMonth + dynamicKpis.completedThisMonth}</div> : <div className="text-2xl font-bold">...</div>}
                        {isClient ? <p className="text-xs text-muted-foreground">{dynamicKpis.startedThisMonth} started, {dynamicKpis.completedThisMonth} completed</p> : <p className="text-xs text-muted-foreground">Loading...</p>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Project Duration</CardTitle>
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold">{dashboardKpis.avgDuration.toFixed(1)}</div>
                        <p className="text-xs text-muted-foreground">months average</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">On-Time Completion</CardTitle>
                        <History className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        {isClient ? <div className="text-2xl font-bold">{dynamicKpis.onTimeCompletion.toFixed(0)}%</div> : <div className="text-2xl font-bold">...</div>}
                        {isClient ? <p className={`text-xs text-muted-foreground flex items-center ${dynamicKpis.onTimeCompletionChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {dynamicKpis.onTimeCompletionChange >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                            {Math.abs(dynamicKpis.onTimeCompletionChange).toFixed(1)}% vs last quarter
                        </p> : <p className="text-xs text-muted-foreground">Loading...</p>}
                        </CardContent>
                    </Card>
                </div>
                <div className="grid grid-flow-row-dense grid-cols-1 gap-6 lg:grid-cols-2">
                    <ProjectStatusChart data={projectStatusData} />
                    <ClientProjectsChart projects={projectsWithCalculatedValues} />
                    <ProjectDeliveryPerformanceChart data={projectDeliveryData} />
                    <PerformanceChart data={monthlyPerformanceData} />
                    <ClientPerformanceAnalysis data={clientPerformanceData} className="lg:col-span-2" />
                    <ProjectTimelineOverview projects={projectsWithCalculatedValues} className="lg:col-span-2" />
                </div>
            </div>
        </TabsContent>
         <TabsContent value="financials" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => handleExportPdf('financials-content', 'Financials')} variant="outline"><FileDown className="mr-2 h-4 w-4"/>Export PDF</Button>
            </div>
            <div id="financials-content" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(dashboardKpis.totalRevenue)}</div>
                        {isClient ? <p className={`text-xs text-muted-foreground flex items-center ${dynamicKpis.revenueChangePercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {dynamicKpis.revenueChangePercentage >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                            {dynamicKpis.revenueChangePercentage.toFixed(1)}% from last month
                        </p> : <p className="text-xs text-muted-foreground">Loading...</p>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(dashboardKpis.totalGrossProfit)}</div>
                        <p className={`text-xs text-muted-foreground flex items-center ${dashboardKpis.grossProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {dashboardKpis.grossProfitMargin.toFixed(1)}% margin
                        </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Budget Variance (Completed)</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        <div className={`text-2xl font-bold ${dashboardKpis.budgetVariance > 0 ? 'text-red-500' : 'text-green-500'}`}>{formatCurrency(dashboardKpis.budgetVariance)}</div>
                        <p className={`text-xs text-muted-foreground flex items-center ${dashboardKpis.budgetVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {dashboardKpis.budgetVariancePercentage.toFixed(1)}% {dashboardKpis.budgetVariance > 0 ? 'over' : 'under'} budget (vs. Subcon PO + Material BOQ)
                        </p>
                        </CardContent>
                    </Card>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Monthly Financial Performance</CardTitle>
                            <CardDescription>Revenue, costs, and profit trends</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={financialConfig} className="h-[250px] w-full">
                                <ResponsiveContainer>
                                    <ComposedChart data={monthlyPerformanceData}>
                                        <CartesianGrid vertical={false} />
                                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                                        <YAxis tickFormatter={(value) => `RM${Number(value) / 1000}k`} />
                                        <Tooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />} />
                                        <Legend />
                                        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="cost" fill="var(--color-cost)" radius={[4, 4, 0, 0]} />
                                        <Line type="monotone" dataKey="profit" stroke="var(--color-profit)" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Cost Breakdown Analysis</CardTitle>
                            <CardDescription>Distribution of project costs by category</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={{}} className="mx-auto aspect-square h-[250px]">
                                <PieChart>
                                    <ChartTooltip content={<ChartTooltipContent nameKey="name" formatter={(value) => formatCurrency(value as number)} />} />
                                    <Pie data={costBreakdownData} dataKey="value" nameKey="name" labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`} outerRadius={60}>
                                            {costBreakdownData.map((entry) => (
                                            <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Legend />
                                </PieChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                    <MonthlyPoChart
                        title="Client Purchase Orders"
                        description="Total value of POs received from clients per month."
                        data={clientPoData}
                        dataKey="clientPoValue"
                        color="chart-1"
                    />
                    <MonthlyPoChart
                        title="Subcontractor Purchase Orders"
                        description="Total value of POs issued to subcontractors per month."
                        data={subconPoData}
                        dataKey="subconPoValue"
                        color="chart-2"
                    />
                  <AgingOfReceivablesChart projects={projectsWithCalculatedValues} />
                  <InvoiceSubmissionChart data={invoiceData} />
              </div>
              <div className="space-y-6">
                <CashFlowForecastChart data={cashFlowData} />
                <ProjectProfitabilityTable projects={projectsWithCalculatedValues} />
              </div>
            </div>
        </TabsContent>
        <TabsContent value="materials" className="pt-4 space-y-6">
            <div className="flex justify-end">
                <Button onClick={() => handleExportPdf('materials-content', 'Materials')} variant="outline"><FileDown className="mr-2 h-4 w-4"/>Export PDF</Button>
            </div>
            <div id="materials-content">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total PO Value</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(materialDashboardData.totalPoValue)}</div>
                             <p className="text-xs text-muted-foreground">Value of all general material POs</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Material Used (Cost)</CardTitle>
                             <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(materialDashboardData.totalMaterialUsedCost)}</div>
                             <p className="text-xs text-muted-foreground">Net cost of materials issued to projects</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Stock on Hand (Value)</CardTitle>
                             <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(materialDashboardData.stockOnHandValue)}</div>
                             <p className="text-xs text-muted-foreground">Estimated value of current inventory</p>
                        </CardContent>
                    </Card>
                </div>
                <div className="grid gap-6 md:grid-cols-2 mt-6">
                    <MonthlyMaterialCostChart data={materialDashboardData.monthlyCostData} />
                    <TopConsumedMaterialsChart data={materialDashboardData.topConsumedMaterials} />
                </div>
                 <div className="space-y-6 mt-6">
                    <MaterialReconciliationChart data={materialAnalyticsData.reconciliationData} />
                    <MaterialCostVsBudgetTable data={materialAnalyticsData.costTrackingData} />
                </div>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
