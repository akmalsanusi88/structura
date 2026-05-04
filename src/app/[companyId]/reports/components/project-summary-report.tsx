
'use client';

import type { Project, PlantUnit } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileUp, FileDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ProjectSummaryData {
    projectId: string;
    projectName: string;
    client: string;
    poCount: number;
    poValue: number;
    workDoneValue: number;
    progress: number;
    subconWorkDoneValue: number;
    materialUsage: number;
    grossProfit: number;
    margin: number;
    hasFinalClaim: boolean;
}
type SortKey = keyof ProjectSummaryData;

interface ProjectSummaryReportProps {
    projects: Project[];
    plantUnits: PlantUnit[];
}

export default function ProjectSummaryReport({ projects, plantUnits }: ProjectSummaryReportProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
    const rowsPerPage = 50;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    };
    
    const plantUnitMap = useMemo(() => new Map(plantUnits.map(pu => [pu.id, pu])), [plantUnits]);

    const projectSummaryData = useMemo(() => {
        return projects.map(project => {
            const clientPOs = (project.purchaseOrders || []).filter(po => po.type === 'Client');
            const poCount = clientPOs.length;
            const poValue = clientPOs.reduce((sum, po) => sum + po.items.reduce((itemSum, item) => itemSum + item.quantity * item.rate + (item.managementFee || 0), 0), 0);
            
            const workDoneValue = (project as any).actualRevenue || 0;
            const hasFinalClaim = (project.clientClaims || []).some(claim => claim.isFinal || claim.claimNo?.toLowerCase().includes('retention'));
            
            let progress = poValue > 0 ? (workDoneValue / poValue) * 100 : 0;
            if (hasFinalClaim) {
                progress = 100;
            }
            
            // Subcon work done
            const subconPoItems = (project.purchaseOrders || []).filter(po => po.type === 'Subcontractor').flatMap(po => po.items);
            const subconPoItemMap = new Map(subconPoItems.map(item => [item.id, item]));
            const subconWorkDoneValue = project.dailyActivities?.reduce((total, log) => {
                return total + log.work.reduce((dayTotal, workRecord) => {
                    const poItem = subconPoItemMap.get(workRecord.boqItemId);
                    if (poItem) {
                        return dayTotal + (workRecord.quantity * (poItem?.rate || 0));
                    }
                    return dayTotal;
                }, 0);
            }, 0) || 0;

            // Material Usage
            let materialUsage = 0;
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
             materialSummaryMap.forEach((data, sourceId) => {
                const usedQty = data.issuedQty - data.returnedQty;
                const boqItem = project.materialBoq?.find(bi => bi.id === sourceId);
                const rate = boqItem?.rate || plantUnitMap.get(sourceId)?.rate || 0;
                materialUsage += usedQty * rate;
            });

            const grossProfit = workDoneValue - subconWorkDoneValue - materialUsage;
            const margin = workDoneValue > 0 ? (grossProfit / workDoneValue) * 100 : 0;

            return {
                projectId: project.id,
                projectName: project.name,
                client: project.client,
                poCount,
                poValue,
                workDoneValue,
                progress,
                subconWorkDoneValue,
                materialUsage,
                grossProfit,
                margin,
                hasFinalClaim
            };
        });
    }, [projects, plantUnitMap]);

    const sortedProjects = useMemo(() => {
        let sortableItems = [...projectSummaryData];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
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
    }, [projectSummaryData, sortConfig]);

    const totalPages = Math.ceil(sortedProjects.length / rowsPerPage);
    const paginatedProjects = sortedProjects.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(totalPages, page)));
    const handleNextPage = () => goToPage(currentPage + 1);
    const handlePrevPage = () => goToPage(currentPage - 1);

    const requestSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
    };

    const renderHeader = (label: string, sortKey: SortKey, className?: string) => (
        <TableHead className={className}>
            <Button variant="ghost" className="w-full justify-start p-0" onClick={() => requestSort(sortKey)}>
                {label} {getSortIcon(sortKey)}
            </Button>
        </TableHead>
    );

    const renderNumericHeader = (label: string, sortKey: SortKey, className?: string) => (
        <TableHead className={className}>
            <Button variant="ghost" className="w-full justify-end p-0" onClick={() => requestSort(sortKey)}>
                {label} {getSortIcon(sortKey)}
            </Button>
        </TableHead>
    );
    
    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        const data = sortedProjects.map(p => ({
            'Client': p.client,
            'Project Name': p.projectName,
            'Status': p.hasFinalClaim ? 'Final Claimed' : '',
            'No of PO': p.poCount,
            'PO Value (RM)': p.poValue,
            'Work Done Value (RM)': p.workDoneValue,
            '% Done': p.progress,
            'Subcon Work Done (RM)': p.subconWorkDoneValue,
            'Material Usage (RM)': p.materialUsage,
            'Gross Profit (RM)': p.grossProfit,
            'Margin (%)': p.margin,
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        
        XLSX.utils.book_append_sheet(wb, ws, "Project Summary");
        XLSX.writeFile(wb, "Project_Summary.xlsx");
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Project Summary Report</CardTitle>
                        <CardDescription>High-level financial overview of all projects.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExportExcel}><FileUp className="mr-2 h-4 w-4" /> Excel</Button>
                </div>
            </CardHeader>
            <CardContent>
                 <div className="overflow-x-auto">
                    <Table className="min-w-[1400px]">
                        <TableHeader>
                            <TableRow>
                                {renderHeader('Client', 'client', 'w-[150px]')}
                                {renderHeader('Project Name', 'projectName', 'w-[40%]')}
                                {renderNumericHeader('# of POs', 'poCount', 'text-right min-w-[120px]')}
                                {renderNumericHeader('PO Value', 'poValue', 'text-right min-w-[120px]')}
                                {renderNumericHeader('Work Done Value', 'workDoneValue', 'text-right min-w-[120px]')}
                                {renderNumericHeader('% Done', 'progress', 'text-right min-w-[120px]')}
                                {renderNumericHeader('Subcon Work Done', 'subconWorkDoneValue', 'text-right min-w-[120px]')}
                                {renderNumericHeader('Material Usage', 'materialUsage', 'text-right min-w-[120px]')}
                                {renderNumericHeader('Gross Profit', 'grossProfit', 'text-right min-w-[120px]')}
                                {renderNumericHeader('Margin', 'margin', 'text-right min-w-[120px]')}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedProjects.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">No projects found.</TableCell>
                                </TableRow>
                            ) : (
                                paginatedProjects.map(p => (
                                    <TableRow key={p.projectId} className={cn(p.hasFinalClaim && 'bg-green-50/50 dark:bg-green-900/10')}>
                                        <TableCell className="py-2 px-4 text-xs">{p.client}</TableCell>
                                        <TableCell className="font-medium py-2 px-4 text-xs">
                                            {p.projectName}
                                        </TableCell>
                                        <TableCell className="text-right py-2 px-4 text-xs">{p.poCount}</TableCell>
                                        <TableCell className="text-right py-2 px-4 text-xs">{formatCurrency(p.poValue)}</TableCell>
                                        <TableCell className="text-right py-2 px-4 text-xs">{formatCurrency(p.workDoneValue)}</TableCell>
                                        <TableCell className="py-2 px-4 text-xs text-right">
                                            <div className="flex items-center gap-2 justify-end">
                                                <Progress value={p.progress} className="w-16" />
                                                <span>{p.progress.toFixed(0)}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-2 px-4 text-xs">{formatCurrency(p.subconWorkDoneValue)}</TableCell>
                                        <TableCell className="text-right py-2 px-4 text-xs">{formatCurrency(p.materialUsage)}</TableCell>
                                        <TableCell className={`text-right font-bold py-2 px-4 text-xs ${p.grossProfit < 0 ? 'text-red-500' : ''}`}>{formatCurrency(p.grossProfit)}</TableCell>
                                        <TableCell className={`text-right font-bold py-2 px-4 text-xs ${p.margin < 0 ? 'text-red-500' : ''}`}>{p.margin.toFixed(1)}%</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter>
                 <div className="flex items-center justify-end w-full space-x-4">
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages > 0 ? totalPages : 1}
                    </span>
                    <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => goToPage(1)} disabled={currentPage === 1}>
                            First
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
                            Previous
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => goToPage(currentPage+1)} disabled={currentPage >= totalPages}>
                            Next
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => goToPage(totalPages)} disabled={currentPage >= totalPages}>
                            Last
                        </Button>
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
}
