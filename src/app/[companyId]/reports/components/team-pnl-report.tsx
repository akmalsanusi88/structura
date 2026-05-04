
'use client';

import * as React from 'react';
import { useMemo, useState, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import type { Project, InHouseTeam, PlantUnit } from '@/lib/types';
import { FileDown, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TeamPnlReportProps {
  projects: Project[];
  teams: InHouseTeam[];
  plantUnits: PlantUnit[];
}

interface PnlData {
    projectId: string;
    projectName: string;
    revenue: number;
    expenses: {
        wages: number;
        petrolAndToll: number;
        siteExpenses: number;
        machineryAndUpkeep: number;
        total: number;
    };
    grossProfit: number;
    teamDetails: Map<string, {
        teamName: string;
        revenue: number;
        expenses: { wages: number; petrolAndToll: number; siteExpenses: number; machineryAndUpkeep: number; total: number; };
        grossProfit: number;
    }>;
}
type SortKey = keyof PnlData | 'wages' | 'petrolAndToll' | 'siteExpenses' | 'machineryAndUpkeep' | 'totalExpenses';

export default function TeamPnlReport({ projects, teams, plantUnits }: TeamPnlReportProps) {
    const [expandedProject, setExpandedProject] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
        }).format(amount);
    };
    
    const plantUnitMap = useMemo(() => new Map(plantUnits.map(pu => [pu.id, pu])), [plantUnits]);
    
    const engineeringBoqMap = useMemo(() => {
        const map = new Map();
        projects.forEach(p => {
            (p.engineeringBoq || []).forEach(item => {
                map.set(item.id, item);
            });
        });
        return map;
    }, [projects]);


    const projectPnlData = useMemo(() => {
        const dataMap = new Map<string, PnlData>();
        
        projects.forEach(p => {
            const projectEntry = {
                projectId: p.id,
                projectName: p.name,
                revenue: 0,
                expenses: { wages: 0, petrolAndToll: 0, siteExpenses: 0, machineryAndUpkeep: 0, total: 0 },
                grossProfit: 0,
                teamDetails: new Map(),
            };

            // Calculate revenue and expenses from daily work logs and team costs by teams
            (p.dailyActivities || []).forEach(log => {
                log.work.forEach(w => {
                    if (w.teamId) {
                        let rate = 0;
                        const engBoqItem = engineeringBoqMap.get(w.boqItemId);
                        if (engBoqItem) {
                            rate = engBoqItem.rate;
                        } else {
                            const pu = plantUnitMap.get(w.boqItemId);
                            if (pu) rate = pu.rate;
                        }
                        const workRevenue = w.quantity * rate;
                        projectEntry.revenue += workRevenue;

                        if (!projectEntry.teamDetails.has(w.teamId)) {
                             projectEntry.teamDetails.set(w.teamId, {
                                teamName: teams.find(t => t.id === w.teamId)?.name || 'Unknown Team',
                                revenue: 0,
                                expenses: { wages: 0, petrolAndToll: 0, siteExpenses: 0, machineryAndUpkeep: 0, total: 0 },
                                grossProfit: 0,
                            });
                        }
                        projectEntry.teamDetails.get(w.teamId)!.revenue += workRevenue;
                    }
                });
            });

            (p.teamCosts || []).forEach(c => {
                 if (!projectEntry.teamDetails.has(c.teamId)) {
                    projectEntry.teamDetails.set(c.teamId, {
                        teamName: teams.find(t => t.id === c.teamId)?.name || 'Unknown Team',
                        revenue: 0,
                        expenses: { wages: 0, petrolAndToll: 0, siteExpenses: 0, machineryAndUpkeep: 0, total: 0 },
                        grossProfit: 0,
                    });
                }
                const teamDetail = projectEntry.teamDetails.get(c.teamId)!;
                teamDetail.expenses.wages += c.salary;
                teamDetail.expenses.petrolAndToll += c.petrolAndToll;
                teamDetail.expenses.siteExpenses += c.siteExpenses;
                teamDetail.expenses.machineryAndUpkeep += c.machineryAndUpkeep;
            });
            
            projectEntry.teamDetails.forEach(detail => {
                detail.expenses.total = detail.expenses.wages + detail.expenses.petrolAndToll + detail.expenses.siteExpenses + detail.expenses.machineryAndUpkeep;
                detail.grossProfit = detail.revenue - detail.expenses.total;

                projectEntry.expenses.wages += detail.expenses.wages;
                projectEntry.expenses.petrolAndToll += detail.expenses.petrolAndToll;
                projectEntry.expenses.siteExpenses += detail.expenses.siteExpenses;
                projectEntry.expenses.machineryAndUpkeep += detail.expenses.machineryAndUpkeep;
            });

            if (projectEntry.revenue > 0 || projectEntry.expenses.wages > 0 || projectEntry.expenses.petrolAndToll > 0 || projectEntry.expenses.siteExpenses > 0 || projectEntry.expenses.machineryAndUpkeep > 0) {
                 dataMap.set(p.id, projectEntry);
            }
        });

        return Array.from(dataMap.values())
            .map(entry => {
                entry.expenses.total = entry.expenses.wages + entry.expenses.petrolAndToll + entry.expenses.siteExpenses + entry.expenses.machineryAndUpkeep;
                entry.grossProfit = entry.revenue - entry.expenses.total;
                return entry;
            })
            .filter(d => d.revenue > 0 || d.expenses.total > 0)

    }, [projects, plantUnits, engineeringBoqMap, teams]);
    
    const sortedData = useMemo(() => {
        let sortableItems = [...projectPnlData];
        if (sortConfig) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;
                if (sortConfig.key === 'wages' || sortConfig.key === 'petrolAndToll' || sortConfig.key === 'siteExpenses' || sortConfig.key === 'machineryAndUpkeep') {
                    aValue = a.expenses[sortConfig.key as keyof PnlData['expenses']];
                    bValue = b.expenses[sortConfig.key as keyof PnlData['expenses']];
                } else if (sortConfig.key === 'totalExpenses') {
                    aValue = a.expenses.total;
                    bValue = b.expenses.total;
                } else {
                    aValue = a[sortConfig.key as keyof PnlData];
                    bValue = b[sortConfig.key as keyof PnlData];
                }

                let comparison = 0;
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    comparison = aValue - bValue;
                } else {
                    comparison = String(aValue).localeCompare(String(bValue));
                }
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            });
        }
        return sortableItems;
    }, [projectPnlData, sortConfig]);
    
    const requestSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 inline-block" /> : <ArrowDown className="ml-2 h-4 w-4 inline-block" />;
    };

    const renderHeader = (label: string, sortKey: SortKey, isNumeric = false) => (
        <TableHead rowSpan={label === 'Expenses' ? undefined : 2} colSpan={label === 'Expenses' ? 4 : undefined} className={cn("align-bottom", isNumeric && "text-right", label === 'Expenses' && "text-center border-l")}>
             <Button variant="ghost" className={`w-full p-0 ${isNumeric ? 'justify-end' : 'justify-start'}`} onClick={() => requestSort(sortKey)}>
                {label} {getSortIcon(sortKey)}
            </Button>
        </TableHead>
    );

    const renderSubHeader = (label: string, sortKey: SortKey) => (
        <TableHead className="text-right border-l">
            <Button variant="ghost" className="w-full justify-end p-0" onClick={() => requestSort(sortKey)}>
                {label} {getSortIcon(sortKey)}
            </Button>
        </TableHead>
    )

    const totals = useMemo(() => {
        return projectPnlData.reduce((acc, data) => {
            acc.revenue += data.revenue;
            acc.wages += data.expenses.wages;
            acc.petrolAndToll += data.expenses.petrolAndToll;
            acc.siteExpenses += data.expenses.siteExpenses;
            acc.machineryAndUpkeep += data.expenses.machineryAndUpkeep;
            acc.totalExpenses += data.expenses.total;
            acc.grossProfit += data.grossProfit;
            return acc;
        }, { revenue: 0, wages: 0, petrolAndToll: 0, siteExpenses: 0, machineryAndUpkeep: 0, totalExpenses: 0, grossProfit: 0 });
    }, [projectPnlData]);

    const handleRowClick = (projectName: string) => {
        setExpandedProject(prev => (prev === projectName ? null : projectName));
    };
    
     const handleExportPdf = React.useCallback(async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');

        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text("In-house Team P&L by Project", 14, 15);
        
        const head = [['Project', 'Revenue (RM)', 'Wages (RM)', 'Petrol & Toll (RM)', 'Site Expenses (RM)', 'Machinery/Vehicle (RM)', 'Total Expenses (RM)', 'Gross Profit (RM)']];
        const body = sortedData.map(d => [
            d.projectName,
            formatCurrency(d.revenue),
            formatCurrency(d.expenses.wages),
            formatCurrency(d.expenses.petrolAndToll),
            formatCurrency(d.expenses.siteExpenses),
            formatCurrency(d.expenses.machineryAndUpkeep),
            formatCurrency(d.expenses.total),
            formatCurrency(d.grossProfit),
        ]);
        const foot = [['Total', formatCurrency(totals.revenue), formatCurrency(totals.wages), formatCurrency(totals.petrolAndToll), formatCurrency(totals.siteExpenses), formatCurrency(totals.machineryAndUpkeep), formatCurrency(totals.totalExpenses), formatCurrency(totals.grossProfit)]];

        autoTable(doc, {
            head, body, foot, startY: 30, headStyles: { fillColor: [41, 128, 185], fontSize: 8 }, footStyles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: 0, fontSize: 8 }, bodyStyles: { fontSize: 8 },
            didParseCell: (data) => {
                if (data.column.index > 0) data.cell.styles.halign = 'right';
            }
        });

        doc.save('team_pnl_by_project.pdf');
    }, [sortedData, totals]);


    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Team P&amp;L by Project</CardTitle>
                        <CardDescription>Aggregated in-house team revenue and costs for each project.</CardDescription>
                    </div>
                     <Button variant="outline" size="sm" onClick={handleExportPdf}>
                        <FileDown className="mr-2 h-4 w-4" /> Export PDF
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {renderHeader('Project', 'projectName')}
                                {renderHeader('Revenue', 'revenue', true)}
                                <TableHead colSpan={4} className="text-center border-l">Expenses</TableHead>
                                {renderHeader('Gross Profit', 'grossProfit', true)}
                            </TableRow>
                            <TableRow>
                                {renderSubHeader('Wages/Salary', 'wages')}
                                {renderSubHeader('Petrol & Toll', 'petrolAndToll')}
                                {renderSubHeader('Site Expenses', 'siteExpenses')}
                                {renderSubHeader('Machinery/Vehicle', 'machineryAndUpkeep')}
                            </TableRow>
                        </TableHeader>
                         <TableBody>
                            {sortedData.length > 0 ? (
                                sortedData.map((data) => {
                                    const isExpanded = expandedProject === data.projectName;
                                    return (
                                        <Fragment key={data.projectId}>
                                            <TableRow onClick={() => handleRowClick(data.projectName)} className="cursor-pointer hover:bg-muted/50">
                                                <TableCell className="font-medium">
                                                     <div className="flex items-center gap-2">
                                                        <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                                        {data.projectName}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">{formatCurrency(data.revenue)}</TableCell>
                                                <TableCell className="text-right border-l">{formatCurrency(data.expenses.wages)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(data.expenses.petrolAndToll)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(data.expenses.siteExpenses)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(data.expenses.machineryAndUpkeep)}</TableCell>
                                                <TableCell className={`text-right font-bold border-l ${data.grossProfit < 0 ? 'text-red-500' : ''}`}>{formatCurrency(data.grossProfit)}</TableCell>
                                            </TableRow>
                                            {isExpanded && (
                                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                    <TableCell colSpan={7} className="p-0">
                                                        <div className="p-4">
                                                             <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead className="font-semibold text-foreground">Team</TableHead>
                                                                        <TableHead className="text-right font-semibold text-foreground">Revenue</TableHead>
                                                                        <TableHead className="text-right font-semibold text-foreground">Wages</TableHead>
                                                                        <TableHead className="text-right font-semibold text-foreground">Expenses</TableHead>
                                                                        <TableHead className="text-right font-semibold text-foreground">Gross Profit</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {Array.from(data.teamDetails.values()).map(teamDetail => (
                                                                        <TableRow key={teamDetail.teamName}>
                                                                            <TableCell>{teamDetail.teamName}</TableCell>
                                                                            <TableCell className="text-right">{formatCurrency(teamDetail.revenue)}</TableCell>
                                                                            <TableCell className="text-right">{formatCurrency(teamDetail.expenses.wages)}</TableCell>
                                                                            <TableCell className="text-right">{formatCurrency(teamDetail.expenses.petrolAndToll + teamDetail.expenses.siteExpenses + teamDetail.expenses.machineryAndUpkeep)}</TableCell>
                                                                            <TableCell className={`text-right font-medium ${teamDetail.grossProfit < 0 ? 'text-red-500' : ''}`}>{formatCurrency(teamDetail.grossProfit)}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </Fragment>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No data for selected filters.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                         <TableFooter>
                            <TableRow>
                                <TableCell className="font-bold">Total</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totals.revenue)}</TableCell>
                                <TableCell className="text-right font-bold border-l">{formatCurrency(totals.wages)}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totals.petrolAndToll)}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totals.siteExpenses)}</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(totals.machineryAndUpkeep)}</TableCell>
                                <TableCell className={`text-right font-bold border-l ${totals.grossProfit < 0 ? 'text-red-500' : ''}`}>{formatCurrency(totals.grossProfit)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                 </div>
            </CardContent>
        </Card>
    )
}
