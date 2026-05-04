
'use client';

import type { Project, SiteInstruction } from '@/lib/types';
import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileUp, FileDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

interface ClientFinancialSummary {
    clientName: string;
    poCount: number;
    poValue: number;
    workDoneValue: number;
    physicalProgress: number;
    totalClaimableAmount: number;
    amountInvoiceSubmitted: number;
    amountInvoiceReceived: number;
    amountInvoicePending: number;
    pendingInvoice: number;
}
type SortKey = keyof Omit<ClientFinancialSummary, 'clientName' | 'physicalProgress' | 'pendingInvoice'>;

interface FinancialSummaryByClientProps {
    projects: Project[]; // these should be pre-calculated
}

export default function FinancialSummaryByClient({ projects }: FinancialSummaryByClientProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
    const rowsPerPage = 50;
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: 'MYR',
        }).format(amount);
    };

    const clientSummaries = useMemo(() => {
        const summaryMap = new Map<string, Omit<ClientFinancialSummary, 'clientName' | 'physicalProgress' | 'pendingInvoice'>>();

        projects.forEach(project => {
            let clientData = summaryMap.get(project.client);
            if (!clientData) {
                clientData = {
                    poCount: 0,
                    poValue: 0,
                    workDoneValue: 0,
                    totalClaimableAmount: 0,
                    amountInvoiceSubmitted: 0,
                    amountInvoiceReceived: 0,
                    amountInvoicePending: 0,
                };
                summaryMap.set(project.client, clientData);
            }
            
            const clientPOs = (project.purchaseOrders || []).filter(po => po.type === 'Client');
            clientData.poCount += clientPOs.length;
            
            const totalPoValueForProject = clientPOs.reduce((sum, po) => sum + po.items.reduce((itemSum, item) => itemSum + item.quantity * item.rate + (item.managementFee || 0), 0), 0);
            clientData.poValue += totalPoValueForProject;

            const workDoneForPeriod = (project as any).actualRevenue || 0;
            
            clientData.workDoneValue += workDoneForPeriod;
            clientData.totalClaimableAmount += workDoneForPeriod;
            clientData.amountInvoiceSubmitted += (project.clientClaims || []).reduce((sum, claim) => sum + (claim.amount - (claim.retentionAmount || 0)), 0);
            clientData.amountInvoiceReceived += (project.clientClaims || []).filter(c => c.status === 'Paid').reduce((sum, claim) => sum + (claim.amount - (claim.retentionAmount || 0)), 0);
        });

        return Array.from(summaryMap.entries()).map(([clientName, data]) => {
            const physicalProgress = data.poValue > 0 ? (data.workDoneValue / data.poValue) * 100 : 0;
            const pendingInvoice = data.totalClaimableAmount - data.amountInvoiceSubmitted;
            return {
                clientName,
                ...data,
                amountInvoicePending: data.amountInvoiceSubmitted - data.amountInvoiceReceived,
                physicalProgress,
                pendingInvoice,
            };
        });
    }, [projects]);
    
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
            'Client': s.clientName,
            '# of POs': s.poCount,
            'PO Value (RM)': s.poValue,
            'Work Done Value (RM)': s.workDoneValue,
            'Progress (%)': s.physicalProgress,
            'Claimable (RM)': s.totalClaimableAmount,
            'Invoiced (RM)': s.amountInvoiceSubmitted,
            'Received Payment (RM)': s.amountInvoiceReceived,
            'Pending Received Payment (RM)': s.amountInvoicePending,
            'Pending Invoice (RM)': s.pendingInvoice,
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Client Summary");
        XLSX.writeFile(wb, "Financial_Summary_by_Client.xlsx");
    };


    return (
        <Card>
            <CardHeader>
                 <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Financial Summary by Client</CardTitle>
                        <CardDescription>A financial overview of invoices and payments, aggregated by client.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportExcel}><FileUp className="mr-2 h-4 w-4" /> Excel</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table className="min-w-[1400px]">
                        <TableHeader>
                            <TableRow>
                                {renderHeader('Client', 'clientName')}
                                {renderHeader('# of POs', 'poCount', true)}
                                {renderHeader('PO Value', 'poValue', true)}
                                {renderHeader('Work Done', 'workDoneValue', true)}
                                {renderHeader('Progress', 'physicalProgress')}
                                {renderHeader('Claimable', 'totalClaimableAmount', true)}
                                {renderHeader('Invoiced', 'amountInvoiceSubmitted', true)}
                                {renderHeader('Received Payment', 'amountInvoiceReceived', true)}
                                {renderHeader('Pending Received Payment', 'amountInvoicePending', true)}
                                {renderHeader('Pending Invoice', 'pendingInvoice', true)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedSummaries.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">No data available.</TableCell>
                                </TableRow>
                            ) : (
                                paginatedSummaries.map((p, index) => (
                                    <TableRow key={`${p.clientName}-${index}`}>
                                        <TableCell className="font-medium py-2 px-4 text-xs">{p.clientName}</TableCell>
                                        <TableCell className="text-right py-2 px-4 text-xs">{p.poCount}</TableCell>
                                        <TableCell className="text-right py-2 px-4 text-xs">{formatCurrency(p.poValue)}</TableCell>
                                        <TableCell className="text-right py-2 px-4 text-xs">{formatCurrency(p.workDoneValue)}</TableCell>
                                        <TableCell className="py-2 px-4 text-xs">
                                            <div className="flex items-center gap-2">
                                                <Progress value={p.physicalProgress} className="w-16" />
                                                <span>{p.physicalProgress.toFixed(0)}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-2 px-4 text-xs">{formatCurrency(p.totalClaimableAmount)}</TableCell>
                                        <TableCell className="text-right py-2 px-4 text-xs">{formatCurrency(p.amountInvoiceSubmitted)}</TableCell>
                                        <TableCell className="text-right text-green-600 py-2 px-4 text-xs">{formatCurrency(p.amountInvoiceReceived)}</TableCell>
                                        <TableCell className="text-right text-orange-600 py-2 px-4 text-xs">{formatCurrency(p.amountInvoicePending)}</TableCell>
                                        <TableCell className="text-right text-blue-600 py-2 px-4 text-xs">{formatCurrency(p.pendingInvoice)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
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
