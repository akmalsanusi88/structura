
'use client';

import type { Project, PlantUnit } from '@/lib/types';
import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileUp, FileDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ClientSummary {
    clientName: string;
    poCount: number;
    poValue: number;
    workDoneValue: number;
    subconWorkDoneValue: number;
    materialCost: number;
    grossProfit: number;
    margin: number;
}
type SortKey = keyof ClientSummary;

interface ProjectSummaryByClientProps {
    projects: Project[];
    plantUnits: PlantUnit[];
}

export default function ProjectSummaryByClient({ projects, plantUnits }: ProjectSummaryByClientProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
    const rowsPerPage = 10;
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
        }).format(amount);
    };

    const plantUnitMap = useMemo(() => new Map(plantUnits.map(pu => [pu.id, pu])), [plantUnits]);

    const clientSummaries = useMemo(() => {
        const summaryMap = new Map<string, Omit<ClientSummary, 'clientName' | 'margin'>>();
        
        projects.forEach(project => {
            let clientData = summaryMap.get(project.client);
            if (!clientData) {
                clientData = {
                    poCount: 0,
                    poValue: 0,
                    workDoneValue: 0,
                    subconWorkDoneValue: 0,
                    materialCost: 0,
                    grossProfit: 0,
                };
                summaryMap.set(project.client, clientData);
            }
            
            const clientPOs = (project.purchaseOrders || []).filter(po => po.type === 'Client');
            clientData.poCount += clientPOs.length;
            clientData.poValue += clientPOs.reduce((sum, po) => sum + po.items.reduce((itemSum, item) => itemSum + item.quantity * item.rate + (item.managementFee || 0), 0), 0);
            
            clientData.workDoneValue += (project as any).actualRevenue || 0;
            
            const subconPoItems = (project.purchaseOrders || []).filter(po => po.type === 'Subcontractor').flatMap(po => po.items);
            const subconPoItemMap = new Map(subconPoItems.map(item => [item.id, item]));
            clientData.subconWorkDoneValue += project.dailyActivities?.reduce((total, log) => {
                return total + log.work.reduce((dayTotal, workRecord) => {
                    const poItem = subconPoItemMap.get(workRecord.boqItemId);
                    if (poItem) {
                        return dayTotal + (workRecord.quantity * (poItem?.rate || 0));
                    }
                    return dayTotal;
                }, 0);
            }, 0) || 0;

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
                clientData.materialCost += usedQty * rate;
            });
        });
        
        return Array.from(summaryMap.entries()).map(([clientName, data]) => {
            const grossProfit = data.workDoneValue - data.subconWorkDoneValue - data.materialCost;
            const margin = data.workDoneValue > 0 ? (grossProfit / data.workDoneValue) * 100 : 0;
            return {
                clientName,
                ...data,
                grossProfit,
                margin
            };
        });

    }, [projects, plantUnitMap]);
    
    const totals = useMemo(() => {
        return clientSummaries.reduce((acc, summary) => {
            acc.poCount += summary.poCount;
            acc.poValue += summary.poValue;
            acc.workDoneValue += summary.workDoneValue;
            acc.subconWorkDoneValue += summary.subconWorkDoneValue;
            acc.materialCost += summary.materialCost;
            acc.grossProfit += summary.grossProfit;
            return acc;
        }, {
            poCount: 0,
            poValue: 0,
            workDoneValue: 0,
            subconWorkDoneValue: 0,
            materialCost: 0,
            grossProfit: 0,
        });
    }, [clientSummaries]);
    
    const sortedSummaries = useMemo(() => {
        let sortableItems = [...clientSummaries];
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
    }, [clientSummaries, sortConfig]);

    const totalPages = Math.ceil(sortedSummaries.length / rowsPerPage);
    const paginatedSummaries = sortedSummaries.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(totalPages, page)));
    const handleNextPage = () => goToPage(currentPage + 1);
    const handlePrevPage = () => goToPage(currentPage - 1);
    const goToFirstPage = () => setCurrentPage(1);
    const goToLastPage = () => goToPage(totalPages);

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

    const renderHeader = (label: string, sortKey: SortKey, isNumeric = false) => (
        <TableHead className={isNumeric ? "text-right" : ""}>
            <Button variant="ghost" className={`w-full p-0 ${isNumeric ? 'justify-end' : 'justify-start'}`} onClick={() => requestSort(sortKey)}>
                {label} {getSortIcon(sortKey)}
            </Button>
        </TableHead>
    );

    const handleExportExcel = async () => {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const data = sortedSummaries.map(s => ({
            'Client': s.clientName,
            '# of POs': s.poCount,
            'PO Value (RM)': s.poValue,
            'Work Done Value (RM)': s.workDoneValue,
            'Subcon Work Done (RM)': s.subconWorkDoneValue,
            'Material Cost (RM)': s.materialCost,
            'Gross Profit (RM)': s.grossProfit,
            'Margin (%)': s.margin,
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Client Summary");
        XLSX.writeFile(wb, "Project_Summary_by_Client.xlsx");
    };

    const handleExportPdf = async () => {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text("Project Summary by Client", 14, 15);
        autoTable(doc, {
            head: [['Client', '# POs', 'PO Value', 'Work Done', 'Subcon Cost', 'Material Cost', 'Profit', 'Margin %']],
            body: sortedSummaries.map(s => [
                s.clientName,
                s.poCount,
                formatCurrency(s.poValue),
                formatCurrency(s.workDoneValue),
                formatCurrency(s.subconWorkDoneValue),
                formatCurrency(s.materialCost),
                formatCurrency(s.grossProfit),
                `${s.margin.toFixed(2)}%`,
            ]),
            startY: 20,
            headStyles: { fillColor: [41, 128, 185] },
            didParseCell: (data) => {
                 if (data.column.index > 0) {
                    data.cell.styles.halign = 'right';
                 }
                 if (data.column.index === 0) {
                    data.cell.styles.halign = 'left';
                 }
            }
        });
        doc.save("Project_Summary_by_Client.pdf");
    };


    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Summary Projects by Client</CardTitle>
                        <CardDescription>Aggregated project financial summary by client.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportExcel}><FileUp className="mr-2 h-4 w-4" /> Excel</Button>
                        <Button variant="outline" size="sm" onClick={handleExportPdf}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table className="min-w-[1200px]">
                        <TableHeader>
                            <TableRow>
                                {renderHeader('Client', 'clientName')}
                                {renderHeader('# of POs', 'poCount', true)}
                                {renderHeader('PO Value', 'poValue', true)}
                                {renderHeader('Work Done Value', 'workDoneValue', true)}
                                {renderHeader('Subcon Work Done', 'subconWorkDoneValue', true)}
                                {renderHeader('Material Cost', 'materialCost', true)}
                                {renderHeader('Gross Profit', 'grossProfit', true)}
                                {renderHeader('Margin %', 'margin', true)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedSummaries.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No data available.</TableCell>
                                </TableRow>
                            ) : (
                                paginatedSummaries.map(summary => (
                                    <TableRow key={summary.clientName}>
                                        <TableCell className="font-medium py-2 px-4">{summary.clientName}</TableCell>
                                        <TableCell className="text-right py-2 px-4">{summary.poCount}</TableCell>
                                        <TableCell className="text-right py-2 px-4">{formatCurrency(summary.poValue)}</TableCell>
                                        <TableCell className="text-right py-2 px-4">{formatCurrency(summary.workDoneValue)}</TableCell>
                                        <TableCell className="text-right py-2 px-4">{formatCurrency(summary.subconWorkDoneValue)}</TableCell>
                                        <TableCell className="text-right py-2 px-4">{formatCurrency(summary.materialCost)}</TableCell>
                                        <TableCell className={`text-right font-bold py-2 px-4 ${summary.grossProfit < 0 ? 'text-red-500' : ''}`}>{formatCurrency(summary.grossProfit)}</TableCell>
                                        <TableCell className={`text-right font-bold py-2 px-4 ${summary.margin < 0 ? 'text-red-500' : ''}`}>{summary.margin.toFixed(1)}%</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell className='font-bold'>Total</TableCell>
                                <TableCell className='text-right font-bold'>{totals.poCount}</TableCell>
                                <TableCell className='text-right font-bold'>{formatCurrency(totals.poValue)}</TableCell>
                                <TableCell className='text-right font-bold'>{formatCurrency(totals.workDoneValue)}</TableCell>
                                <TableCell className='text-right font-bold'>{formatCurrency(totals.subconWorkDoneValue)}</TableCell>
                                <TableCell className='text-right font-bold'>{formatCurrency(totals.materialCost)}</TableCell>
                                <TableCell className={`text-right font-bold ${totals.grossProfit < 0 ? 'text-red-500' : ''}`}>{formatCurrency(totals.grossProfit)}</TableCell>
                                <TableCell />
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
             <CardFooter className="py-4">
                <div className="flex items-center justify-end w-full space-x-4">
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages > 0 ? totalPages : 1}
                    </span>
                    <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={goToFirstPage} disabled={currentPage === 1}>
                            First
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
                            Previous
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage >= totalPages}>
                            Next
                        </Button>
                        <Button variant="outline" size="sm" onClick={goToLastPage} disabled={currentPage >= totalPages}>
                            Last
                        </Button>
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
}
