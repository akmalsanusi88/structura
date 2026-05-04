
'use client';

import type { Project } from '@/lib/types';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileUp, ArrowUp, ArrowDown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface SubconSummary {
    subconName: string;
    poAmountIssued: number;
    workDoneValue: number;
    physicalWorkDonePercent: number;
    poCount: number;
    invoiceReceived: number;
    invoicePaid: number;
    pendingPaid: number;
    pendingInvoice: number;
}
type SortKey = keyof SubconSummary;

interface SummaryBySubconProps {
    projects: Project[];
}

export default function SummaryBySubcon({ projects }: SummaryBySubconProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
    const rowsPerPage = 25;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
        }).format(amount);
    };

    const subconSummaries = useMemo(() => {
        const summaryMap = new Map<string, Omit<SubconSummary, 'subconName' | 'physicalWorkDonePercent' | 'pendingPaid' | 'pendingInvoice'>>();
        
        projects.forEach(project => {
            const subconPOs = (project.purchaseOrders || []).filter(po => po.type === 'Subcontractor');
            subconPOs.forEach(po => {
                const subconName = po.issuer;
                
                let subconData = summaryMap.get(subconName);
                if (!subconData) {
                    subconData = { poAmountIssued: 0, workDoneValue: 0, poCount: 0, invoiceReceived: 0, invoicePaid: 0 };
                    summaryMap.set(subconName, subconData);
                }
                
                subconData.poCount++;
                const poValue = po.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
                subconData.poAmountIssued += poValue;

                const workDoneValue = (project.dailyActivities || []).reduce((sum, log) => {
                    return sum + log.work.filter(w => po.items.some(item => item.id === w.boqItemId)).reduce((workSum, work) => {
                        const item = po.items.find(i => i.id === work.boqItemId);
                        return workSum + (work.quantity * (item?.rate || 0));
                    }, 0);
                }, 0);
                subconData.workDoneValue += workDoneValue;

                const claimsForPo = (project.subconClaims || []).filter(c => c.purchaseOrderId === po.id);
                claimsForPo.forEach(claim => {
                    const netClaimAmount = claim.amount - (claim.retentionAmount || 0);
                    subconData.invoiceReceived += netClaimAmount;
                    if (claim.status === 'Paid') {
                        subconData.invoicePaid += netClaimAmount;
                    }
                });
            });
        });
        
        return Array.from(summaryMap.entries()).map(([subconName, data]) => {
            const physicalWorkDonePercent = data.poAmountIssued > 0 ? (data.workDoneValue / data.poAmountIssued) * 100 : 0;
            const pendingPaid = data.invoiceReceived - data.invoicePaid;
            const pendingInvoice = data.workDoneValue - data.invoiceReceived;
            return { 
                subconName, 
                ...data,
                physicalWorkDonePercent,
                pendingPaid,
                pendingInvoice
            };
        });

    }, [projects]);
    
    const totals = useMemo(() => {
        return subconSummaries.reduce((acc, s) => {
            acc.poAmountIssued += s.poAmountIssued;
            acc.workDoneValue += s.workDoneValue;
            acc.poCount += s.poCount;
            acc.invoiceReceived += s.invoiceReceived;
            acc.invoicePaid += s.invoicePaid;
            acc.pendingPaid += s.pendingPaid;
            acc.pendingInvoice += s.pendingInvoice;
            return acc;
        }, {
            poAmountIssued: 0,
            workDoneValue: 0,
            poCount: 0,
            invoiceReceived: 0,
            invoicePaid: 0,
            pendingPaid: 0,
            pendingInvoice: 0,
        });
    }, [subconSummaries]);

    const sortedSummaries = useMemo(() => {
        let sortableItems = [...subconSummaries];
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
    }, [subconSummaries, sortConfig]);
    
    const totalPages = Math.ceil(sortedSummaries.length / rowsPerPage);
    const paginatedData = sortedSummaries.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(totalPages, page)));
    
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
            'Subcontractor': s.subconName,
            'PO Amount Issued (RM)': s.poAmountIssued,
            'Work Done Value (RM)': s.workDoneValue,
            '% Done': `${s.physicalWorkDonePercent.toFixed(2)}%`,
            '# of POs': s.poCount,
            'Invoice Received (RM)': s.invoiceReceived,
            'Invoice Paid (RM)': s.invoicePaid,
            'Pending Paid (RM)': s.pendingPaid,
            'Pending Invoice (RM)': s.pendingInvoice,
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Subcon Summary");
        XLSX.writeFile(wb, "Summary_by_Subcontractor.xlsx");
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Summary by Subcontractor</CardTitle>
                        <CardDescription>Aggregated financial summary for each subcontractor across all projects.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExportExcel}><FileUp className="mr-2 h-4 w-4" /> Excel</Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table className="min-w-[1200px]">
                        <TableHeader>
                            <TableRow>
                                {renderHeader('Subcontractor', 'subconName')}
                                {renderHeader('PO Amount Issued', 'poAmountIssued', true)}
                                {renderHeader('Work Done Value', 'workDoneValue', true)}
                                {renderHeader('% Done', 'physicalWorkDonePercent')}
                                {renderHeader('# of POs', 'poCount', true)}
                                {renderHeader('Invoice Received', 'invoiceReceived', true)}
                                {renderHeader('Invoice Paid', 'invoicePaid', true)}
                                {renderHeader('Pending Paid', 'pendingPaid', true)}
                                {renderHeader('Pending Invoice', 'pendingInvoice', true)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedData.map(summary => (
                                <TableRow key={summary.subconName}>
                                    <TableCell className="font-medium py-2 px-4">{summary.subconName}</TableCell>
                                    <TableCell className="text-right py-2 px-4">{formatCurrency(summary.poAmountIssued)}</TableCell>
                                    <TableCell className="text-right py-2 px-4">{formatCurrency(summary.workDoneValue)}</TableCell>
                                    <TableCell className="py-2 px-4">
                                        <div className="flex items-center gap-2">
                                            <Progress value={summary.physicalWorkDonePercent} className="w-16" />
                                            <span>{summary.physicalWorkDonePercent.toFixed(0)}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right py-2 px-4">{summary.poCount}</TableCell>
                                    <TableCell className="text-right py-2 px-4">{formatCurrency(summary.invoiceReceived)}</TableCell>
                                    <TableCell className="text-right text-green-600 py-2 px-4">{formatCurrency(summary.invoicePaid)}</TableCell>
                                    <TableCell className="text-right text-orange-600 py-2 px-4">{formatCurrency(summary.pendingPaid)}</TableCell>
                                    <TableCell className="text-right text-blue-600 py-2 px-4">{formatCurrency(summary.pendingInvoice)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                         <TableFooter>
                            <TableRow>
                                <TableCell className='font-bold'>Total</TableCell>
                                <TableCell className='text-right font-bold'>{formatCurrency(totals.poAmountIssued)}</TableCell>
                                <TableCell className='text-right font-bold'>{formatCurrency(totals.workDoneValue)}</TableCell>
                                <TableCell></TableCell>
                                <TableCell className='text-right font-bold'>{totals.poCount}</TableCell>
                                <TableCell className='text-right font-bold'>{formatCurrency(totals.invoiceReceived)}</TableCell>
                                <TableCell className='text-right font-bold text-green-600'>{formatCurrency(totals.invoicePaid)}</TableCell>
                                <TableCell className='text-right font-bold text-orange-600'>{formatCurrency(totals.pendingPaid)}</TableCell>
                                <TableCell className='text-right font-bold text-blue-600'>{formatCurrency(totals.pendingInvoice)}</TableCell>
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
                        <Button variant="outline" size="sm" onClick={() => goToPage(1)} disabled={currentPage === 1}>First</Button>
                        <Button variant="outline" size="sm" onClick={() => goToPage(currentPage-1)} disabled={currentPage === 1}>Previous</Button>
                        <Button variant="outline" size="sm" onClick={() => goToPage(currentPage+1)} disabled={currentPage >= totalPages}>Next</Button>
                        <Button variant="outline" size="sm" onClick={() => goToPage(totalPages)} disabled={currentPage >= totalPages}>Last</Button>
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
}

